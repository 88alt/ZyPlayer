import { dbService } from '@main/services/DbService';
import type {
  GetAssociationQuery,
  GetBarrageQuery,
  GetHotQuery,
  GetMatchQuery,
  SendBarrageBody,
} from '@server/schemas/v1/flim/rec';
import {
  getAssociationSchema,
  getBarrageSchema,
  getHotSchema,
  getMatchSchema,
  sendBarrageSchema,
} from '@server/schemas/v1/flim/rec';
import { REC_ASSOCIATION_TYPE, REC_HOT_TYPE } from '@shared/config/setting';
import { isObject, isObjectEmpty, isStrEmpty, isString } from '@shared/modules/validate';
import type { IBarrageSendOptions } from '@shared/types/barrage';
import type { FastifyPluginAsync } from 'fastify';

import fetchAssociation from './utils/association';
import { fetchBarrage, sendBarrage } from './utils/barrage';
import { fetchDoubanRecomm } from './utils/douban';
import fetchHot from './utils/hot';

const API_PREFIX = 'film/rec';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get<{ Querystring: GetBarrageQuery }>(
    `/${API_PREFIX}/barrage`,
    {
      schema: getBarrageSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.query || {};
        if (!isString(id) || isStrEmpty(id)) {
          return reply.code(400).send({ code: -1, msg: 'Invalid parameters', data: null });
        }

        const dbResBarrage = await dbService.setting.getValue('barrage');
        const res = await fetchBarrage(id, dbResBarrage);
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.post<{ Body: SendBarrageBody }>(
    `/${API_PREFIX}/barrage`,
    {
      schema: sendBarrageSchema,
    },
    async (req, reply) => {
      try {
        const options = req.body as IBarrageSendOptions;
        if (!isObject(options) || isObjectEmpty(options)) {
          return reply.code(400).send({ code: -1, msg: 'Invalid parameters', data: null });
        }

        const dbResBarrage = await dbService.setting.getValue('barrage');
        const status = await sendBarrage(dbResBarrage?.url, options);
        return reply.code(200).send({ code: 0, msg: 'ok', data: { success: status } });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: GetHotQuery }>(
    `/${API_PREFIX}/hot`,
    {
      schema: getHotSchema,
    },
    async (req, reply) => {
      try {
        const { pageNum = 1, pageSize = 10, source, date, type = 1 } = req.query || {};

        const dataSource = source || (await dbService.setting.getValue('hot')) || 'komect';
        const allow = Object.values(REC_HOT_TYPE);
        if (!allow.includes(dataSource)) {
          return reply.code(200).send({ code: 0, msg: 'ok', data: [] });
        }

        const res = await fetchHot[dataSource]({ date, type, page: pageNum, pageSize });
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: GetAssociationQuery }>(
    `/${API_PREFIX}/association`,
    {
      schema: getAssociationSchema,
    },
    async (req, reply) => {
      try {
        const { pageNum = 1, pageSize = 10, source, kw } = req.query || {};

        const dataSource = source || (await dbService.setting.getValue('association')) || 'douban';
        const allow = Object.values(REC_ASSOCIATION_TYPE);

        if (!allow.includes(dataSource)) {
          return reply.code(200).send({ code: 0, msg: 'ok', data: [] });
        }

        const res = await fetchAssociation[dataSource]({ kw, page: pageNum, pageSize });
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: GetMatchQuery }>(
    `/${API_PREFIX}/match`,
    {
      schema: getMatchSchema,
    },
    async (req, reply) => {
      try {
        const { name, year, id, type } = req.query || {};
        const res = await fetchDoubanRecomm({ name, year, id, type });
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
