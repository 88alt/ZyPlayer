import { PassThrough, Readable } from 'node:stream';
import type { ReadableStream } from 'node:stream/web';

import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { loggerService } from '@logger';
import { t } from '@main/services/AppLocale';
import { LOG_MODULE } from '@shared/config/logger';
import { AIGC_PROVIDER_TYPE } from '@shared/config/setting';
import type { ISetting } from '@shared/config/tblSetting';
import { isHttp, isObject, isObjectEmpty } from '@shared/modules/validate';
import type { LanguageModel, ModelMessage, ToolSet } from 'ai';
import { generateText, stepCountIs, streamText } from 'ai';
import { isEqual } from 'es-toolkit';
import { createOllama } from 'ollama-ai-provider-v2';

import { formatApiHost } from './api';
import { memoryManager } from './memory';
import { SYSTEM_PROMPT } from './prompts';
import { websearchTool } from './tools/websearch';

type JSONValue = null | string | number | boolean | JSONObject | JSONArray;
interface JSONObject {
  [key: string]: JSONValue | undefined;
}
type JSONArray = JSONValue[];

type LLMSupportProvider =
  | AIGC_PROVIDER_TYPE.OPENAI
  | AIGC_PROVIDER_TYPE.ANTHROPIC
  | AIGC_PROVIDER_TYPE.OLLAMA
  | AIGC_PROVIDER_TYPE.GOOGLE;

type LLMOptions = Omit<ISetting['aigc'], 'type'> & { type: LLMSupportProvider };
interface LLMProviderConfig {
  apiKey?: string;
  baseURL: string;
}
type LLMOptionsValidator = (options: LLMOptions) => string | null;
type LLMProvider = (modelId: string) => LanguageModel;

type ProviderOptions = Record<string, JSONObject>;
type LLMThinkProviderLevel = 'off' | 'low' | 'medium' | 'high' | 'xhigh';
type LLMToolName = 'websearch';

interface LLMToolProviderOptions {
  tools?: ToolSet;
  toolChoice?: 'auto';
  stopWhen?: ReturnType<typeof stepCountIs>;
}

export interface ChatRequestOptions {
  prompt: string;
  model: string;
  sessionId: string;
  parentId?: number;
  temperature?: number;
  topP?: number;
  thinkingEnabled?: boolean | LLMThinkProviderLevel;
  searchEnabled?: boolean;
}

const logger = loggerService.withContext(LOG_MODULE.AIGC_HELPER);

const PROVIDER_VALIDATORS: Partial<Record<AIGC_PROVIDER_TYPE, LLMOptionsValidator>> = {
  [AIGC_PROVIDER_TYPE.OPENAI]: (options) => {
    // if (!options.key) return 'key is required';
    if (options.server && !isHttp(options.server)) return 'server is not a valid HTTP URL';
    return null;
  },

  [AIGC_PROVIDER_TYPE.ANTHROPIC]: (options) => {
    // if (!options.key) return 'key is required';
    if (options.server && !isHttp(options.server)) return 'server is not a valid HTTP URL';
    return null;
  },

  [AIGC_PROVIDER_TYPE.OLLAMA]: (options) => {
    // if (!options.key) return 'key is required';
    if (options.server && !isHttp(options.server)) return 'server is not a valid HTTP URL';
    return null;
  },

  [AIGC_PROVIDER_TYPE.GOOGLE]: (options) => {
    // if (!options.key) return 'key is required';
    if (options.server && !isHttp(options.server)) return 'server is not a valid HTTP URL';
    return null;
  },
};

class ChatCompletion {
  private provider: LLMProvider | null = null;
  private options: LLMOptions | null = null;
  private memory: typeof memoryManager;

  constructor() {
    this.memory = memoryManager;
  }

  private validLLMOptions(options: LLMOptions): void {
    if (!isObject(options) || isObjectEmpty(options)) {
      throw new Error('Invalid LLM client options');
    }

    const { type, model } = options;
    if (!model) throw new Error('Invalid LLM options - model is required');

    const validator = PROVIDER_VALIDATORS[type];
    if (!validator) throw new Error(`Invalid LLM options - unsupported provider: ${type}`);

    const error = validator(options);
    if (error) throw new Error(`Invalid LLM options - ${error}`);
  }

