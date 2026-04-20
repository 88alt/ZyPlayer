import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

import { ResponseErrorSchema, ResponseSuccessSchema } from '../../base';

const API_PREFIX = 'system';

const InfoSchema = Type.Object({
  duration: Type.Number({ description: 'duration (s)', format: 'float' }),
  video: Type.Partial(
    Type.Object({
      codec: Type.String({ description: 'video codec' }),
      width: Type.Integer({ description: 'video width', format: 'int32' }),
      height: Type.Integer({ description: 'video height', format: 'int32' }),
      resolution: Type.String({ description: 'video resolution' }),
      fps: Type.Integer({ description: 'video fps', format: 'int32' }),
      bitrate: Type.Integer({ description: 'video bitrate (kbps)', format: 'int32' }),
    }),
  ),
  audio: Type.Partial(
    Type.Object({
      codec: Type.Optional(Type.String({ description: 'audio codec' })),
      sampleRate: Type.Optional(Type.Integer({ description: 'audio sample rate (hz)', format: 'int32' })),
      channelCount: Type.Optional(Type.Integer({ description: 'audio channel count', format: 'int32' })),
      channelType: Type.Optional(Type.String({ description: 'audio channel type' })),
      bitrate: Type.Optional(Type.Integer({ description: 'audio bitrate (kbps)', format: 'int32' })),
    }),
  ),
});

const InfoResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.Partial(InfoSchema),
  },
  { description: 'Response schema for ffmpeg info' },
);

const ScreenshotResponseSchema = Type.Object(
  {
    ...Type.Omit(ResponseSuccessSchema, ['data']).properties,
    data: Type.String({ description: 'screenshot base64' }),
  },
  { description: 'Response schema for ffmpeg screenshot' },
);

export const ffmpegInfoSchema = {
  tags: [API_PREFIX],
  summary: 'Get media info',
  description: 'Media info.',
  body: Type.Object({
    url: Type.String({ format: 'uri', description: 'request url' }),
    options: Type.Optional(
      Type.Partial(
        Type.Object({
          headers: Type.Record(Type.String(), Type.Any(), { description: 'request headers' }),
          timeout: Type.Integer({ minimum: 0, maximum: 2147480, description: 'timeout (ms)' }),
        }),
      ),
    ),
  }),
  response: {
    200: InfoResponseSchema,
    500: ResponseErrorSchema,
  },
};

export const ffmpegScreenshotSchema = {
  tags: [API_PREFIX],
  summary: 'Get media screenshot',
  description: 'Media screenshot base64.',
  body: Type.Object({
    url: Type.String({ format: 'uri', description: 'request url' }),
    options: Type.Optional(
      Type.Partial(
        Type.Object({
          headers: Type.Record(Type.String(), Type.Any(), { description: 'request headers' }),
          timeout: Type.Integer({ minimum: 0, maximum: 2147480, description: 'timeout (ms)' }),
          timestamp: Type.String({ description: 'timestamp (HH:mm:ss)' }),
        }),
      ),
    ),
  }),
  response: {
    200: ScreenshotResponseSchema,
    500: ResponseErrorSchema,
  },
};

export type FfmpegInfoBody = Static<typeof ffmpegInfoSchema.body>;
export type FfmpegScreenshotBody = Static<typeof ffmpegScreenshotSchema.body>;
