import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

import { ResponseErrorSchema, ResponseSuccessSchema } from '../../base';

const API_PREFIX = 'film';

const InfoSchema = Type.Object({
  vod_id: Type.Union([Type.String(), Type.Integer({ format: 'int32' })]),
  vod_name: Type.String(),
  vod_pic: Type.String(),
  vod_lang: Type.String(),
  vod_year: Type.Union([Type.String(), Type.Integer({ format: 'int32' })]),
  vod_area: Type.String(),
  vod_remarks: Type.String(),
  vod_score: Type.String(),
  vod_state: Type.String(),
  vod_class: Type.String(),
  vod_actor: Type.String(),
  vod_director: Type.String(),
  vod_content: Type.String(),
  vod_blurb: Type.String(),
  vod_play_from: Type.String(),
  vod_play_url: Type.String(),
  vod_episode: Type.Record(Type.String(), Type.Array(Type.Object({ text: Type.String(), link: Type.String() }))),
  type_name: Type.String(),
  vod_tag: Type.Optional(Type.String()),
});

const HomeSchema = Type.Object({
  class: Type.Array(
    Type.Object({
      type_id: Type.Union([Type.String(), Type.Integer({ format: 'int32' })]),
      type_name: Type.String(),
    }),
  ),
  filters: Type.Record(
    Type.String(),
    Type.Array(
      Type.Object({
        key: Type.String(),
        name: Type.String(),
        value: Type.Array(
          Type.Object({
            n: Type.Union([Type.String(), Type.Integer({ format: 'int32' })]),
            v: Type.Union([Type.String(), Type.Integer({ format: 'int32' })]),
          }),
        ),
      }),
    ),
  ),
});

const PlaySchema = Type.Object({
  url: Type.String(),
  quality: Type.Optional(Type.Array(Type.Object({ name: Type.String(), url: Type.String() }))),
  jx: Type.Optional(Type.Integer({ format: 'int32' })),
  parse: Type.Optional(Type.Integer({ format: 'int32' })),
  headers: Type.Optional(Type.Record(Type.String(), Type.Any())),
  script: Type.Optional(Type.Record(Type.String(), Type.String())),
});

const HomeResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: HomeSchema,
  },
  { description: 'Response schema for cms home' },
);

const BaseResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Object({
      page: Type.Integer({ format: 'int32' }),
      pagecount: Type.Integer({ format: 'int32' }),
      total: Type.Integer({ format: 'int32' }),
      list: Type.Array(Type.Pick(InfoSchema, ['vod_id', 'vod_name', 'vod_pic', 'vod_remarks', 'vod_blurb', 'vod_tag'])),
    }),
  },
  { description: 'Response schema for cms base' },
);

const DetailResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Object({
      page: Type.Integer({ format: 'int32' }),
      pagecount: Type.Integer({ format: 'int32' }),
      total: Type.Integer({ format: 'int32' }),
      list: Type.Array(Type.Partial(InfoSchema)),
    }),
  },
  { description: 'Response schema for cms detail' },
);

const PlayResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: PlaySchema,
  },
  { description: 'Response schema for cms play' },
);

const ActionResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Union([Type.String(), Type.Record(Type.String(), Type.Any())]),
  },
  { description: 'Response schema for cms action' },
);

const ProxyResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Union([Type.Tuple([Type.Integer({ format: 'int32' }), Type.String(), Type.String()]), Type.Tuple([])]),
  },
  { description: 'Response schema for cms proxy' },
);

export const getInitchema = {
  tags: [API_PREFIX],
  summary: 'Get cms init',
  description: 'Cms init',
  querystring: Type.Object({
    uuid: Type.String({ description: 'cms uuid' }),
    force: Type.Optional(Type.Boolean({ description: 'refresh cache' })),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.Boolean({ description: 'Indicates whether the init operation was successful' }),
      },
      { description: 'Response schema for cms init' },
    ),
    500: ResponseErrorSchema,
  },
};

