import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/i18n';
import { useWorkerPool } from '@/hooks/use-worker-pool';
import type { CryptoAction, CryptoExecute } from '../workers/encode.worker';
import encodeWorkerUrl from '../workers/encode.worker?worker&url';

interface EncodePanelProps {
  algorithm: string;
}

export function EncodePanel({ algorithm }: EncodePanelProps) {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState<CryptoExecute | null>(null);
  const { exec } = useWorkerPool(encodeWorkerUrl);

  const handleExecute = useCallback(
    async (action: CryptoExecute) => {
      if (!input || loading) return;
      setLoading(action);
      try {
        const result = await exec('main', [algorithm as CryptoAction, action, { src: input }]);
        setOutput(result as string);
        toast.success(t('toast.success'));
      } catch (error) {
        setOutput('');
        toast.error(`${t('toast.errorPrefix')}: ${(error as Error).message}`);
      } finally {
        setLoading(null);
      }
    },
    [algorithm, input, loading, exec, t],
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
          <Button variant="outline" onClick={() => handleExecute('encode')} disabled={!!loading} className="flex-1">
            {loading === 'encode' && <Loader2 className="animate-spin" />}
            {t('action.encode')}
          </Button>
          <Button onClick={() => handleExecute('decode')} disabled={!!loading} className="flex-1">
            {loading === 'decode' && <Loader2 className="animate-spin" />}
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
