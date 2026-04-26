import { dbService } from '@main/services/DbService';
import { fileStorage } from '@main/services/FileStorage';
import type { ClearDataBody, ExportDataBody, ImportDataBody } from '@server/schemas/v1/data/db';
import { clearSchema, exportSchema, importSchema } from '@server/schemas/v1/data/db';
import type { IDataImportType, IDataPutType, IDataRemoteType } from '@shared/config/data';
import { DATA_PAGE, DATA_PUT_TYPE, DATA_TABLE_PAGE } from '@shared/config/data';
import { isArrayEmpty } from '@shared/modules/validate';
import type { ITableName } from '@shared/types/db';
import type { FastifyPluginAsync } from 'fastify';

import { convertToStandard } from './utils/data';

const API_PREFIX = 'data/db';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.delete<{ Body: ClearDataBody }>(
    `/${API_PREFIX}/clear`,
    {
      schema: clearSchema,
    },
    async (req, reply) => {
      try {
        const { type = [] } = req.body;

        const TABLE_NAMES = dbService.tableNames;
        const tables = type.filter((t) => TABLE_NAMES.includes(t as ITableName));
        if (type.includes(DATA_PAGE.FILM)) tables.push(...DATA_TABLE_PAGE.FILM);
        if (type.includes(DATA_PAGE.LIVE)) tables.push(...DATA_TABLE_PAGE.LIVE);
        if (type.includes(DATA_PAGE.MOMENT)) tables.push(...DATA_TABLE_PAGE.MOMENT);
        if (type.includes(DATA_PAGE.PARSE)) tables.push(...DATA_TABLE_PAGE.PARSE);
        const others = type.filter((t) => !TABLE_NAMES.includes(t as ITableName));

        const otherActions: Record<string, () => Promise<void>> = {
          cache: async () => {
            await fileStorage.clearTempCache();
          },
        };

        if (!isArrayEmpty(tables)) await dbService.db.clear(tables as ITableName[]);
        await Promise.all(others.filter((t) => t in otherActions).map((t) => otherActions[t]()));

        return reply.code(200).send({ code: 0, msg: 'ok', data: { success: true } });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.post<{ Body: ExportDataBody }>(
    `/${API_PREFIX}/export`,
    {
      schema: exportSchema,
    },
    async (req, reply) => {
      try {
        const { type = [] } = req.body;

        const TABLE_NAMES = dbService.tableNames;
        const tables = type.filter((t) => TABLE_NAMES.includes(t as ITableName));
        if (type.includes(DATA_PAGE.FILM)) tables.push(...DATA_TABLE_PAGE.FILM);
        if (type.includes(DATA_PAGE.LIVE)) tables.push(...DATA_TABLE_PAGE.LIVE);
        if (type.includes(DATA_PAGE.MOMENT)) tables.push(...DATA_TABLE_PAGE.MOMENT);
        if (type.includes(DATA_PAGE.PARSE)) tables.push(...DATA_TABLE_PAGE.PARSE);

        const res = await dbService.db.all(tables as ITableName[]);
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.post<{ Body: ImportDataBody }>(
    `/${API_PREFIX}/import`,
    {
      schema: importSchema,
    },
    async (req, reply) => {
      try {
        const { api, putType, importType, remoteType } = req.body as {
          api: string;
          putType: IDataPutType;
          importType: IDataImportType;
          remoteType: IDataRemoteType;
        };
        const method = putType === DATA_PUT_TYPE.ADDITIONAL ? 'add' : 'set';

        const data = await convertToStandard(importType, remoteType, api);
        if (putType === DATA_PUT_TYPE.ADDITIONAL) delete data.setting;

        const ops = (Object.keys(data) as ITableName[]).map((t) => dbService[t][method](data[t] as any));
        const res = await Promise.allSettled(ops);

        const ststus = res.filter((r) => r.status === 'rejected').length === 0;
        return reply.code(200).send({ code: 0, msg: 'ok', data: { success: ststus } });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
