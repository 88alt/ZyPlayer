import { dbService } from '@main/services/DbService';
import { pluginService } from '@main/services/PluginService';
import type {
  GetPluginDetailParams,
  GetPluginPageQuery,
  InstallPluginBody,
  StartPluginBody,
  StopPluginBody,
  UninstallPluginBody,
} from '@server/schemas/v1/plugin';
import {
  getDetailSchema,
  installSchema,
  pageSchema,
  startSchema,
  stopSchema,
  uninstallSchema,
} from '@server/schemas/v1/plugin';
import type { FastifyPluginAsync } from 'fastify';

const API_PREFIX = 'plugin';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
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

  fastify.post<{ Body: InstallPluginBody }>(
    `/${API_PREFIX}/install`,
    {
      schema: installSchema,
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

  fastify.delete<{ Body: UninstallPluginBody }>(
    `/${API_PREFIX}/uninstall`,
    {
      schema: uninstallSchema,
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

  fastify.put<{ Body: StartPluginBody }>(
    `/${API_PREFIX}/start`,
    {
      schema: startSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.body;
        const res = await pluginService.start(id);
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.put<{ Body: StopPluginBody }>(
    `/${API_PREFIX}/stop`,
    {
      schema: stopSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.body;
        const res = await pluginService.stop(id);
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
