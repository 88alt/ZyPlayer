import type { IVlcCanvasRenderer, IVlcInitOptions } from '../types';
import { VlcAdapter } from './adapter';
import { createI18nResolver } from './lang/locales';
import cssVarMix from './player/cssVarMix';
import currentTimeMix from './player/currentTimeMix';
import durationMix from './player/durationMix';
import flipMix from './player/flipMix';
import fullscreenMix from './player/fullscreenMix';
import pauseMix from './player/pauseMix';
import pipMix from './player/pipMix';
import playbackRateMix from './player/playbackRateMix';
import playedMix from './player/playedMix';
import playingMix from './player/playingMix';
import playMix from './player/playMix';
import seekMix from './player/seekMix';
import toggleMix from './player/toggleMix';
import volumeMix from './player/volumeMix';
import Storage from './storage';
import { Template } from './template';
import Emitter from './utils/emitter';

export interface IVlcPlayer {
  // Services
  template: Template;
  notice: { show: string | Error; silent: boolean };
  i18n: { get: (key: string) => string };
  storage: Storage;
  option: Record<string, any>;
  constructor: { instances: any[]; FULLSCREEN_WEB_IN_BODY: boolean };

  // State
  state: string;
  isReady: boolean;

  // Event system
  emit: (name: string, ...args: any[]) => void;
  on: (name: string, fn: (...args: any[]) => void) => void;
  off: (name: string, fn?: (...args: any[]) => void) => void;
  once: (name: string, fn: (...args: any[]) => void) => void;
  proxy: (el: HTMLElement | Window, event: string, fn: (e: any) => void) => () => void;

  // Playback (from mixins)
  play: () => Promise<void>;
  pause: () => void;
  toggle: () => void;
  seek: number;
  forward: number;
  backward: number;
  played: number;
  flip: string;
  cssVar: (key: string, value?: string) => any;

  // Properties (from mixins or direct)
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  fullscreenWeb: boolean;

  // PiP
  pip: boolean;
  pipEnabled: boolean;
  pipCanvas: HTMLCanvasElement | null;

  // VLC-specific
  adapter: VlcAdapter;
  canvasRenderer: IVlcCanvasRenderer | null;
}

export function createVlcPlayer(options: IVlcInitOptions): IVlcPlayer {
  const adapter = new VlcAdapter();
  const storage = new Storage();
  const emitter = new Emitter();
  const t = createI18nResolver(options);

  // Create template (renders DOM and provides refs)
  const template = new Template(
    {
      option: {
        container: options.el,
        url: options.url,
        type: 'vlc',
        mutex: true,
        hotkey: true,
        playbackRates: options.playbackRates,
      },
      adapter,
    },
    t,
  );

  // Track DOM event cleanups for proxy()
  const proxyCleanups: Array<() => void> = [];

  let noticeTimer: ReturnType<typeof setTimeout> | null = null;
  const player: any = {
    // Services
    template,
    notice: {
      _msg: '' as string | Error,
      silent: false,
      set show(msg: string | Error) {
        this._msg = msg;
        if (this.silent) return;
        const el = template.$notice;
        if (!el) return;
        el.textContent = String(msg);
        el.classList.add('show');
        if (noticeTimer) clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => {
          el.classList.remove('show');
        }, 1500);
      },
      get show(): string | Error {
        return this._msg;
      },
    },
    i18n: { get: (key: string) => t(key as any) },
    storage,
    option: {
      url: options.url,
      type: 'vlc',
      mutex: true,
      hotkey: true,
    },
    constructor: {
      instances: [] as any[],
      FULLSCREEN_WEB_IN_BODY: false,
    },

    // State
    state: 'idle',
    isReady: false,

    // Event system
    emit: (name: string, ...args: any[]) => emitter.emit(name, ...args),
    on: (name: string, fn: (...args: any[]) => void) => emitter.on(name, fn),
    off: (name: string, fn?: (...args: any[]) => void) => emitter.off(name, fn),
    once: (name: string, fn: (...args: any[]) => void) => emitter.once(name, fn),
    proxy: (el: HTMLElement | Window, event: string, fn: (e: any) => void) => {
      el.addEventListener(event, fn);
      const cleanup = () => el.removeEventListener(event, fn);
      proxyCleanups.push(cleanup);
      return cleanup;
    },

    // VLC-specific
    adapter,
    canvasRenderer: null as IVlcCanvasRenderer | null,
  };

  // Fix constructor.instances reference
  player.constructor.instances = [player];

  // Apply mixins
  playMix(player);
  pauseMix(player);
  toggleMix(player);
  seekMix(player);
  playedMix(player);
  playingMix(player);
  currentTimeMix(player);
  durationMix(player);
  volumeMix(player);
  playbackRateMix(player);
  flipMix(player);
  cssVarMix(player);
  fullscreenMix(player);
  pipMix(player);

  // Restore from storage (priority: options > storage > default)
  if (options.volume == null) {
    const savedVolume = storage.get('volume');
    if (savedVolume != null && !Number.isNaN(Number(savedVolume))) {
      player.volume = Number(savedVolume);
    }
  }
  if (options.muted ?? storage.get('muted')) {
    player.muted = true;
  }
  if (options.playbackRate == null) {
    const savedRate = storage.get('playrate');
    if (savedRate != null && !Number.isNaN(Number(savedRate))) {
      player.playbackRate = Number(savedRate);
    }
  }

  return player;
}
