import { hash } from '@zy/crypto';

export const generateCacheKey = (url: string): string => {
  return `proxy-${hash['md5-16']({ src: url })}`;
};
