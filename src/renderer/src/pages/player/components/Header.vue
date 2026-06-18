<template>
  <div :class="[`${prefix}-header-container`]">
    <div class="left system-functions">
      <div class="back-main system-function no-drag-region">
        <t-button theme="default" variant="text" class="btn" @click="handleBackMain">
          <template #icon><home-icon /></template>
          {{ $t('pages.player.header.backMain') }}
        </t-button>
      </div>
    </div>
    <div class="spacer system-functions">
      <span class="txthide txthide1">{{ titleFormData }}</span>
    </div>
    <div class="right system-functions">
      <div class="system-function no-drag-region">
        <t-button theme="default" shape="square" class="browse-button" @click="handleBrowse">
          <template #icon>
            <browse-icon v-if="browseFormData" />
            <browse-off-icon v-else />
          </template>
        </t-button>
      </div>
      <system-control class="system-function no-drag-region" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { APP_NAME } from '@shared/config/appInfo';
import { IPC_CHANNEL } from '@shared/config/ipcChannel';
import { BrowseIcon, BrowseOffIcon, HomeIcon } from 'tdesign-icons-vue-next';
import { onMounted, ref, watch } from 'vue';

import logoIcon from '@/assets/icon.png';
import SystemControl from '@/components/system-control/index.vue';
import { prefix } from '@/config/global';

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  browse: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['browse']);

const titleFormData = ref(props.title);
const browseFormData = ref(props.browse);

watch(
  () => props.title,
  (val) => (titleFormData.value = val),
);
watch(
  () => props.browse,
  (val) => (browseFormData.value = val),
);
watch(
  () => titleFormData.value,
  () => setSystemMediaMetadata(),
);

onMounted(() => setup());

const setup = () => {
  setSystemMediaMetadata();
};

const handleBackMain = () => {
  window.electron.ipcRenderer.invoke(IPC_CHANNEL.WINDOW_MAIN);
};

const handleBrowse = () => {
  browseFormData.value = !browseFormData.value;
  emit('browse', browseFormData.value);
};

const setSystemMediaMetadata = () => {
  if ('mediaSession' in navigator) {
    const doc = {
      title: titleFormData.value,
      artist: APP_NAME,
      artwork: [{ src: logoIcon, sizes: '128x128', type: 'image/png' }],
    };

    navigator.mediaSession.metadata = new MediaMetadata(doc);
  }
};
</script>
<style lang="less" scoped>
.back-main {
  width: auto;
}
</style>
