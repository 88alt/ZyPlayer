import type { CdpSnifferMediaBody } from '@server/schemas/v1/system/cdp';
import { cdpSnifferMediaSchema } from '@server/schemas/v1/system/cdp';
import { isHttp } from '@shared/modules/validate';
import type { FastifyPluginAsync } from 'fastify';

import { snifferMediaToStandard } from './utils/sniffer';

const API_PREFIX = 'system/cdp';

const api: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<{ Body: CdpSnifferMediaBody }>(
    `/${API_PREFIX}/sniffer/media`,
    {
      schema: cdpSnifferMediaSchema,
    },
    async (req, reply) => {
      try {
        const { url, options } = req.body;
        if (!isHttp(url)) {
          return reply.code(400).send({ code: -1, msg: 'Invalid URL', data: null });
        }

        const resp = await snifferMediaToStandard(url, options);

        return reply.code(200).send({ code: 0, msg: 'ok', data: resp });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ code: -1, msg: 'Error processing request', data: null });
      }
    },
  );
};

export default api;
