import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

import { PageQuery, ResponseErrorSchema, ResponseSuccessSchema } from '../../base';

const API_PREFIX = 'Channel';

const ChannelSchema = Type.Object({
  id: Type.String({ description: 'id' }),
  name: Type.Union([Type.String(), Type.Null()], { description: 'name' }),
  api: Type.String({ description: 'api' }),
  logo: Type.Union([Type.String(), Type.Null()], { description: 'logo' }),
  playback: Type.Union([Type.String(), Type.Null()], { description: 'playback' }),
  group: Type.Union([Type.String(), Type.Null()], { description: 'group' }),
  createdAt: Type.Integer({ format: 'int64', description: 'created timestamp' }),
  updatedAt: Type.Integer({ format: 'int64', description: 'updated timestamp' }),
});

const ChannelResponse = Type.Omit(ChannelSchema, []);

const ChannelListResponse = Type.Object({
  list: Type.Array(ChannelResponse),
  total: Type.Number({ description: 'Total count' }),
  class: Type.Array(Type.Object({ label: Type.String(), value: Type.String() })),
});

const ChannelEpgResponse = Type.Object({
  start: Type.String({ pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', description: 'start time' }),
  end: Type.String({ pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', description: 'end time' }),
  title: Type.String({ description: 'title' }),
  desc: Type.Optional(Type.String({ description: 'description' })),
});

const ChannelResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: ChannelResponse,
  },
  { description: 'Response schema for Channel response' },
);

const ChannelListResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: ChannelListResponse,
  },
  { description: 'Response schema for Channel list' },
);

const ChannelEpgResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Array(ChannelEpgResponse),
  },
  { description: 'Response schema for EPG list' },
);

const ChannelArrayResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Array(ChannelResponse),
  },
  { description: 'Response schema for Channel array' },
);

export const addSchema = {
  tags: [API_PREFIX],
  summary: 'Add data',
  description: 'Add a new data',
  body: Type.Partial(Type.Omit(ChannelSchema, ['id', 'createdAt', 'updatedAt'])),
  response: {
    200: ChannelArrayResponseSchema,
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
      { description: 'Response schema for delete data' },
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
    doc: Type.Partial(Type.Omit(ChannelSchema, ['id', 'createdAt', 'updatedAt'])),
  }),
  response: {
    200: ChannelArrayResponseSchema,
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
      group: Type.String({ description: 'search group' }),
      ...PageQuery,
    }),
  ),
  response: {
    200: ChannelListResponseSchema,
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
    200: ChannelResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const getEpgSchema = {
  tags: [API_PREFIX],
  summary: 'Get epg',
  description: 'Get epg by channel and date',
  querystring: Type.Object({
    ch: Type.String({ description: 'channel' }),
    date: Type.Optional(Type.String({ format: 'date', description: 'date' })),
  }),
  response: {
    200: ChannelEpgResponseSchema,
    400: ResponseErrorSchema,
    500: ResponseErrorSchema,
  },
};

export type AddChannelBody = Static<typeof addSchema.body>;
export type DeleteChannelBody = Static<typeof deleteSchema.body>;
export type PutChannelBody = Static<typeof putSchema.body>;
export type GetChannelPageQuery = Static<typeof pageSchema.querystring>;
export type GetChannelDetailParams = Static<typeof getDetailSchema.params>;
export type GetChannelEpgQuery = Static<typeof getEpgSchema.querystring>;
