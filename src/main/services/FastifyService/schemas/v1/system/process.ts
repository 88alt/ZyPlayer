import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

import { ResponseErrorSchema, ResponseSuccessSchema } from '../../base';

const API_PREFIX = 'system';

const KillResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Boolean({ description: 'kill result' }),
  },
  { description: 'Response schema for kill process result' },
);

const MatchResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Array(Type.Number(), { description: 'matched process ids' }),
  },
  { description: 'Response schema for matched process ids' },
);

export const processKillSchema = {
  tags: [API_PREFIX],
  summary: 'Process kill',
  description: 'Kill system process',
  querystring: Type.Object({
    pid: Type.Array(Type.Integer({ format: 'int32', description: 'process id' })),
  }),
  response: {
    200: KillResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const processMatchSchema = {
  tags: [API_PREFIX],
  summary: 'Process match',
  description: 'Match system process',
  querystring: Type.Object({
    type: Type.String({ enum: ['port', 'ps'], description: 'match type' }),
    kw: Type.Union([Type.String(), Type.Integer({ format: 'int32' })], { description: 'keyword' }),
  }),
  response: {
    200: MatchResponseSchema,
    500: ResponseErrorSchema,
  },
};

export type ProcessKillQuery = Static<typeof processKillSchema.querystring>;
export type ProcessMatchQuery = Static<typeof processMatchSchema.querystring>;
