import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

import { PageQuery, ResponseErrorSchema, ResponseSuccessSchema } from '../../base';

const API_PREFIX = 'moment';

const StarSchema = Type.Object({
  id: Type.String({ description: 'id' }),
  type: Type.Integer({ format: 'int32', enum: [1, 2, 3], description: 'type' }),
  relateId: Type.String({ description: 'relate id' }),
  videoId: Type.String({ description: 'video id' }),
  videoImage: Type.Union([Type.String(), Type.Null()], { description: 'video image' }),
  videoName: Type.Union([Type.String(), Type.Null()], { description: 'video name' }),
  videoType: Type.Union([Type.String(), Type.Null()], { description: 'video type' }),
  videoRemarks: Type.Union([Type.String(), Type.Null()], { description: 'video remarks' }),
  createdAt: Type.Integer({ format: 'int64', description: 'created timestamp' }),
  updatedAt: Type.Integer({ format: 'int64', description: 'updated timestamp' }),
});

const StarResponse = Type.Omit(StarSchema, []);

const StarListResponse = Type.Object({
  list: Type.Array(
    Type.Intersect([
      StarSchema,
      Type.Object({
        relateSite: Type.Any({ description: 'Relate info' }),
      }),
    ]),
  ),
  total: Type.Optional(Type.Integer({ format: 'int32' })),
});

const StarResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Union([StarResponse, Type.Object({}, { additionalProperties: false })], {
      description: 'Star data',
    }),
  },
  { description: 'Response schema for Star response' },
);

const StarListResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: StarListResponse,
  },
  { description: 'Response schema for Star list' },
);

const StarArrayResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Array(StarResponse),
  },
  { description: 'Response schema for Star array' },
);

export const addSchema = {
  tags: [API_PREFIX],
  summary: 'Add data',
  description: 'Add a new data',
  body: Type.Partial(Type.Omit(StarSchema, ['id', 'createdAt', 'updatedAt'])),
  response: {
    200: StarArrayResponseSchema,
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
        Type.Array(Type.Integer({ format: 'int32', enum: [1, 2, 3] }), { description: 'search type' }),
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
    id: Type.Array(Type.String(), { description: 'id' }),
    doc: Type.Partial(Type.Omit(StarSchema, ['id', 'createdAt', 'updatedAt'])),
  }),
  response: {
    200: StarArrayResponseSchema,
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
      type: Type.Array(Type.Integer({ format: 'int32', enum: [1, 2, 3] }), { description: 'search type' }),
      ...PageQuery,
    }),
  ),
  response: {
    200: StarListResponseSchema,
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
    type: Type.Optional(Type.Integer({ format: 'int32', enum: [1, 2, 3], description: 'type' })),
  }),
  response: {
    200: StarResponseSchema,
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
    200: StarResponseSchema,
    500: ResponseErrorSchema,
  },
};

export type AddStarBody = Static<typeof addSchema.body>;
export type DeleteStarBody = Static<typeof deleteSchema.body>;
export type PutStarBody = Static<typeof putSchema.body>;
export type GetStarPageQuery = Static<typeof pageSchema.querystring>;
export type FindStarDetailQuery = Static<typeof findDetailSchema.querystring>;
export type GetStarDetailParams = Static<typeof getDetailSchema.params>;
