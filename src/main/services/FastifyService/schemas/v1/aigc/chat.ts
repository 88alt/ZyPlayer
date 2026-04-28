import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

import { ResponseErrorSchema, ResponseSuccessSchema } from '../../base';

const API_PREFIX = 'aigc';

const ChatStreamResponseSchema = Type.Object(
  {
    type: Type.String(),
  },
  {
    additionalProperties: true,
    description: 'Response schema for chat completion stream',
  },
);

const ChatTextResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Object({
      sessionId: Type.String({ description: 'Completion session id' }),
      completion: Type.Object({
        type: Type.String({ enum: ['text-delta', 'error'], description: 'Completion type' }),
        parentId: Type.String({ description: 'Unique identifier of the parent message' }),
        messageId: Type.String({ description: 'Unique identifier of the message' }),
        text: Type.Optional(Type.String({ description: 'Completion text' })),
        error: Type.Optional(Type.Any({ description: 'Error message' })),
      }),
    }),
  },
  { description: 'Response schema for chat completion text' },
);

export const completionSchema = {
  tags: [API_PREFIX],
  summary: 'Ai Chat Stream',
  description: 'Ai Chat Completion Stream',
  body: Type.Object({
    prompt: Type.String({ description: 'Completion prompt ' }),
    model: Type.String({ description: 'Completion model' }),
    sessionId: Type.String({ description: 'Completion session id' }),
    parentId: Type.Optional(Type.Number({ description: 'Completion parent id' })),
    temperature: Type.Optional(Type.Number({ description: 'Sampling temperature' })),
    topP: Type.Optional(Type.Number({ description: 'Top-p sampling parameter' })),
    thinkingEnabled: Type.Optional(
      Type.Union([Type.Boolean(), Type.String({ enum: ['off', 'low', 'medium', 'high', 'xhigh'] })], {
        description: 'Completion reasoning level',
      }),
    ),
    searchEnabled: Type.Optional(Type.Boolean({ description: 'Enable web search tool' })),
    stream: Type.Optional(Type.Boolean({ description: 'Whether to stream the response, default is true' })),
  }),
  response: {
    200: {
      content: {
        'text/event-stream': {
          schema: ChatStreamResponseSchema,
        },
        'application/json': {
          schema: ChatTextResponseSchema,
        },
      },
    },
    400: ResponseErrorSchema,
    500: ResponseErrorSchema,
  },
};

export const normalSchema = {
  tags: [API_PREFIX],
  summary: 'Ai Chat Text',
  description: 'Ai Chat Completion Text ',
  body: Type.Object({
    prompt: Type.String({ description: 'Completion prompt ' }),
    model: Type.String({ description: 'Completion model' }),
    sessionId: Type.String({ description: 'Completion session id' }),
    parentId: Type.Optional(Type.Number({ description: 'Completion parent id' })),
    temperature: Type.Optional(Type.Number({ description: 'Sampling temperature' })),
    topP: Type.Optional(Type.Number({ description: 'Top-p sampling parameter' })),
    thinkingEnabled: Type.Optional(
      Type.Union([Type.Boolean(), Type.String({ enum: ['off', 'low', 'medium', 'high', 'xhigh'] })], {
        description: 'Completion reasoning level',
      }),
    ),
    searchEnabled: Type.Optional(Type.Boolean({ description: 'Enable web search tool' })),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.String({ description: 'Completion text' }),
      },
      { description: 'Response schema for chat completion text' },
    ),
    400: ResponseErrorSchema,
    500: ResponseErrorSchema,
  },
};

export type CompletionBody = Static<typeof completionSchema.body>;
export type NormalBody = Static<typeof normalSchema.body>;
