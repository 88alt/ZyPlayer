import { base64, gzip, hex, html, unicode, url } from '@zy/crypto';
import workerpool from 'workerpool';

export type CryptoAction = 'base64' | 'gzip' | 'hex' | 'html' | 'unicode' | 'url';
export type CryptoExecute = 'encode' | 'decode';
type CryptoMethod = (doc: Record<string, any>) => string;

const METHOD_MAP = { base64, gzip, hex, html, unicode, url } as unknown as Record<
  CryptoAction,
  Record<CryptoExecute, CryptoMethod>
>;

const main = (action: CryptoAction, execute: CryptoExecute, doc: Record<string, any>): string => {
  const method = METHOD_MAP[action]?.[execute];
  return method(doc);
};

workerpool.worker({ main });
