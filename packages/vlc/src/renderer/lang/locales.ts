import type { IVlcI18n, IVlcI18nKey, IVlcInitOptions, IVlcLocale } from '../../types';

const DEFAULT_DEMO_LOCALE: IVlcLocale = 'zh-CN';

const DEMO_I18N_MAP: Record<IVlcLocale, Record<IVlcI18nKey, string>> = {
  'zh-CN': {
    playerTitle: 'VLC Player Demo',
    placeholderLoading: '加载中',
    placeholderStopped: '点击播放继续',
    placeholderError: '播放出错',
    placeholderInitError: 'VLC 初始化异常',
    statusIdle: '空闲',
    statusReady: '就绪',
    statusOpening: '打开中',
    statusPlaying: '播放中',
    statusPaused: '已暂停',
    statusStopped: '已停止',
    statusEnded: '播放结束',
    statusError: '错误',
    statusPipUnsupported: '画中画不可用',
    statusPipError: '画中画异常',
    statusBuffering: '缓冲中',
    labelVolume: '音量',
    labelPlaybackRate: '倍速',
    actionPlay: '播放',
    actionPause: '暂停',
    actionMute: '静音',
    actionUnmute: '取消静音',
    actionPictureInPicture: '画中画',
    actionExitPictureInPicture: '退出画中画',
    actionFullscreen: '全屏',
    actionExitFullscreen: '退出全屏',
    actionNext: '下一集',
    actionPrev: '上一集',
    actionForward: '快进 {seconds} 秒',
    actionBackward: '快退 {seconds} 秒',
  },
  'zh-TW': {
    playerTitle: 'VLC Player Demo',
    placeholderLoading: '載入中',
    placeholderStopped: '點擊播放繼續',
    placeholderError: '播放出錯',
    placeholderInitError: 'VLC 初始化異常',
    statusIdle: '閒置',
    statusReady: '就緒',
    statusOpening: '開啟中',
    statusPlaying: '播放中',
    statusPaused: '已暫停',
    statusStopped: '已停止',
    statusEnded: '播放結束',
    statusError: '錯誤',
    statusPipUnsupported: '子母畫面不可用',
    statusPipError: '子母畫面異常',
    statusBuffering: '緩衝中',
    labelVolume: '音量',
    labelPlaybackRate: '倍速',
    actionPlay: '播放',
    actionPause: '暫停',
    actionMute: '靜音',
    actionUnmute: '取消靜音',
    actionPictureInPicture: '子母畫面',
    actionExitPictureInPicture: '退出子母畫面',
    actionFullscreen: '全螢幕',
    actionExitFullscreen: '退出全螢幕',
    actionNext: '下一集',
    actionPrev: '上一集',
    actionForward: '快進 {seconds} 秒',
    actionBackward: '快退 {seconds} 秒',
  },
  'en-US': {
    playerTitle: 'VLC Player Demo',
    placeholderLoading: 'Loading',
    placeholderStopped: 'Click play to continue',
    placeholderError: 'Playback error',
    placeholderInitError: 'VLC initialization error',
    statusIdle: 'idle',
    statusReady: 'ready',
    statusOpening: 'opening',
    statusPlaying: 'playing',
    statusPaused: 'paused',
    statusStopped: 'stopped',
    statusEnded: 'ended',
    statusError: 'error',
    statusPipUnsupported: 'picture-in-picture unsupported',
    statusPipError: 'picture-in-picture error',
    statusBuffering: 'buffering',
    labelVolume: 'Volume',
    labelPlaybackRate: 'Speed',
    actionPlay: 'Play',
    actionPause: 'Pause',
    actionMute: 'Mute',
    actionUnmute: 'Unmute',
    actionPictureInPicture: 'Picture in Picture',
    actionExitPictureInPicture: 'Exit Picture in Picture',
    actionFullscreen: 'Fullscreen',
    actionExitFullscreen: 'Exit Fullscreen',
    actionNext: 'Next',
    actionPrev: 'Previous',
    actionForward: 'Forward {seconds}s',
    actionBackward: 'Backward {seconds}s',
  },
};

export function createI18nResolver(
  options: IVlcInitOptions,
): (key: string, vars?: Record<string, string | number>) => string {
  const locale = options.locale ?? DEFAULT_DEMO_LOCALE;
  const defaults = DEMO_I18N_MAP[locale] ?? DEMO_I18N_MAP[DEFAULT_DEMO_LOCALE];
  const overrides: IVlcI18n = options.i18n ?? {};

  return (key: string, vars?: Record<string, string | number>) => {
    const k = key as IVlcI18nKey;
    let text = overrides[k] ?? defaults[k] ?? DEMO_I18N_MAP[DEFAULT_DEMO_LOCALE][k];
    if (!vars) return text;
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
    return text;
  };
}
