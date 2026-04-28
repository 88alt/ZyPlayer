<template>
  <div class="aigc">
    <div v-if="isAvaildParam" class="aigc-main">
      <div class="aigc-content">
        <t-chat-list :clear-history="messages.length > 0" @clear="clearHistory">
          <t-chat-message
            v-for="(message, idx) in messages"
            :key="message.id"
            :message="message"
            :variant="messageProps[message.role]?.variant"
            :placement="messageProps[message.role]?.placement"
            :avatar="messageProps[message.role]?.avatar"
            :handle-actions="message.role === 'user' ? {} : handleMsgActions"
            :chat-content-props="contentProps"
            allow-content-segment-custom
          >
            <template #actionbar>
              <t-chat-actionbar
                v-if="isAIMessage(message) && message.status === 'complete'"
                :comment="actionComment"
                :action-bar="getActionBar(idx === messages.length - 1)"
                :copy-text="getMessageContentForCopy(message)"
                @actions="(type: string) => handleAction(type, { item: message })"
              />
            </template>
          </t-chat-message>
        </t-chat-list>

        <t-chat-sender
          v-model="inputValue"
          :textarea-props="{
            placeholder: $t('common.placeholder.input'),
          }"
          :loading="senderLoading"
          @send="handleSend"
          @stop="handleStop"
        >
          <template #footer-prefix>
            <t-space align="center" size="small">
              <t-button
                variant="outline"
                shape="round"
                :theme="active.think ? 'primary' : 'default'"
                @click="active.think = !active.think"
              >
                <template #icon><system-sum-icon /></template>
                {{ $t('aigc.chat.sender.think') }}
              </t-button>
              <t-button
                variant="outline"
                :theme="active.search ? 'primary' : 'default'"
                shape="round"
                @click="active.search = !active.search"
              >
                <template #icon><internet-icon /></template>
                {{ $t('aigc.chat.sender.search') }}
              </t-button>
            </t-space>
          </template>
        </t-chat-sender>
      </div>
      <p class="aigc-declare">{{ $t('aigc.declare') }}</p>
    </div>

    <div v-else class="aigc-empty">
      <t-empty :title="$t('aigc.noParam')">
        <template #image>
          <error-circle-icon size="64" color="var(--td-text-color-placeholder)" />
        </template>
      </t-empty>
    </div>
  </div>
</template>
<script setup lang="ts">
import { APP_NAME } from '@shared/config/appinfo';
import { AIGC_CHAT_COMPLETION_API } from '@shared/config/env';
import { THEME } from '@shared/config/theme';
import { toM, toY } from '@shared/modules/date';
import { isHttp, isObject, isObjectEmpty } from '@shared/modules/validate';
import type {
  AIMessageContent,
  ChatMessagesData,
  ChatRequestParams,
  ChatServiceConfig,
  SSEChunkData,
  SuggestionItem,
  TdChatActionsName,
  TdChatContentMDOptions,
  TdChatMessageConfig,
} from '@tdesign-vue-next/chat';
import { getMessageContentForCopy, isAIMessage, useChat } from '@tdesign-vue-next/chat';
import { cloneDeep } from 'es-toolkit';
import { ErrorCircleIcon, InternetIcon, SystemSumIcon } from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, onMounted, ref } from 'vue';

import { createMemorySession, delMemorySession } from '@/api/aigc';
import { getSettingDetail } from '@/api/setting';
import openaiIcon from '@/assets/ai/openai-kimi.png';
import { emitterChannel, emitterSource } from '@/config/emitterChannel';
import { t } from '@/locales';
import { useSettingStore } from '@/store';
import emitter from '@/utils/emitter';

/**
 * @see https://tdesign.tencent.com/vue-next/components/chatbot
 */

const storeSetting = useSettingStore();

const inputValue = ref<string>('');
const actionComment = ref<'good' | 'bad' | ''>('');

const config = ref<{ server: string; key: string; model: string }>({
  server: '',
  key: '',
  model: '',
});
const sessionId = ref<string | null>(null);
const parentId = ref<number>(0);

const active = ref({
  think: false,
  search: false,
});

const messageProps = ref<TdChatMessageConfig>({
  user: { variant: 'base', placement: 'right' },
  assistant: {
    variant: 'text',
    placement: 'left',
    actions: ['copy', 'replay', 'good', 'bad'],
    avatar: openaiIcon,
  },
});

const contentProps = ref({
  thinking: { maxHeight: 100, collapsed: false },
  markdown: {
    engine: 'cherry-markdown',
    options: {
      themeSettings: {
        codeBlockTheme: storeSetting.displayTheme === THEME.LIGHT ? 'vs-light' : 'vs-dark',
      } as TdChatContentMDOptions,
    },
  },
});

