import { dbService } from '@main/services/DbService';
import type { CompletionBody, NormalBody } from '@server/schemas/v1/aigc/chat';
import { completionSchema, normalSchema } from '@server/schemas/v1/aigc/chat';
import { isHttp, isStrEmpty, isString } from '@shared/modules/validate';
import type { FastifyPluginAsync } from 'fastify';

import { chatCompletion } from './utils/chat';

const API_PREFIX = 'aigc/chat';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<{ Body: CompletionBody }>(
    `/${API_PREFIX}/completion`,
    { schema: completionSchema },
    async (req, reply) => {
      try {
        const { prompt, model: rawModel, sessionId, parentId, stream } = req.body;

        const ai = (await dbService.setting.getValue('aigc')) || {};
        const model = rawModel || ai.model || '';

        if (!isString(prompt) || isStrEmpty(prompt)) {
          return reply.code(400).send({ code: -1, msg: 'Invalid parameters - prompt is required', data: null });
        }

        if (![ai.server, model].some(isString) || !isHttp(ai.server) || isStrEmpty(model)) {
          return reply
            .code(400)
            .send({ code: -1, msg: 'Invalid parameters - ai configuration is required', data: null });
        }

        const resp = await chatCompletion.chatStandard(
          { prompt, stream, model, sessionId, parentId },
          { baseURL: ai.server, apiKey: ai.key },
        );

        if (stream) {
          reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });

          for await (const chunk of resp.completion) {
            reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }

          reply.raw.write('data: [DONE]\n\n');
          reply.raw.end();
        } else {
          return reply
            .code(200)
            .send({ code: 0, msg: 'ok', data: { sessionId: resp.sessionId, completion: resp.completion } });
        }
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.post<{ Body: NormalBody }>(
    `/${API_PREFIX}/normal`,
    {
      schema: normalSchema,
    },
    async (req, reply) => {
      try {
        const { prompt, model: rawModel, sessionId, parentId } = req.body;

        const ai = (await dbService.setting.getValue('aigc')) || {};
        const model = rawModel || ai.model || '';

        if (!isString(prompt) || isStrEmpty(prompt)) {
          return reply.code(400).send({ code: -1, msg: 'Invalid parameters - prompt is required', data: null });
        }

        if (![ai.server, model].some(isString) || !isHttp(ai.server) || isStrEmpty(model)) {
          return reply
            .code(400)
            .send({ code: -1, msg: 'Invalid parameters - ai configuration is required', data: null });
        }

        const resp = await chatCompletion.chatNormal(
          { prompt, stream: false, model, sessionId, parentId },
          { baseURL: ai.server, apiKey: ai.key },
        );

        return reply.code(200).send({ code: 0, msg: 'ok', data: resp });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
