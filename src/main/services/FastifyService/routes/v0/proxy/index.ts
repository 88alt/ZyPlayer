import { Buffer } from 'node:buffer';

import { request } from '@main/utils/request';
import type { GetProxyCacheRequest, SetProxyCacheRequest } from '@server/schemas/v0/proxy';
import { getSchema, setSchema } from '@server/schemas/v0/proxy';
import { PROXY_API } from '@shared/config/env';
import { base64, hash } from '@shared/modules/crypto';
import type { FastifyPluginAsync } from 'fastify';

const API_PREFIX = 'proxy';

const generateCacheKey = (url: string): string => {
  return `proxy-${hash['md5-16']({ src: url })}`;
};

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get<{ Querystring: GetProxyCacheRequest }>(
    `/${API_PREFIX}`,
    {
      schema: getSchema,
    },
    async (req, reply) => {
      try {
        const { url } = req.query;

        if (!url) {
          return reply.code(400).send({ code: -1, msg: 'Invalid URL', data: null });
        }

        const cacheKey = generateCacheKey(url);

        const cacheData: Array<string> | null = await fastify.cache.get(cacheKey);
        if (cacheData && cacheData.length > 0) {
          const [status, contentType, content, ...rest] = cacheData;
          const headers = rest.length > 0 ? rest[0] : null;
          const isBase64 = rest.length > 1 ? rest[1] : null;

          if (headers) {
            Object.entries(headers).forEach(([key, value]) => {
              reply.header(key, value);
            });
          }

          let responseContent = content;
          if (isBase64) {
            if (content.includes('base64,')) {
              responseContent = decodeURIComponent(content.split('base64,')[1]);
            }
            responseContent = base64.decode({ src: responseContent });
          }

          return reply
            .code(typeof status === 'number' ? status : Number.parseInt(status))
            .header('Content-Type', contentType)
            .send(responseContent);
        }

        if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].some((ext) => url.toLowerCase().includes(ext))) {
          const { data: resp } = await request.request({
            url,
            method: 'GET',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.82',
            },
          });
          if (typeof resp === 'string' && resp.includes('base64,')) {
            const parts = resp.split(';base64,');
            if (parts.length === 2) {
              const imageType = parts[0].split(':')[1];
              const imageBuffer = Buffer.from(parts[1], 'base64');

              return reply.type(imageType).send(imageBuffer);
            }
          }
        }

        return reply.code(302).redirect(url);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.post<{ Body: SetProxyCacheRequest }>(
    `/${API_PREFIX}`,
    {
      schema: setSchema,
    },
    async (req, reply) => {
      try {
        const { text, url } = req.body;

        if (!text || !url) {
          return reply.code(400).send({ code: -1, msg: 'Text and URL parameters are required', data: null });
        }

        const cacheKey = generateCacheKey(url);
        fastify.cache.set(cacheKey, text);

        return reply.code(200).send({
          code: 0,
          msg: 'ok',
          data: `${PROXY_API}?url=${encodeURIComponent(url)}`,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
