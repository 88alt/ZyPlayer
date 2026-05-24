import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { GithubLink } from '@/components/github-link';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { useI18n } from '@/i18n';
import { EncodePanel } from './encode-panel';
import { EncryptPanel } from './encrypt-panel';
import { HashPanel } from './hash-panel';

const ENCRYPT_ALGORITHMS = [
  { value: 'rsa', label: 'RSA' },
  { value: 'aes', label: 'AES' },
  { value: 'des', label: 'DES' },
  { value: 'tripleDes', label: 'Triple DES' },
  { value: 'rc4', label: 'RC4' },
  { value: 'rc4Drop', label: 'RC4-Drop' },
  { value: 'rabbit', label: 'Rabbit' },
  { value: 'rabbitLegacy', label: 'Rabbit Legacy' },
  { value: 'sm4', label: 'SM4' },
];

const HASH_ALGORITHMS = [
  { value: 'hash', label: 'Hash' },
  { value: 'hmac', label: 'HMAC' },
];

const ENCODE_ALGORITHMS = [
  { value: 'html', label: 'HTML' },
  { value: 'unicode', label: 'Unicode' },
  { value: 'base64', label: 'Base64' },
  { value: 'url', label: 'URL' },
  { value: 'hex', label: 'Hex' },
  { value: 'gzip', label: 'Gzip' },
];

const ALGORITHM_MAP: Record<string, { value: string; label: string }[]> = {
  encrypt: ENCRYPT_ALGORITHMS,
  hash: HASH_ALGORITHMS,
  encode: ENCODE_ALGORITHMS,
};

const DEFAULT_ALGO: Record<string, string> = {
  encrypt: 'rsa',
  hash: 'hash',
  encode: 'html',
};

export function MainApp() {
  const { t } = useI18n();
  const [mainTab, setMainTab] = useState('encrypt');
  const [subTabMap, setSubTabMap] = useState(DEFAULT_ALGO);

  const subTab = subTabMap[mainTab];
  const algorithms = ALGORITHM_MAP[mainTab];

  const handleMainTabChange = (value: string) => {
    setMainTab(value);
  };

  const handleSubTabChange = (value: string) => {
    setSubTabMap((prev) => ({ ...prev, [mainTab]: value }));
  };

  useEffect(() => {
    toast.info(t('app.browserOnly'), { id: 'browser-only' });
  }, [t]);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-50 w-full bg-background">
        <div className="flex items-center justify-between px-4 py-1">
          <h1 className="text-lg font-semibold">Crypto Playground</h1>
          <div className="flex items-center gap-1">
            <GithubLink />
            <Separator orientation="vertical" className="my-2.5" />
            <LanguageToggle />
            <Separator orientation="vertical" className="my-2.5" />
            <ThemeToggle className="-mr-1.5" />
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-1">
        <Tabs value={mainTab} onValueChange={handleMainTabChange} className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-col gap-2 shrink-0">
            <TabsList variant="line">
              <TabsTrigger value="encrypt">{t('app.encrypt')}</TabsTrigger>
              <TabsTrigger value="hash">{t('app.hash')}</TabsTrigger>
              <TabsTrigger value="encode">{t('app.encode')}</TabsTrigger>
            </TabsList>

            <div className="flex gap-1 overflow-x-auto whitespace-nowrap py-1.5">
              {algorithms.map((algo) => (
                <button
                  key={algo.value}
                  onClick={() => handleSubTabChange(algo.value)}
                  className={`px-2 py-1 text-sm rounded-md transition-colors shrink-0 ${
                    subTab === algo.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {algo.label}
                </button>
              ))}
            </div>
          </div>

          <TabsContent value="encrypt" className="flex-1 min-h-0 overflow-auto p-1">
            <EncryptPanel algorithm={subTabMap.encrypt} />
          </TabsContent>
          <TabsContent value="hash" className="flex-1 min-h-0 overflow-auto p-1">
            <HashPanel algorithm={subTabMap.hash} />
          </TabsContent>
          <TabsContent value="encode" className="flex-1 min-h-0 overflow-auto p-1">
            <EncodePanel algorithm={subTabMap.encode} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="py-3 text-sm text-muted-foreground">
        <div className="flex flex-col items-center">
          <span className="w-full px-1 text-center text-xs leading-loose text-muted-foreground sm:text-xs">
            Copyright © {new Date().getFullYear()} zy. All Rights Reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
