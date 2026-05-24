import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { base64, gzip, hex, html, unicode, url } from '@zy/crypto';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/i18n';

type MethodOptions = Record<string, unknown>;
type CryptoMethod = { encode: unknown; decode: unknown };

const METHOD_MAP: Record<string, CryptoMethod> = {
  html,
  unicode,
  base64,
  url,
  hex,
  gzip,
};

interface EncodePanelProps {
  algorithm: string;
}

export function EncodePanel({ algorithm }: EncodePanelProps) {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');

  const handleExecute = useCallback(
    (action: 'encode' | 'decode') => {
      if (!input) return;
      try {
        const method = METHOD_MAP[algorithm][action] as (opts: MethodOptions) => string;
        const result = method({ src: input });
        setOutput(result);
        toast.success(t('toast.success'));
      } catch (error) {
        setOutput('');
        toast.error(`${t('toast.errorPrefix')}: ${(error as Error).message}`);
      }
    },
    [algorithm, input, t],
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>{t('field.input')}</Label>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('placeholder.text')}
          rows={4}
        />
      </div>

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
