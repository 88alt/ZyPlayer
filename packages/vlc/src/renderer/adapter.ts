import type { IVlcAdapterOptions, IVlcEventPayload, IVlcInitOptions, IVlcInitPath } from '../types';
import type { IVlcBridge } from './bridge';
import { createBridge } from './bridge';
import Storage from './storage';

const DEFAULT_FRAME_SIZE = {
  width: 1280,
  height: 720,
};

export interface VlcFrameSize {
  width: number;
  height: number;
}

export class VlcAdapter {
  private bridge: IVlcBridge | null = null;
  private storage = new Storage();
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  private _muted = false;
  private _volume = 0.7;
  private _playbackRate = 1;
  private _isPlaying = false;
  private _ended = false;
  private _playerCreated = false;
  private _frameSize: VlcFrameSize = { ...DEFAULT_FRAME_SIZE };
  private _timeUpdateCleanup: (() => void) | null = null;

  get instance(): IVlcBridge | null {
    return this.bridge;
  }

  get playing(): boolean {
    return this._isPlaying;
  }

  get ended(): boolean {
    return this._ended;
  }

  get muted(): boolean {
    return this._muted;
  }

  set muted(state: boolean) {
    this._muted = state;
    this.bridge?.setMuted(state);
    this.storage.set('muted', state);
    this.emit('muted', state);
  }

  get volume(): number {
    return this._volume;
  }