export const getHomeSchema = {
  tags: [API_PREFIX],
  summary: 'Get cms home',
  description: 'Cms home',
  querystring: Type.Object({
    uuid: Type.String({ description: 'cms uuid' }),
  }),
  response: {
    200: HomeResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const getHomeVodSchema = {
  tags: [API_PREFIX],
  summary: 'Get cms homeVod',
  description: 'Cms homeVod',
  querystring: Type.Object({
    uuid: Type.String({ description: 'cms uuid' }),
  }),
  response: {
    200: BaseResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const getCategorySchema = {
  tags: [API_PREFIX],
  summary: 'Get cms category',
  description: 'Cms category',
  querystring: Type.Object({
    uuid: Type.String({ description: 'cms uuid' }),
    tid: Type.String({ description: 'category id' }),
    page: Type.Optional(Type.Integer({ format: 'int32', description: 'page' })),
    extend: Type.Optional(Type.String({ description: 'extend' })),
  }),
  response: {
    200: BaseResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const getDetailSchema = {
  tags: [API_PREFIX],
  summary: 'Get cms detail',
  description: 'Cms detail',
  querystring: Type.Object({
    uuid: Type.String({ description: 'cms uuid' }),
    ids: Type.String({ description: 'detail id' }),
  }),
  response: {
    200: DetailResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const getSearchSchema = {
  tags: [API_PREFIX],
  summary: 'Get cms search',
  description: 'Cms search',
  querystring: Type.Object({
    uuid: Type.String({ description: 'cms uuid' }),
    wd: Type.String({ description: 'search word' }),
    page: Type.Optional(Type.Integer({ format: 'int32', description: 'page' })),
  }),
  response: {
    200: BaseResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const getPlaySchema = {
  tags: [API_PREFIX],
  summary: 'Get cms play',
  description: 'Cms play',
  querystring: Type.Object({
    uuid: Type.String({ description: 'cms uuid' }),
    play: Type.String({ description: 'play episode' }),
    flag: Type.String({ description: 'play line' }),
  }),
  response: {
    200: PlayResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const getActionSchema = {
  tags: [API_PREFIX],
  summary: 'Get cms action',
  description: 'Cms action',
  querystring: Type.Object({
    uuid: Type.String({ format: 'uuid', description: 'cms uuid' }),
    action: Type.String({ description: 'action key' }),
    value: Type.Union([Type.String(), Type.Record(Type.String(), Type.Any())], { description: 'action value' }),
    timeout: Type.Optional(Type.Integer({ format: 'int32', description: 'action timeout, unit is second' })),
  }),
  response: {
    200: ActionResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const getProxySchema = {
  tags: [API_PREFIX],
  summary: 'Get cms proxy',
  description: 'Cms proxy',
  querystring: Type.Object(
    {
      uuid: Type.String({ format: 'uuid', description: 'cms uuid' }),
      do: Type.String({ description: 'proxy type' }),
      url: Type.String({ format: 'uri', description: 'proxy url' }),
    },
    { additionalProperties: true },
  ),
  response: {
    200: ProxyResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const getCheckSchema = {
  tags: [API_PREFIX],
  summary: 'Check cms validity',
  description: 'Check cms validity',
  querystring: Type.Object({
    uuid: Type.String({ format: 'uuid', description: 'cms uuid' }),
    type: Type.String({ enum: ['search', 'simple', 'complete'], description: 'check type' }),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.Boolean({ description: 'Indicates whether the check operation was successful' }),
      },
      { description: 'Response schema for cms check' },
    ),
    500: ResponseErrorSchema,
  },
};

export type CmsInitQuery = Static<typeof getInitchema.querystring>;
export type CmsHomeQuery = Static<typeof getHomeSchema.querystring>;
export type CmsHomeVodQuery = Static<typeof getHomeVodSchema.querystring>;
export type CmsCategoryQuery = Static<typeof getCategorySchema.querystring>;
export type CmsDetailQuery = Static<typeof getDetailSchema.querystring>;
export type CmsSearchQuery = Static<typeof getSearchSchema.querystring>;
export type CmsPlayQuery = Static<typeof getPlaySchema.querystring>;
export type CmsActionQuery = Static<typeof getActionSchema.querystring>;
export type CmsProxyQuery = Static<typeof getProxySchema.querystring>;
export type CmsCheckQuery = Static<typeof getCheckSchema.querystring>;
