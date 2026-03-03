<template>
  <t-dialog v-model:visible="formVisible" v-bind="attrsCustom">
    <template v-if="formData.title" #header>
      {{ formData.title }}
    </template>

    <template #body>
      <div class="action-content">
        <action-section-view ref="actionRef" :config="formData" @submit="onSubmit" @timeout="onTimeout" />
      </div>
    </template>

    <template #footer>
      <div class="action-footer">
        <t-button v-if="showReset" variant="dashed" class="btn-modern" @click="handleReset">
          {{ $t('common.reset') }}
        </t-button>

        <t-button v-if="showCancel" theme="default" class="btn-modern" @click="handleCancel">
          {{ $t('common.cancel') }}
        </t-button>

        <t-button v-if="showConfirm" theme="primary" class="btn-modern" @click="handleSubmit">
          {{ $t('common.confirm') }}
        </t-button>
      </div>
    </template>
  </t-dialog>
</template>
<script setup lang="ts">
defineOptions({
  name: 'Action',
});

const props = defineProps({
  config: {
    type: Object as PropType<ICmsActionBase>,
    default: () => ({}),
  },
  visible: {
    type: Boolean,
    default: false,
  },
});

const emits = defineEmits(['update:visible', 'cancel', 'submit', 'timeout']);

import type { ICmsActionButtonType, ICmsActionFormType, ICmsActionType } from '@shared/config/cmsAction';
import {
  CMS_ACTION_BUTTON_TYPE,
  CMS_ACTION_BUTTON_TYPES,
  CMS_ACTION_FORM_TYPE,
  CMS_ACTION_TYPE,
} from '@shared/config/cmsAction';
import { isNil } from '@shared/modules/validate';
import type { ICmsActionBase } from '@shared/types/cms';
import type { Dialog, DialogProps } from 'tdesign-vue-next';
import type { PropType } from 'vue';
import { computed, ref, useAttrs, watch } from 'vue';

import ActionSectionView from './components/ActionSection.vue';
import { parseActionButton } from './utils';

const attrs: Partial<DialogProps> = useAttrs();

const dialogRef = ref<InstanceType<typeof Dialog>>();
const actionRef = ref<InstanceType<typeof ActionSectionView>>();

const formVisible = ref<boolean>(props.visible);

const formData = ref<ICmsActionBase>(props.config);

const attrsCustom = computed<Partial<DialogProps>>(() => {
  // eslint-disable-next-line ts/no-unused-vars
  const { visible, ...rest } = attrs;

  return {
    ref: dialogRef,
    showInAttachedElement: true,
    destroyOnClose: true,
    placement: 'center',
    footer: shouldShowFooter.value,
    ...rest,
    onCloseBtnClick: () => handleCancel(),
    closeOnOverlayClick: formData.value.canceledOnTouchOutside ?? true,
    closeOnEscKeydown: formData.value.canceledOnTouchOutside ?? true,
  } as Partial<DialogProps>;
});

watch(
  () => formVisible.value,
  (val) => emits('update:visible', val),
);
watch(
  () => props.visible,
  (val) => (formVisible.value = val),
);
watch(
  () => props.config,
  (val) => (formData.value = val),
  { deep: true },
);

const parsedButton = computed(() => {
  return (isNil(formData.value.button)
    ? -1
    : parseActionButton(formData.value.button)) as unknown as ICmsActionButtonType;
});

const shouldShowFooter = computed(() => {
  const { button } = formData.value;
  if (isNil(button)) return isInputType(formData.value.type);
  const allow = new Set<ICmsActionButtonType>(CMS_ACTION_BUTTON_TYPES);
  return allow.has(parsedButton.value);
});

const showCancel = computed(() => {
  const { button, type } = formData.value;
  if (isNil(button)) return isInputType(type);
  const allow = new Set<ICmsActionButtonType>([
    CMS_ACTION_BUTTON_TYPE.OK_CANCEL,
    CMS_ACTION_BUTTON_TYPE.CANCEL_ONLY,
    CMS_ACTION_BUTTON_TYPE.CUSTOM,
  ]);
  return allow.has(parsedButton.value);
});

const showConfirm = computed(() => {
  const { button, type } = formData.value;
  if (isNil(button)) return isInputType(type);
  const allow = new Set<ICmsActionButtonType>([
    CMS_ACTION_BUTTON_TYPE.OK_CANCEL,
    CMS_ACTION_BUTTON_TYPE.OK_ONLY,
    CMS_ACTION_BUTTON_TYPE.CUSTOM,
  ]);
  return allow.has(parsedButton.value);
});

const showReset = computed(() => parsedButton.value === CMS_ACTION_BUTTON_TYPE.CUSTOM);

const isInputType = (type: ICmsActionType = CMS_ACTION_TYPE.INPUT): boolean => {
  return CMS_ACTION_FORM_TYPE.includes(type as unknown as ICmsActionFormType);
};
const handleCancel = () => {
  emits('cancel');
  formVisible.value = false;
};

const handleReset = () => {
  actionRef.value?.reset();
};

const onSubmit = (id: string, data?: Record<string, any>) => {
  emits('submit', id, data);
  formVisible.value = false;
};

const onTimeout = () => {
  emits('timeout');
  formVisible.value = false;
};

const handleSubmit = () => {
  actionRef.value?.submit();
};
</script>
<style lang="less" scoped>
.action-content {
  padding: 0 2px;
}
</style>