const defaultMessages = ref<ChatMessagesData[]>([
  {
    id: 'welcome',
    role: 'assistant',
    content: [
      {
        type: 'text',
        status: 'complete',
        data: t('aigc.chat.tip', [APP_NAME]),
      },
      {
        type: 'suggestion',
        status: 'complete',
        data: [
          {
            title: t('aigc.chat.suggestion.desc.title', [APP_NAME]),
            prompt: t('aigc.chat.suggestion.desc.prompt', [APP_NAME]),
          },
          {
            title: t('aigc.chat.suggestion.hot.title'),
            prompt: t('aigc.chat.suggestion.hot.prompt', [toY(), toM()]),
          },
        ],
      },
    ],
  },
]);

const chatServiceConfig = ref<ChatServiceConfig>({
  endpoint: AIGC_CHAT_COMPLETION_API,
  stream: true,
  protocol: 'default',
  onRequest: (
    params: ChatRequestParams,
  ): (ChatRequestParams & RequestInit) | Promise<ChatRequestParams & RequestInit> => {
    console.log(messages.value);

    return {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // msgId: params.messageID,
        prompt: params.prompt,
        stream: true,
        model: config.value.model,
        sessionId: sessionId.value,
        parentId: parentId.value,
        thinkingEnabled: active.value.think,
        searchEnabled: active.value.search,
      }),
    };
  },
  onMessage: (stream: SSEChunkData): AIMessageContent | AIMessageContent[] | null => {
    const chunk = stream.data as { type: string; [key: string]: any };

    if (!isObject(chunk) || isObjectEmpty(chunk)) return null;

    switch (chunk.type) {
      case 'reasoning-delta':
        return {
          type: 'thinking',
          status: 'streaming',
          data: { title: t('aigc.chat.chunk.think.thinking'), text: chunk.text },
        };
      case 'reasoning-end':
        return {
          type: 'thinking',
          status: 'complete',
          data: { title: t('aigc.chat.chunk.think.thinked'), text: '' },
        };

      case 'text-delta':
        return {
          type: 'markdown',
          data: chunk.text || '',
          strategy: 'merge',
        };

      case 'tool-call': {
        const isSearchTool = chunk.toolName === 'websearch';

        return {
          type: isSearchTool ? 'search' : 'toolcall',
          data: isSearchTool
            ? {
                title: t('aigc.chat.chunk.search.searching', [chunk.toolName]),
                references: [],
              }
            : {
                toolCallId: chunk.toolCallId,
                toolCallName: chunk.toolName,
              },
        } as AIMessageContent;
      }
      case 'tool-result': {
        const isSearchTool = chunk.toolName === 'websearch';
        const outputResult = chunk.output?.results || [];

        return {
          type: isSearchTool ? 'search' : 'toolcall',
          data: isSearchTool
            ? {
                title: t('aigc.chat.chunk.search.searched', [outputResult.length]),
                references: outputResult,
              }
            : {
                toolCallId: chunk.toolCallId,
                toolCallName: chunk.toolName,
                result: outputResult,
              },
        } as AIMessageContent;
      }

      case 'ready': {
        parentId.value = chunk.messageId;
        return null;
      }
      // case 'finish': {
      //   return null;
      // }
      case 'error': {
        const datetime = new Date();
        chatEngine.value?.setMessages(
          [
            ...messages.value.slice(0, -1),
            {
              id: `msg_${datetime.getTime()}_${Math.floor(Math.random() * 100000)}`,
              role: 'assistant',
              status: 'error',
              datetime: datetime.toISOString(),
              content: [
                {
                  type: 'text',
                  data: `${chunk.error.name}: ${chunk.error.reason}`,
                  status: 'error',
                  strategy: 'append',
                },
              ],
            },
          ],
          'replace',
        );
        return null;
      }
      default:
        return null;
    }
  },
});

const { chatEngine, messages, status } = useChat({
  defaultMessages: defaultMessages.value,
  chatServiceConfig: chatServiceConfig.value,
});

const senderLoading = computed(() => status.value === 'pending' || status.value === 'streaming');
const isAvaildParam = computed(() => {
  const { server, model } = config.value;
  return isHttp(server) && !!model;
});

onMounted(() => setup());

const getActionBar = (isLast: boolean): TdChatActionsName[] => {
  const actions: TdChatActionsName[] = ['copy', 'good', 'bad'];
  if (isLast) actions.unshift('replay');
  return actions;
};

const handleMsgActions = {
  suggestion: ({ content }: { content: SuggestionItem }) => {
    inputValue.value = content?.prompt || '';
  },
};

const handleCopyAction = (message: ChatMessagesData) => {
  try {
    const data = getMessageContentForCopy(message);
    navigator.clipboard.writeText(data);
    MessagePlugin.success(t('common.copySuccess'));
  } catch (error) {
    console.error('Copy failed:', error);
    MessagePlugin.error(t('common.copyFail'));
  }
};

const handleAction = (type: string, { item }: { item: ChatMessagesData }) => {
  const handles = {
    bad: () => {
      actionComment.value = actionComment.value === 'bad' ? '' : 'bad';
    },
    copy: () => {
      handleCopyAction(item);
    },
    good: () => {
      actionComment.value = actionComment.value === 'good' ? '' : 'good';
    },
    replay: async () => {
      // default(length-2): welcome system
      parentId.value = messages.value.length - 2 <= 0 ? 0 : messages.value.length - 4;
      chatEngine.value?.regenerateAIMessage();
    },
  };

  try {
    handles?.[type]?.(item);
  } catch (error) {
    console.error(error);
  }
};

