import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

import { ResponseErrorSchema, ResponseSuccessSchema } from '../../base';

const API_PREFIX = 'aigc';

const MessageSchema = Type.Object({
  role: Type.String({ enum: ['system', 'user', 'assistant'] }),
  content: Type.String(),
});

const MemorySchema = Type.Object({
  id: Type.String(),
  messages: Type.Union([Type.Array(MessageSchema), Type.Null()]),
});

const MemoryResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: MemorySchema,
  },
  { description: 'Response schema for session message' },
);

const SessionIdsResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Array(Type.String()),
  },
  { description: 'Response schema for session id list' },
);

export const addMessageSchema = {
  tags: [API_PREFIX],
  summary: 'Add message data',
  description: 'Add a new message data',
  body: Type.Object({
    id: Type.String({ description: 'id' }),
    messages: Type.Union([MessageSchema, Type.Array(MessageSchema)], { description: 'messages' }),
  }),
  response: {
    200: MemoryResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const deleteMessageSchema = {
  tags: [API_PREFIX],
  summary: 'Delete message data',
  description: 'Delete message as supplied, or if the index is empty, delete all sessions supplied with id',
  body: Type.Object({
    id: Type.String({ description: 'id' }),
    index: Type.Optional(Type.Array(Type.Integer(), { description: 'message index' })),
  }),
  response: {
    200: MemoryResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const putMessageSchema = {
  tags: [API_PREFIX],
  summary: 'Set message data',
  description: 'Set message data',
  body: Type.Object({
    id: Type.String({ description: 'id' }),
    updates: Type.Array(
      Type.Object({
        index: Type.Integer(),
        message: MessageSchema,
      }),
      { description: 'updates' },
    ),
  }),
  response: {
    200: MemoryResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const getMessageSchema = {
  tags: [API_PREFIX],
  summary: 'Get message data',
  description:
    'Get message data, limit by recentCount or maxTokens, if both are provided, recentCount will be ignored, if none is provided, return all',
  params: Type.Object({
    id: Type.String({ description: 'id' }),
  }),
  querystring: Type.Object({
    recentCount: Type.Optional(Type.String()),
    maxTokens: Type.Optional(Type.String()),
  }),
  response: {
    200: MemoryResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const createSessionSchema = {
  tags: [API_PREFIX],
  summary: 'Create session data',
  description: 'Create a new session data',
  body: Type.Optional(
    Type.Partial(
      Type.Object({
        messages: Type.Array(MessageSchema, { description: 'initial messages' }),
      }),
    ),
  ),
  response: {
    200: MemoryResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const clearSessionSchema = {
  tags: [API_PREFIX],
  summary: 'Delete session data',
  description: 'Delete session all data',
  body: Type.Object({
    id: Type.Optional(Type.Array(Type.String(), { description: 'id' })),
  }),
  response: {
    200: Type.Object(
      {
        ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
        data: Type.Null({ description: 'delete success' }),
      },
      { description: 'Response schema for clear session' },
    ),
    500: ResponseErrorSchema,
  },
};

export const getSessionIdsSchema = {
  tags: [API_PREFIX],
  summary: 'Get session id data',
  description: 'Get all session id',
  response: {
    200: SessionIdsResponseSchema,
    500: ResponseErrorSchema,
  },
};

export type AddMessageBody = Static<typeof addMessageSchema.body>;
export type DeleteMessageBody = Static<typeof deleteMessageSchema.body>;
export type PutMessageBody = Static<typeof putMessageSchema.body>;
export type GetMessageParams = Static<typeof getMessageSchema.params>;
export type GetMessageQuery = Static<typeof getMessageSchema.querystring>;

export type CreateSessionBody = Static<typeof createSessionSchema.body>;
export type ClearSessionBody = Static<typeof clearSessionSchema.body>;
