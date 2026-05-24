import { hash, hmac } from '@zy/crypto';
import workerpool from 'workerpool';

export type CryptoAction = 'hash' | 'hmac';
export type CryptoName =
  | 'md5-16'
  | 'md5-32'
  | 'sha1'
  | 'sha224'
  | 'sha256'
  | 'sha3'
  | 'sha384'
  | 'sha512'
  | 'sha512-224'
  | 'sha512-256'
  | 'ripemd160'
  | 'sm3';
type CryptoMethod = (doc: Record<string, any>) => string;

const METHOD_MAP = { hash, hmac } as unknown as Record<CryptoAction, CryptoMethod>;

const main = (action: CryptoAction, name: CryptoName, doc: Record<string, any>): string => {
  const method = METHOD_MAP[action]?.[name];
  return method(doc);
};

workerpool.worker({ main });
