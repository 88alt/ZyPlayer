import { killPid, matchPort, matchPs } from '@main/utils/process';
import type { ProcessKillQuery, ProcessMatchQuery } from '@server/schemas/v1/system/process';
import { processKillSchema, processMatchSchema } from '@server/schemas/v1/system/process';
import type { FastifyPluginAsync } from 'fastify';

const API_PREFIX = 'system';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.delete<{ Querystring: ProcessKillQuery }>(
    `/${API_PREFIX}/process/kill`,
    {
      schema: processKillSchema,
    },
    async (req, reply) => {
      try {
        const { pid = [] } = req.query;
        const resp = await killPid(pid);
        return reply.code(200).send({ code: 0, msg: 'ok', data: resp });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: ProcessMatchQuery }>(
    `/${API_PREFIX}/process/match`,
    {
      schema: processMatchSchema,
    },
    async (req, reply) => {
      try {
        const { type, kw } = req.query;
        const pids = type === 'port' ? await matchPort(Number(kw)) : await matchPs(String(kw));
        return reply.code(200).send({ code: 0, msg: 'ok', data: pids });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
