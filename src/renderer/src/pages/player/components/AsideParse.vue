<template>
  <div class="container-aside-wrap container-aside-parse">
    <div class="container-wrap main-wrap">
      <div class="info-wrap">
        <div class="new-title-wrap">
          <div class="new-title-name">
            <div class="title title-text txthide txthide1">{{ infoConf.name }}</div>
          </div>
        </div>
        <div class="play-paction">
          <div class="paction-item like" @click="handleSwitchStar">
            <heart-filled-icon v-if="starData.id" class="icon" />
            <heart-icon v-else class="icon" />
            <span class="tip">{{ $t('pages.moment.star.title') }}</span>
          </div>
          <t-divider layout="vertical" />

          <div class="paction-item download" @click="handleDownloadDialog">
            <download-icon class="icon" />
            <span class="tip">{{ $t('pages.player.function.download') }}</span>
          </div>
          <t-divider layout="vertical" />

          <div class="paction-item share" @click="handleSharePopup">
            <t-popup trigger="click">
              <share1-icon class="icon" />
              <span class="tip">{{ $t('component.share.title') }}</span>

              <template #content>
                <share-popup :data="shareFormData" type="popup" />
              </template>
            </t-popup>
          </div>
          <t-divider layout="vertical" />

          <div class="paction-item more">
            <t-dropdown trigger="click">
              <more-icon />

              <t-dropdown-menu>
                <t-dropdown-item>
                  <div class="setting-item" @click="handleSettingDialog">
                    <setting-icon />
                    {{ $t('pages.player.function.setting') }}
                  </div>
                </t-dropdown-item>
              </t-dropdown-menu>
            </t-dropdown>
          </div>
        </div>
        <dialog-download-view
          v-model:visible="active.download"
          :episode="downloadFormData.episode"
          :current="downloadFormData.current"
        />
        <dialog-setting-view
          v-model:visible="active.setting"
          type="parse"
          :data="settingFormData"
          :time="processConf"
          @change="onSettingChange"
        />
      </div>

      <div class="anthology-container parse-anthology">
        <div class="anthology-series-wrap">
          <tag-nav
            class="anthology-series-nav"
            :list="navOptions"
            :active="active.nav"
            @change="handleSwitchSeriesTab"
          />
        </div>
        <div class="box-anthology-wrap">
          <div class="box-anthology-item">
            <div class="box-anthology-content">
              <t-list ref="listRef" class="list-wrap" :scroll="{ rowHeight: 34, type: 'virtual' }">
                <t-list-item
                  v-for="(item, index) in parseList"
                  :key="index"
                  class="item-wrap"
                  :class="[item.id === extraConf.active.id ? 'is-active' : '']"
                  @click="handleSwitchParseItem(item)"
                >
                  <div class="list-item">
                    <div class="title txthide txthide1">{{ item.name }}</div>
                  </div>
                  <div class="divider"></div>
                </t-list-item>
              </t-list>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="tsx">
import { isArray, isArrayEmpty, isHttp, isPositiveFiniteNumber } from '@shared/modules/validate';
import type { ICmsInfo } from '@shared/types/cms';
import type { IModels } from '@shared/types/db';
import { DownloadIcon, HeartFilledIcon, HeartIcon, MoreIcon, SettingIcon, Share1Icon } from 'tdesign-icons-vue-next';
import type { ListInstanceFunctions } from 'tdesign-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import type { PropType } from 'vue';
import { computed, onMounted, ref, toRaw, useTemplateRef, watch } from 'vue';

import { fetchRecBarrage } from '@/api/film';
import { fetchParse } from '@/api/parse';
import sharePopup from '@/components/share/index.vue';
import TagNav from '@/components/tag-nav/index.vue';
import type { IStorePlayer } from '@/config/player';
import { useHistory } from '@/hooks/useHistory';
import { useStar } from '@/hooks/useStar';
import { t } from '@/locales';
import type { IVideoOptions, IVideoProcess } from '@/types/player';

import DialogDownloadView from './DialogDownload.vue';
import DialogSettingView from './DialogSetting.vue';

const props = defineProps({
  store: {
    type: Object as PropType<IStorePlayer>,
    default: () => ({}),
  },
  process: {
    type: Object as PropType<IVideoProcess>,
    default: () => ({ currentTime: 0, duration: 0 }),
  },
});

