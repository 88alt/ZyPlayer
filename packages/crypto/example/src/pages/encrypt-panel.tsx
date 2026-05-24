import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { aes, des, tripleDes, rsa, rc4, rc4Drop, rabbit, rabbitLegacy, sm4 } from '@zy/crypto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { type TranslationKey, useI18n } from '@/i18n';

type MethodOptions = Record<string, unknown>;
type CryptoMethod = { encode: unknown; decode: unknown };

const METHOD_MAP: Record<string, CryptoMethod> = {
  rsa,
  rc4,
  rc4Drop,
  aes,
  des,
  tripleDes,
  rabbit,
  rabbitLegacy,
  sm4,
};

const ENCODE_OPTIONS = [
  { value: 'utf8', label: 'UTF-8' },
  { value: 'base64', label: 'Base64' },
  { value: 'hex', label: 'Hex' },
];

type Translate = (key: TranslationKey) => string;

const getModeOptions = (algorithm: string, t: Translate) => {
  switch (algorithm) {
    case 'rsa':
      return [
        { value: '0', label: t('option.standardPublicPrivate') },
        { value: '1', label: t('option.nonstandardPrivatePublic') },
      ];
    case 'sm4':
      return [
        { value: 'cbc', label: 'CBC' },
        { value: 'ecb', label: 'ECB' },
        { value: 'gcm', label: 'GCM' },
      ];
    case 'aes':
      return [
        { value: 'cbc', label: 'CBC' },
        { value: 'cfb', label: 'CFB' },
        { value: 'ofb', label: 'OFB' },
        { value: 'ctr', label: 'CTR' },
        { value: 'ecb', label: 'ECB' },
        { value: 'gcm', label: 'GCM' },
      ];
    default:
      return [
        { value: 'cbc', label: 'CBC' },
        { value: 'cfb', label: 'CFB' },
        { value: 'ofb', label: 'OFB' },
        { value: 'ctr', label: 'CTR' },
        { value: 'ecb', label: 'ECB' },
      ];
  }
};

const getLongOptions = (algorithm: string, t: Translate) => {
  if (algorithm === 'rsa') {
    return [
      { value: '0', label: t('option.standard') },
      { value: '1', label: t('option.longText') },
    ];
  }
  return [];
};

const getPadOptions = (algorithm: string) => {
  switch (algorithm) {
    case 'rsa':
      return [
        { value: 'rsa-oaep', label: 'RSA-OAEP' },
        { value: 'rsaes-pkcs1-v1_5', label: 'RSAES-PKCS1' },
      ];
    case 'sm4':
      return [
        { value: 'Pkcs7Padding', label: 'PKCS7' },
        { value: 'NoPadding', label: 'No Padding' },
      ];
    default:
      return [
        { value: 'Pkcs7Padding', label: 'PKCS7' },
        { value: 'AnsiX923', label: 'AnsiX923' },
        { value: 'Iso10126', label: 'Iso10126' },
        { value: 'Iso97971', label: 'Iso97971' },
        { value: 'ZeroPadding', label: 'Zero Padding' },
        { value: 'NoPadding', label: 'No Padding' },
      ];
  }
};

interface EncryptPanelProps {
  algorithm: string;
}

