import { dbService } from '@main/services/DbService';
import type {
  AddChannelBody,
  DeleteChannelBody,
  GetChannelDetailParams,
  GetChannelEpgQuery,
  GetChannelPageQuery,
  PutChannelBody,
} from '@server/schemas/v1/live/channel';
import {
  addSchema,
  deleteSchema,
  getDetailSchema,
  getEpgSchema,
  pageSchema,
  putSchema,
} from '@server/schemas/v1/live/channel';
import { isStrEmpty } from '@shared/modules/validate';
import type { IModels } from '@shared/types/db';
import type { FastifyPluginAsync } from 'fastify';

import { convertToStandard } from './utils/epg';

const API_PREFIX = 'live/channel';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<{ Body: AddChannelBody }>(
    `/${API_PREFIX}`,
    {
      schema: addSchema,
    },
    async (req, reply) => {
      try {
        const doc = req.body as IModels['channel'];
        const dbRes = await dbService.channel.add(doc);
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.delete<{ Body: DeleteChannelBody }>(
    `/${API_PREFIX}`,
    {
      schema: deleteSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.body || {};
        if (id && id.length !== 0) {
          await dbService.channel.remove(id);
        } else {
          await dbService.channel.clear();
        }
        return reply.code(200).send({ code: 0, msg: 'ok', data: null });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.put<{ Body: PutChannelBody }>(
    `/${API_PREFIX}`,
    {
      schema: putSchema,
    },
    async (req, reply) => {
      try {
        const { id, doc } = req.body as { id: string[]; doc: IModels['channel'] };
        const dbRes = await dbService.channel.update(id, doc);
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: GetChannelPageQuery }>(
    `/${API_PREFIX}/page`,
    {
      schema: pageSchema,
    },
    async (req, reply) => {
      try {
        const { pageNum = 1, pageSize = 10, kw, group } = req.query;

        const [dbResPage, defaultIptvId, defaultIptv, dbResGroup] = await Promise.all([
          dbService.channel.page(pageNum, pageSize, kw, group),
          dbService.setting.getValue('defaultIptv'),
          dbService.setting.getValue('live'),
          dbService.channel.group(),
        ]);

        const { logo: dbResSourceLogo = '' } = (await dbService.iptv.get(defaultIptvId)) || {};
        const defaultLogo = dbResSourceLogo || defaultIptv?.logo || '';

        const list = dbResPage.list.map((item) => ({
          ...item,
          logo: item?.logo || defaultLogo.replace('{name}', item.name),
        }));

        return reply.code(200).send({
          code: 0,
          msg: 'ok',
          data: { list, total: dbResPage.total, class: dbResGroup ?? [] },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Params: GetChannelDetailParams }>(
    `/${API_PREFIX}/:id`,
    {
      schema: getDetailSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const dbRes = await dbService.channel.get(id);
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: GetChannelEpgQuery }>(
    `/${API_PREFIX}/epg`,
    {
      schema: getEpgSchema,
    },
    async (req, reply) => {
      try {
        const { ch, date } = req.query;
        if (isStrEmpty(ch)) {
          return reply.code(400).send({ code: -1, msg: 'Invalid parameters', data: null });
        }

        const dbResIptvId = await dbService.setting.getValue('defaultIptv');
        const dbResSourceEpg = (await dbService.iptv.get(dbResIptvId))?.epg;
        const dbResSeeingEpg = (await dbService.setting.getValue('live'))?.epg;

        const api = dbResSourceEpg || dbResSeeingEpg || '';
        if (isStrEmpty(api)) {
          return reply.code(400).send({ code: -1, msg: 'EPG URL not found', data: null });
        }

        try {
          const res = await convertToStandard(api, ch, date);
          return reply.code(200).send({ code: 0, msg: 'ok', data: res });
        } catch {
          return reply.code(200).send({ code: 0, msg: 'ok', data: [] });
        }
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
