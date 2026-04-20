import { dbService } from '@main/services/DbService';
import { getRelatedSchema } from '@server/schemas/v1/moment/moment';
import type { FastifyPluginAsync } from 'fastify';

const API_PREFIX = 'moment';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get(
    `/${API_PREFIX}/related`,
    {
      schema: getRelatedSchema,
    },
    async (_req, reply) => {
      try {
        const [dbResAnalyze, dbResIptv, dbResSite] = await Promise.all([
          dbService.analyze.active(),
          dbService.iptv.active(),
          dbService.site.active(),
        ]);

        return reply.code(200).send({
          code: 0,
          msg: 'ok',
          data: {
            parse: dbResAnalyze,
            live: dbResIptv,
            film: dbResSite,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
