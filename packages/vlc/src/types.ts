export type IVlcPlayerState =
  | 'nothing-special'
  | 'opening'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'ended'
  | 'error'
  | 'unknown';

export interface IVlcTrack {
  id: number;
  name: string;
  isActive: boolean;
}

export interface IVlcEventPayload {
  instanceId?: string;
  eventType: string;
  value: number;
  additionalInfo: string;
}

export interface IVlcInitPath {
  libPath: string;
  pluginPath?: string;
}

export type IVlcLocale = 'zh-CN' | 'zh-TW' | 'en-US';

export interface IVlcInitOptions {
  el: string;
  url: string;
  headers?: Record<string, string>;
  debug?: boolean;
  seekStep?: number;
  volumeStep?: number;
  autoplay?: boolean;
  volume?: number;
  muted?: boolean;
  loop?: boolean;
  startTime?: number;
  playbackRate?: number;
  playbackRates?: number[];
  locale?: IVlcLocale;
  i18n?: IVlcI18n;
  playNext?: () => void;
  playPrev?: () => void;
}

export interface IVlcApiContract {
  attach: (handle: bigint) => void;
  setFrameFormat: (width: number, height: number) => void;
  getFrameRgba: () => Uint8Array;
  getState: () => IVlcPlayerState;
  getEnded: () => boolean;
  getPlaying: () => boolean;
  create: (path: IVlcInitPath, options: IVlcInitOptions) => string;
  play: () => void;
  stop: () => void;
  pause: () => void;
  toggle: () => void;
  setVolume: (vol: number) => void;
  getVolume: () => number;
  setMuted: (muted: boolean) => void;
  getMuted: () => boolean;
  seek: (time: number) => void;
  setProgress: (progress: number) => void;
  getProgress: () => number;
  getDuration: () => number;
  getPlayed: () => number;
  getBuffered: () => number;
  setPlaybackRate: (rate: number) => void;
  getPlaybackRate: () => number;
  setSubtitleTrack: (id: number) => void;
  getSubtitleTrack: () => IVlcTrack[];
  addSubtitleFile: (path: string) => void;
  setAudioTrack: (id: number) => void;
  getAudioTrack: () => IVlcTrack[];
  onEvent: (event_name: string, callback: (payload: IVlcEventPayload) => void) => void;
  destroy: () => void;
}

// renderer types

export type IVlcIconKey =
  | 'play'
  | 'pause'
  | 'volume'
  | 'volumeSmall'
  | 'muted'
  | 'pip'
  | 'pipExit'
  | 'fullscreen'
  | 'fullscreenExit'
  | 'mnext'
  | 'mprev';

export type IVlcIconResolver = (name: IVlcIconKey) => string | null | undefined;

export type IVlcI18nKey =
  | 'playerTitle'
  | 'placeholderLoading'
  | 'placeholderStopped'
  | 'placeholderError'
  | 'placeholderInitError'
  | 'statusIdle'
  | 'statusReady'
  | 'statusOpening'
  | 'statusPlaying'
  | 'statusPaused'
  | 'statusStopped'
  | 'statusEnded'
  | 'statusError'
  | 'statusPipUnsupported'
  | 'statusPipError'
  | 'statusBuffering'
  | 'labelVolume'
  | 'labelPlaybackRate'
  | 'actionPlay'
  | 'actionPause'
  | 'actionMute'
  | 'actionUnmute'
  | 'actionPictureInPicture'
  | 'actionExitPictureInPicture'
  | 'actionFullscreen'
  | 'actionExitFullscreen'
  | 'actionNext'
  | 'actionPrev'
  | 'actionForward'
  | 'actionBackward';

export type IVlcI18n = Partial<Record<IVlcI18nKey, string>>;

export interface IVlcCanvasRenderer {
  renderSourceToDisplay: () => void;
  renderToCanvas: (targetCanvas: HTMLCanvasElement, targetCtx: CanvasRenderingContext2D) => void;
  resizeCanvasToStage: () => void;
  clearDisplayCanvas: () => void;
  scheduleCanvasResize: () => void;
  startFramePump: () => void;
  stopFramePump: () => void;
  setPipActive: (active: boolean) => void;
  initFrameData: () => void;
  onFrame: (callback: () => void) => void;
  destroy: () => void;
}

export type IVlcAdapterOptions = IVlcInitOptions & {
  instanceId?: string;
};
