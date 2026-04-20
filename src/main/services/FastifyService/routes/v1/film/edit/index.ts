import { pd, pdfa, pdfh, pdfl } from '@main/utils/hiker/htmlParser';
import type {
  DecryptBody,
  DecryptParams,
  DomPdBody,
  DomPdfaBody,
  DomPdfhBody,
  DomPdflBody,
  SiftCategoryBody,
  SiftFilterBody,
  TemplateDetailParams,
  TemplateNameParams,
} from '@server/schemas/v1/flim/edit';
import {
  decryptSchema,
  domPdfaSchema,
  domPdfhSchema,
  domPdflSchema,
  domPdSchema,
  siftCategorySchema,
  siftFilterSchema,
  templateDetailSchema,
  templateNameSchema,
} from '@server/schemas/v1/flim/edit';
import { SITE_TYPE } from '@shared/config/film';
import { isObjectEmpty } from '@shared/modules/validate';
import type { FastifyPluginAsync } from 'fastify';

import { convertOriginalCode as t3DrpyDecrypt } from '../cms/adapter/t3Drpy/decrypt';
import { renderTemplate as t3DrpyTemplates } from '../cms/adapter/t3Drpy/templates';
import { siftCategory, siftFilter } from './utils/sift';

const TEMPLATES_MAP = {
  [SITE_TYPE.T3_DRPY]: t3DrpyTemplates,
};

const DECRYPT_MAP = {
  [SITE_TYPE.T3_DRPY]: t3DrpyDecrypt,
  [SITE_TYPE.T4_DRPYS]: t3DrpyDecrypt,
};

const API_PREFIX = 'film/edit';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<{ Body: DomPdBody }>(
    `/${API_PREFIX}/dom/pd`,
    {
      schema: domPdSchema,
    },
    async (req, reply) => {
      try {
        const { html, rule, baseUrl } = req.body;
        const res = pd(html, rule, baseUrl);
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.post<{ Body: DomPdfaBody }>(
    `/${API_PREFIX}/dom/pdfa`,
    {
      schema: domPdfaSchema,
    },
    async (req, reply) => {
      try {
        const { html, rule } = req.body;
        const res = pdfa(html, rule);
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.post<{ Body: DomPdfhBody }>(
    `/${API_PREFIX}/dom/pdfh`,
    {
      schema: domPdfhSchema,
    },
    async (req, reply) => {
      try {
        const { html, rule, baseUrl } = req.body;
        const res = pdfh(html, rule, baseUrl);
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.post<{ Body: DomPdflBody }>(
    `/${API_PREFIX}/dom/pdfl`,
    {
      schema: domPdflSchema,
    },
    async (req, reply) => {
      try {
        const { html, rule, listText, listUrl, baseUrl = '' } = req.body;
        const res = pdfl(html, rule, listText, listUrl, baseUrl);
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.post<{ Body: SiftCategoryBody }>(
    `/${API_PREFIX}/sift/category`,
    {
      schema: siftCategorySchema,
    },
    async (req, reply) => {
      try {
        const { html, baseUrl, categoryUrl, categoryRule, categoryExclude = '' } = req.body;
        const res = siftCategory(html, baseUrl, categoryUrl, categoryRule, categoryExclude);
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.post<{ Body: SiftFilterBody }>(
    `/${API_PREFIX}/sift/filter`,
    {
      schema: siftFilterSchema,
    },
    async (req, reply) => {
      try {
        const { html, baseRule, detailRule, matchs, ci = '', excludeKeys = '' } = req.body;
        const res = siftFilter(html, baseRule, detailRule, matchs, ci, excludeKeys);
        return reply.code(200).send({ code: 0, msg: 'ok', data: res });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Params: TemplateNameParams }>(
    `/${API_PREFIX}/template/:type`,
    {
      schema: templateNameSchema,
    },
    async (req, reply) => {
      try {
        const { type: rawType } = req.params;
        const type = Number.parseInt(rawType as unknown as string);

        if (isObjectEmpty(TEMPLATES_MAP[type]?.templates || {})) {
          return reply.code(200).send({ code: 0, msg: 'ok', data: [] });
        }
        const templates = Object.keys(TEMPLATES_MAP[type].templates);

        return reply.code(200).send({ code: 0, msg: 'ok', data: templates });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Params: TemplateDetailParams }>(
    `/${API_PREFIX}/template/:type/:name`,
    {
      schema: templateDetailSchema,
    },
    async (req, reply) => {
      try {
        const { type: rawType, name } = req.params;
        const type = Number.parseInt(rawType as unknown as string);

        if (!Object.hasOwn(TEMPLATES_MAP[type]?.templates || {}, name)) {
          return reply.code(200).send({ code: 0, msg: 'ok', data: '' });
        }
        const template = TEMPLATES_MAP[type].detail(name) || '';

        return reply.code(200).send({ code: 0, msg: 'ok', data: template });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.post<{ Params: DecryptParams; Body: DecryptBody }>(
    `/${API_PREFIX}/decrypt/:type`,
    {
      schema: decryptSchema,
    },
    async (req, reply) => {
      try {
        const rawCode = req.body;
        const { type: rawType } = req.params;
        const type = Number.parseInt(rawType as unknown as string);

        if (!Object.hasOwn(DECRYPT_MAP, type)) {
          return reply.code(200).send({ code: 0, msg: 'ok', data: '' });
        }
        const code = DECRYPT_MAP[type]?.(rawCode) || '';

        return reply.code(200).send({ code: 0, msg: 'ok', data: code });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
