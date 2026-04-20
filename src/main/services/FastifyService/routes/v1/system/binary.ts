import { binaryService } from '@main/services/BinaryService';
import type { InstallBinaryBody } from '@server/schemas/v1/system/binary';
import { getBinaryListSchema, installBinarySchema } from '@server/schemas/v1/system/binary';
import type { FastifyPluginAsync } from 'fastify';

const API_PREFIX = 'system/binary';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get(
    `/${API_PREFIX}/list`,
    {
      schema: getBinaryListSchema,
    },
    async (_req, reply) => {
      try {
        const resp = await binaryService.getBinaryList();
        return reply.code(200).send({ code: 0, msg: 'ok', data: resp });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.post<{ Body: InstallBinaryBody }>(
    `/${API_PREFIX}/install`,
    {
      schema: installBinarySchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.body;
        const resp = await binaryService.installBinary(id);
        return reply.code(200).send({ code: 0, msg: 'ok', data: resp });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
