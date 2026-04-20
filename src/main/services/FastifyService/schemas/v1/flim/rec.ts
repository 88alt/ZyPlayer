import { REC_ASSOCIATION_TYPE, REC_HOT_TYPE } from '@shared/config/setting';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

import { PageQuery, ResponseErrorSchema, ResponseSuccessSchema } from '../../base';

const API_PREFIX = 'film';

const BarrageSchema = Type.Object({
  id: Type.String(),
  text: Type.String(),
  type: Type.String({ enum: ['top', 'bottom', 'left', 'right'] }),
  time: Type.Number(),
  color: Type.String(),
});

const HotAssociationSchema = Type.Object({
  vod_id: Type.Union([Type.String(), Type.Integer({ format: 'int32' })]),
  vod_name: Type.String(),
  vod_hot: Type.Number(),
  vod_pic: Type.Optional(Type.String()),
  vod_remarks: Type.Optional(Type.String()),
});

const DoubanMatchSchema = Type.Object({
  vod_name: Type.String(),
  vod_pic: Type.Optional(Type.String()),
  vod_douban_id: Type.Optional(Type.String()),
  vod_douban_type: Type.Optional(Type.String()),
});

const BarrageResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Partial(
      Type.Object({
        id: Type.String(),
        list: Type.Array(BarrageSchema),
      }),
    ),
  },
  { description: 'Response schema for barrage' },
);

const HotResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Array(HotAssociationSchema),
  },
  { description: 'Response schema for hot' },
);

const AssociationResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Array(HotAssociationSchema),
  },
  { description: 'Response schema for association' },
);

const DoubanMatchResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Array(DoubanMatchSchema),
  },
  { description: 'Response schema for Douban match' },
);

export const getBarrageSchema = {
  tags: [API_PREFIX],
  summary: 'Get Recommend Barrage',
  description: 'Recommend Barrage',
  querystring: Type.Object({
    id: Type.String({ description: 'id' }),
  }),
  response: {
    200: BarrageResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const sendBarrageSchema = {
  tags: [API_PREFIX],
  summary: 'Post Barrage',
  description: 'Post Barrage',
  body: Type.Object({
    id: Type.String({ description: 'id' }),
    time: Type.Number({ format: 'float', description: 'time' }),
    text: Type.String({ description: 'text' }),
    type: Type.String({ enum: ['top', 'bottom', 'left', 'right'], description: 'type' }),
    color: Type.Optional(Type.String({ description: 'color' })),
    size: Type.Optional(Type.String({ description: 'size' })),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.Boolean({ description: 'Indicates whether the send operation was successful' }),
      },
      { description: 'Response schema for send barrage' },
    ),
    500: ResponseErrorSchema,
  },
};

export const getHotSchema = {
  tags: [API_PREFIX],
  summary: 'Get Recommend Hot',
  description: 'Recommend Hot',
  querystring: Type.Partial(
    Type.Object({
      source: Type.String({ enum: Object.values(REC_HOT_TYPE), description: 'source' }),
      date: Type.String({ description: 'date' }),
      type: Type.Integer({ format: 'int32', enum: [1, 2, 3, 4], description: '1:movie 2:tv 3:art 4:anime(child)' }),
      ...PageQuery,
    }),
  ),
  response: {
    200: HotResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const getAssociationSchema = {
  tags: [API_PREFIX],
  summary: 'Get Recommend Association',
  description: 'Recommend Association',
  querystring: Type.Object({
    source: Type.Optional(Type.String({ enum: Object.values(REC_ASSOCIATION_TYPE), description: 'source' })),
    kw: Type.String({ description: 'keyword' }),
    ...PageQuery,
  }),
  response: {
    200: AssociationResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const getMatchSchema = {
  tags: [API_PREFIX],
  summary: 'Get Douban Recommend',
  description: 'Douban Recommend with (name and year) or (id and type)',
  querystring: Type.Partial(
    Type.Object({
      name: Type.Optional(Type.String({ description: 'name' })),
      year: Type.Optional(Type.String({ description: 'year' })),
      id: Type.Optional(Type.String({ description: 'id' })),
      type: Type.Optional(Type.String({ description: 'type' })),
    }),
  ),
  response: {
    200: DoubanMatchResponseSchema,
    500: ResponseErrorSchema,
  },
};

export type GetBarrageQuery = Static<typeof getBarrageSchema.querystring>;
export type SendBarrageBody = Static<typeof sendBarrageSchema.body>;
export type GetHotQuery = Static<typeof getHotSchema.querystring>;
export type GetAssociationQuery = Static<typeof getAssociationSchema.querystring>;
export type GetMatchQuery = Static<typeof getMatchSchema.querystring>;