  private createLLMProvider(provider: LLMSupportProvider, options: LLMProviderConfig): LLMProvider {
    const { apiKey, baseURL } = options;

    switch (provider) {
      case AIGC_PROVIDER_TYPE.ANTHROPIC:
        return createAnthropic({ apiKey, baseURL });
      case AIGC_PROVIDER_TYPE.OLLAMA:
        return createOllama({
          baseURL,
          ...(apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : {}),
        });
      case AIGC_PROVIDER_TYPE.GOOGLE:
        return createGoogleGenerativeAI({ apiKey, baseURL });
      case AIGC_PROVIDER_TYPE.OPENAI:
      default:
        return createOpenAICompatible({ apiKey, baseURL, name: 'openai' });
    }
  }

  private getLLMProvider(options: LLMOptions): LLMProvider {
    try {
      options = { ...options, server: formatApiHost(options.server) };
      this.validLLMOptions(options);

      if (this.provider && this.options && isEqual(this.options, options)) {
        return this.provider;
      }

      this.provider = this.createLLMProvider(options.type, { apiKey: options.key, baseURL: options.server });
      this.options = options;
      return this.provider;
    } catch (error) {
      this.provider = null;
      this.options = null;
      throw error;
    }
  }

  private getLLMThinkProviderOptions(provider: LLMSupportProvider, level: LLMThinkProviderLevel): ProviderOptions {
    if (level === 'off') return {};

    const budgetMap = {
      low: 1024,
      medium: 4096,
      high: 8192,
      xhigh: 16384,
    } as const;

    switch (provider) {
      case AIGC_PROVIDER_TYPE.ANTHROPIC:
        return {
          [AIGC_PROVIDER_TYPE.ANTHROPIC]: {
            thinking: {
              type: 'enabled',
              budgetTokens: budgetMap[level],
            },
          },
        };
      case AIGC_PROVIDER_TYPE.GOOGLE:
        return {
          [AIGC_PROVIDER_TYPE.GOOGLE]: {
            thinkingConfig: {
              thinkingBudget: budgetMap[level],
              includeThoughts: false,
            },
          },
        };
      case AIGC_PROVIDER_TYPE.OLLAMA:
        return {};
      case AIGC_PROVIDER_TYPE.OPENAI:
        return {
          [AIGC_PROVIDER_TYPE.OPENAI]: {
            reasoningEffort: level,
          },
        };
      default:
        return {};
    }
  }

  private getLLMToolProviderOptions(config: { [key in LLMToolName]?: boolean }): LLMToolProviderOptions {
    if (!isObject(config) || isObjectEmpty(config)) return {};

    const tools = {
      ...(config.websearch ? { websearch: websearchTool } : {}),
    };

    return {
      tools,
      toolChoice: 'auto',
      stopWhen: stepCountIs(100),
    };
  }

  private buildMessages(sessionId: string, prompt: string): Array<ModelMessage> {
    const history = this.memory.getMessage(sessionId, { recentCount: 10 });

    return [
      { role: 'system', content: `必须使用${t('lang')}回答\n\n${SYSTEM_PROMPT}` },
      ...history.messages.map((msg: { role: 'system' | 'user' | 'assistant'; content: string }) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: prompt },
    ];
  }

  private computedMessagesLength(sessionId: string): number {
    const history = this.memory.getMessage(sessionId);
    const historyLength = history.messages.length;
    return historyLength;
  }

  private dealParentMessages(sessionId: string, parentId: number): void {
    if (parentId % 2 !== 0) return;
    const messageLength = this.computedMessagesLength(sessionId);
    if (parentId < 1 || parentId >= messageLength) return;

    const delIdxes = Array.from({ length: messageLength - parentId }, (_, i) => parentId + i);
    this.memory.deleteMessage(sessionId, delIdxes);
  }

