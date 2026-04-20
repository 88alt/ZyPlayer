import { dbService } from '@main/services/DbService';
import type {
  AddSiteBody,
  DeleteSiteBody,
  GetSiteDetailByKeyParams,
  GetSiteDetailParams,
  GetSitePageQuery,
  PutSiteBody,
  SetDefaultSiteParams,
} from '@server/schemas/v1/flim/site';
import {
  addSchema,
  deleteSchema,
  getActiveSchema,
  getDetailByKeySchema,
  getDetailSchema,
  pageSchema,
  putSchema,
  setDefaultSchema,
} from '@server/schemas/v1/flim/site';
import type { IModels } from '@shared/types/db';
import type { FastifyPluginAsync } from 'fastify';

const API_PREFIX = 'film/site';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<{ Body: AddSiteBody }>(
    `/${API_PREFIX}`,
    {
      schema: addSchema,
    },
    async (req, reply) => {
      try {
        const doc = req.body as IModels['site'];
        const dbRes = await dbService.site.add(doc);
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.delete<{ Body: DeleteSiteBody }>(
    `/${API_PREFIX}`,
    {
      schema: deleteSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.body || {};
        if (id && id.length !== 0) {
          await dbService.site.remove(id);
        } else {
          await dbService.site.clear();
        }
        return reply.code(200).send({ code: 0, msg: 'ok', data: null });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.put<{ Body: PutSiteBody }>(
    `/${API_PREFIX}`,
    {
      schema: putSchema,
    },
    async (req, reply) => {
      try {
        const { id, doc } = req.body as { id: string[]; doc: IModels['site'] };
        const dbRes = await dbService.site.update(id, doc);
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: GetSitePageQuery }>(
    `/${API_PREFIX}/page`,
    {
      schema: pageSchema,
    },
    async (req, reply) => {
      try {
        const { pageNum = 1, pageSize = 10, kw } = req.query;

        const [dbResPage, dbResGroup, dbResDefaultId] = await Promise.all([
          dbService.site.page(pageNum, pageSize, kw),
          dbService.site.group(),
          dbService.setting.getValue('defaultSite'),
        ]);

        return reply.code(200).send({
          code: 0,
          msg: 'ok',
          data: {
            list: dbResPage.list,
            total: dbResPage.total,
            default: dbResDefaultId ?? '',
            group: dbResGroup ?? [],
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get(
    `/${API_PREFIX}/active`,
    {
      schema: getActiveSchema,
    },
    async (_req, reply) => {
      try {
        const [dbResAll, dbResGroup, dbResDefaultId, dbResSite] = await Promise.all([
          dbService.site.active(),
          dbService.site.group(),
          dbService.setting.getValue('defaultSite'),
          dbService.setting.getValue('site'),
        ]);

        const dbResDefault = await dbService.site.get(dbResDefaultId);

        return reply.code(200).send({
          code: 0,
          msg: 'ok',
          data: {
            list: dbResAll,
            default: dbResDefault ?? {},
            extra: {
              group: dbResGroup ?? [],
              filter: dbResSite.filterMode ?? false,
              search: dbResSite.searchMode ?? 'site',
            },
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Params: GetSiteDetailParams }>(
    `/${API_PREFIX}/:id`,
    {
      schema: getDetailSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const dbRes = await dbService.site.get(id);
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Params: GetSiteDetailByKeyParams }>(
    `/${API_PREFIX}/key/:key`,
    {
      schema: getDetailByKeySchema,
    },
    async (req, reply) => {
      try {
        const { key } = req.params;
        const dbRes = await dbService.site.getByField({ key });
        const res = dbRes?.[0];
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.put<{ Params: SetDefaultSiteParams }>(
    `/${API_PREFIX}/default/:id`,
    {
      schema: setDefaultSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.params;
        await dbService.setting.update({ key: 'defaultSite', value: id });
        return reply.code(200).send({ code: 0, msg: 'ok', data: true });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
