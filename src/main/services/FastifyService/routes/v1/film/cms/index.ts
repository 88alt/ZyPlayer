import { dbService } from '@main/services/DbService';
import type {
  CmsActionQuery,
  CmsCategoryQuery,
  CmsCheckQuery,
  CmsDetailQuery,
  CmsHomeQuery,
  CmsHomeVodQuery,
  CmsInitQuery,
  CmsPlayQuery,
  CmsProxyQuery,
  CmsSearchQuery,
} from '@server/schemas/v1/flim/cms';
import {
  getActionSchema,
  getCategorySchema,
  getCheckSchema,
  getDetailSchema,
  getHomeSchema,
  getHomeVodSchema,
  getInitchema,
  getPlaySchema,
  getProxySchema,
  getSearchSchema,
} from '@server/schemas/v1/flim/cms';
import { runRetryAsyncFunction } from '@shared/modules/function';
import {
  isArray,
  isArrayEmpty,
  isJsonStr,
  isNil,
  isObject,
  isObjectEmpty,
  isPositiveFiniteNumber,
  isStrEmpty,
  isString,
} from '@shared/modules/validate';
import type {
  ICmsAction,
  ICmsCategory,
  ICmsDetail,
  ICmsHome,
  ICmsHomeVod,
  ICmsPlay,
  ICmsProxy,
  ICmsSearch,
} from '@shared/types/cms';
import type { FastifyPluginAsync } from 'fastify';
import JSON5 from 'json5';

import { prepare } from './utils/cache';
import { formatCategories, formatEpisode, formatInfoContent } from './utils/cms';

