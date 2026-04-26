import { dbService } from '@main/services/DbService';
import type {
  AddAnalyzeBody,
  DeleteAnalyzeBody,
  GetAnalyzeDetailByKeyParams,
  GetAnalyzeDetailParams,
  GetAnalyzePageQuery,
  GetCheckParams,
  PutAnalyzeBody,
  SetDefaultParams,
} from '@server/schemas/v1/parse/analyze';
import {
  addSchema,
  deleteSchema,
  getActiveSchema,
  getCheckSchema,
  getDetailByKeySchema,
  getDetailSchema,
  pageSchema,
  putSchema,
  setDefaultSchema,
} from '@server/schemas/v1/parse/analyze';
import type { IAnalyzeType } from '@shared/config/parse';
import { isHttp, isNumber } from '@shared/modules/validate';
import type { IModels } from '@shared/types/db';
import type { FastifyPluginAsync } from 'fastify';

import { convertToStandard } from './utils/mediaDirect';

const API_PREFIX = 'parse/analyze';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<{ Body: AddAnalyzeBody }>(
    `/${API_PREFIX}`,
    {
      schema: addSchema,
    },
    async (req, reply) => {
      try {
        const doc = req.body as IModels['analyze'];
        const dbRes = await dbService.analyze.add(doc);
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.delete<{ Body: DeleteAnalyzeBody }>(
    `/${API_PREFIX}`,
    {
      schema: deleteSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.body || {};
        if (id && id.length !== 0) {
          await dbService.analyze.remove(id);
        } else {
          await dbService.analyze.clear();
        }
        return reply.code(200).send({ code: 0, msg: 'ok', data: null });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.put<{ Body: PutAnalyzeBody }>(
    `/${API_PREFIX}`,
    {
      schema: putSchema,
    },
    async (req, reply) => {
      try {
        const { id, doc } = req.body as { id: string[]; doc: IModels['analyze'] };
        const dbRes = await dbService.analyze.update(id, doc);
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: GetAnalyzePageQuery }>(
    `/${API_PREFIX}/page`,
    {
      schema: pageSchema,
    },
    async (req, reply) => {
      try {
        const { pageNum = 1, pageSize = 10, kw } = req.query;

        const [dbResPage, dbResDefaultId] = await Promise.all([
          dbService.analyze.page(pageNum, pageSize, kw),
          dbService.setting.getValue('defaultAnalyze'),
        ]);

        return reply.code(200).send({
          code: 0,
          msg: 'ok',
          data: {
            list: dbResPage.list,
            total: dbResPage.total,
            default: dbResDefaultId ?? '',
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
        const [dbResAll, dbResDefaultId] = await Promise.all([
          dbService.analyze.active(),
          dbService.setting.getValue('defaultAnalyze'),
        ]);

        const dbResDefault = await dbService.analyze.get(dbResDefaultId);

        return reply.code(200).send({
          code: 0,
          msg: 'ok',
          data: {
            list: dbResAll,
            default: dbResDefault ?? {},
            extra: {},
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Params: GetAnalyzeDetailParams }>(
    `/${API_PREFIX}/:id`,
    {
      schema: getDetailSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const dbRes = await dbService.analyze.get(id);
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Params: GetAnalyzeDetailByKeyParams }>(
    `/${API_PREFIX}/key/:key`,
    {
      schema: getDetailByKeySchema,
    },
    async (req, reply) => {
      try {
        const { key } = req.params;
        const dbRes = await dbService.analyze.getByField({ key });
        const res = dbRes?.[0] ?? {};
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.put<{ Params: SetDefaultParams }>(
    `/${API_PREFIX}/default/:id`,
    {
      schema: setDefaultSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.params;
        await dbService.setting.update({ key: 'defaultAnalyze', value: id });
        return reply.code(200).send({ code: 0, msg: 'ok', data: { success: true } });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Params: GetCheckParams }>(
    `/${API_PREFIX}/check/:id`,
    {
      schema: getCheckSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const dbResDetail = await dbService.analyze.get(id);
        const { api, type, script, headers } = dbResDetail || {};
        if (!isHttp(api) || !isNumber(type)) {
          return reply.code(200).send({ code: -1, msg: 'Invalid parameters', data: null });
        }

        const RANDOM_URL = [
          'https://v.qq.com/x/cover/mzc00200f19q8q5/t41011onk2h.html', // 许我耀眼
          'https://www.iqiyi.com/v_aky0eua8jg.html', // 命悬一生
          'https://www.mgtv.com/b/779771/23643138.html', // 花儿与少年
          'https://v.youku.com/v_show/id_XNjUwNjI3NDg0OA==.html', // 暗河传
        ];

        const url = `${api}${RANDOM_URL[Math.floor(Math.random() * RANDOM_URL.length)]}`;
        const resp = await convertToStandard(
          url,
          type as IAnalyzeType,
          headers as Record<string, any>,
          script as string,
        );
        const status = isHttp(resp.url);

        return reply.code(200).send({ code: 0, msg: 'ok', data: { success: status } });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
