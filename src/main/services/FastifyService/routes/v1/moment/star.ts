import { dbService } from '@main/services/DbService';
import type {
  AddStarBody,
  DeleteStarBody,
  FindStarDetailQuery,
  GetStarDetailParams,
  GetStarPageQuery,
  PutStarBody,
} from '@server/schemas/v1/moment/star';
import {
  addSchema,
  deleteSchema,
  findDetailSchema,
  getDetailSchema,
  pageSchema,
  putSchema,
} from '@server/schemas/v1/moment/star';
import type { IModels } from '@shared/types/db';
import type { FastifyPluginAsync } from 'fastify';

const API_PREFIX = 'moment/star';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<{ Body: AddStarBody }>(
    `/${API_PREFIX}`,
    {
      schema: addSchema,
    },
    async (req, reply) => {
      try {
        const dbRes = await dbService.star.add(req.body as IModels['star']);
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.delete<{ Body: DeleteStarBody }>(
    `/${API_PREFIX}`,
    {
      schema: deleteSchema,
    },
    async (req, reply) => {
      try {
        const { id = [], type = [] } = req.body || {};
        if (type.length !== 0) {
          await dbService.star.removeByField({ type });
        } else if (id.length !== 0) {
          await dbService.star.remove(id);
        } else {
          await dbService.star.clear();
        }
        return reply.code(200).send({ code: 0, msg: 'ok', data: null });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.put<{ Body: PutStarBody }>(
    `/${API_PREFIX}`,
    {
      schema: putSchema,
    },
    async (req, reply) => {
      try {
        const { id, doc } = req.body;
        const dbRes = await dbService.star.update(id, doc as IModels['star']);
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: GetStarPageQuery }>(
    `/${API_PREFIX}/page`,
    {
      schema: pageSchema,
    },
    async (req, reply) => {
      try {
        const { pageNum = 1, pageSize = 10, type = [], kw } = req.query;

        const dbResPage = await dbService.star.page(pageNum, pageSize, kw, type);

        const loaderMap: Record<number, string> = {
          1: 'site',
          2: 'iptv',
          3: 'analyze',
        } as const;

        const list = await Promise.all(
          dbResPage.list.map(async (item) => {
            const relateSite =
              (await dbService?.[loaderMap[item.type]]?.getByField({ key: item.relateId! }))?.[0] ?? {};
            return { ...item, relateSite };
          }),
        );

        return reply.code(200).send({
          code: 0,
          msg: 'ok',
          data: {
            list,
            total: dbResPage.total,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: FindStarDetailQuery }>(
    `/${API_PREFIX}/find`,
    {
      schema: findDetailSchema,
    },
    async (req, reply) => {
      try {
        const { relateId, videoId, type } = req.query;
        const dbRes = await dbService.star.getByField({ relateId, videoId, ...(type ? { type } : {}) });
        const res = dbRes?.[0] ?? {};
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Params: GetStarDetailParams }>(
    `/${API_PREFIX}/:id`,
    {
      schema: getDetailSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const dbRes = await dbService.star.get(id);
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
