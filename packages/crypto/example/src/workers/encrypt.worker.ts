import { aes, des, rabbit, rabbitLegacy, rc4, rc4Drop, rsa, sm4, tripleDes } from '@zy/crypto';
import workerpool from 'workerpool';

export type CryptoAction = 'rsa' | 'rc4' | 'rc4Drop' | 'aes' | 'des' | 'tripleDes' | 'rabbit' | 'rabbitLegacy' | 'sm4';
export type CryptoExecute = 'encode' | 'decode';
type CryptoMethod = (doc: Record<string, any>) => string;

const METHOD_MAP = { rsa, rc4, rc4Drop, aes, des, tripleDes, rabbit, rabbitLegacy, sm4 } as Record<
  CryptoAction,
  Record<CryptoExecute, CryptoMethod>
>;

const main = (action: CryptoAction, execute: CryptoExecute, doc: Record<string, any>): string => {
  const method = METHOD_MAP[action]?.[execute];
  return method(doc);
};

workerpool.worker({ main });
