import { tableNames } from '@main/services/DbService/schemas';
import { dataPages, dataPutTypes, dataRemoteTypes } from '@shared/config/data';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

import { ResponseErrorSchema, ResponseSuccessSchema } from '../../base';

const API_PREFIX = 'data';

const ExportResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Record(Type.String({ enum: tableNames }), Type.Any()),
  },
  { description: 'Response schema for data export' },
);

export const clearSchema = {
  tags: [API_PREFIX],
  summary: 'Clear data',
  description: 'Clear data, if provided type, only clear the specified type',
  body: Type.Object({
    type: Type.Optional(
      Type.Array(Type.String({ enum: [...tableNames, ...dataPages, 'cache'] }), {
        description: 'table name or other type',
      }),
    ),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.Object({
          success: Type.Boolean({ description: 'Indicates whether the operation was successful' }),
        }),
      },
      { description: 'Response schema for data clear' },
    ),
    500: ResponseErrorSchema,
  },
};

export const exportSchema = {
  tags: [API_PREFIX],
  summary: 'Export data',
  description: 'Export data, if provided type, only export the specified type',
  body: Type.Object({
    type: Type.Optional(
      Type.Array(Type.String({ enum: [...tableNames, ...dataPages] }), {
        description: 'table name',
      }),
    ),
  }),
  response: {
    200: ExportResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const importCompleteSchema = {
  tags: [API_PREFIX],
  summary: 'Import  complete data',
  description: 'Import complete data',
  body: Type.Object({
    api: Type.String({ description: 'api' }),
    putType: Type.String({ enum: dataPutTypes, description: 'put type' }),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.Object({
          success: Type.Boolean({ description: 'Indicates whether the operation was successful' }),
          message: Type.Optional(Type.String({ description: 'Error message' })),
        }),
      },
      { description: 'Response schema for data import' },
    ),
    500: ResponseErrorSchema,
  },
};

export const importSimpleSchema = {
  tags: [API_PREFIX],
  summary: 'Import simple data',
  description: 'Import simple data',
  body: Type.Object({
    api: Type.String({ description: 'api' }),
    putType: Type.String({ enum: dataPutTypes, description: 'put type' }),
    remoteType: Type.String({ enum: dataRemoteTypes, description: 'remote type' }),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.Object({
          success: Type.Boolean({ description: 'Indicates whether the operation was successful' }),
          message: Type.Optional(Type.String({ description: 'Error message' })),
        }),
      },
      { description: 'Response schema for data import' },
    ),
    500: ResponseErrorSchema,
  },
};

export type ClearDataBody = Static<typeof clearSchema.body>;
export type ExportDataBody = Static<typeof exportSchema.body>;
export type ImportCompleteDataBody = Static<typeof importCompleteSchema.body>;
export type ImportSimpleDataBody = Static<typeof importSimpleSchema.body>;
