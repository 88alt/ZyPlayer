import { dbService } from '@main/services/DbService';
import { backupSchema, resumeSchema } from '@server/schemas/v1/data/cloud';
import type { FastifyPluginAsync } from 'fastify';

const API_PREFIX = 'data/cloud';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get(
    `/${API_PREFIX}/backup`,
    {
      schema: backupSchema,
    },
    async (_req, reply) => {
      try {
        const cloudConf = await dbService.setting.getValue('cloud');
        const { sync: _sync, type, ...options } = cloudConf || {};

        const status = await dbService.cloudBackup(type, options);
        return reply.code(200).send({ code: 0, msg: 'ok', data: status });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get(
    `/${API_PREFIX}/resume`,
    {
      schema: resumeSchema,
    },
    async (_req, reply) => {
      try {
        const cloudConf = await dbService.setting.getValue('cloud');
        const { sync: _sync, type, ...options } = cloudConf || {};

        const status = await dbService.cloudResume(type, options);
        return reply.code(200).send({ code: 0, msg: 'ok', data: status });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
