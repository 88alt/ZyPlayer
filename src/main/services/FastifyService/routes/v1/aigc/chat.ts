import { dbService } from '@main/services/DbService';
import type { CompletionBody, NormalBody } from '@server/schemas/v1/aigc/chat';
import { completionSchema, normalSchema } from '@server/schemas/v1/aigc/chat';
import { isHttp, isStrEmpty, isString } from '@shared/modules/validate';
import type { FastifyPluginAsync } from 'fastify';

import type { ChatRequestOptions } from './utils/chat';
import { chatCompletion } from './utils/chat';

const API_PREFIX = 'aigc/chat';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<{ Body: CompletionBody }>(
    `/${API_PREFIX}/completion`,
    {
      schema: completionSchema,
    },
    async (req, reply) => {
      try {
        const { prompt, model: rawModel, sessionId, stream } = req.body;

        const llmOptions = (await dbService.setting.getValue('aigc')) || {};
        const model = rawModel || llmOptions.model || '';

        if (!isString(prompt) || isStrEmpty(prompt)) {
          return reply.code(400).send({ code: -1, msg: 'Invalid parameters - prompt is required', data: null });
        }
        if (!isString(sessionId) || isStrEmpty(sessionId)) {
          return reply.code(400).send({ code: -1, msg: 'Invalid parameters - sessionId is required', data: null });
        }
        if (![llmOptions.server, model].some(isString) || !isHttp(llmOptions.server) || isStrEmpty(model)) {
          return reply
            .code(400)
            .send({ code: -1, msg: 'Invalid parameters - ai configuration is required', data: null });
        }

        if (stream) {
          const resp = await chatCompletion.chatStream(req.body as ChatRequestOptions, llmOptions);

          reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });

          for await (const chunk of resp.completion) {
            reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }

          reply.raw.end();
        } else {
          const resp = await chatCompletion.chatText(req.body as ChatRequestOptions, llmOptions);

          return reply.code(200).send({ code: 0, msg: 'ok', data: resp });
        }
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.post<{ Body: NormalBody }>(
    `/${API_PREFIX}/generate`,
    {
      schema: normalSchema,
    },
    async (req, reply) => {
      try {
        const { prompt, model: rawModel, sessionId } = req.body;

        const llmOptions = (await dbService.setting.getValue('aigc')) || {};
        const model = rawModel || llmOptions.model || '';

        if (!isString(prompt) || isStrEmpty(prompt)) {
          return reply.code(400).send({ code: -1, msg: 'Invalid parameters - prompt is required', data: null });
        }
        if (!isString(sessionId) || isStrEmpty(sessionId)) {
          return reply.code(400).send({ code: -1, msg: 'Invalid parameters - sessionId is required', data: null });
        }
        if (![llmOptions.server, model].some(isString) || !isHttp(llmOptions.server) || isStrEmpty(model)) {
          return reply
            .code(400)
            .send({ code: -1, msg: 'Invalid parameters - ai configuration is required', data: null });
        }

        const resp = await chatCompletion.chatText(req.body as ChatRequestOptions, llmOptions);
        const text = resp.completion.type === 'text-delta' ? resp.completion.text || '' : '';

        return reply.code(200).send({ code: 0, msg: 'ok', data: text });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