const handleSend = async (params: string) => {
  if (!sessionId.value) {
    await initSessionMemory();
    if (!sessionId.value) {
      MessagePlugin.error(t('aigc.message.createSessionFailed'));
      return;
    }
  }

  await chatEngine.value?.sendUserMessage({ prompt: params });
  inputValue.value = '';
};

const handleStop = () => {
  chatEngine.value?.abortChat();
};

const setup = async () => {
  emitter.off(emitterChannel.REFRESH_AIGC_CONFIG, reloadConfig);
  emitter.on(emitterChannel.REFRESH_AIGC_CONFIG, reloadConfig);

  getSetting();
};

const getSetting = async () => {
  try {
    const resp = await getSettingDetail('aigc');

    const currentModel = config.value.model;
    if (resp.model !== currentModel) {
      const systemIdx = messages.value.findIndex((m) => m.role === 'system');
      if (systemIdx < 0) {
        chatEngine.value?.sendSystemMessage(t('aigc.chat.modelChange', [resp.model]));
      } else {
        const clonedMessages = cloneDeep(messages.value);
        clonedMessages[systemIdx].content = [
          {
            type: 'text',
            status: 'complete',
            data: t('aigc.chat.modelChange', [resp.model]),
          },
        ];
        chatEngine.value?.setMessages(clonedMessages, 'replace');
      }
    }

    config.value = resp;
  } catch (error) {
    console.error('Failed to fetch AI config:', error);
  }
};

const reloadConfig = async ({ data: eventData }) => {
  const { source } = eventData;
  if (source === emitterSource.LAYOUT_HEADER_QUICK) return;

  handleStop();

  await getSetting();
};

const initSessionMemory = async () => {
  try {
    const resp = await createMemorySession();
    sessionId.value = resp.id;
    parentId.value = 0;
  } catch (error) {
    console.error('Failed to create session:', error);
  }
};

const clearSessionMemory = async () => {
  try {
    if (sessionId.value) {
      await delMemorySession({ id: [sessionId.value] });
    }
  } catch (error) {
    console.error('Failed to clear chat:', error);
  } finally {
    sessionId.value = null;
    parentId.value = 0;
  }
};

const clearHistory = async () => {
  await clearSessionMemory();
  chatEngine.value?.clearMessages();
};
</script>
<style lang="less" scoped>
.aigc {
  height: 100%;
  width: 100%;

  .aigc-main {
    height: 100%;
    width: 100%;
    max-width: 734px;
    margin: 0 auto;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--td-size-4);

    .aigc-content {
      height: calc(100% - 22px);
      width: 100%;
      flex: 1 1 auto;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--td-size-4);
      position: relative;

      :deep(t-chat-loading),
      :deep(t-chat-item) {
        --td-chat-loading-circle-border-top-color: var(--td-brand-color);
        --td-chat-loading-circle-border: 2px solid var(--td-brand-color-1);
      }

      :deep(t-chat-item) {
        &::part(t-chat__text--user) {
          background-color: var(--td-chat-item-suggestion-background);
          color: var(--td-chat-item-suggestion-color);
        }

        &::part(t-chat-loading__circle) {
          --td-chat-loading-circle-border-top-color: var(--td-brand-color);
        }
      }

      :deep(.t-chat-sender) {
        .t-chat-sender__textarea {
          // background-color: var(--td-bg-color-component);
          box-shadow: none;

          &:hover {
            border-color: var(--td-border-level-2-color);
          }

          .t-chat-sender__footer {
            .t-chat-sender__mode {
              .t-button {
                &.t-button--theme-primary {
                  background-color: var(--td-brand-color-light);
                  color: var(--td-brand-color-active);
                  border-color: var(--td-brand-color-active);
                }

                &:hover {
                  &.t-button--theme-primary {
                    background-color: var(--td-brand-color-focus);
                  }

                  &:not(.t-button--theme-primary) {
                    color: var(--td-text-color-primary);
                    border-color: var(--td-border-level-2-color);
                    background-color: var(--td-bg-color-component);
                  }
                }
              }
            }

            .t-chat-sender__button {
              .t-chat-sender__button__sendbtn {
                .t-chat-sender__button__default {
                  border-radius: var(--td-radius-circle);
                }
              }
            }
          }
        }
      }
    }

    .aigc-declare {
      height: fit-content;
      width: 100%;
      flex: 0;
      color: var(--td-text-color-disabled);
      font-size: var(--td-font-size-link-small);
      text-align: center;
    }

    :deep(.t-chat__to-bottom) {
      bottom: var(--td-comp-size-m);
      width: var(--td-comp-size-xl);
      height: var(--td-comp-size-xl);
      border-radius: var(--td-radius-circle);
    }
  }
}
</style>