const emits = defineEmits(['update', 'barrage', 'create', 'pause', 'seek']);

const DEFAULT_SKIP_TIME = 90;

// @ts-expect-error ts-plugin(6133)
const listRef = useTemplateRef<ListInstanceFunctions>('listRef');

const infoConf = ref(props.store.data.info);
const extraConf = ref(props.store.data.extra);
const playerConf = ref(props.store.setting);
const processConf = ref(props.process);

const parseList = ref(extraConf.value.site || []);

const videoData = ref<IVideoOptions>({
  url: '',
  playEnd: false,
  watchTime: 0,
  duration: 0,
  skipTimeInStart: DEFAULT_SKIP_TIME,
  skipTimeInEnd: DEFAULT_SKIP_TIME,
});

const downloadFormData = ref({
  episode: {} as ICmsInfo['vod_episode'],
  current: '',
});
const shareFormData = ref({
  name: '',
  url: '',
  enablePrefix: true,
});
const settingFormData = ref({
  skipHeadAndEnd: false,
  skipTimeInStart: DEFAULT_SKIP_TIME,
  skipTimeInEnd: DEFAULT_SKIP_TIME,
  skipAd: false,
});

const active = ref({
  watch: true,
  nav: 'line',
  share: false,
  download: false,
  setting: false,
});

const { starData, getStarData, handleSwitchStar, resetStarData } = useStar({
  source: infoConf,
  getQuery: (info) => ({
    relateId: extraConf.value.active.key,
    videoId: info.id,
    type: 3,
  }),
  createDoc: (info) => ({
    type: 3,
    relateId: extraConf.value.active.key,
    videoId: info.id,
    videoImage: '',
    videoName: info.name,
    videoType: '',
    videoRemarks: '',
  }),
});

const { getHistoryData, throttleSaveHistory, resetHistoryData } = useHistory({
  source: infoConf,
  getQuery: (info) => ({
    relateId: extraConf.value.active.key,
    videoId: info.id,
    type: 3,
  }),
  createDoc: (info) => ({
    type: 3,
    relateId: extraConf.value.active.key,
    siteSource: '',
    playEnd: videoData.value.playEnd,
    videoId: info.id,
    videoImage: '',
    videoName: info.name,
    videoIndex: `${info.name}$${info.api}`,
    watchTime: isPositiveFiniteNumber(videoData.value.watchTime) ? videoData.value.watchTime : 0,
    duration: isPositiveFiniteNumber(videoData.value.duration) ? videoData.value.duration : 0,
    skipTimeInStart: videoData.value.skipTimeInStart,
    skipTimeInEnd: videoData.value.skipTimeInEnd,
  }),
  onLoaded: (history) => {
    const { skipHeadAndEnd } = playerConf.value;
    const skipTimeInStart = history.skipTimeInStart ?? DEFAULT_SKIP_TIME;
    const skipTimeInEnd = history.skipTimeInEnd ?? DEFAULT_SKIP_TIME;
    const duration = history.duration ?? 0;
    const rawWatchTime = history.watchTime ?? 0;
    const playEnd = history.playEnd ?? false;
    videoData.value = {
      ...videoData.value,
      skipTimeInStart,
      skipTimeInEnd,
      duration,
      watchTime: skipHeadAndEnd ? Math.max(rawWatchTime, skipTimeInStart) : rawWatchTime,
      playEnd,
    };
  },
});

const navOptions = computed(() => [{ value: 'line', label: t('pages.parse.title') }]);

watch(
  () => props.store,
  (val) => {
    infoConf.value = val.data.info;
    extraConf.value = val.data.extra;
    playerConf.value = val.setting;
  },
  { deep: true },
);
watch(
  () => props.process,
  (val) => (processConf.value = val),
);
watch(
  () => processConf.value,
  (val) => {
    if (active.value.watch) timerUpdatePlayProcess(val.currentTime, val.duration);
  },
);
// watch(
//   () => active.value.nav,
//   () => handleScroll(),
// );

onMounted(() => setup());

const handleSwitchParseItem = async (item: IModels['analyze']) => {
  resetHistoryData();
  resetStarData();

  videoData.value = { url: '', playEnd: false, watchTime: 0, duration: 0, skipTimeInStart: 0, skipTimeInEnd: 0 };

  await emits('update', {
    data: toRaw({
      info: infoConf.value,
      extra: { ...extraConf.value, active: item },
    }),
  });

  setup();
};

