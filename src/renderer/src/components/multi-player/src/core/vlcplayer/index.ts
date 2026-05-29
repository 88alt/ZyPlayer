import '@zy/vlc/renderer.css';

import type { IVlcRuntime, VlcPlayer } from '@zy/vlc/renderer';
import { setupVlc } from '@zy/vlc/renderer';

import { emitterChannel } from '@/config/emitterChannel';
import { getPlayStore } from '@/store';
import emitter from '@/utils/emitter';

import type { IBarrage, IMultiPlayerOptions } from '../../types';
import { language, libvlcPath } from '../../utils/static';
import { storage } from '../../utils/storage';

const getVlcPath = () => {
  const external = getPlayStore().player.external.trim();
  const [libPath, pluginPath] = external.split(';').map((item) => item.trim());
  const fallback = libvlcPath();

  return {
    libPath: libPath || fallback.libPath,
    pluginPath: pluginPath || fallback.pluginPath,
  };
};

const getVlcLocale = () => {
  const locale = language();
  if (locale === 'zh-CN' || locale === 'zh-TW') return locale;
  return 'en-US';
};

const normalizeHeaders = (headers: Record<string, any>) => {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)]));
};

const toSeconds = (time: number) => {
  if (!Number.isFinite(time)) return Number.NaN;
  return time / 1000;
};

class VlcPlayerAdapter {
  player: IVlcRuntime | null = null;
  options: Required<IMultiPlayerOptions> | null = null;

  barrage(_barrage: IBarrage[], _id: string) {}

  async create(rawOptions: Required<IMultiPlayerOptions>): Promise<IVlcRuntime> {
    this.options = rawOptions;

    const playNext = rawOptions.next
      ? () => {
          emitter.emit(emitterChannel.COMP_MULTI_PLAYER_PLAYNEXT, {});
        }
      : undefined;

    this.player = setupVlc(getVlcPath(), {
      el: `#${rawOptions.container}`,
      url: rawOptions.url,
      headers: normalizeHeaders(rawOptions.headers),
      autoplay: rawOptions.autoplay,
      startTime: !rawOptions.isLive && rawOptions.startTime > 0 ? rawOptions.startTime : 0,
      volume: ((v) => (Number.isNaN(v) ? 1 : v))(Number(storage?.get('volume'))),
      playbackRate: !rawOptions.isLive ? ((v) => (Number.isNaN(v) ? 1 : v))(Number(storage?.get('playrate'))) : 1,
      locale: getVlcLocale(),
      playNext,
    });

    if (storage?.get('muted')) this.player.player.muted = true;

    return this.player;
  }

  async destroy() {
    if (!this.player) return;

    this.player.destroy();
    this.player = null;
    this.options = null;
  }

  onTimeUpdate(callback: (args: { currentTime: number; duration: number }) => void) {
    this.player?.adapter.onTimeUpdate(({ currentTime, duration }) => {
      callback({
        currentTime: toSeconds(currentTime),
        duration: toSeconds(duration),
      });
    });
  }

  offTimeUpdate() {
    this.player?.adapter.offTimeUpdate();
  }

  async play() {
    this.player?.player.play();
  }

  async pause() {
    this.player?.player.pause();
  }

  togglePlay() {
    this.player?.player.toggle();
  }

  toggleMuted() {
    if (this.player) this.muted = !this.muted;
  }

  seek(time: number) {
    if (this.player) this.player.player.seek = time;
  }

  async switchUrl(rawOptions: Required<IMultiPlayerOptions>) {
    await this.destroy();
    await this.create(rawOptions);
  }

  get currentTime() {
    return toSeconds(this.player?.player.currentTime ?? Number.NaN);
  }

  get duration() {
    return toSeconds(this.player?.player.duration ?? Number.NaN);
  }

  get time() {
    return {
      currentTime: this.currentTime,
      duration: this.duration,
    };
  }

  get playbackRate() {
    return this.player?.player.playbackRate ?? 1;
  }

  set playbackRate(rate: number) {
    if (!this.player) return;

    this.player.player.playbackRate = rate;
    storage?.set('playrate', rate);
  }

  get muted() {
    return !!this.player?.player.muted;
  }

  set muted(state: boolean) {
    if (!this.player) return;

    this.player.player.muted = state;
    storage?.set('muted', state);
  }

  get volume() {
    return this.player?.player.volume ?? 0;
  }

  set volume(volume: number) {
    if (!this.player) return;

    if (volume > 0) this.player.player.muted = false;
    this.player.player.volume = volume;
    storage?.set('muted', this.player.player.muted);
    storage?.set('volume', volume);
  }

  get instance(): VlcPlayer | null {
    return this.player?.player ?? null;
  }
}

export default VlcPlayerAdapter;
