import type { IVlcEventPayload, IVlcInitOptions, IVlcInitPath } from '../../types';
import { resolveDemoIconSvg } from '../icons';
import { createI18nResolver } from '../lang/locales';
import { clamp01, formatTime, setElementA11yLabel, shouldIgnoreHotkeyTarget } from '../utils';
import type { IVlcPlayer } from '../vlc-player';
import { createVlcPlayer } from '../vlc-player';
import { createCanvasRenderer } from './canvas-renderer';

const UI_HIDE_DELAY = 2200;
const DEFAULT_PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export interface IVlcRuntime extends IVlcPlayer {
  destroy: () => void;
}

type CleanupFn = () => void;
type LoadingReason = 'frame' | 'seeking';

interface PendingSeek {
  time: number;
  progress: number;
  startedAt: number;
}

function createCleanupBag(): { add: (cleanup: CleanupFn) => void; runAll: () => void } {
  const bag: CleanupFn[] = [];
  return {
    add(cleanup: CleanupFn): void {
      bag.push(cleanup);
    },
    runAll(): void {
      while (bag.length > 0) {
        const fn = bag.pop();
        if (!fn) continue;
        try {
          fn();
        } catch {
          // ignore cleanup failure
        }
      }
    },
  };
}

function createVlcRuntime(path: IVlcInitPath, options: IVlcInitOptions): IVlcRuntime {
  const t = createI18nResolver(options);
  const cleanupBag = createCleanupBag();

  const playbackRates = options.playbackRates ?? DEFAULT_PLAYBACK_RATES;

  // --- Create player (mixin host with template) ---
  const player: IVlcPlayer = createVlcPlayer({ ...options, playbackRates });
  const { adapter, template } = player;

  adapter.create(path, {
    el: options.el,
    url: options.url,
    headers: options.headers,
    debug: options.debug,
    startTime: options.startTime,
    autoplay: options.autoplay,
    volume: options.volume,
    playbackRate: options.playbackRate,
    locale: options.locale,
  });

  // --- Canvas renderer ---
  const canvasRenderer = createCanvasRenderer(
    {
      videoStage: template.$videoStage,
      videoCanvas: template.$videoCanvas,
      pipCanvas: player.pipCanvas,
    },
    adapter,
  );
  player.canvasRenderer = canvasRenderer;

  // --- UI state ---
  const initialRate = options.playbackRate ?? 1;
  template.$rateIcon.textContent = `${initialRate}x`;
  let seeking = false;
  let lastSeekTime = 0;
  let hideUiTimer: ReturnType<typeof setTimeout> | null = null;
  let lastNativeTime = 0;
  let lastNativeProgress = 0;
  let lastKnownDuration = 0;
  let playbackEnded = false;
  let restartingFromEndedSeek = false;
  let waitingForFrame = false;
  let loadingReason: LoadingReason | null = null;
  let pendingSeek: PendingSeek | null = null;

  // --- UI helpers ---
  function updatePlaybackUi(playing: boolean): void {
    const icon = resolveDemoIconSvg(playing ? 'pause' : 'play');
    template.$playIcon.innerHTML = icon;
    const label = t(playing ? 'actionPause' : 'actionPlay');
    setElementA11yLabel(template.$btnPlay, label);
  }

  function updateMuteUi(muted: boolean, volume?: number): void {
    const v = volume ?? player.volume;
    let icon: 'muted' | 'volume' | 'volumeSmall';
    if (muted || v === 0) {
      icon = 'muted';
    } else {
      icon = v < 0.5 ? 'volumeSmall' : 'volume';
    }
    template.$muteIcon.innerHTML = resolveDemoIconSvg(icon);
    template.$volumeSub.style.width = muted ? '0%' : `${clamp01(v) * 100}%`;
    setElementA11yLabel(template.$btnMute, t(muted ? 'actionUnmute' : 'actionMute'));
    template.$btnMute.classList.toggle('primary', muted);
  }

  function updateVolumeUi(nextVolume: number): void {
    const volume = clamp01(nextVolume);
    updateMuteUi(player.muted, volume);
  }

  function updateProgressBars(progress: number, buffered = progress): void {
    const progressPercent = `${clamp01(progress) * 100}%`;
    const bufferedPercent = `${Math.max(clamp01(progress), clamp01(buffered)) * 100}%`;

    template.$progSub.style.width = progressPercent;
    template.$progBuf.style.width = bufferedPercent;
  }

  function getBufferedProgress(progress: number): number {
    const duration = adapter.getDuration();
    const buffered = adapter.getBuffered();
    const bufferedProgress = Number.isFinite(buffered) && duration > 0 ? clamp01(buffered / duration) : progress;
    return Math.max(clamp01(progress), bufferedProgress);
  }

  function getProgressFromPointer(event: PointerEvent): number {
    const rect = template.$prog.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return clamp01((event.clientX - rect.left) / rect.width);
  }

  function getVolumeFromPointer(event: PointerEvent): number {
    const rect = template.$volumeProg.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return clamp01((event.clientX - rect.left) / rect.width);
  }

  function previewProgress(progress: number): void {
    const duration = getPlayableDuration();
    const currentTime = progress * duration;
    template.$timeLeft.textContent = formatTime(currentTime * 1000);
    template.$timeRight.textContent = formatTime(duration * 1000);
    updateProgressBars(progress, getBufferedProgress(progress));
  }

  function getPlayableDuration(): number {
    const duration = player.duration;
    if (Number.isFinite(duration) && duration > 0) {
      lastKnownDuration = duration;
      return duration;
    }
    return lastKnownDuration;
  }

  function renderProgress(time = 0, length = 0, progress = 0, buffered = adapter.getBuffered()): void {
    if (seeking) return;
    const safeLength = Math.max(0, length || 0);
    const safeTime = Math.max(0, time || 0);
    if (safeLength > 0) lastKnownDuration = safeLength / 1000;
    const safeProgress = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0;
    const safeBuffered = Number.isFinite(buffered) && safeLength > 0 ? clamp01(buffered / safeLength) : 0;
    const bufferedProgress = Math.max(safeProgress, safeBuffered);
    template.$timeLeft.textContent = formatTime(safeTime);
    template.$timeRight.textContent = formatTime(safeLength);
    updateProgressBars(safeProgress, bufferedProgress);
  }

  function renderNativeProgress(time = lastNativeTime, progress = lastNativeProgress): void {
    if (seeking || Date.now() - lastSeekTime < 1000) return;
    const safeTime = Math.max(0, Number.isFinite(time) ? time : 0);
    const safeProgress = Number.isFinite(progress) ? clamp01(progress) : 0;
    const duration = adapter.getDuration();
    const safeDuration =
      Number.isFinite(duration) && duration > 0
        ? duration
        : safeTime > 0 && safeProgress > 0
          ? safeTime / safeProgress
          : 0;
    const nextProgress = safeDuration > 0 ? clamp01(safeTime / safeDuration) : safeProgress;

    renderProgress(safeTime, safeDuration, nextProgress);
  }

  function renderBufferedProgress(bufferingPercent?: number): void {
    const duration = adapter.getDuration();
    const played = adapter.getPlayed();
    const progress = adapter.getProgress();
    const buffered =
      Number.isFinite(bufferingPercent) && duration > 0
        ? duration * clamp01((bufferingPercent ?? 0) / 100)
        : adapter.getBuffered();

    renderProgress(played, duration, progress, buffered);
  }

  function syncFullscreenButton(): void {
    template.$fullscreenIcon.innerHTML = resolveDemoIconSvg(player.fullscreenWeb ? 'fullscreenExit' : 'fullscreen');
    setElementA11yLabel(template.$btnFullscreen, t(player.fullscreenWeb ? 'actionExitFullscreen' : 'actionFullscreen'));
  }

  function syncPipButton(): void {
    template.$pipIcon.innerHTML = resolveDemoIconSvg(player.pip ? 'pipExit' : 'pip');
    setElementA11yLabel(template.$btnPip, t(player.pip ? 'actionExitPictureInPicture' : 'actionPictureInPicture'));
  }

  function showControls(): void {
    template.$player.classList.remove('ui-hidden');
  }

  function hideControls(): void {
    if (!player.playing) return;
    template.$player.classList.add('ui-hidden');
  }

  function stopUiHideTimer(): void {
    if (!hideUiTimer) return;
    clearTimeout(hideUiTimer);
    hideUiTimer = null;
  }

  function resetUiHideTimer(): void {
    stopUiHideTimer();
    showControls();
    if (!player.playing) return;
    hideUiTimer = setTimeout(hideControls, UI_HIDE_DELAY);
  }

  function setIdleView(message: string): void {
    hideLoading();
    template.$placeholder.textContent = message;
    template.$placeholder.style.display = '';
  }

  function showLoading(message = t('placeholderLoading'), reason: LoadingReason): void {
    waitingForFrame = reason === 'frame';
    loadingReason = reason;
    template.$loadingText.textContent = message;
    template.$loading.classList.remove('hidden');
    template.$loading.setAttribute('aria-hidden', 'false');
    template.$placeholder.style.display = 'none';
  }

  function waitForNextFrame(message = t('placeholderLoading')): void {
    if (loadingReason === 'seeking') {
      template.$loadingText.textContent = message;
      return;
    }
    showLoading(message, 'frame');
  }

  function showSeekingLoading(time: number, progress: number, message = t('statusBuffering')): void {
    pendingSeek = {
      time: Math.max(0, time),
      progress: clamp01(progress),
      startedAt: Date.now(),
    };
    showLoading(message, 'seeking');
  }

  function hideSeekingLoadingIfReady(event?: IVlcEventPayload): void {
    if (loadingReason !== 'seeking' || !player.playing) return;
    if (pendingSeek && event) {
      const elapsed = Date.now() - pendingSeek.startedAt;
      const seekTimeReached = event.eventType === 'time-changed' && Math.abs(event.value - pendingSeek.time) <= 1000;
      const seekProgressReached =
        event.eventType === 'position-changed' && Math.abs(event.value - pendingSeek.progress) <= 0.01;
      if (!seekTimeReached && !seekProgressReached && elapsed < 1200) return;
    }
    pendingSeek = null;
    hideLoading();
  }

  function hideLoading(): void {
    waitingForFrame = false;
    loadingReason = null;
    pendingSeek = null;
    template.$loading.classList.add('hidden');
    template.$loading.setAttribute('aria-hidden', 'true');
  }

  function syncPlaybackSettingsFromAdapter(): void {
    const volume = adapter.getVolume();
    if (Number.isFinite(volume)) updateVolumeUi(volume);

    const rate = adapter.getPlaybackRate();
    if (Number.isFinite(rate)) {
      const normalizedRate = playbackRates.includes(rate) ? rate : 1;
      syncRateHighlight(normalizedRate);
    }

    const muted = adapter.getMuted();
    if (typeof muted === 'boolean') updateMuteUi(muted);
  }

  function syncPlaybackUi(playing: boolean): void {
    updatePlaybackUi(playing);
    if (playing) {
      resetUiHideTimer();
    } else {
      stopUiHideTimer();
      showControls();
    }
  }

  // --- Actions using mixin-provided properties ---
  function togglePlay(): void {
    if (playbackEnded) {
      playbackEnded = false;
      adapter.setProgress(0);
      showSeekingLoading(0, 0);
      player.play();
      syncPlaybackUi(true);
      return;
    }
    player.toggle();
    syncPlaybackUi(player.playing);
  }

  function toggleFullscreen(): void {
    player.fullscreenWeb = !player.fullscreenWeb;
    syncFullscreenButton();
    canvasRenderer.scheduleCanvasResize();
  }

  function toggleMute(): void {
    player.muted = !player.muted;
  }

  function applyProgressFromUi(progress: number): void {
    seeking = false;
    lastSeekTime = Date.now();
    const duration = getPlayableDuration();
    if (duration <= 0) return;
    const currentTime = progress * duration;
    player.seek = currentTime;
    showSeekingLoading(currentTime * 1000, progress);
    template.$timeLeft.textContent = formatTime(currentTime * 1000);
    template.$timeRight.textContent = formatTime(duration * 1000);
    player.notice.show = `${formatTime(currentTime * 1000)} / ${formatTime(duration * 1000)}`;
    updateProgressBars(progress, getBufferedProgress(progress));
    if (playbackEnded) {
      playbackEnded = false;
      restartingFromEndedSeek = true;
      void adapter.setProgress(progress).then(() => {
        showSeekingLoading(currentTime * 1000, progress);
        player.play();
        syncPlaybackUi(true);
      });
    }
  }

  function applyVolumeFromUi(volume: number): void {
    volume = clamp01(volume);
    updateVolumeUi(volume);
    if (player.muted) {
      player.muted = false;
    }
    player.volume = volume;
  }

  function syncRateHighlight(rate: number): void {
    template.$rateIcon.textContent = `${rate}x`;
    template.$rateOptions.querySelectorAll<HTMLElement>('.rate-option').forEach((el) => {
      el.classList.toggle('active', Number(el.dataset.rate) === rate);
    });
  }

  function applyRate(rate: number): void {
    player.playbackRate = rate;
    syncRateHighlight(rate);
  }

  // --- PiP ---
  function togglePictureInPicture(): void {
    if (!player.pip && player.fullscreenWeb) {
      player.fullscreenWeb = false;
      syncFullscreenButton();
      canvasRenderer.scheduleCanvasResize();
    }
    player.pip = !player.pip;
  }

  // --- VLC event handler ---
  function onVlcEvent(payload: IVlcEventPayload): void {
    const handlers: Record<string, (event: IVlcEventPayload) => void> = {
      playing: () => {
        playbackEnded = false;
        restartingFromEndedSeek = false;
        player.notice.silent = false;
        syncPlaybackSettingsFromAdapter();
        template.$placeholder.style.display = 'none';
        updatePlaybackUi(true);
        resetUiHideTimer();
        canvasRenderer.startFramePump();
        hideSeekingLoadingIfReady();
      },
      paused: () => {
        hideLoading();
        updatePlaybackUi(false);
        stopUiHideTimer();
        showControls();
        canvasRenderer.startFramePump();
      },
      stopped: () => {
        if (restartingFromEndedSeek) {
          updatePlaybackUi(true);
          stopUiHideTimer();
          showControls();
          return;
        }
        hideLoading();
        updatePlaybackUi(false);
        const duration = getPlayableDuration();
        if (playbackEnded && duration > 0) {
          renderProgress(duration * 1000, duration * 1000, 1, duration * 1000);
          template.$placeholder.style.display = 'none';
        } else {
          playbackEnded = false;
          renderProgress(0, duration * 1000, 0);
          setIdleView(t('placeholderStopped'));
        }
        stopUiHideTimer();
        showControls();
        canvasRenderer.stopFramePump();
      },
      ended: () => {
        hideLoading();
        playbackEnded = true;
        updatePlaybackUi(false);
        const duration = getPlayableDuration();
        if (duration > 0) {
          renderProgress(duration * 1000, duration * 1000, 1, duration * 1000);
        }
        stopUiHideTimer();
        showControls();
        canvasRenderer.stopFramePump();
      },
      error: () => {
        hideLoading();
        updatePlaybackUi(false);
        setIdleView(t('placeholderError'));
        stopUiHideTimer();
        showControls();
        canvasRenderer.stopFramePump();
      },
      'time-changed': (event) => {
        lastNativeTime = event.value;
        renderNativeProgress();
        hideSeekingLoadingIfReady(event);
      },
      'position-changed': (event) => {
        restartingFromEndedSeek = false;
        lastNativeProgress = event.value;
        renderNativeProgress();
        hideSeekingLoadingIfReady(event);
      },
      buffering: (event) => {
        renderBufferedProgress(event.value);
        const bufferingPercent = Number.isFinite(event.value) ? event.value : 0;
        if (bufferingPercent >= 100) {
          if (loadingReason !== 'seeking' && !waitingForFrame) hideLoading();
          return;
        }
        const percent = Number.isFinite(event.value) ? ` ${Math.round(event.value)}%` : '';
        waitForNextFrame(`${t('statusBuffering')}${percent}`);
      },
      opening: () => {
        waitForNextFrame(t('statusOpening'));
      },
    };

    const handler = handlers[payload.eventType];
    if (handler) handler(payload);
  }

  // --- Wire UI events ---
  function wireEvents(): void {
    // Make player focusable so keyboard shortcuts are scoped to it
    template.$player.setAttribute('tabindex', '0');
    const onPlayerClick = (): void => template.$player.focus();
    template.$player.addEventListener('click', onPlayerClick);
    cleanupBag.add(() => template.$player.removeEventListener('click', onPlayerClick));

    const resizeObserver = new ResizeObserver(() => canvasRenderer.scheduleCanvasResize());
    resizeObserver.observe(template.$videoStage);
    cleanupBag.add(() => resizeObserver.disconnect());

    const removeVlcEvent = adapter.onEvent(onVlcEvent);
    cleanupBag.add(removeVlcEvent);

    // Play
    const onPlayClick = (): void => togglePlay();
    template.$btnPlay.addEventListener('click', onPlayClick);
    cleanupBag.add(() => template.$btnPlay.removeEventListener('click', onPlayClick));

    // Single-click to toggle play/pause, double-click to toggle fullscreen
    let clickTimer: ReturnType<typeof setTimeout> | null = null;
    const onVideoClick = (): void => {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      } else {
        clickTimer = setTimeout(() => {
          clickTimer = null;
          resetUiHideTimer();
          togglePlay();
        }, 250);
      }
    };
    const onVideoDblClick = (): void => {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      resetUiHideTimer();
      toggleFullscreen();
    };
    template.$videoStage.addEventListener('click', onVideoClick);
    template.$videoStage.addEventListener('dblclick', onVideoDblClick);
    cleanupBag.add(() => template.$videoStage.removeEventListener('click', onVideoClick));
    cleanupBag.add(() => template.$videoStage.removeEventListener('dblclick', onVideoDblClick));

    // Next / Prev
    if (options.playNext) {
      template.$btnNext.classList.remove('hidden');
      const onNextClick = (): void => {
        resetUiHideTimer();
        options.playNext!();
      };
      template.$btnNext.addEventListener('click', onNextClick);
      cleanupBag.add(() => template.$btnNext.removeEventListener('click', onNextClick));
    }
    if (options.playPrev) {
      template.$btnPrev.classList.remove('hidden');
      const onPrevClick = (): void => {
        resetUiHideTimer();
        options.playPrev!();
      };
      template.$btnPrev.addEventListener('click', onPrevClick);
      cleanupBag.add(() => template.$btnPrev.removeEventListener('click', onPrevClick));
    }

    // Fullscreen
    const onFullscreenClick = (): void => {
      resetUiHideTimer();
      toggleFullscreen();
    };
    template.$btnFullscreen.addEventListener('click', onFullscreenClick);
    cleanupBag.add(() => template.$btnFullscreen.removeEventListener('click', onFullscreenClick));

    // Sync button when browser exits fullscreen (e.g. user presses Esc)
    const onFullscreenChange = (): void => {
      syncFullscreenButton();
      canvasRenderer.scheduleCanvasResize();
    };
    template.$player.addEventListener('fullscreenchange', onFullscreenChange);
    template.$player.addEventListener('webkitfullscreenchange', onFullscreenChange);
    cleanupBag.add(() => template.$player.removeEventListener('fullscreenchange', onFullscreenChange));
    cleanupBag.add(() => template.$player.removeEventListener('webkitfullscreenchange', onFullscreenChange));

    // PiP
    const onPipClick = (): void => {
      resetUiHideTimer();
      togglePictureInPicture();
    };
    template.$btnPip.addEventListener('click', onPipClick);
    cleanupBag.add(() => template.$btnPip.removeEventListener('click', onPipClick));

    player.on('pip', (active: boolean) => {
      syncPipButton();
      canvasRenderer.setPipActive(active);
      if (!active) canvasRenderer.scheduleCanvasResize();
    });
    player.on('play', () => syncPlaybackUi(true));
    player.on('pause', () => syncPlaybackUi(false));
    player.on('volume', (volume: number) => updateVolumeUi(volume));
    player.on('muted', (muted: boolean) => updateMuteUi(muted));
    player.on('playbackRate', (rate: number) => {
      syncRateHighlight(rate);
    });

    // Mute
    const onMuteClick = (): void => {
      resetUiHideTimer();
      toggleMute();
    };
    template.$btnMute.addEventListener('click', onMuteClick);
    cleanupBag.add(() => template.$btnMute.removeEventListener('click', onMuteClick));

    // Progress
    let progressPointerId: number | null = null;

    const onProgressPointerDown = (event: PointerEvent): void => {
      event.preventDefault();
      resetUiHideTimer();
      seeking = true;
      progressPointerId = event.pointerId;
      template.$progressTouch.setPointerCapture(event.pointerId);
      previewProgress(getProgressFromPointer(event));
    };

    const onProgressPointerMove = (event: PointerEvent): void => {
      if (progressPointerId !== event.pointerId) return;
      resetUiHideTimer();
      previewProgress(getProgressFromPointer(event));
    };

    const onProgressPointerUp = (event: PointerEvent): void => {
      if (progressPointerId !== event.pointerId) return;
      const progress = getProgressFromPointer(event);
      progressPointerId = null;
      if (template.$progressTouch.hasPointerCapture(event.pointerId)) {
        template.$progressTouch.releasePointerCapture(event.pointerId);
      }
      applyProgressFromUi(progress);
    };

    const onProgressPointerCancel = (event: PointerEvent): void => {
      if (progressPointerId !== event.pointerId) return;
      progressPointerId = null;
      seeking = false;
      if (template.$progressTouch.hasPointerCapture(event.pointerId)) {
        template.$progressTouch.releasePointerCapture(event.pointerId);
      }
      renderNativeProgress();
    };

    template.$progressTouch.addEventListener('pointerdown', onProgressPointerDown);
    cleanupBag.add(() => template.$progressTouch.removeEventListener('pointerdown', onProgressPointerDown));

    template.$progressTouch.addEventListener('pointermove', onProgressPointerMove);
    cleanupBag.add(() => template.$progressTouch.removeEventListener('pointermove', onProgressPointerMove));

    template.$progressTouch.addEventListener('pointerup', onProgressPointerUp);
    cleanupBag.add(() => template.$progressTouch.removeEventListener('pointerup', onProgressPointerUp));

    template.$progressTouch.addEventListener('pointercancel', onProgressPointerCancel);
    cleanupBag.add(() => template.$progressTouch.removeEventListener('pointercancel', onProgressPointerCancel));

    // Volume
    let volumePointerId: number | null = null;

    const onVolumePointerDown = (event: PointerEvent): void => {
      event.preventDefault();
      resetUiHideTimer();
      volumePointerId = event.pointerId;
      template.$volumeProg.setPointerCapture(event.pointerId);
      applyVolumeFromUi(getVolumeFromPointer(event));
    };

    const onVolumePointerMove = (event: PointerEvent): void => {
      if (volumePointerId !== event.pointerId) return;
      resetUiHideTimer();
      applyVolumeFromUi(getVolumeFromPointer(event));
    };

    const onVolumePointerUp = (event: PointerEvent): void => {
      if (volumePointerId !== event.pointerId) return;
      volumePointerId = null;
      if (template.$volumeProg.hasPointerCapture(event.pointerId)) {
        template.$volumeProg.releasePointerCapture(event.pointerId);
      }
      applyVolumeFromUi(getVolumeFromPointer(event));
    };

    const onVolumePointerCancel = (event: PointerEvent): void => {
      if (volumePointerId !== event.pointerId) return;
      volumePointerId = null;
      if (template.$volumeProg.hasPointerCapture(event.pointerId)) {
        template.$volumeProg.releasePointerCapture(event.pointerId);
      }
      updateVolumeUi(player.volume);
    };

    template.$volumeProg.addEventListener('pointerdown', onVolumePointerDown);
    cleanupBag.add(() => template.$volumeProg.removeEventListener('pointerdown', onVolumePointerDown));

    template.$volumeProg.addEventListener('pointermove', onVolumePointerMove);
    cleanupBag.add(() => template.$volumeProg.removeEventListener('pointermove', onVolumePointerMove));

    template.$volumeProg.addEventListener('pointerup', onVolumePointerUp);
    cleanupBag.add(() => template.$volumeProg.removeEventListener('pointerup', onVolumePointerUp));

    template.$volumeProg.addEventListener('pointercancel', onVolumePointerCancel);
    cleanupBag.add(() => template.$volumeProg.removeEventListener('pointercancel', onVolumePointerCancel));

    // Rate menu
    const onRateOptionClick = (e: Event): void => {
      const target = e.target as HTMLElement;
      const rate = target.dataset.rate;
      if (rate) {
        resetUiHideTimer();
        applyRate(Number.parseFloat(rate));
      }
    };
    template.$rateOptions.addEventListener('click', onRateOptionClick);
    cleanupBag.add(() => template.$rateOptions.removeEventListener('click', onRateOptionClick));

    const onRateMenuEnter = (): void => stopUiHideTimer();
    const onRateMenuLeave = (): void => resetUiHideTimer();
    template.$rateMenu.addEventListener('mouseenter', onRateMenuEnter);
    template.$rateMenu.addEventListener('mouseleave', onRateMenuLeave);
    cleanupBag.add(() => template.$rateMenu.removeEventListener('mouseenter', onRateMenuEnter));
    cleanupBag.add(() => template.$rateMenu.removeEventListener('mouseleave', onRateMenuLeave));

    // User activity (auto-hide)
    const videoStage = template.$videoStage;
    const onUserActivity = (): void => resetUiHideTimer();
    videoStage.addEventListener('mousemove', onUserActivity);
    videoStage.addEventListener('mouseenter', onUserActivity);
    videoStage.addEventListener('click', onUserActivity);
    videoStage.addEventListener('keydown', onUserActivity);
    videoStage.addEventListener('touchstart', onUserActivity, { passive: true });
    cleanupBag.add(() => videoStage.removeEventListener('mousemove', onUserActivity));
    cleanupBag.add(() => videoStage.removeEventListener('mouseenter', onUserActivity));
    cleanupBag.add(() => videoStage.removeEventListener('click', onUserActivity));
    cleanupBag.add(() => videoStage.removeEventListener('keydown', onUserActivity));
    cleanupBag.add(() => videoStage.removeEventListener('touchstart', onUserActivity));

    // Keyboard shortcuts — scoped to this player's container
    const seekStepMs = options.seekStep ?? 5000;
    const volumeStepVal = options.volumeStep ?? 0.1;
    const onPlayerKeydown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.repeat || shouldIgnoreHotkeyTarget(event.target)) return;

      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        resetUiHideTimer();
        togglePlay();
        return;
      }

      if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
        event.preventDefault();
        resetUiHideTimer();
        const delta = event.code === 'ArrowUp' ? volumeStepVal : -volumeStepVal;
        const next = clamp01(player.volume + delta);
        updateVolumeUi(next);
        if (player.muted) {
          player.muted = false;
          updateMuteUi(false);
        }
        player.volume = next;
        return;
      }

      if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        event.preventDefault();
        resetUiHideTimer();
        const duration = getPlayableDuration();
        if (duration <= 0) return;
        seeking = true;
        lastSeekTime = Date.now();
        const delta = event.code === 'ArrowRight' ? seekStepMs : -seekStepMs;
        const next = Math.max(0, Math.min(duration, player.currentTime + delta / 1000));
        player.seek = next;
        showSeekingLoading(next * 1000, duration > 0 ? next / duration : 0);
        const stepSec = Math.round(seekStepMs / 1000);
        player.notice.show =
          event.code === 'ArrowRight'
            ? t('actionForward', { seconds: stepSec })
            : t('actionBackward', { seconds: stepSec });
        const progress = duration > 0 ? clamp01(next / duration) : 0;
        template.$timeLeft.textContent = formatTime(next * 1000);
        template.$timeRight.textContent = formatTime(duration * 1000);
        updateProgressBars(progress, getBufferedProgress(progress));
        seeking = false;
      }
    };
    template.$player.addEventListener('keydown', onPlayerKeydown);
    cleanupBag.add(() => template.$player.removeEventListener('keydown', onPlayerKeydown));
  }

  // --- Init ---
  function init(): void {
    wireEvents();
    canvasRenderer.onFrame(() => {
      if (loadingReason === 'frame' && waitingForFrame) hideLoading();
    });
    syncPipButton();
    waitForNextFrame(t('placeholderLoading'));
    syncFullscreenButton();
    canvasRenderer.resizeCanvasToStage();

    void adapter
      .init()
      .then(() => {
        syncPlaybackSettingsFromAdapter();
        canvasRenderer.initFrameData();
        canvasRenderer.resizeCanvasToStage();
        canvasRenderer.startFramePump();
        player.notice.silent = true;
        player.play();
        updatePlaybackUi(true);
        resetUiHideTimer();
      })
      .catch((err) => {
        setIdleView(`${t('placeholderInitError')}: ${String(err)}`);
      });
  }

  init();

  Object.defineProperty(player, 'destroy', {
    value: () => {
      canvasRenderer.destroy();
      stopUiHideTimer();
      player.pip = false;
      if (document.fullscreenElement === template.$player) {
        void document.exitFullscreen();
      }
      adapter.destroy();
      cleanupBag.runAll();
      template.destroy(true);
    },
  });

  return player as IVlcRuntime;
}

class VlcPlayerRuntime {
  constructor(path: IVlcInitPath, options: IVlcInitOptions) {
    return createVlcRuntime(path, options);
  }
}

export const VlcPlayer = VlcPlayerRuntime as unknown as {
  new (path: IVlcInitPath, options: IVlcInitOptions): IVlcRuntime;
};
