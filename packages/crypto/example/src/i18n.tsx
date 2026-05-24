import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'crypto-playground-locale';

export type Locale = 'zh' | 'en';

const translations = {
  zh: {
    'app.browserOnly': '所有计算均在浏览器端完成',
    'app.encrypt': '加密',
    'app.hash': '哈希',
    'app.encode': '编码',
    'lang.switchTo': '切换到 English',
    'lang.menu': '语言',
    'lang.zh': '中文',
    'lang.en': 'English',
    'toast.success': '成功',
    'toast.copied': '已复制到剪贴板',
    'toast.errorPrefix': '错误',
    'toast.encryptUtf8OutputUnsupported': '加密不支持UTF-8输出编码',
    'toast.decodeUtf8InputUnsupported': '解码不支持UTF-8输入编码',
    'toast.longTextWarning': '长文本处理会阻塞进程, 长时间未响应请刷新页面。',
    'field.content': '内容',
    'field.input': '输入',
    'field.key': '密钥',
    'field.passphrase': '密钥密码',
    'field.iv': '偏移',
    'field.mode': '模式',
    'field.longText': '长文本',
    'field.padding': '填充',
    'field.drop': '丢弃位数',
    'field.tag': '标签',
    'field.aad': '附加认证数据',
    'field.inputEncoding': '输入编码',
    'field.outputEncoding': '输出编码',
    'field.action': '操作',
    'field.output': '输出',
    'action.encode': '编码',
    'action.decode': '解码',
    'action.compute': '计算',
    'option.standardPublicPrivate': '标准(公加私解)',
    'option.nonstandardPrivatePublic': '非标(私加公解)',
    'option.standard': '标准',
    'option.longText': '长文本(区块117)',
    'placeholder.text': '请输入文本...',
    'placeholder.hashText': '请输入待哈希文本...',
    'placeholder.pemKey': '请输入PEM密钥...',
    'placeholder.key': '请输入密钥...',
    'placeholder.passphrase': '请输入密钥密码（可选）...',
    'placeholder.iv': '请输入偏移量...',
    'placeholder.tag': '请输入标签（解码用）...',
    'placeholder.aad': '请输入附加认证数据...',
    'placeholder.output': '结果将在此显示...',
  },
  en: {
    'app.browserOnly': 'All calculations run locally in browser',
    'app.encrypt': 'Encrypt',
    'app.hash': 'Hash',
    'app.encode': 'Encode',
    'lang.switchTo': 'Switch to Chinese',
    'lang.menu': 'Language',
    'lang.zh': 'Chinese',
    'lang.en': 'English',
    'toast.success': 'Success',
    'toast.copied': 'Copied to clipboard',
    'toast.errorPrefix': 'Error',
    'toast.encryptUtf8OutputUnsupported': 'Encryption does not support UTF-8 output encoding',
    'toast.decodeUtf8InputUnsupported': 'Decoding does not support UTF-8 input encoding',
    'toast.longTextWarning': 'Long text processing may block the page. Refresh if it stops responding.',
    'field.content': 'Content',
    'field.input': 'Input',
    'field.key': 'Key',
    'field.passphrase': 'Key passphrase',
    'field.iv': 'IV',
    'field.mode': 'Mode',
    'field.longText': 'Long text',
    'field.padding': 'Padding',
    'field.drop': 'Drop',
    'field.tag': 'Tag',
    'field.aad': 'Additional authenticated data',
    'field.inputEncoding': 'Input encoding',
    'field.outputEncoding': 'Output encoding',
    'field.action': 'Action',
    'field.output': 'Output',
    'action.encode': 'Encode',
    'action.decode': 'Decode',
    'action.compute': 'Compute',
    'option.standardPublicPrivate': 'Standard',
    'option.nonstandardPrivatePublic': 'Non-standard',
    'option.standard': 'Standard',
    'option.longText': 'Long text(Block 117)',
    'placeholder.text': 'Enter text...',
    'placeholder.hashText': 'Enter text to hash...',
    'placeholder.pemKey': 'Enter PEM key...',
    'placeholder.key': 'Enter key...',
    'placeholder.passphrase': 'Enter key passphrase (optional)...',
    'placeholder.iv': 'Enter IV...',
    'placeholder.tag': 'Enter tag (for decoding)...',
    'placeholder.aad': 'Enter additional authenticated data...',
    'placeholder.output': 'Result will appear here...',
  },
} as const;

export type TranslationKey = keyof typeof translations.zh;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'zh';

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'zh' || saved === 'en') return saved;

  return window.navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
  };

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale: () => setLocale(locale === 'zh' ? 'en' : 'zh'),
      t: (key) => translations[locale][key],
    }),
    [locale],
  );

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
