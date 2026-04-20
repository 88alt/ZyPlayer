import { siteTypes } from '@shared/config/film';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

import { ResponseErrorSchema, ResponseSuccessSchema } from '../../base';

const API_PREFIX = 'film';

export const domPdSchema = {
  tags: [API_PREFIX],
  summary: 'Parser pd',
  description: 'Parsing content with the pd function',
  body: Type.Object({
    rule: Type.String({ description: 'rule' }),
    html: Type.String({ description: 'html, post-transfer incoming' }),
    baseUrl: Type.Optional(Type.String({ description: 'base url' })),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.String({ description: 'pd data' }),
      },
      { description: 'Response schema for pd' },
    ),
    500: ResponseErrorSchema,
  },
};

export const domPdfaSchema = {
  tags: [API_PREFIX],
  summary: 'Parser pdfa',
  description: 'Parsing content with the pdfa function',
  body: Type.Object({
    rule: Type.String({ description: 'rule' }),
    html: Type.String({ description: 'html, post-transfer incoming' }),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.Array(Type.String(), { description: 'pdfa data' }),
      },
      { description: 'Response schema for pdfa' },
    ),
    500: ResponseErrorSchema,
  },
};

export const domPdfhSchema = {
  tags: [API_PREFIX],
  summary: 'Parser pdfh',
  description: 'Parsing content with the pdfh function',
  body: Type.Object({
    rule: Type.String({ description: 'rule' }),
    html: Type.String({ description: 'html, post-transfer incoming' }),
    baseUrl: Type.Optional(Type.String({ description: 'base url' })),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.String({ description: 'pdfl data' }),
      },
      { description: 'Response schema for pdfh' },
    ),
    500: ResponseErrorSchema,
  },
};

export const domPdflSchema = {
  tags: [API_PREFIX],
  summary: 'Parser pdfl',
  description: 'Parsing content with the pdfl function',
  body: Type.Object({
    rule: Type.String({ description: 'rule' }),
    html: Type.String({ description: 'html, post-transfer incoming' }),
    listText: Type.String({ description: 'list text' }),
    listUrl: Type.String({ description: 'list url' }),
    baseUrl: Type.Optional(Type.String({ description: 'baseurl' })),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.String({ description: 'pdfl data' }),
      },
      { description: 'Response schema for pdfl' },
    ),
    500: ResponseErrorSchema,
  },
};

export const siftCategorySchema = {
  tags: [API_PREFIX],
  summary: 'Parser sift category',
  description: 'Parsing content with the sift category function',
  body: Type.Object({
    html: Type.String({ description: 'html, post-transfer incoming' }),
    categoryRule: Type.String({ description: 'category parse' }),
    categoryExclude: Type.Optional(Type.String({ description: 'category exclude, vertical line split' })),
    categoryUrl: Type.String({ description: 'category url, "fyclass" instead of category uuid' }),
    baseUrl: Type.String({ description: 'base url' }),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.Object({
          title: Type.String(),
          uuid: Type.String(),
          raw: Type.Array(
            Type.Object({
              title: Type.String(),
              uuid: Type.String(),
              path_url: Type.Optional(Type.String()),
              source_url: Type.Optional(Type.String()),
            }),
          ),
        }),
      },
      { description: 'Response schema for sift category' },
    ),
    500: ResponseErrorSchema,
  },
};

export const siftFilterSchema = {
  tags: [API_PREFIX],
  summary: 'Parser sift filter',
  description: 'Parsing content with the sift filter function',
  body: Type.Object({
    html: Type.String({ description: 'html, post-transfer incoming' }),
    baseRule: Type.String({ description: 'base rule' }),
    detailRule: Type.String({ description: 'detail rule' }),
    matchs: Type.Record(Type.String(), Type.String(), { description: 'matchs' }),
    ci: Type.Optional(Type.String({ description: 'ci' })),
    excludeKeys: Type.Optional(Type.String({ description: 'exclude keys, vertical line split' })),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.Any({ description: 'sift filter data' }),
      },
      { description: 'Response schema for sift filter' },
    ),
    500: ResponseErrorSchema,
  },
};

export const templateNameSchema = {
  tags: [API_PREFIX],
  summary: 'Get template names',
  description: 'Get template names by type',
  params: Type.Object({
    type: Type.Integer({ format: 'int32', enum: siteTypes, description: 'type' }),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.Array(Type.String(), { description: 'template names' }),
      },
      { description: 'Response schema for template names' },
    ),
    500: ResponseErrorSchema,
  },
};

export const templateDetailSchema = {
  tags: [API_PREFIX],
  summary: 'Get template detail',
  description: 'Get template detail by type and name',
  params: Type.Object({
    type: Type.Integer({ format: 'int32', enum: siteTypes, description: 'type' }),
    name: Type.String({ description: 'name' }),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.Any({ description: 'template detail data' }),
      },
      { description: 'Response schema for template detail' },
    ),
    500: ResponseErrorSchema,
  },
};

export const decryptSchema = {
  tags: [API_PREFIX],
  summary: 'Decrypt code',
  description: 'Decrypt code content',
  consumes: ['text/plain'],
  params: Type.Object({
    type: Type.Integer({ format: 'int32', enum: siteTypes, description: 'type' }),
  }),
  body: Type.String({ description: 'code content' }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.String({ description: 'decrypted code content' }),
      },
      { description: 'Response schema for decrypt' },
    ),
    500: ResponseErrorSchema,
  },
};

export type DomPdBody = Static<typeof domPdSchema.body>;
export type DomPdfaBody = Static<typeof domPdfaSchema.body>;
export type DomPdfhBody = Static<typeof domPdfhSchema.body>;
export type DomPdflBody = Static<typeof domPdflSchema.body>;
export type SiftCategoryBody = Static<typeof siftCategorySchema.body>;
export type SiftFilterBody = Static<typeof siftFilterSchema.body>;
export type TemplateNameParams = Static<typeof templateNameSchema.params>;
export type TemplateDetailParams = Static<typeof templateDetailSchema.params>;
export type DecryptParams = Static<typeof decryptSchema.params>;
export type DecryptBody = Static<typeof decryptSchema.body>;
