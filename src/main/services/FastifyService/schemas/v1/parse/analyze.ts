import { analyzeTypes } from '@shared/config/parse';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

import { PageQuery, ResponseErrorSchema, ResponseSuccessSchema } from '../../base';

const API_PREFIX = 'parse';

const AnalyzeSchema = Type.Object({
  id: Type.String({ description: 'id' }),
  key: Type.String({ description: 'key' }),
  name: Type.Union([Type.String(), Type.Null()], { description: 'name' }),
  api: Type.String({ description: 'api' }),
  type: Type.Integer({ format: 'int32', enum: analyzeTypes, description: 'type' }),
  flag: Type.Array(Type.String(), { description: 'flag' }),
  headers: Type.Union([Type.Record(Type.String(), Type.Any()), Type.Null()], { description: 'headers' }),
  script: Type.Union([Type.String(), Type.Null()], { description: 'script' }),
  isActive: Type.Boolean({ description: 'active status' }),
  createdAt: Type.Integer({ format: 'int64', description: 'created timestamp' }),
  updatedAt: Type.Integer({ format: 'int64', description: 'updated timestamp' }),
});

export const AnalyzeResponse = Type.Omit(AnalyzeSchema, []);

const AnalyzeListResponse = Type.Object({
  list: Type.Array(AnalyzeResponse),
  total: Type.Number({ description: 'Total count' }),
  default: Type.String({ description: 'Default id' }),
});

const AnalyzeActiveListResponse = Type.Object({
  list: Type.Array(AnalyzeResponse),
  default: Type.Union([AnalyzeResponse, Type.Object({}, { additionalProperties: false })], {
    description: 'default data',
  }),
  extra: Type.Partial(Type.Object({})),
});

const AnalyzeResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: AnalyzeResponse,
  },
  { description: 'Response schema for analyze response' },
);

const AnalyzeListResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: AnalyzeListResponse,
  },
  { description: 'Response schema for analyze list' },
);

const AnalyzeActiveListResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: AnalyzeActiveListResponse,
  },
  { description: 'Response schema for analyze active list' },
);

const AnalyzeArrayResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Array(AnalyzeResponse),
  },
  { description: 'Response schema for analyze array' },
);

export const addSchema = {
  tags: [API_PREFIX],
  summary: 'Add data',
  description: 'Add a new data',
  body: Type.Partial(Type.Omit(AnalyzeSchema, ['id', 'createdAt', 'updatedAt'])),
  response: {
    200: AnalyzeArrayResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const deleteSchema = {
  tags: [API_PREFIX],
  summary: 'Delete data',
  description: 'Delete by id or type, if id and type is empty, delete all',
  body: Type.Object({
    id: Type.Optional(Type.Array(Type.String(), { description: 'id' })),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.Null({ description: 'delete success' }),
      },
      { description: 'Response schema for delete response' },
    ),
    500: ResponseErrorSchema,
  },
};

export const putSchema = {
  tags: [API_PREFIX],
  summary: 'Set data',
  description: 'Set data',
  body: Type.Object({
    id: Type.Array(Type.String(), { description: 'id' }),
    doc: Type.Partial(Type.Omit(AnalyzeSchema, ['id', 'createdAt', 'updatedAt'])),
  }),
  response: {
    200: AnalyzeArrayResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const pageSchema = {
  tags: [API_PREFIX],
  summary: 'Get list',
  description: 'Get list with pagination and filtering',
  querystring: Type.Partial(
    Type.Object({
      kw: Type.String({ description: 'search keyword' }),
      ...PageQuery,
    }),
  ),
  response: {
    200: AnalyzeListResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const getActiveSchema = {
  tags: [API_PREFIX],
  summary: 'Get active',
  description: 'Get active data',
  response: {
    200: AnalyzeActiveListResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const getDetailSchema = {
  tags: [API_PREFIX],
  summary: 'Get detail',
  description: 'Get detail by id',
  params: Type.Object({
    id: Type.String({ description: 'id' }),
  }),
  response: {
    200: AnalyzeResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const getDetailByKeySchema = {
  tags: [API_PREFIX],
  summary: 'Get detail',
  description: 'Get detail by key',
  params: Type.Object({
    key: Type.String({ description: 'key' }),
  }),
  response: {
    200: AnalyzeResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const setDefaultSchema = {
  tags: [API_PREFIX],
  summary: 'Set default',
  description: 'Set default by id',
  params: Type.Object({
    id: Type.String({ description: 'id' }),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.Object({
          success: Type.Boolean({ description: 'Indicates whether the operation was successful' }),
        }),
      },
      { description: 'Response schema for set default response' },
    ),
    500: ResponseErrorSchema,
  },
};

export const getCheckSchema = {
  tags: [API_PREFIX],
  summary: 'Check validity',
  description: 'Check validity',
  params: Type.Object({
    id: Type.String({ description: 'id' }),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.Object({
          success: Type.Boolean({ description: 'Indicates whether the operation was successful' }),
        }),
      },
      { description: 'Response schema for check validity response' },
    ),
    500: ResponseErrorSchema,
  },
};

export type AddAnalyzeBody = Static<typeof addSchema.body>;
export type PutAnalyzeBody = Static<typeof putSchema.body>;
export type GetAnalyzeDetailParams = Static<typeof getDetailSchema.params>;
export type GetAnalyzeDetailByKeyParams = Static<typeof getDetailByKeySchema.params>;
export type DeleteAnalyzeBody = Static<typeof deleteSchema.body>;
export type GetAnalyzePageQuery = Static<typeof pageSchema.querystring>;
export type SetDefaultParams = Static<typeof setDefaultSchema.params>;
export type GetCheckParams = Static<typeof getCheckSchema.params>;
