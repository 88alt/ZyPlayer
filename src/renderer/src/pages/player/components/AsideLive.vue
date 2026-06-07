<template>
  <div class="container-aside-wrap container-aside-live">
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
        </div>
        <dialog-download-view
          v-model:visible="active.download"
          :episode="downloadFormData.episode"
          :current="downloadFormData.current"
        />
      </div>

      <div class="anthology-container live-anthology">
        <div class="anthology-series-wrap">
          <tag-nav
            class="anthology-series-nav"
            :list="navOptions"
            :active="active.nav"
            @change="handleSwitchSeriesTab"
          />
        </div>
        <div class="box-anthology-wrap">
          <div v-if="active.nav === 'epg'" class="box-anthology-item box-anthology-epg">
            <div class="box-anthology-content">
              <t-list ref="epgListRef" class="list-wrap" :scroll="{ rowHeight: 34, type: 'virtual' }">
                <t-list-item
                  v-for="(item, index) in epgList"
                  :key="index"
                  class="item-wrap"
                  :class="[formatEpgStatus(item.start, item.end) ? 'is-active' : '']"
                >
                  <div class="list-item">
                    <div class="time">{{ item.start }}</div>
                    <div class="title txthide txthide1">{{ item.title }}</div>
                  </div>
                  <div class="divider"></div>
                </t-list-item>
              </t-list>
            </div>
          </div>
          <div v-else-if="active.nav === 'channel'" class="box-anthology-item box-anthology-channel">
            <div v-if="classList.length > 1" class="box-anthology-header">
              <title-menu :list="classList" :active="active.class" class="nav" @change="handleSwitchChannelClass" />
            </div>
            <div class="box-anthology-content">
              <t-list ref="channelListRef" class="list-wrap" :scroll="{ rowHeight: 32, type: 'virtual' }">
                <t-list-item
                  v-for="(item, index) in channelList"
                  :key="index"
                  class="item-wrap"
                  :class="[item.id === infoConf.id ? 'is-active' : '']"
                  @click="handleSwitchChannelItem(item)"
                >
                  <div class="list-item">
                    <div class="logo">
                      <t-image
                        class="logo-lazy"
                        fit="contain"
                        :src="item.logo"
                        :lazy="true"
                        :loading="renderDefaultLazy"
                        :error="renderDefaultLazy"
                      />
                    </div>
                    <div class="title txthide txthide1">{{ item.name }}</div>
                  </div>
                  <div class="divider"></div>
                </t-list-item>
              </t-list>

              <div class="infinite-loading">
                <infinite-loading
                  class="infinite-loading-container"
                  target=".box-anthology-content"
                  :identifier="infiniteId"
                  :distance="200"
                  @infinite="loadMore"
                >
                  <template #complete>{{ $t('common.infiniteLoading.complete') }}</template>
                  <template #error>{{ $t('common.infiniteLoading.error') }}</template>
                </infinite-loading>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="tsx">
import 'v3-infinite-loading/lib/style.css';

import { isBetween, toYMD } from '@shared/modules/date';
import { isArray, isArrayEmpty, isPositiveFiniteNumber } from '@shared/modules/validate';
import type { ICmsInfo } from '@shared/types/cms';
import type { IModels } from '@shared/types/db';
import { DownloadIcon, HeartFilledIcon, HeartIcon, Share1Icon } from 'tdesign-icons-vue-next';
import type { ListInstanceFunctions } from 'tdesign-vue-next';
import InfiniteLoading from 'v3-infinite-loading';
import type { StateHandler as ILoadStateHdandler } from 'v3-infinite-loading/lib/types';
import type { PropType } from 'vue';
import { computed, onMounted, ref, toRaw, useTemplateRef, watch } from 'vue';

import { fetchChannelEpg, fetchChannelPage } from '@/api/live';
import LazyBg from '@/components/lazy-bg/index.vue';
import sharePopup from '@/components/share/index.vue';
import TagNav from '@/components/tag-nav/index.vue';
import TitleMenu from '@/components/title-menu/index.vue';
import type { IStorePlayer } from '@/config/player';
import { useHistory } from '@/hooks/useHistory';
import { useStar } from '@/hooks/useStar';
import { t } from '@/locales';
import type { IVideoOptions, IVideoProcess } from '@/types/player';

import DialogDownloadView from './DialogDownload.vue';

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

const renderDefaultLazy = () => <LazyBg class="render-icon" />;

// @ts-expect-error ts-plugin(6133)
const epgListRef = useTemplateRef<ListInstanceFunctions>('epgListRef');
// @ts-expect-error ts-plugin(6133)
const channelListRef = useTemplateRef<ListInstanceFunctions>('channelListRef');

const infoConf = ref(props.store.data.info);
const extraConf = ref(props.store.data.extra);
const playerConf = ref(props.store.setting);
const processConf = ref(props.process);

const channelList = ref<IModels['channel'][]>([]);
const classList = ref<Array<{ type_id: string; type_name: string }>>([]);
const epgList = ref<Array<{ title: string; start: string; end: string }>>([]);

const infiniteId = ref(Date.now());
const pagination = ref({
  pageIndex: 1,
  pageSize: 32,
  total: 0,
});

