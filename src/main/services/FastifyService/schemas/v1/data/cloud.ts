import { Type } from '@sinclair/typebox';

import { ResponseErrorSchema, ResponseSuccessSchema } from '../../base';

const API_PREFIX = 'data';

export const backupSchema = {
  tags: [API_PREFIX],
  summary: 'Data backup',
  description: 'Local data backup to cloud',
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.Boolean({ description: 'Indicates whether the backup operation was successful' }),
      },
      { description: 'Response schema for backup' },
    ),
    500: ResponseErrorSchema,
  },
};

export const resumeSchema = {
  tags: [API_PREFIX],
  summary: 'Data resume',
  description: 'Local data resume from cloud',
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.Boolean({ description: 'Indicates whether the resume operation was successful' }),
      },
      { description: 'Response schema for resume' },
    ),
    500: ResponseErrorSchema,
  },
};
