import { dbService } from '@main/services/DbService';
import { pluginService } from '@main/services/PluginService';
import type {
  AddPluginBody,
  DeletePluginBody,
  GetPluginDetailParams,
  GetPluginPageQuery,
  PutPluginBody,
} from '@server/schemas/v1/plugin';
import { addSchema, deleteSchema, getDetailSchema, pageSchema, putSchema } from '@server/schemas/v1/plugin';
import type { IModels } from '@shared/types/db';
import type { FastifyPluginAsync } from 'fastify';

const API_PREFIX = 'plugin';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<{ Body: AddPluginBody }>(
    `/${API_PREFIX}`,
    {
      schema: addSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.body;
        const res = await pluginService.install(id);
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.delete<{ Body: DeletePluginBody }>(
    `/${API_PREFIX}`,
    {
      schema: deleteSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.body;
        const res = await pluginService.uninstall(id);
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.put<{ Body: PutPluginBody }>(
    `/${API_PREFIX}`,
    {
      schema: putSchema,
    },
    async (req, reply) => {
      try {
        const { id, doc } = req.body;

        let res: IModels['plugin'][] = [];
        if (doc.isActive) {
          res = await pluginService.start(id);
        } else {
          res = await pluginService.stop(id);
        }
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: GetPluginPageQuery }>(
    `/${API_PREFIX}/page`,
    {
      schema: pageSchema,
    },
    async (req, reply) => {
      try {
        const { pageNum = 1, pageSize = 10, kw } = req.query;
        const res = await dbService.plugin.page(pageNum, pageSize, kw);
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Params: GetPluginDetailParams }>(
    `/${API_PREFIX}/:id`,
    {
      schema: getDetailSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const res = await dbService.plugin.get(id);
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