export function EncryptPanel({ algorithm }: EncryptPanelProps) {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [key, setKey] = useState('');
  const [keyEncode, setKeyEncode] = useState('utf8');
  const [passphrase, setPassphrase] = useState('');
  const [passphraseEncode, setPassphraseEncode] = useState('utf8');
  const [iv, setIv] = useState('');
  const [ivEncode, setIvEncode] = useState('utf8');
  const [mode, setMode] = useState('0');
  const [long, setLong] = useState('0');
  const [pad, setPad] = useState('rsa-oaep');
  const [drop, setDrop] = useState(192);
  const [tag, setTag] = useState('');
  const [tagEncode, setTagEncode] = useState('hex');
  const [aad, setAad] = useState('');
  const [aadEncode, setAadEncode] = useState('utf8');
  const [inputEncode, setInputEncode] = useState('utf8');
  const [outputEncode, setOutputEncode] = useState('base64');
  const [output, setOutput] = useState('');

  // Reset mode/pad when algorithm changes
  useEffect(() => {
    setOutput('');
    const modes = getModeOptions(algorithm, t);
    if (!modes.some((m) => m.value === mode)) {
      setMode(modes[0].value);
    }
    const pads = getPadOptions(algorithm);
    if (!pads.some((p) => p.value === pad)) {
      setPad(pads[0].value);
    }
  }, [algorithm, mode, pad, t]);

  const showIv = !['rsa', 'rc4', 'rc4Drop'].includes(algorithm);
  const showMode = !['rc4', 'rc4Drop', 'rabbit', 'rabbitLegacy'].includes(algorithm);
  const showLong = algorithm === 'rsa' && mode === '0';
  const showPad =
    showMode &&
    ((['aes', 'des', 'tripleDes', 'sm4'].includes(algorithm) && ['cbc', 'ecb'].includes(mode)) ||
      (algorithm === 'rsa' && ['0', '1'].includes(mode)));
  const showDrop = algorithm === 'rc4Drop';
  const showTagAad = ['aes', 'sm4'].includes(algorithm) && mode === 'gcm';
  const isRsa = algorithm === 'rsa';

  const handleExecute = useCallback(
    (action: 'encode' | 'decode') => {
      if (!input) return;
      try {
        if (outputEncode === 'utf8' && action === 'encode') {
          toast.warning(t('toast.encryptUtf8OutputUnsupported'));
          return;
        }
        if (inputEncode === 'utf8' && action === 'decode') {
          toast.warning(t('toast.decodeUtf8InputUnsupported'));
          return;
        }

        if (isRsa && long === '1') {
          toast.warning(t('toast.longTextWarning'));
        }

        let params: MethodOptions = { src: input, inputEncode, outputEncode };

        if (isRsa) {
          params = { ...params, key, pad, passphrase, passphraseEncode, type: Number(mode), long: long === '1' };
        } else if (algorithm === 'rc4') {
          params = { ...params, key, keyEncode };
        } else if (algorithm === 'rc4Drop') {
          params = { ...params, key, keyEncode, drop };
        } else if (algorithm === 'aes' || algorithm === 'sm4') {
          params = { ...params, key, keyEncode, iv, ivEncode, mode, pad, tag, tagEncode, aad, aadEncode };
        } else if (algorithm === 'rabbit' || algorithm === 'rabbitLegacy') {
          params = { ...params, key, keyEncode, iv, ivEncode };
        } else {
          params = { ...params, key, keyEncode, iv, ivEncode, mode, pad };
        }

        const method = METHOD_MAP[algorithm][action] as (opts: MethodOptions) => string;
        const result = method(params);
        setOutput(result);
        toast.success(t('toast.success'));
      } catch (error) {
        setOutput('');
        toast.error(`${t('toast.errorPrefix')}: ${(error as Error).message}`);
      }
    },
    [
      algorithm,
      input,
      key,
      keyEncode,
      passphrase,
      passphraseEncode,
      iv,
      ivEncode,
      mode,
      long,
      pad,
      drop,
      tag,
      tagEncode,
      aad,
      aadEncode,
      inputEncode,
      outputEncode,
      isRsa,
      t,
    ],
  );

  const handleCopy = useCallback(
    async (text: string) => {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        toast.success(t('toast.copied'));
      } catch (error) {
        toast.error(`${t('toast.errorPrefix')}: ${(error as Error).message}`);
      }
    },
    [t],
  );

  const renderEncodingSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-24 shrink-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ENCODE_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const renderTabs = (options: { value: string; label: string }[], value: string, onChange: (v: string) => void) => (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList>
        {options.map((opt) => (
          <TabsTrigger key={opt.value} value={opt.value}>
            {opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Input */}
      <div className="flex flex-col gap-2">
        <Label>{t('field.content')}</Label>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('placeholder.text')}
          rows={4}
        />
      </div>

      {/* Key */}
      <div className="flex flex-col gap-2">
        <Label>{t('field.key')}</Label>
        {isRsa ? (
          <Textarea
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={t('placeholder.pemKey')}
            rows={4}
          />
        ) : (
          <div className="flex gap-2">
            {renderEncodingSelect(keyEncode, setKeyEncode)}
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={t('placeholder.key')}
              className="flex-1"
            />
          </div>
        )}
      </div>

      {/* Passphrase (RSA only) */}
      {isRsa && (
        <div className="flex flex-col gap-2">
          <Label>{t('field.passphrase')}</Label>
          <div className="flex gap-2">
            {renderEncodingSelect(passphraseEncode, setPassphraseEncode)}
            <Input
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder={t('placeholder.passphrase')}
              className="flex-1"
            />
          </div>
        </div>
      )}

      {/* IV */}
      {showIv && (
        <div className="flex flex-col gap-2">
          <Label>{t('field.iv')}</Label>
          <div className="flex gap-2">
            {renderEncodingSelect(ivEncode, setIvEncode)}
            <Input
              value={iv}
              onChange={(e) => setIv(e.target.value)}
              placeholder={t('placeholder.iv')}
              className="flex-1"
            />
          </div>
        </div>
      )}

      {/* Mode */}
      {showMode && (
        <div className="flex flex-col gap-2">
          <Label>{t('field.mode')}</Label>
          {renderTabs(getModeOptions(algorithm, t), mode, setMode)}
        </div>
      )}

      {/* Long */}
      {showLong && (
        <div className="flex flex-col gap-2">
          <Label>{t('field.longText')}</Label>
          {renderTabs(getLongOptions(algorithm, t), long, setLong)}
        </div>
      )}

      {/* Padding */}
      {showPad && (
        <div className="flex flex-col gap-2">
          <Label>{t('field.padding')}</Label>
          {renderTabs(getPadOptions(algorithm), pad, setPad)}
        </div>
      )}

      {/* Drop (RC4-Drop only) */}
      {showDrop && (
        <div className="flex flex-col gap-2">
          <Label>{t('field.drop')}</Label>
          <Input
            type="number"
            value={drop}
            onChange={(e) => setDrop(Number(e.target.value))}
            min={0}
            className="w-32"
          />
        </div>
      )}

      {/* Tag (GCM mode) */}
      {showTagAad && (
        <>
          <div className="flex flex-col gap-2">
            <Label>{t('field.tag')}</Label>
            <div className="flex gap-2">
              {renderEncodingSelect(tagEncode, setTagEncode)}
              <Input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder={t('placeholder.tag')}
                className="flex-1"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t('field.aad')}</Label>
            <div className="flex gap-2">
              {renderEncodingSelect(aadEncode, setAadEncode)}
              <Input
                value={aad}
                onChange={(e) => setAad(e.target.value)}
                placeholder={t('placeholder.aad')}
                className="flex-1"
              />
            </div>
          </div>
        </>
      )}

      {/* Input Encoding */}
      <div className="flex flex-col gap-2">
        <Label>{t('field.inputEncoding')}</Label>
        {renderTabs(ENCODE_OPTIONS, inputEncode, setInputEncode)}
      </div>

      {/* Output Encoding */}
      <div className="flex flex-col gap-2">
        <Label>{t('field.outputEncoding')}</Label>
        {renderTabs(ENCODE_OPTIONS, outputEncode, setOutputEncode)}
      </div>

      {/* Action */}
      <div className="flex flex-col gap-2">
        <Label>{t('field.action')}</Label>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExecute('encode')} className="flex-1">
            {t('action.encode')}
          </Button>
          <Button onClick={() => handleExecute('decode')} className="flex-1">
            {t('action.decode')}
          </Button>
        </div>
      </div>

      {/* Output */}
      <div className="flex flex-col gap-2">
        <Label>{t('field.output')}</Label>
        <Textarea
          value={output}
          readOnly
          placeholder={t('placeholder.output')}
          rows={4}
          className="cursor-pointer"
          onClick={() => handleCopy(output)}
        />
      </div>
    </div>
  );
}
