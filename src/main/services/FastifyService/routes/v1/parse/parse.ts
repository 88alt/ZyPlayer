import { dbService } from '@main/services/DbService';
import type { MediaDirectQuery } from '@server/schemas/v1/parse/parse';
import { mediaDirectSchema } from '@server/schemas/v1/parse/parse';
import type { IAnalyzeType } from '@shared/config/parse';
import { isHttp, isNumber, isStrEmpty, isString } from '@shared/modules/validate';
import type { FastifyPluginAsync } from 'fastify';

import { convertToStandard } from './utils/mediaDirect';

const API_PREFIX = 'parse';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get<{ Querystring: MediaDirectQuery }>(
    `/${API_PREFIX}/media-direct`,
    {
      schema: mediaDirectSchema,
    },
    async (req, reply) => {
      try {
        const { id, url: rawUrl } = req.query;
        const dbResDetail = await dbService.analyze.get(id);
        const { api, type, script, headers } = dbResDetail || {};

        if (!isHttp(api) || !isNumber(type)) {
          return reply.code(400).send({ code: -1, msg: 'Invalid parameters', data: null });
        }
        if (!isString(rawUrl) || isStrEmpty(rawUrl)) {
          return reply.code(400).send({ code: -1, msg: 'Invalid URL', data: null });
        }

        try {
          const url = `${api}${rawUrl}`;
          const res = await convertToStandard(
            url,
            type as IAnalyzeType,
            headers as Record<string, any>,
            script as string,
          );
          return reply.code(200).send({ code: 0, msg: 'ok', data: res });
        } catch {
          return reply.code(200).send({ code: 0, msg: 'ok', data: { url: '', headers: {} } });
        }
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
