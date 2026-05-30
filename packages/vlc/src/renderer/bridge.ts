import { VLC_IPC_CHANNEL } from '../constants/ipc';
import type { IVlcEventPayload, IVlcInitOptions, IVlcInitPath } from '../types';

export interface IVlcBridge {
  create: (mountSelector: string) => void | Promise<void>;
  play: () => void;
  pause: () => void;
  setVolume: (vol: number) => void;
  getVolume: () => number;
  setMuted: (muted: boolean) => void;
  getMuted: () => boolean;
  setProgress: (progress: number) => Promise<void>;
  getProgress: () => number;
  getDuration: () => number;
  getPlayed: () => number;
  getBuffered: () => number;
  setPlaybackRate: (rate: number) => void;
  getPlaybackRate: () => number;
  setFrameFormat: (width: number, height: number) => void;
  getFrameRgba: () => Uint8Array;
  onEvent: (callback: (payload: IVlcEventPayload) => void) => () => void;
  destroy: () => Promise<void>;
}

export function createBridge(path: IVlcInitPath, options: IVlcInitOptions, instanceId?: string): IVlcBridge {
  const ipcRenderer = (window as unknown as { electron: { ipcRenderer: Electron.IpcRenderer } }).electron.ipcRenderer;
  const initPath = { libPath: path.libPath ?? '', pluginPath: path.pluginPath ?? '' };
  const defaultUrl = options.url ?? '';
  const defaultVolume = options.volume ?? 0.7;
  const defaultMuted = options.muted ?? false;
  const defaultRate = options.playbackRate ?? 1;
  const seekStep = options.seekStep ?? 5000;
  const volumeStep = options.volumeStep ?? 0.05;
  let lastFrame: Uint8Array = new Uint8Array(0);
  let frameRequestInFlight = false;
  let created = false;
  let instance_id: string | null = instanceId ?? null;
  let metricsTimer: ReturnType<typeof setInterval> | null = null;
  const metrics = {
    volume: defaultVolume,
    muted: defaultMuted,
    progress: 0,
    duration: 0,
    played: 0,
    buffered: 0,
    playbackRate: defaultRate,
  };

  function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    return ipcRenderer.invoke(channel, ...args);
  }

  function toMetricNumber(value: unknown, allowNaN = false): number | null {
    if (typeof value === 'number') {
      if (allowNaN && Number.isNaN(value)) return value;
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'bigint') {
      const numberValue = Number(value);
      return Number.isFinite(numberValue) ? numberValue : null;
    }
    if (typeof value === 'string' && value.trim()) {
      const numberValue = Number(value);
      if (allowNaN && Number.isNaN(numberValue)) return numberValue;
      return Number.isFinite(numberValue) ? numberValue : null;
    }
    return null;
  }

  function updateNumberMetric(key: keyof typeof metrics, promise: Promise<unknown>, allowNaN = false): void {
    void promise
      .then((value) => {
        const numberValue = toMetricNumber(value, allowNaN);
        if (numberValue !== null) (metrics as Record<string, unknown>)[key] = numberValue;
      })
      .catch(() => {});
  }

  function startMetricsPolling(): void {
    if (metricsTimer) return;
    metricsTimer = setInterval(() => {
      if (!created) return;
      updateNumberMetric('volume', invoke(VLC_IPC_CHANNEL.VLC_GET_VOLUME, instance_id), true);
      updateNumberMetric('progress', invoke(VLC_IPC_CHANNEL.VLC_GET_PROGRESS, instance_id), true);
      updateNumberMetric('duration', invoke(VLC_IPC_CHANNEL.VLC_GET_DURATION, instance_id), true);
      updateNumberMetric('played', invoke(VLC_IPC_CHANNEL.VLC_GET_PLAYED, instance_id), true);
      updateNumberMetric('buffered', invoke(VLC_IPC_CHANNEL.VLC_GET_BUFFERED, instance_id), true);
      updateNumberMetric('playbackRate', invoke(VLC_IPC_CHANNEL.VLC_GET_PLAYBACK_RATE, instance_id), true);
      void invoke(VLC_IPC_CHANNEL.VLC_GET_MUTED, instance_id)
        .then((value) => {
          if (typeof value === 'boolean') metrics.muted = value;
        })
        .catch(() => {});
    }, 250);
  }

  function syncMetricsFromEvent(payload: IVlcEventPayload): void {
    if (payload.eventType === 'time-changed') {
      metrics.played = payload.value;
      return;
    }

    if (payload.eventType === 'position-changed') {
      metrics.progress = Math.max(0, Math.min(1, payload.value));
      return;
    }

    if (payload.eventType === 'buffering') {
      const bufferedPercent = Math.max(0, Math.min(100, payload.value));
      metrics.buffered = metrics.duration * (bufferedPercent / 100);
    }
  }

  function asUint8Array(frame: unknown): Uint8Array | null {
    if (frame instanceof Uint8Array) return frame;
    const obj = frame as Record<string, unknown> | null;
    if (obj && obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return Uint8Array.from(obj.data as number[]);
    }
    return null;
  }

  return {
    create(mountSelector: string) {
      return invoke(
        VLC_IPC_CHANNEL.VLC_CREATE,
        initPath,
        {
          el: mountSelector,
          url: defaultUrl,
          debug: options.debug,
          autoplay: false,
          volume: defaultVolume,
          playbackRate: defaultRate,
          seekStep,
          volumeStep,
        },
        instance_id,
      ).then((id) => {
        instance_id = id as string;
        created = true;
        startMetricsPolling();
      });
    },
    setFrameFormat(width: number, height: number) {
      void invoke(VLC_IPC_CHANNEL.VLC_SET_FRAME_FORMAT, width, height, instance_id);
    },
    getFrameRgba(): Uint8Array {
      if (!created) return lastFrame;
      if (!frameRequestInFlight) {
        frameRequestInFlight = true;
        void invoke(VLC_IPC_CHANNEL.VLC_GET_FRAME_RGBA, instance_id)
          .then((frame) => {
            const parsed = asUint8Array(frame);
            if (parsed) lastFrame = parsed as Uint8Array<ArrayBuffer>;
          })
          .catch(() => {})
          .finally(() => {
            frameRequestInFlight = false;
          });
      }
      return lastFrame;
    },
    play() {
      void invoke(VLC_IPC_CHANNEL.VLC_PLAY, instance_id);
    },
    pause() {
      void invoke(VLC_IPC_CHANNEL.VLC_PAUSE, instance_id);
    },
    setVolume(vol: number) {
      metrics.volume = vol;
      void invoke(VLC_IPC_CHANNEL.VLC_SET_VOLUME, vol, instance_id);
    },
    getVolume(): number {
      return metrics.volume;
    },
    setMuted(muted: boolean) {
      metrics.muted = muted;
      void invoke(VLC_IPC_CHANNEL.VLC_SET_MUTED, muted, instance_id);
    },
    getMuted(): boolean {
      return metrics.muted;
    },
    setProgress(progress: number) {
      metrics.progress = progress;
      return invoke(VLC_IPC_CHANNEL.VLC_SET_PROGRESS, progress, instance_id).then(() => {});
    },
    getProgress(): number {
      return metrics.progress;
    },
    getDuration(): number {
      return metrics.duration;
    },
    getPlayed(): number {
      return metrics.played;
    },
    getBuffered(): number {
      return metrics.buffered;
    },
    setPlaybackRate(rate: number) {
      metrics.playbackRate = rate;
      void invoke(VLC_IPC_CHANNEL.VLC_SET_PLAYBACK_RATE, rate, instance_id);
    },
    getPlaybackRate(): number {
      return metrics.playbackRate;
    },
    onEvent(callback: (payload: IVlcEventPayload) => void) {
      const listener = (_event: unknown, payload: unknown) => {
        const p = payload as IVlcEventPayload;
        if (
          p &&
          typeof p.eventType === 'string' &&
          typeof p.value === 'number' &&
          typeof p.additionalInfo === 'string'
        ) {
          // Filter events for this instance
          if (!created || !instance_id || p.instanceId !== instance_id) return;
          syncMetricsFromEvent(p);
          callback(p);
        }
      };
      ipcRenderer.on(VLC_IPC_CHANNEL.VLC_ON_EVENT, listener);
      return () => {
        ipcRenderer.removeListener(VLC_IPC_CHANNEL.VLC_ON_EVENT, listener);
      };
    },
    destroy() {
      if (metricsTimer) {
        clearInterval(metricsTimer);
        metricsTimer = null;
      }
      created = false;
      frameRequestInFlight = false;
      lastFrame = new Uint8Array(0);
      return invoke(VLC_IPC_CHANNEL.VLC_DESTROY, instance_id).then(() => {
        instance_id = null;
      });
    },
  };
}
