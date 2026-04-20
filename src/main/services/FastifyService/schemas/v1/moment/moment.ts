import { Type } from '@sinclair/typebox';

import { ResponseErrorSchema, ResponseSuccessSchema } from '../../base';
import { SiteResponse } from '../flim/site';
import { IptvResponse } from '../live/iptv';
import { AnalyzeResponse } from '../parse/analyze';

const API_PREFIX = 'moment';

const RelatedSchema = Type.Object({
  parse: Type.Array(AnalyzeResponse),
  live: Type.Array(IptvResponse),
  film: Type.Array(SiteResponse),
});

const RelatedResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: RelatedSchema,
  },
  { description: 'Response schema for related response' },
);

export const getRelatedSchema = {
  tags: [API_PREFIX],
  summary: 'Get related',
  description: 'Get related site',
  response: {
    200: RelatedResponseSchema,
    500: ResponseErrorSchema,
  },
};
