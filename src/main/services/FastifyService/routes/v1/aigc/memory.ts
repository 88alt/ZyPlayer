import type {
  AddMessageBody,
  ClearSessionBody,
  CreateSessionBody,
  DeleteMessageBody,
  GetMessageParams,
  GetMessageQuery,
  PutMessageBody,
} from '@server/schemas/v1/aigc/memory';
import {
  addMessageSchema,
  clearSessionSchema,
  createSessionSchema,
  deleteMessageSchema,
  getMessageSchema,
  getSessionIdsSchema,
  putMessageSchema,
} from '@server/schemas/v1/aigc/memory';
import type { FastifyPluginAsync } from 'fastify';

import type { ChatMessage, RecentMessageOptions } from './utils/memory';
import { memoryManager } from './utils/memory';

const API_PREFIX = 'aigc/memory';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<{ Body: AddMessageBody }>(
    `/${API_PREFIX}/message`,
    {
      schema: addMessageSchema,
    },
    async (req, reply) => {
      try {
        const { id, messages } = req.body as { id: string; messages: ChatMessage[] };
        const session = memoryManager.addMessage(id, messages);
        return reply.code(200).send({ code: 0, msg: 'ok', data: session });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.delete<{ Body: DeleteMessageBody }>(
    `/${API_PREFIX}/message`,
    {
      schema: deleteMessageSchema,
    },
    async (req, reply) => {
      try {
        const { id, index } = req.body;
        const session = memoryManager.deleteMessage(id, index);
        return reply.code(200).send({ code: 0, msg: 'ok', data: session });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.put<{ Body: PutMessageBody }>(
    `/${API_PREFIX}/message`,
    {
      schema: putMessageSchema,
    },
    async (req, reply) => {
      try {
        const { id, updates } = req.body as { id: string; updates: Array<{ index: number; message: ChatMessage }> };
        const session = memoryManager.replaceMessage(id, updates);
        reply.code(200).send({ code: 0, msg: 'ok', data: session });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get<{ Params: GetMessageParams; Querystring: GetMessageQuery }>(
    `/${API_PREFIX}/message/:id`,
    {
      schema: getMessageSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const { recentCount, maxTokens } = req.query;
        const options: RecentMessageOptions = {};

        if (recentCount) options.recentCount = Number.parseInt(recentCount);
        if (maxTokens) options.maxTokens = Number.parseInt(maxTokens);

        const session = memoryManager.getMessage(id, options);
        return reply.code(200).send({ code: 0, msg: 'ok', data: session });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.post<{ Body: CreateSessionBody }>(
    `/${API_PREFIX}/session`,
    {
      schema: createSessionSchema,
    },
    async (req, reply) => {
      try {
        const { messages = [] } = req.body as { messages: ChatMessage[] };
        const session = memoryManager.createSession(messages);
        return reply.code(200).send({ code: 0, msg: 'ok', data: session });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.delete<{ Body: ClearSessionBody }>(
    `/${API_PREFIX}/session`,
    {
      schema: clearSessionSchema,
    },
    async (req, reply) => {
      try {
        const { id } = req.body || {};
        if (id && id.length !== 0) {
          memoryManager.delSession(id);
        } else {
          memoryManager.clearSession();
        }
        return reply.code(200).send({ code: 0, msg: 'ok', data: null });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.get(
    `/${API_PREFIX}/session/id`,
    {
      schema: getSessionIdsSchema,
    },
    async (_req, reply) => {
      try {
        const id = memoryManager.getSessionIds();
        return reply.code(200).send({ code: 0, msg: 'ok', data: id });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
