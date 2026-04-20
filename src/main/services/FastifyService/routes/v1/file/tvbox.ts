import { basename, dirname, extname, join } from 'node:path';

import {
  fileState,
  fileStateSync,
  pathExist,
  readDirFaster,
  readDirSync,
  readFile,
  readFileSync,
  saveFile,
} from '@main/utils/file';
import { APP_FILE_PATH } from '@main/utils/path';
import type { TvboxAutoParams, TvboxMakeParams } from '@server/schemas/v1/file/tvbox';
import { autoSchema, makeSchema } from '@server/schemas/v1/file/tvbox';
import { PREFIX_API } from '@shared/config/env';
import { randomUUID } from '@shared/modules/crypto';
import type { FastifyPluginAsync } from 'fastify';

const API_PREFIX = 'file/film';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get<{ Params: TvboxAutoParams }>(
    `/${API_PREFIX}/auto/:type/*`,
    {
      schema: autoSchema,
    },
    async (req, reply) => {
      try {
        const { type = 'file', '*': path } = req.params;
        const filePath = type === 'file' ? join(APP_FILE_PATH, path) : path;

        const files = await readDirFaster(filePath, 3, (path, _isDirectory) => {
          return !/\.(?:js|py)(?:\?.*)?$/.test(path);
        });

        const matchApi = (ext: string, path: string) => {
          if (ext === '.js') {
            return 'https://raw.githubusercontent.com/hjdhnx/drpy-webpack/refs/heads/main/src/drpy2.min.js';
          }
          if (ext === '.py') return `${PREFIX_API}/v1/file/manage/${type}/${path}`;
          return '';
        };
        const matchExt = (ext: string, path: string) => {
          if (ext === '.js') {
            return `${PREFIX_API}/v1/file/manage/${type}/${path}`;
          }
          if (ext === '.py') return '';
          return '';
        };

        const sites = files.map((path) => {
          const uuid = randomUUID();

          const fullName = basename(path);
          const ext = extname(fullName);
          const name = basename(fullName, ext);

          const relativePath = type === 'file' ? path.replace(`${APP_FILE_PATH}/`, '') : path;

          return {
            id: uuid,
            key: uuid,
            name,
            type: 3,
            api: matchApi(ext, relativePath),
            searchable: 1,
            quickSearch: 0,
            filterable: 1,
            ext: matchExt(ext, relativePath),
          };
        });

        return reply.code(200).send({ sites });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Params: TvboxMakeParams }>(
    `/${API_PREFIX}/make/:type/*`,
    {
      schema: makeSchema,
    },
    async (req, reply) => {
      try {
        const { type = 'file', '*': path } = req.params;
        const filePath = type === 'file' ? join(APP_FILE_PATH, path) : path;

        const exists = await pathExist(filePath);
        if (!exists) {
          return reply.code(200).send({});
        }

        const state = await fileState(filePath);
        if (state !== 'dir' && state !== 'file') {
          return reply.code(200).send({});
        }

        const indexPath = join(filePath, 'index.js');
        const jsonPath = join(filePath, 'index.json');

        const indexState = await fileState(indexPath);
        if (indexState === 'file') {
          const content = await readFile(indexPath);

          // eslint-disable-next-line no-new-func
          const func = new Function('pathLib', 'path_dir', `${content}\n return main;`);
          const fn = func(
            {
              join,
              dirname,
              readDir: readDirSync,
              readFile: readFileSync,
              stat: fileStateSync,
            },
            filePath,
          );
          const resp = await fn();

          await saveFile(join(filePath, 'index.json'), resp);
        }

        const jsonState = await fileState(jsonPath);
        if (jsonState === 'file') {
          const content = await readFile(jsonPath);
          return reply.code(200).send(content);
        }

        return reply.code(200).send({});
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
