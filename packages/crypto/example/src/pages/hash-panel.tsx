import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { Encode } from '@zy/crypto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/i18n';
import { useWorkerPool } from '@/hooks/use-worker-pool';
import type { CryptoAction, CryptoName } from '../workers/hash.worker';
import hashWorkerUrl from '../workers/hash.worker?worker&url';

const ALGORITHM_OPTIONS = [
  { value: 'md5-16', label: 'MD5-16' },
  { value: 'md5-32', label: 'MD5-32' },
  { value: 'sha1', label: 'SHA1' },
  { value: 'sha224', label: 'SHA224' },
  { value: 'sha256', label: 'SHA256' },
  { value: 'sha3', label: 'SHA3' },
  { value: 'sha384', label: 'SHA384' },
  { value: 'sha512', label: 'SHA512' },
  { value: 'sha512-224', label: 'SHA512/224' },
  { value: 'sha512-256', label: 'SHA512/256' },
  { value: 'ripemd160', label: 'RIPEMD160' },
  { value: 'sm3', label: 'SM3' },
];

const INPUT_ENCODE_OPTIONS = [
  { value: 'utf8', label: 'UTF-8' },
  { value: 'hex', label: 'Hex' },
  { value: 'base64', label: 'Base64' },
];

const OUTPUT_ENCODE_OPTIONS = [
  { value: 'hex', label: 'Hex' },
  { value: 'base64', label: 'Base64' },
];

interface HashPanelProps {
  algorithm: string;
}

export function HashPanel({ algorithm }: HashPanelProps) {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [key, setKey] = useState('');
  const [inputEncode, setInputEncode] = useState('utf8');
  const [keyEncode, setKeyEncode] = useState('utf8');
  const [outputEncode, setOutputEncode] = useState('hex');
  const [output, setOutput] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { exec } = useWorkerPool(hashWorkerUrl);

  const handleCompute = useCallback(async () => {
    if (!input || loading) return;
    setLoading(true);
    try {
      const tasks = ALGORITHM_OPTIONS.map(async ({ value: name }) => {
        const doc =
          algorithm === 'hash'
            ? { src: input, inputEncode: inputEncode as Encode, outputEncode: outputEncode as Encode }
            : {
                src: input,
                key,
                inputEncode: inputEncode as Encode,
                keyEncode: keyEncode as Encode,
                outputEncode: outputEncode as Encode,
              };
        const result = await exec('main', [algorithm as CryptoAction, name as CryptoName, doc]);
        return [name, result] as const;
      });
      const results = await Promise.all(tasks);
      setOutput(Object.fromEntries(results));
      toast.success(t('toast.success'));
    } catch (error) {
      setOutput({});
      toast.error(`${t('toast.errorPrefix')}: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [algorithm, input, loading, key, inputEncode, keyEncode, outputEncode, exec, t]);

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>{t('field.content')}</Label>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('placeholder.hashText')}
          rows={4}
        />
      </div>

      {algorithm === 'hmac' && (
        <div className="flex flex-col gap-2">
          <Label>{t('field.key')}</Label>
          <div className="flex gap-2">
            <Select value={keyEncode} onValueChange={setKeyEncode}>
              <SelectTrigger className="w-24 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INPUT_ENCODE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={t('placeholder.key')}
              className="flex-1"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label>{t('field.inputEncoding')}</Label>
        <Tabs value={inputEncode} onValueChange={setInputEncode}>
          <TabsList>
            {INPUT_ENCODE_OPTIONS.map((opt) => (
              <TabsTrigger key={opt.value} value={opt.value}>
                {opt.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t('field.outputEncoding')}</Label>
        <Tabs value={outputEncode} onValueChange={setOutputEncode}>
          <TabsList>
            {OUTPUT_ENCODE_OPTIONS.map((opt) => (
              <TabsTrigger key={opt.value} value={opt.value}>
                {opt.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t('field.action')}</Label>
        <Button onClick={handleCompute} disabled={loading} className="w-full">
          {loading && <Loader2 className="animate-spin" />}
          {t('action.compute')}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t('field.output')}</Label>
        <div className="flex flex-col gap-2">
          {ALGORITHM_OPTIONS.map((algo) => (
            <div key={algo.value} className="flex gap-2 items-center">
              <Label className="w-24 shrink-0 text-sm text-muted-foreground">{algo.label}</Label>
              <Input
                value={output[algo.value] || ''}
                readOnly
                placeholder=""
                className="flex-1 cursor-pointer font-mono text-xs"
                onClick={() => handleCopy(output[algo.value])}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
