import '@zy/vlc/renderer.css';

import type { IVlcInitOptions, IVlcRuntime } from '@zy/vlc/renderer';
import { VlcPlayer } from '@zy/vlc/renderer';
import { merge } from 'es-toolkit';

import { emitterChannel } from '@/config/emitterChannel';
import { getPlayStore } from '@/store';
import emitter from '@/utils/emitter';

import type { IBarrage, IMultiPlayerOptions } from '../../types';
import { language, libvlcPath } from '../../utils/static';
import { storage, storageUtil } from '../../utils/storage';

const getVlcPath = () => {
  const external = getPlayStore().player.external.trim();
  const [libPath, pluginPath] = external.split(';').map((item) => item.trim());
  const fallback = libvlcPath();

  return {
    libPath: libPath || fallback.libPath,
    pluginPath: pluginPath || fallback.pluginPath,
  };
};

class VlcPlayerAdapter {
  player: IVlcRuntime | null = null;
  options: IVlcInitOptions = {
    el: '#vlcplayer',
    url: '',
    playbackRates: [0.75, 1, 1.25, 1.5, 2, 3],
    locale: 'zh-CN',
  };

  barrage(_barrage: IBarrage[], _id: string) {}

  async create(rawOptions: Required<IMultiPlayerOptions>) {
    storageUtil.delStartWith('vlcplayer_settings');

    const options: IVlcInitOptions = {
      el: `#${rawOptions.container}`, // 容器
      url: rawOptions.url, // 地址
      // autoplay: rawOptions.autoplay,
      // isLive: rawOptions.isLive,
      startTime: !rawOptions.isLive && rawOptions.startTime > 0 ? rawOptions.startTime : 0,
      volume: ((v) => (Number.isNaN(v) ? 1 : v))(Number(storage?.get('volume'))), // 音量
      muted: !!storage?.get('muted'),
      locale: (() => {
        const locale = language();
        switch (locale) {
          case 'zh-CN':
            return 'zh-CN';
          case 'zh-TW':
            return 'zh-TW';
          default:
            return 'en-US';
        }
      })(), // 语言
      // quality: rawOptions.quality.map((q, i) => ({ html: q.name, url: q.url, default: i === 0 })), // 画质
      headers: rawOptions.headers, // 请求头
    };

    if (rawOptions.next) {
      options.playNext = () => emitter.emit(emitterChannel.COMP_MULTI_PLAYER_PLAYNEXT, {});
    }

    // 初始化
    const player = new VlcPlayer(getVlcPath(), merge(this.options, options));

    player.storage = storage as unknown as IVlcRuntime['storage']; // 挂载存储
    this.player = player; // 赋值实例

    return this.player;
  }

  destroy() {
    if (!this.player) return;

    this.player.destroy();
    this.player = null;
  }

  onTimeUpdate(callback: (args: { currentTime: number; duration: number }) => void) {
    this.player?.adapter.onTimeUpdate(({ currentTime, duration }) => {
      callback({
        currentTime: currentTime ?? Number.NaN,
        duration: duration ?? Number.NaN,
      });
    });
  }

  offTimeUpdate() {
    this.player?.adapter.offTimeUpdate();
  }

  play() {
    this.player?.play();
  }

  pause() {
    this.player?.pause();
  }

  togglePlay() {
    this.player?.toggle();
  }

  toggleMuted() {
    if (this.player) this.muted = !this.muted;
  }

  seek(time: number) {
    if (this.player) this.player.seek = time;
  }

  switchUrl(rawOptions: Required<IMultiPlayerOptions>) {
    this.destroy();
    this.create(rawOptions);
  }

  get currentTime() {
    return this.player?.currentTime ?? Number.NaN;
  }

  get duration() {
    return this.player?.duration ?? Number.NaN;
  }

  get time() {
    return {
      currentTime: this.player?.currentTime ?? Number.NaN,
      duration: this.player?.duration ?? Number.NaN,
    };
  }

  get playbackRate() {
    return this.player?.playbackRate ?? 1;
  }

  set playbackRate(rate: number) {
    if (this.player) {
      this.player.playbackRate = rate;

      storage?.set('playrate', rate);
    }
  }

  get muted() {
    return !!this.player?.muted;
  }

  set muted(state: boolean) {
    if (this.player) {
      this.player.muted = state;

      storage?.set('muted', state);
    }
  }

  get volume() {
    return this.player?.volume ?? 0;
  }

  set volume(volume: number) {
    if (this.player) {
      if (volume > 0) this.player.muted = false;
      this.player.volume = volume;

      storage?.set('muted', this.player.muted);
      storage?.set('volume', volume);
    }
  }

  get instance() {
    return this.player;
  }
}

export default VlcPlayerAdapter;