  set volume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this._volume = clamped;
    this.bridge?.setVolume(clamped);
    if (clamped > 0) this.storage.set('volume', clamped);
  }

  get playbackRate(): number {
    return this._playbackRate;
  }

  set playbackRate(rate: number) {
    this._playbackRate = rate;
    this.bridge?.setPlaybackRate(rate);
    this.storage.set('playrate', rate);
  }

  get currentTime(): number {
    return this.bridge?.getPlayed() ?? 0;
  }

  get duration(): number {
    return this.bridge?.getDuration() ?? 0;
  }

  get progress(): number {
    return this.bridge?.getProgress() ?? 0;
  }

  get buffered(): number {
    return this.bridge?.getBuffered() ?? 0;
  }

  get time(): { currentTime: number; duration: number } {
    return {
      currentTime: this.currentTime,
      duration: this.duration,
    };
  }

  // --- Event system (artplayer-style) ---

  on(event: string, handler: (...args: any[]) => void): void {
    let handlers = this.listeners.get(event);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(event, handlers);
    }
    handlers.add(handler);
  }

  off(event: string, handler?: (...args: any[]) => void): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    if (handler) {
      handlers.delete(handler);
    } else {
      handlers.clear();
    }

    if (handlers.size === 0) this.listeners.delete(event);
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(...args);
    }
  }

  // --- VLC native events ---

  onEvent(callback: (payload: IVlcEventPayload) => void): () => void {
    if (!this.bridge) return () => {};
    return this.bridge.onEvent((payload) => {
      this.syncPlaybackState(payload);
      callback(payload);
    });
  }

  onTimeUpdate(callback: (args: { currentTime: number; duration: number }) => void): void {
    this.offTimeUpdate();

    this._timeUpdateCleanup = this.onEvent((payload) => {
      if (payload.eventType !== 'time-changed') return;

      callback({
        currentTime: this.currentTime,
        duration: this.duration,
      });
    });
  }

  offTimeUpdate(): void {
    this._timeUpdateCleanup?.();
    this._timeUpdateCleanup = null;
  }

  // --- Lifecycle ---

  create(path: IVlcInitPath, options: IVlcAdapterOptions): void {
    const bridgeOptions: IVlcInitOptions = {
      el: options.el,
      url: options.url,
      headers: options.headers,
      debug: options.debug,
      autoplay: options.autoplay ?? true,
      volume: options.volume ?? this.storage.get('volume') ?? 0.7,
      muted: options.muted ?? !!this.storage.get('muted'),
      playbackRate: options.playbackRate ?? this.storage.get('playrate') ?? 1,
      locale: options.locale as IVlcInitOptions['locale'],
    };

    this.bridge = createBridge(path, bridgeOptions, options.instanceId);
    this._volume = bridgeOptions.volume!;
    this._playbackRate = bridgeOptions.playbackRate!;
    this._muted = bridgeOptions.muted!;
  }

  async init(): Promise<void> {
    if (!this.bridge) throw new Error('bridge not created');
    await this.bridge.create('');
    this._playerCreated = true;
    this.bridge.setFrameFormat(this._frameSize.width, this._frameSize.height);
    if (this._muted) this.bridge.setMuted(true);
    this.bridge.play();
    this._isPlaying = true;
  }

  destroy(): void {
    this.offTimeUpdate();

    // Clear all listeners
    this.listeners.forEach((handlers) => handlers.clear());
    this.listeners.clear();

    void this.bridge?.destroy();
    this.bridge = null;
    this._playerCreated = false;
    this._isPlaying = false;
    this._ended = false;
  }

  // --- Playback controls ---

  play(): void {
    if (!this._playerCreated) return;
    this.bridge?.play();
    this._isPlaying = true;
    this._ended = false;
    this.emit('play');
  }

  pause(): void {
    if (!this._playerCreated) return;
    this.bridge?.pause();
    this._isPlaying = false;
    this.emit('pause');
  }

  togglePlay(): void {
    if (this._isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  toggleMuted(): void {
    this.muted = !this._muted;
  }

  seek(time: number): void {
    if (!this._playerCreated) return;
    const duration = this.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const progress = Math.max(0, Math.min(1, time / duration));
    void this.bridge?.setProgress(progress);
  }

  setProgress(progress: number): Promise<void> {
    if (!this._playerCreated) return Promise.resolve();
    this._ended = false;
    return this.bridge?.setProgress(Math.max(0, Math.min(1, progress))) ?? Promise.resolve();
  }

  // --- Frame access (VLC-specific) ---

  getFrameRgba(): Uint8Array {
    return this.bridge?.getFrameRgba() ?? new Uint8Array(0);
  }

  setFrameFormat(width: number, height: number): void {
    const next = this.normalizeFrameSize(width, height);
    this._frameSize = next;
    this.bridge?.setFrameFormat(next.width, next.height);
  }

  getFrameSize(): VlcFrameSize {
    return { ...this._frameSize };
  }

  private normalizeFrameSize(width: number, height: number): VlcFrameSize {
    const safeWidth = Number.isFinite(width) ? Math.round(width) : DEFAULT_FRAME_SIZE.width;
    const safeHeight = Number.isFinite(height) ? Math.round(height) : DEFAULT_FRAME_SIZE.height;

    return {
      width: Math.max(1, Math.min(3840, safeWidth)),
      height: Math.max(1, Math.min(2160, safeHeight)),
    };
  }

  private syncPlaybackState(payload: IVlcEventPayload): void {
    if (payload.eventType === 'playing') {
      this._isPlaying = true;
      this._ended = false;
      return;
    }

    if (payload.eventType === 'paused' || payload.eventType === 'stopped' || payload.eventType === 'error') {
      this._isPlaying = false;
      if (payload.eventType !== 'stopped') this._ended = false;
      return;
    }

    if (payload.eventType === 'ended') {
      this._isPlaying = false;
      this._ended = true;
    }
  }

  // --- Metrics access (bridge proxy) ---

  getPlayed(): number {
    return this.bridge?.getPlayed() ?? 0;
  }

  getDuration(): number {
    return this.bridge?.getDuration() ?? 0;
  }

  getProgress(): number {
    return this.bridge?.getProgress() ?? 0;
  }

  getBuffered(): number {
    return this.bridge?.getBuffered() ?? 0;
  }

  getVolume(): number {
    return this.bridge?.getVolume() ?? this._volume;
  }

  getMuted(): boolean {
    return this.bridge?.getMuted() ?? this._muted;
  }

  getPlaybackRate(): number {
    return this.bridge?.getPlaybackRate() ?? this._playbackRate;
  }
}