const API_PREFIX = 'film/cms';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get<{ Querystring: CmsInitQuery }>(
    `/${API_PREFIX}/init`,
    {
      schema: getInitchema,
    },
    async (req, reply) => {
      try {
        const { uuid, force = false } = req.query || {};
        try {
          await prepare(uuid, force);
          return reply.code(200).send({ code: 0, msg: 'ok', data: true });
        } catch {
          return reply.code(200).send({ code: 0, msg: 'ok', data: false });
        }
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: CmsHomeQuery }>(
    `/${API_PREFIX}/home`,
    {
      schema: getHomeSchema,
    },
    async (req, reply) => {
      try {
        const { uuid } = req.query || {};

        const adapter = await prepare(uuid);
        const resp = await adapter.home();

        const source = await dbService.site.get(uuid);

        const categories = formatCategories(source.categories || '');

        const rawClassList = Array.isArray(resp?.class) ? resp?.class : [];
        const classes = rawClassList
          .filter(
            (item, index, self) =>
              item.type_id &&
              item.type_name &&
              !categories?.includes(item.type_name) &&
              self.findIndex((other) => other.type_id === item.type_id) === index,
          )
          .map((item) => ({
            type_id: String(item.type_id ?? '').trim(),
            type_name: item.type_name?.toString().trim() ?? '',
          }));
        const classIds = classes.map((item) => item.type_id);

        const rawFiltersObj = resp?.filters && Object.keys(resp?.filters).length ? resp.filters : {};
        const filters = Object.keys(rawFiltersObj).reduce<Record<string, any>>((acc, key) => {
          if (String(key) && classIds.includes(String(key))) {
            acc[String(key)] = rawFiltersObj[key];
          }
          return acc;
        }, {});

        const res = { class: classes, filters } as ICmsHome;

        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: CmsHomeVodQuery }>(
    `/${API_PREFIX}/homeVod`,
    {
      schema: getHomeVodSchema,
    },
    async (req, reply) => {
      try {
        const { uuid } = req.query || {};

        const adapter = await prepare(uuid);
        const resp = await adapter.homeVod();

        const videos = (Array.isArray(resp?.list) ? resp.list : [])
          .filter((v) => v.vod_id && v.vod_id !== 'no_data')
          .map((v) => ({
            vod_id: String(v.vod_id ?? ''),
            vod_name: v.vod_name ?? '',
            vod_pic: v.vod_pic ?? '',
            vod_remarks: formatInfoContent(v.vod_remarks ?? ''),
            vod_blurb: formatInfoContent(v.vod_blurb ?? ''),
            vod_tag: ['action', 'file', 'folder'].includes(v.vod_tag || 'file') ? v.vod_tag : 'file',
          }));
        const pagecurrent = Number(resp?.page) || 1;
        const pagecount = Number(resp?.pagecount) || 0;
        const total = Number(resp?.total) || 0;

        const res = { page: pagecurrent, pagecount, total, list: videos } as ICmsHomeVod;

        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: CmsCategoryQuery }>(
    `/${API_PREFIX}/category`,
    {
      schema: getCategorySchema,
    },
    async (req, reply) => {
      try {
        let { uuid, tid, page = 1, extend: rawExtend = '{}' } = req.query || {};
        if (isString(page)) page = Number.parseInt(page);
        if (!isPositiveFiniteNumber(page)) page = 1;
        const extend = isJsonStr(rawExtend) ? JSON5.parse(rawExtend) : {};

        const adapter = await prepare(uuid);
        const resp = tid === '' ? await adapter.homeVod() : await adapter.category({ tid, page, extend });

        const videos = (Array.isArray(resp?.list) ? resp.list : [])
          .filter((v) => v.vod_id && v.vod_id !== 'no_data')
          .map((v) => ({
            vod_id: String(v.vod_id ?? ''),
            vod_name: v.vod_name ?? '',
            vod_pic: v.vod_pic ?? '',
            vod_remarks: formatInfoContent(v.vod_remarks ?? ''),
            vod_blurb: formatInfoContent(v.vod_blurb ?? ''),
            vod_tag: ['action', 'file', 'folder'].includes(v.vod_tag || 'file') ? v.vod_tag : 'file',
          }));
        const pagecurrent = Number(resp?.page) || page;
        const pagecount = Number(resp?.pagecount) || 0;
        const total = Number(resp?.total) || 0;

        const res = { page: pagecurrent, pagecount, total, list: videos } as ICmsCategory;

        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: CmsDetailQuery }>(
    `/${API_PREFIX}/detail`,
    {
      schema: getDetailSchema,
    },
    async (req, reply) => {
      try {
        const { uuid, ids } = req.query || {};

        const adapter = await prepare(uuid);
        const resp = await adapter.detail({ ids });

        const videos = (Array.isArray(resp?.list) ? resp.list : [])
          .filter((v) => v.vod_id)
          .map((v) => ({
            vod_id: String(v.vod_id),
            vod_name: v.vod_name ?? '',
            vod_pic: v.vod_pic ?? '',
            vod_remarks: formatInfoContent(v.vod_remarks ?? ''),
            vod_year: formatInfoContent(String(v.vod_year ?? '')),
            vod_lang: formatInfoContent(v.vod_lang ?? ''),
            vod_area: formatInfoContent(v.vod_area ?? ''),
            vod_score: formatInfoContent(String((v.vod_score || v.vod_douban_score) ?? '0.0')),
            vod_state: formatInfoContent(v.vod_state ?? ''),
            vod_class: formatInfoContent(v.vod_class ?? ''),
            vod_actor: formatInfoContent(v.vod_actor ?? ''),
            vod_director: formatInfoContent(v.vod_director ?? ''),
            vod_content: formatInfoContent(v.vod_content ?? ''),
            vod_blurb: formatInfoContent(v.vod_blurb ?? ''),
            vod_play_from: v.vod_play_from ?? '',
            vod_play_url: v.vod_play_url ?? '',
            vod_episode: formatEpisode(v.vod_play_from, v.vod_play_url) || {},
            type_name: v.type_name ?? '',
          }));
        const pagecurrent = Number(resp?.page) || 1;
        const pagecount = Number(resp?.pagecount) || 0;
        const total = Number(resp?.total) || 0;

        const res = { page: pagecurrent, pagecount, total, list: videos } as ICmsDetail;

        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: CmsSearchQuery }>(
    `/${API_PREFIX}/search`,
    {
      schema: getSearchSchema,
    },
    async (req, reply) => {
      try {
        let { uuid, wd, page = 1 } = req.query || {};
        if (isString(page)) page = Number.parseInt(page);
        if (!isPositiveFiniteNumber(page)) page = 1;

        const adapter = await prepare(uuid);
        const resp = await adapter.search({ wd, page });

        const videos = (Array.isArray(resp?.list) ? resp.list : [])
          .filter((v) => v.vod_id)
          .map((v) => ({
            vod_id: String(v.vod_id ?? ''),
            vod_name: v.vod_name ?? '',
            vod_pic: v.vod_pic ?? '',
            vod_remarks: formatInfoContent(v.vod_remarks ?? ''),
            vod_blurb: formatInfoContent(v.vod_blurb ?? ''),
            vod_tag: ['action', 'file', 'folder'].includes(v.vod_tag || 'file') ? v.vod_tag : 'file',
          }));
        const pagecurrent = Number(resp?.page) || page;
        const pagecount = Number(resp?.pagecount) || 0;
        const total = Number(resp?.total) || 0;

        const res = { page: pagecurrent, pagecount, total, list: videos } as ICmsSearch;

        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: CmsPlayQuery }>(
    `/${API_PREFIX}/play`,
    {
      schema: getPlaySchema,
    },
    async (req, reply) => {
      try {
        const { uuid, flag, play } = req.query || {};

        const adapter = await prepare(uuid);
        const resp = await adapter.play({ flag, play });

        const res = {
          url: isString(resp?.url) && !isStrEmpty(resp.url) ? resp.url : '',
          quality: isArray(resp?.quality) && !isArrayEmpty(resp.quality) ? resp.quality : [],
          parse: isPositiveFiniteNumber(resp?.parse) ? resp.parse : 0,
          jx: isPositiveFiniteNumber(resp?.jx) ? resp.jx : 0,
          headers: isObject(resp?.headers) && !isObjectEmpty(resp.headers) ? resp.headers : {},
          script: isObject(resp?.script) && !isObjectEmpty(resp.script) ? resp.script : {},
        } as ICmsPlay;

        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: CmsActionQuery }>(
    `/${API_PREFIX}/action`,
    {
      schema: getActionSchema,
    },
    async (req, reply) => {
      try {
        const { uuid, action, value, timeout } = req.query || {};

        const adapter = await prepare(uuid);
        const resp = await adapter.action({ action, value, timeout });

        const res = resp as ICmsAction;

        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: CmsProxyQuery }>(
    `/${API_PREFIX}/proxy`,
    {
      schema: getProxySchema,
    },
    async (req, reply) => {
      try {
        const { uuid, ...args } = req.query || {};

        const adapter = await prepare(uuid);
        const resp = await adapter.proxy(args);

        const res = resp as ICmsProxy;

        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Querystring: CmsCheckQuery }>(
    `/${API_PREFIX}/check`,
    {
      schema: getCheckSchema,
    },
    async (req, reply) => {
      try {
        const { uuid, type } = req.query || {};
        const retry = 3;
        const adapter = await prepare(uuid);

        const checkSearch = async () => {
          await runRetryAsyncFunction(
            async () => {
              const keywords = ['我', '你', '他'];
              const wd = keywords[Math.floor(Math.random() * keywords.length)];
              return await adapter.search({ wd });
            },
            retry,
            (result) => !isNil(result?.list) && !isArrayEmpty(result.list) && result.list[0]?.vod_id !== 'no_data',
          );

          return true;
        };

        const checkMain = async () => {
          const home = await adapter.home();
          if (isNil(home.class) || isArrayEmpty(home.class)) return false;

          let category = await runRetryAsyncFunction(
            async () => {
              const tid = home.class[Math.floor(Math.random() * home.class.length)]?.type_id;
              return await adapter.category({ tid });
            },
            retry,
            (result) => !isNil(result?.list) && !isArrayEmpty(result.list) && result.list[0]?.vod_id !== 'no_data',
          );

          const filteredList = category.list?.filter((item) => !['folder', 'action'].includes(item?.vod_tag)) || [];
          const hasSpecialTags = category.list?.some((item) => ['folder', 'action'].includes(item?.vod_tag));
          if (filteredList.length === 0 && hasSpecialTags) {
            return true;
          } else if (filteredList.length > 0) {
            category = { ...category, list: filteredList };
          }

          const detail = await runRetryAsyncFunction(
            async () => {
              const ids = category.list[Math.floor(Math.random() * category.list.length)]?.vod_id;
              return await adapter.detail({ ids });
            },
            retry,
            (result) =>
              !isNil(result?.list) &&
              !isArrayEmpty(result.list) &&
              !!result.list[0]?.vod_play_url &&
              !!result.list[0]?.vod_play_from,
          );

          const vod_episode = formatEpisode(detail.list[0].vod_play_from, detail.list[0].vod_play_url)!;
          const resPlay = await adapter.play({
            flag: Object.keys(vod_episode)[0] || '',
            play: vod_episode[Object.keys(vod_episode)[0]]?.[0].link || '',
          });
          return (
            (isString(resPlay?.url) && !isStrEmpty(resPlay.url)) ||
            (isArray(resPlay?.url) && !isArrayEmpty(resPlay.url))
          );
        };

        const typeCheckMap: Record<string, (() => Promise<boolean>)[]> = {
          search: [checkSearch],
          simple: [checkMain],
          complete: [checkSearch, checkMain],
        };

        const checks = typeCheckMap[type] || [];

        try {
          for (const fn of checks) {
            if (!(await fn())) {
              return reply.code(200).send({ code: 0, msg: 'ok', data: false });
            }
          }
        } catch (error) {
          fastify.log.error(error);
          return reply.code(200).send({ code: 0, msg: 'ok', data: false });
        }

        return reply.code(200).send({ code: 0, msg: 'ok', data: true });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: 0, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
