import { dbService } from '@main/services/DbService';
import type {
  AddIptvBody,
  DeleteIptvBody,
  GetCheckIptvParams,
  GetIptvDetailByKeyParams,
  GetIptvDetailParams,
  GetIptvPageQuery,
  PutIptvBody,
  SetDefaultIptvParams,
} from '@server/schemas/v1/live/iptv';
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
} from '@server/schemas/v1/live/iptv';
import type { IIptvType } from '@shared/config/live';
import { isArrayEmpty, isNumber, isStrEmpty } from '@shared/modules/validate';
import type { IModels } from '@shared/types/db';
import type { FastifyPluginAsync } from 'fastify';

import { convertToStandard } from './utils/channel';

const API_PREFIX = 'live/iptv';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<{ Body: AddIptvBody }>(
    `/${API_PREFIX}`,
    {
      schema: addSchema,
    },
    async (req, reply) => {
      try {
        const doc = req.body as IModels['iptv'];
        const dbRes = await dbService.iptv.add(doc);
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.delete<{ Body: DeleteIptvBody }>(
    `/${API_PREFIX}`,
    {
      schema: deleteSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.body || {};
        if (id && id.length !== 0) {
          await dbService.iptv.remove(id);
        } else {
          await dbService.iptv.clear();
        }
        return reply.code(200).send({ code: 0, msg: 'ok', data: null });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.put<{ Body: PutIptvBody }>(
    `/${API_PREFIX}`,
    {
      schema: putSchema,
    },
    async (req, reply) => {
      try {
        const { id, doc } = req.body as { id: string[]; doc: IModels['iptv'] };
        const dbRes = await dbService.iptv.update(id, doc);
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: GetIptvPageQuery }>(
    `/${API_PREFIX}/page`,
    {
      schema: pageSchema,
    },
    async (req, reply) => {
      try {
        const { pageNum = 1, pageSize = 10, kw } = req.query;

        const [dbResPage, dbResDefaultId] = await Promise.all([
          dbService.iptv.page(pageNum, pageSize, kw),
          dbService.setting.getValue('defaultIptv'),
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
        const [dbResAll, dbResDefaultId, dbResIptv] = await Promise.all([
          dbService.iptv.active(),
          dbService.setting.getValue('defaultIptv'),
          dbService.setting.getValue('live'),
        ]);

        const dbResDefault = await dbService.iptv.get(dbResDefaultId);

        return reply.code(200).send({
          code: 0,
          msg: 'ok',
          data: {
            list: dbResAll,
            default: dbResDefault ?? {},
            extra: {
              epg: dbResIptv?.epg ?? '',
              logo: dbResIptv?.logo ?? '',
              ipMark: dbResIptv?.ipMark ?? '',
              delay: dbResIptv?.delay ?? '',
              thumbnail: dbResIptv?.thumbnail ?? '',
            },
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Params: GetIptvDetailParams }>(
    `/${API_PREFIX}/:id`,
    {
      schema: getDetailSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const dbRes = await dbService.iptv.get(id);
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Params: GetIptvDetailByKeyParams }>(
    `/${API_PREFIX}/key/:key`,
    {
      schema: getDetailByKeySchema,
    },
    async (req, reply) => {
      try {
        const { key } = req.params;
        const dbRes = await dbService.iptv.getByField({ key });
        const res = dbRes?.[0] ?? {};
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.put<{ Params: SetDefaultIptvParams }>(
    `/${API_PREFIX}/default/:id`,
    {
      schema: setDefaultSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const dbResDetail = await dbService.iptv.get(id);
        const { api, type } = dbResDetail || {};
        if (isStrEmpty(api) || !isNumber(type)) {
          return reply.code(400).send({ code: -1, msg: 'Invalid parameters', data: null });
        }

        const parseRes = await convertToStandard(api, type as IIptvType);
        if (isArrayEmpty(parseRes)) {
          return reply.code(200).send({ code: 0, msg: 'ok', data: { success: false } });
        }

        await dbService.channel.set(parseRes as IModels['channel'][]);
        await dbService.setting.update({ key: 'defaultIptv', value: id });

        return reply.code(200).send({ code: 0, msg: 'ok', data: { success: true } });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Params: GetCheckIptvParams }>(
    `/${API_PREFIX}/check/:id`,
    {
      schema: getCheckSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const dbResDetail = await dbService.iptv.get(id);
        const { api, type } = dbResDetail || {};
        if (isStrEmpty(api) || !isNumber(type)) {
          return reply.code(400).send({ code: -1, msg: 'Invalid parameters', data: null });
        }

        const parseRes = await convertToStandard(api, type as IIptvType);
        const status = !isArrayEmpty(parseRes);
        return reply.code(200).send({ code: 0, msg: 'ok', data: { success: status } });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
