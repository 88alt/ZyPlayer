<template>
  <div class="lab-crypto-encode view-component-container">
    <div class="content">
      <div class="input">
        <p class="title-label">{{ $t('common.input') }}</p>
        <t-form
          ref="formRef"
          :data="formData"
          :rules="RULES"
          :label-width="0"
          required-mark-position="right"
          label-align="left"
          reset-type="initial"
          @submit="onSubmit"
        >
          <t-form-item :label="t('common.content')" name="input">
            <t-textarea
              v-model="formData.input"
              :autosize="{ minRows: 3, maxRows: 5 }"
              :placeholder="$t('common.placeholder.input')"
            />
          </t-form-item>
        </t-form>
      </div>
      <div class="action">
        <p class="title-label">{{ $t('common.action') }}</p>
        <div class="content-action">
          <t-button
            theme="default"
            variant="base"
            block
            :loading="active.loading === 'encode'"
            :disabled="!!active.loading"
            @click="handleSubmit('encode')"
          >
            {{ $t('common.encode') }}
          </t-button>
          <t-button
            theme="primary"
            variant="base"
            block
            :loading="active.loading === 'decode'"
            :disabled="!!active.loading"
            @click="handleSubmit('decode')"
          >
            {{ $t('common.decode') }}
          </t-button>
        </div>
      </div>
      <div class="output">
        <p class="title-label">{{ $t('common.output') }}</p>
        <div class="content-output">
          <t-textarea
            v-model="output"
            :autosize="{ minRows: 3, maxRows: 5 }"
            readonly
            class="output-textarea"
            @click="handleCopy"
          />
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { FormInstanceFunctions, SubmitContext } from 'tdesign-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import type { PropType } from 'vue';
import { ref, toRaw, useTemplateRef, watch } from 'vue';

import { useWorkerPool } from '@/hooks/useWorkerPool';
import { t } from '@/locales';

import type { CryptoAction, CryptoExecute } from '../workers/encode.worker';
import cryptoWorkerUrl from '../workers/encode.worker?worker&url';

const props = defineProps({
  active: {
    type: String as PropType<CryptoAction>,
    default: 'html',
  },
});

const RULES = {
  input: [{ required: true }],
};

const { exec: executeCrypto } = useWorkerPool(cryptoWorkerUrl, { workerOpts: { type: 'module' } });

const formRef = useTemplateRef<FormInstanceFunctions>('formRef');

const formData = ref({
  input: '',
});
const output = ref<string>('');
const active = ref<{ action: CryptoAction; execute: CryptoExecute; loading: CryptoExecute | null }>({
  action: 'html',
  execute: 'encode',
  loading: null,
});

watch(
  () => props.active,
  (val) => {
    active.value.action = val;
    defaultConf();
  },
);

const defaultConf = () => {
  output.value = '';
};

const handleExecute = async () => {
  try {
    const { execute, action, loading } = active.value;
    const { input } = formData.value;
    if (!input || !execute || loading) return;

    active.value.loading = execute;

    const doc = { src: input };
    output.value = await executeCrypto('main', [action, execute, toRaw(doc)]);

    MessagePlugin.success(t('common.success'));
  } catch (error) {
    output.value = '';
    console.error(error);
    MessagePlugin.error(`${t('common.error')}: ${(error as Error).message}`);
  } finally {
    active.value.loading = null;
  }
};

const handleCopy = async (e: Event) => {
  const val = (e.target as HTMLTextAreaElement).value;
  if (!val) return;

  try {
    await navigator.clipboard.writeText(val);
    MessagePlugin.success(t('common.copySuccess'));
  } catch (error) {
    MessagePlugin.error(`${t('common.error')}:  ${(error as Error).message}`);
  }
};

const onSubmit = (context: SubmitContext<FormData>) => {
  const { validateResult, firstError } = context;
  if (validateResult && typeof validateResult === 'boolean') {
    handleExecute();
  } else {
    MessagePlugin.warning(firstError!);
  }
};

const handleSubmit = (type: 'encode' | 'decode') => {
  active.value.execute = type;

  formRef.value?.submit();
};
</script>
<style lang="less" scoped>
.view-component-container {
  padding: 0 var(--td-comp-paddingLR-s) var(--td-comp-paddingTB-s) 0;
  display: flex;
  flex-direction: column;
  gap: var(--td-size-4);
  overflow-y: auto;

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--td-size-4);

    .input {
      display: flex;
      flex-direction: column;
      gap: var(--td-size-4);

      .t-form {
        > :last-child.t-form__item-with-extra {
          margin-bottom: var(--td-line-height-body-small);
        }
      }
    }

    .action {
      display: flex;
      flex-direction: column;
      gap: var(--td-size-4);

      .content-action {
        display: flex;
        gap: var(--td-size-4);
      }
    }

    .output {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--td-size-4);

      .content-output {
        flex: 1;

        .output-textarea {
          height: 100%;

          :deep(textarea) {
            height: 100% !important;
            min-height: 200px !important;
          }
        }
      }
    }
  }
}
</style>
