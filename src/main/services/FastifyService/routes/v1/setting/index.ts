import { dbService } from '@main/services/DbService';
import type {
  AddSettingBody,
  DeleteSettingBody,
  GetSettingDetailParams,
  GetSettingDetailValueParams,
  PutSettingBody,
  PutSettingSourceBody,
} from '@server/schemas/v1/setting';
import {
  addSchema,
  deleteSchema,
  getDetailSchema,
  getDetailValueSchema,
  getListSchema,
  getSetupSchema,
  putSchema,
  putSourceSchema,
} from '@server/schemas/v1/setting';
import type { ISettingKey } from '@shared/config/tblSetting';
import { settingList as tblSetting, setupKeys } from '@shared/config/tblSetting';
import type { FastifyPluginAsync } from 'fastify';

const API_PREFIX = 'setting';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<{ Body: AddSettingBody }>(
    `/${API_PREFIX}`,
    {
      schema: addSchema,
    },
    async (req, reply) => {
      try {
        const { key, value } = req.body as { key: ISettingKey; value: any };
        const dbRes = await dbService.setting.add({ key, value });
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.delete<{ Body: DeleteSettingBody }>(
    `/${API_PREFIX}`,
    {
      schema: deleteSchema,
    },
    async (req, reply) => {
      try {
        const { keys } = (req.body || {}) as { keys?: ISettingKey[] };
        if (!keys || keys.length === 0) {
          await dbService.setting.clear();
        } else {
          await dbService.setting.remove(keys);
        }
        return reply.code(200).send({ code: 0, msg: 'ok', data: null });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.put<{ Body: PutSettingBody }>(
    `/${API_PREFIX}`,
    {
      schema: putSchema,
    },
    async (req, reply) => {
      try {
        const { key, value } = req.body as { key: ISettingKey; value: any };
        const dbRes = await dbService.setting.update({ key, value });
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get(
    `/${API_PREFIX}/list`,
    {
      schema: getListSchema,
    },
    async (_req, reply) => {
      try {
        const dbRes = await dbService.setting.all();
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get(
    `/${API_PREFIX}/setup`,
    {
      schema: getSetupSchema,
    },
    async (_req, reply) => {
      try {
        const dbRes = Object.fromEntries(
          await Promise.all(setupKeys.map(async (key) => [key, await dbService.setting.getValue(key)])),
        );
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Params: GetSettingDetailParams }>(
    `/${API_PREFIX}/:key`,
    {
      schema: getDetailSchema,
    },
    async (req, reply) => {
      try {
        const { key } = req.params as { key: ISettingKey };
        const dbRes = await dbService.setting.get(key);
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Params: GetSettingDetailValueParams }>(
    `/${API_PREFIX}/value/:key`,
    {
      schema: getDetailValueSchema,
    },
    async (req, reply) => {
      try {
        const { key } = req.params as { key: ISettingKey };
        const dbRes = await dbService.setting.getValue(key);
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.put<{ Body: PutSettingSourceBody }>(
    `/${API_PREFIX}/source`,
    {
      schema: putSourceSchema,
    },
    async (req, reply) => {
      try {
        const destMap = new Map(Object.entries(req.body || {}));
        const settingMap = new Map(tblSetting.map((s) => [s.key, s.value]));
        const dbValue = await dbService.setting.all();

        const upsertPromises: Promise<unknown>[] = [];
        for (const [key, fallback] of settingMap) {
          const value = destMap.get(key) ?? fallback;
          if (!Object.hasOwn(dbValue, key)) {
            upsertPromises.push(dbService.setting.add({ key, value }));
          } else if (dbValue[key as ISettingKey] !== value) {
            upsertPromises.push(dbService.setting.update({ key, value }));
          }
        }
        await Promise.all(upsertPromises);

        const toDelete = Object.keys(dbValue).filter((key) => !settingMap.has(key as ISettingKey));
        if (toDelete.length) {
          await dbService.setting.remove(toDelete as ISettingKey[]);
        }

        const dbRes = await dbService.setting.all();
        return reply.code(200).send({ code: 0, msg: 'ok', data: dbRes });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
