import { ffmpegService } from '@main/services/FFmpegService';
import type { FfmpegInfoBody, FfmpegScreenshotBody } from '@server/schemas/v1/system/ffmpeg';
import { ffmpegInfoSchema, ffmpegScreenshotSchema } from '@server/schemas/v1/system/ffmpeg';
import type { FastifyPluginAsync } from 'fastify';

const API_PREFIX = 'system/ffmpeg';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<{ Body: FfmpegInfoBody }>(
    `/${API_PREFIX}/info`,
    {
      schema: ffmpegInfoSchema,
    },
    async (req, reply) => {
      try {
        const { url, options } = req.body;
        await ffmpegService.prepare();
        const resp = await ffmpegService.getBaseInfo(url, options);
        return reply.code(200).send({ code: 0, msg: 'ok', data: resp });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );

  fastify.post<{ Body: FfmpegScreenshotBody }>(
    `/${API_PREFIX}/screenshot`,
    {
      schema: ffmpegScreenshotSchema,
    },
    async (req, reply) => {
      try {
        const { url, options } = req.body;
        await ffmpegService.prepare();
        const resp = await ffmpegService.getScreenshot(url, options);
        return reply.code(200).send({ code: 0, msg: 'ok', data: resp });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: (error as Error).message, data: null });
      }
    },
  );
};

export default api;
