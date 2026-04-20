import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

import { PageQuery, ResponseErrorSchema, ResponseSuccessSchema } from '../../base';

const API_PREFIX = 'moment';

const HistorySchema = Type.Object({
  id: Type.String({ description: 'id' }),
  type: Type.Integer({ format: 'int32', enum: [1, 2, 3, 5, 6, 7], description: 'type' }),
  relateId: Type.String({ description: 'relate id' }),
  siteSource: Type.Union([Type.String(), Type.Null()], { description: 'site source' }),
  playEnd: Type.Boolean({ description: 'watch end' }),
  videoId: Type.String({ description: 'video id' }),
  videoImage: Type.Union([Type.String(), Type.Null()], { description: 'video image' }),
  videoName: Type.Union([Type.String(), Type.Null()], { description: 'video name' }),
  videoIndex: Type.Union([Type.String(), Type.Null()], { description: 'video index' }),
  watchTime: Type.Union([Type.Number({ format: 'float' }), Type.Null()], { description: 'watch time' }),
  duration: Type.Union([Type.Number({ format: 'float' }), Type.Null()], { description: 'video duration' }),
  skipTimeInEnd: Type.Union([Type.Number({ format: 'float' }), Type.Null()], { description: 'skip time in end' }),
  skipTimeInStart: Type.Union([Type.Number({ format: 'float' }), Type.Null()], { description: 'skip time in start' }),
  createdAt: Type.Integer({ format: 'int64', description: 'created timestamp' }),
  updatedAt: Type.Integer({ format: 'int64', description: 'updated timestamp' }),
});

const HistoryResponse = Type.Omit(HistorySchema, []);

const HistoryListResponse = Type.Object({
  list: Type.Array(
    Type.Intersect([
      HistorySchema,
      Type.Object({
        relateSite: Type.Any({ description: 'Relate info' }),
      }),
    ]),
  ),
  total: Type.Optional(Type.Integer({ format: 'int32' })),
});

const HistoryResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Union([HistoryResponse, Type.Object({}, { additionalProperties: false })], {
      description: 'History data',
    }),
  },
  { description: 'Response schema for History response' },
);

const HistoryListResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: HistoryListResponse,
  },
  { description: 'Response schema for History list' },
);

const HistoryArrayResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Array(HistoryResponse),
  },
  { description: 'Response schema for History array' },
);

export const addSchema = {
  tags: [API_PREFIX],
  summary: 'Add data',
  description: 'Add a new data',
  body: Type.Partial(Type.Omit(HistorySchema, ['id', 'createdAt', 'updatedAt'])),
  response: {
    200: HistoryArrayResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const deleteSchema = {
  tags: [API_PREFIX],
  summary: 'Delete data',
  description: 'Delete by id or type, if id and type is empty, delete all',
  body: Type.Partial(
    Type.Object({
      id: Type.Optional(Type.Array(Type.String(), { description: 'id' })),
      type: Type.Optional(
        Type.Array(Type.Integer({ format: 'int32', enum: [1, 2, 3, 5, 6, 7] }), { description: 'search type' }),
      ),
    }),
  ),
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
    id: Type.Array(Type.String(), { description: 'updated id' }),
    doc: Type.Partial(Type.Omit(HistorySchema, ['id', 'createdAt', 'updatedAt'])),
  }),
  response: {
    200: HistoryArrayResponseSchema,
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
      type: Type.Array(Type.Integer({ format: 'int32', enum: [1, 2, 3, 5, 6, 7] }), { description: 'search type' }),
      ...PageQuery,
    }),
  ),
  response: {
    200: HistoryListResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const findDetailSchema = {
  tags: [API_PREFIX],
  summary: 'Get detail',
  description: 'Get detail by joint parameterization',
  querystring: Type.Object({
    relateId: Type.String({ description: 'relate id' }),
    videoId: Type.String({ description: 'video id' }),
    type: Type.Optional(Type.Integer({ format: 'int32', enum: [1, 2, 3, 5, 6, 7], description: 'type' })),
  }),
  response: {
    200: HistoryResponseSchema,
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
    200: HistoryResponseSchema,
    500: ResponseErrorSchema,
  },
};

export type AddHistoryBody = Static<typeof addSchema.body>;
export type DeleteHistoryBody = Static<typeof deleteSchema.body>;
export type PutHistoryBody = Static<typeof putSchema.body>;
export type GetHistoryPageQuery = Static<typeof pageSchema.querystring>;
export type FindHistoryDetailQuery = Static<typeof findDetailSchema.querystring>;
export type GetHistoryDetailParams = Static<typeof getDetailSchema.params>;
