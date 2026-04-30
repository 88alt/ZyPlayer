import { jsonSchema, tool } from 'ai';

import { toolSearchProvider } from './provider';

export const websearchTool = tool({
  description: `Web search tool for finding current information, news, and real-time data from the internet.`,
  inputSchema: jsonSchema<{ query: string }>({
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query',
      },
    },
    required: ['query'],
    additionalProperties: false,
  }),

  execute: async ({ query }) => {
    const result = await toolSearchProvider.search(query);
    return result;
  },
});