  public async chatStream(
    config: ChatRequestOptions,
    options: LLMOptions,
  ): Promise<{ completion: ReadableStream; sessionId: string }> {
    const client = this.getLLMProvider(options);
    if (!client) throw new Error('LLM client is not initialized.');

    const {
      sessionId,
      prompt,
      parentId = 0,
      temperature = 1,
      topP = 0.95,
      thinkingEnabled = false,
      searchEnabled = false,
    } = config;
    const model = config.model || options.model;

    this.dealParentMessages(sessionId, parentId);
    const messageLength = this.computedMessagesLength(sessionId);
    const messages = this.buildMessages(sessionId, prompt);

    const passThrough = new PassThrough({ objectMode: true });

    (async () => {
      let fullMessage = '';

      try {
        this.memory.addMessage(sessionId, { role: 'user', content: prompt });

        const { fullStream } = streamText({
          model: client(model),
          messages,
          temperature,
          topP,
          ...this.getLLMToolProviderOptions({ websearch: searchEnabled }),
          providerOptions: {
            ...this.getLLMThinkProviderOptions(
              options.type,
              typeof thinkingEnabled === 'boolean' ? (thinkingEnabled ? 'medium' : 'off') : thinkingEnabled,
            ),
          },
        });

        for await (const chunk of fullStream) {
          switch (chunk.type) {
            case 'start':
              passThrough.write({
                type: 'ready',
                sessionId,
                parentId: messageLength + 1,
                messageId: messageLength + 2,
              });
              break;
            case 'text-delta': {
              fullMessage += chunk.text;
              break;
            }
            case 'error': {
              logger.error(
                `Failed to complete chat, the status code is ${(chunk.error as any).statusCode}, reason detail with ${(chunk.error as any).responseBody}`,
              );
              break;
            }
          }

          passThrough.write(chunk);
        }

        this.memory.addMessage(sessionId, { role: 'assistant', content: fullMessage });
      } finally {
        passThrough.end();
      }
    })();

    const webStream = Readable.toWeb(passThrough as Readable) as ReadableStream;
    return { completion: webStream, sessionId };
  }

  public async chatText(
    config: ChatRequestOptions,
    options: LLMOptions,
  ): Promise<{
    completion: {
      type: 'text-delta' | 'error';
      text?: any;
      error?: any;
      parentId: number;
      messageId: number;
    };
    sessionId: string;
  }> {
    const client = this.getLLMProvider(options);
    if (!client) throw new Error('LLM client is not initialized.');

    const {
      sessionId,
      prompt,
      parentId = 0,
      temperature = 1,
      topP = 0.95,
      thinkingEnabled = false,
      searchEnabled = false,
    } = config;
    const model = config.model || options.model;

    this.dealParentMessages(sessionId, parentId);
    const messageLength = this.computedMessagesLength(sessionId);
    const messages = this.buildMessages(sessionId, prompt);

    let completion;
    try {
      this.memory.addMessage(sessionId, { role: 'user', content: prompt });

      const { text } = await generateText({
        model: client(model),
        messages,
        temperature,
        topP,
        ...this.getLLMToolProviderOptions({ websearch: searchEnabled }),
        providerOptions: {
          ...this.getLLMThinkProviderOptions(
            options.type,
            typeof thinkingEnabled === 'boolean' ? (thinkingEnabled ? 'medium' : 'off') : thinkingEnabled,
          ),
        },
      });

      completion = { type: 'text-delta', text, parentId: messageLength + 1, messageId: messageLength + 2 };
      this.memory.addMessage(sessionId, { role: 'assistant', content: text });
    } catch (error) {
      logger.error(
        `Failed to complete chat, the status code is ${(error as any).statusCode}, reason detail with ${(error as any).responseBody}`,
      );
      completion = { type: 'error', error, parentId: messageLength + 1, messageId: messageLength + 2 };
      this.memory.addMessage(sessionId, { role: 'assistant', content: '' });
    }

    return { sessionId, completion };
  }
}

export const chatCompletion = new ChatCompletion();