const handleSwitchSeriesTab = (val: string) => {
  active.value.nav = val;
};

const handleDownloadDialog = () => {
  downloadFormData.value = {
    episode: {
      [t('common.default')]: [{ text: infoConf.value.name, link: videoData.value.url || infoConf.value.api }],
    },
    current: videoData.value.url,
  };

  active.value.download = true;
};

const handleSharePopup = () => {
  const name = infoConf.value.name;

  shareFormData.value = { ...shareFormData.value, name, url: videoData.value.url };

  active.value.share = true;
};

const callBarrage = async (item: { url: string }) => {
  try {
    const res = await fetchRecBarrage({ id: item.url });
    if (!isArray(res.list) || isArrayEmpty(res.list)) return;

    emits('barrage', {
      list: res.list,
      id: res.id,
    });
  } catch {}
};

const handleSettingDialog = () => {
  settingFormData.value = {
    skipHeadAndEnd: playerConf.value.skipHeadAndEnd,
    skipTimeInStart: videoData.value.skipTimeInStart,
    skipTimeInEnd: videoData.value.skipTimeInEnd,
    skipAd: playerConf.value.skipAd,
  };

  active.value.setting = true;
};

const onSettingChange = (item: typeof settingFormData.value) => {
  const { skipTimeInStart = DEFAULT_SKIP_TIME, skipTimeInEnd = DEFAULT_SKIP_TIME, skipHeadAndEnd, skipAd } = item;

  /** sync skip time */
  videoData.value.skipTimeInStart = skipTimeInStart;
  videoData.value.skipTimeInEnd = skipTimeInEnd;

  /** sync player config */
  playerConf.value.skipHeadAndEnd = skipHeadAndEnd;
  playerConf.value.skipAd = skipAd;

  emits('update', {
    setting: playerConf.value,
  });
};

const callPlay = async (item: { url: string }) => {
  MessagePlugin.info(t('pages.parse.message.info'));

  const { active } = extraConf.value;
  const resp = await fetchParse({ id: active.id, url: item.url });

  if (!isHttp(resp?.url)) {
    MessagePlugin.error(t('pages.parse.message.error'));
    return;
  }

  videoData.value.url = resp.url;

  await emits('create', {
    url: resp.url,
    headers: resp.headers,
    startTime: videoData.value.watchTime,
    skipAd: playerConf.value.skipAd,
  });
  callBarrage(item);
};

const timerUpdatePlayProcess = async (currentTime: number, duration: number) => {
  if (!isPositiveFiniteNumber(currentTime) || !isPositiveFiniteNumber(duration)) return;
  if (currentTime <= 0 || duration <= 0) return;

  const { skipTimeInStart, skipTimeInEnd } = videoData.value;
  const { skipHeadAndEnd } = playerConf.value;

  /** skip head */
  if (skipHeadAndEnd && skipTimeInStart < duration && currentTime < skipTimeInStart) {
    emits('seek', skipTimeInStart);
    return;
  }

  // Get skip time
  const watchTime = skipHeadAndEnd ? currentTime + skipTimeInEnd : currentTime;
  const isPlayEnd = watchTime >= duration;

  // console.debug(`timeUpdate`, {
  //   currentTime,
  //   watchTime,
  //   duration,
  //   percentage: Math.trunc((currentTime / duration) * 100),
  // });

  // update history data
  videoData.value = { ...videoData.value, watchTime, duration, playEnd: isPlayEnd };
  throttleSaveHistory();
};

const setup = async () => {
  // handleScroll();

  await getHistoryData();

  await callPlay({ url: infoConf.value.api });

  getStarData();
};

// const handleScroll = () => {
//   nextTick(() => {
//     if (!listRef.value) return;

//     const id = extraConf.value.active.id;
//     if (!id) return;

//     const list = parseList.value;
//     if (list.length === 0) return;

//     const index = list.findIndex((item) => item.id === id) - 1;
//     if (index < 0) return;
//     console.debug('handleScroll to index:', index);
//     listRef.value?.scrollTo?.({
//       index,
//       behavior: 'smooth',
//     });
//   });
// };
</script>
<style lang="less" scoped></style>
