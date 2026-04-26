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
        data: Type.Object({
          success: Type.Boolean({ description: 'Indicates whether the operation was successful' }),
        }),
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
        data: Type.Object({
          success: Type.Boolean({ description: 'Indicates whether the operation was successful' }),
        }),
      },
      { description: 'Response schema for resume' },
    ),
    500: ResponseErrorSchema,
  },
};
