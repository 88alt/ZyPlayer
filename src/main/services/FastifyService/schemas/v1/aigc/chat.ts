import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

import { ResponseErrorSchema, ResponseSuccessSchema } from '../../base';

const API_PREFIX = 'aigc';

const CompletionSchema = Type.Object({
  id: Type.String(),
  object: Type.String(Type.Literal('chat.completion')),
  created: Type.Integer({ format: 'int64' }),
  model: Type.String(),
  choices: Type.Array(
    Type.Object({
      index: Type.Integer({ format: 'int32' }),
      message: Type.Object({
        role: Type.String({ enum: ['system', 'user', 'assistant'] }),
        content: Type.String(),
      }),
      finish_reason: Type.String(),
    }),
  ),
  usage: Type.Optional(
    Type.Object({
      prompt_tokens: Type.Integer({ format: 'int32' }),
      completion_tokens: Type.Integer({ format: 'int32' }),
      total_tokens: Type.Integer({ format: 'int32' }),
    }),
  ),
});

const TextEventStreamResponseSchema = Type.Union([CompletionSchema, Type.String()]);

const ApplicationJsonResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Object({
      sessionId: Type.String(),
      completion: CompletionSchema,
    }),
  },
  { description: 'Response schema for chat completion' },
);

export const completionSchema = {
  tags: [API_PREFIX],
  summary: 'Ai Chat Completion',
  description: 'Ai Chat Completion',
  body: Type.Object({
    prompt: Type.String({ description: 'The prompt to generate a completion for.' }),
    model: Type.Optional(Type.String({ description: 'The model to use.' })),
    stream: Type.Optional(Type.Boolean({ description: 'Whether to stream the response.' })),
    sessionId: Type.Optional(Type.String({ description: 'The session ID for the conversation.' })),
    parentId: Type.Optional(Type.String({ description: 'The parent message ID for threading.' })),
  }),
  response: {
    200: {
      content: {
        'text/event-stream': {
          schema: TextEventStreamResponseSchema,
        },
        'application/json': {
          schema: ApplicationJsonResponseSchema,
        },
      },
    },
    400: ResponseErrorSchema,
    500: ResponseErrorSchema,
  },
};

export const normalSchema = {
  tags: [API_PREFIX],
  summary: 'Ai Chat Normal',
  description: 'Ai Chat Normal, only return message',
  body: Type.Object({
    prompt: Type.String({ description: 'The prompt to generate a completion for.' }),
    model: Type.Optional(Type.String({ description: 'The model to use.' })),
    sessionId: Type.Optional(Type.String({ description: 'The session ID for the conversation.' })),
    parentId: Type.Optional(Type.String({ description: 'The parent message ID for threading.' })),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.String({ description: 'The generated message content.' }),
      },
      { description: 'Response schema for normal chat completion' },
    ),
    400: ResponseErrorSchema,
    500: ResponseErrorSchema,
  },
};

export type CompletionBody = Static<typeof completionSchema.body>;
export type NormalBody = Static<typeof normalSchema.body>;