const videoData = ref<IVideoOptions>({
  url: '',
  playEnd: false,
  watchTime: 0,
  duration: 0,
  skipTimeInStart: 0,
  skipTimeInEnd: 0,
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

const active = ref({
  watch: true,
  nav: 'epg',
  class: '',
  share: false,
  download: false,
});

const { starData, getStarData, handleSwitchStar, resetStarData } = useStar({
  source: infoConf,
  getQuery: (info) => ({
    relateId: extraConf.value.active.key,
    videoId: info.id,
    type: 2,
  }),
  createDoc: (info) => ({
    type: 2,
    relateId: extraConf.value.active.key,
    videoId: info.id,
    videoImage: info.logo,
    videoName: info.name,
    videoType: info.group,
    videoRemarks: '',
  }),
});

const { getHistoryData, throttleSaveHistory, resetHistoryData } = useHistory({
  source: infoConf,
  getQuery: (info) => ({
    relateId: extraConf.value.active.key,
    videoId: info.id,
    type: 2,
  }),
  createDoc: (info) => ({
    type: 2,
    relateId: extraConf.value.active.key,
    siteSource: info.group,
    playEnd: videoData.value.playEnd,
    videoId: info.id,
    videoImage: info.logo,
    videoName: info.name,
    videoIndex: `${info.name}$${info.api}`,
    watchTime: isPositiveFiniteNumber(videoData.value.watchTime) ? videoData.value.watchTime : 0,
    duration: isPositiveFiniteNumber(videoData.value.duration) ? videoData.value.duration : 0,
    skipTimeInStart: videoData.value.skipTimeInStart,
    skipTimeInEnd: videoData.value.skipTimeInEnd,
  }),
  onLoaded: (history) => {
    const { skipHeadAndEnd } = playerConf.value;
    const skipTimeInStart = history.skipTimeInStart ?? 0;
    const skipTimeInEnd = history.skipTimeInEnd ?? 0;
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

const navOptions = computed(() => [
  { value: 'epg', label: t('pages.player.live.epg') },
  { value: 'channel', label: t('pages.player.live.channel') },
]);

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

const formatEpgStatus = (start: string, end: string): boolean => {
  const standardStart = `${toYMD()} ${start}`;
  const standardEnd = `${toYMD()} ${end}`;
  return isBetween(standardStart, standardEnd);
};

const getChannel = async () => {
  const { pageIndex, pageSize } = pagination.value;

  const resp = await fetchChannelPage({
    pageNum: pageIndex,
    pageSize,
    group: active.value.class,
  });

  if (isArray(resp.class) && !isArrayEmpty(resp.class)) {
    classList.value = [
      { type_id: '', type_name: computed(() => t('common.all')) },
      ...resp.class.map((item) => ({
        type_id: item.value,
        type_name: item.label,
      })),
    ];

    active.value.class = classList.value.map((item) => item.type_id).includes(active.value.class)
      ? active.value.class
      : classList.value[0].type_id;
  }

  if (isArray(resp.list) && !isArrayEmpty(resp.list)) {
    channelList.value.push(...resp.list);
  }

  if (resp.total) pagination.value.total = resp.total;

  return resp.list.length;
};

const resetPagination = () => {
  pagination.value.pageIndex = 1;
  pagination.value.total = 0;
};

const loadMore = async ($state: ILoadStateHdandler) => {
  try {
    const length = await getChannel();

    if (length === 0) {
      resetPagination();
      $state.complete();
    } else {
      pagination.value.pageIndex++;
      $state.loaded();
    }
  } catch (error) {
    console.error(`Failed to load more data:`, error);
    $state.error();
  }
};

const getChannelEpg = async (ch: string, date: string) => {
  try {
    const res = await fetchChannelEpg({ ch, date });
    epgList.value = res;
  } catch (error) {
    console.error('Fetch EPG List Error:', error);
  }
};

const handleSwitchSeriesTab = (val: string) => {
  active.value.nav = val;
};

const handleSwitchChannelClass = (id: string) => {
  resetPagination();

  channelList.value = [];

  active.value.class = id;

  infiniteId.value = Date.now();
};

const handleSwitchChannelItem = async (item: IModels['channel']) => {
  epgList.value = [];

  resetStarData();
  resetHistoryData();

  videoData.value = { url: '', playEnd: false, watchTime: 0, duration: 0, skipTimeInStart: 0, skipTimeInEnd: 0 };

  await emits('update', {
    data: toRaw({
      info: item,
      extra: extraConf.value,
    }),
  });
  setup();
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
  let name = infoConf.value.name;
  if (infoConf.value.group) name = `${infoConf.value.group}-${infoConf.value.name}`;

  shareFormData.value = { ...shareFormData.value, name, url: videoData.value.url };
  active.value.share = true;
};

const callPlay = async (item: { url: string; headers?: Record<string, any> }) => {
  videoData.value.url = item.url;

  await emits('create', {
    url: item.url,
    isLive: true,
    headers: item.headers,
  });
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

  await callPlay({ url: infoConf.value.api, headers: infoConf.value.headers });

  getStarData();
  getChannelEpg(infoConf.value.name, toYMD());
};

// const handleScroll = () => {
//   nextTick(() => {
//     const nav = active.value.nav;
//     const isEpg = nav === 'epg';

//     const listRef = isEpg ? epgListRef.value : channelListRef.value;
//     if (!listRef) return;

//     const list = isEpg ? epgList.value : channelList.value;
//     if (list.length === 0) return;

//     const id = isEpg ? epgList.value.find((item) => formatEpgStatus(item.start, item.end))?.title : infoConf.value.id;
//     if (!id) return;

//     const index = list.findIndex((item) => (isEpg ? item.title === id : item.id === id)) - 1;
//     if (index < 0) return;

//     listRef.scrollTo?.({
//       index,
//       behavior: 'smooth',
//     });
//   });
// };
</script>
<style lang="less" scoped></style>
