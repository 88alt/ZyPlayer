import { Buffer } from 'node:buffer';

import { batchFetch, fetch } from '@main/utils/hiker/request/asyncAxios';
import JSON5 from 'json5';

const hasPropertyIgnoreCase = (obj: Record<string, string>, propertyName: string) => {
  return Object.keys(obj).some((key) => key.toLowerCase() === propertyName.toLowerCase());
};

const valueStartsWith = (obj: Record<string, string>, propertyName: string, prefix: string) => {
  const key = Object.keys(obj).find((key) => key.toLowerCase() === propertyName.toLowerCase());
  return key !== undefined && obj[key].startsWith(prefix);
};

const req = async (
  url: string,
  cobj: Record<string, any>,
): Promise<{ code: number; content: string; headers: Record<string, string> }> => {
  const obj = { ...cobj };

  try {
    if (obj.data) {
      obj.body = obj.data;
      const isForm =
        obj.postType === 'form' ||
        (hasPropertyIgnoreCase(obj.headers, 'Content-Type') &&
          valueStartsWith(obj.headers, 'Content-Type', 'application/x-www-form-urlencoded'));

      if (isForm) {
        obj.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        obj.body = new URLSearchParams(obj.data).toString();
        delete obj.postType;
      }
      delete obj.data;
    }

    if (Object.hasOwn(obj, 'redirect')) obj.redirect = !!obj.redirect;
    if (obj.buffer === 2) obj.toHex = true;
    obj.withHeaders = true;

    let resp: any = await fetch(url, obj);
    resp = JSON5.parse(resp);
    const res = {
      code: resp?.statusCode ?? 500,
      headers: Object.fromEntries(Object.entries(resp?.headers || {}).map(([k, v]) => [k, v?.[0]])),
      content: resp?.body || '',
    };

    if (obj.buffer === 2) {
      res.content = Buffer.from(resp!.body, 'hex').toString('base64');
    }

    return res;
  } catch (error) {
    console.error(error);
    return { code: 500, headers: {}, content: '' };
  }
};

export { batchFetch, req };

export { aesX, BaseSpider, desX, getProxy, joinUrl, local, md5X, rsaX } from '@main/utils/hiker';
