import type {
  IVlcApiContract,
  IVlcEventPayload,
  IVlcInitOptions,
  IVlcInitPath,
  IVlcPlayerState,
  IVlcTrack,
} from '../types';
import native from './native-loader';

export class VlcApi implements IVlcApiContract {
  private instanceId: string;

  constructor(instanceId: string = 'default') {
    this.instanceId = instanceId;
  }

  attach(handle: bigint): void {
    native.attach(handle, this.instanceId);
  }

  setFrameFormat(width: number, height: number): void {
    native.setFrameFormat(width, height, this.instanceId);
  }

  getFrameRgba(): Uint8Array {
    return native.getFrameRgba(this.instanceId) ?? new Uint8Array(0);
  }

  getState(): IVlcPlayerState {
    return native.getState(this.instanceId);
  }

  getEnded(): boolean {
    return native.getEnded(this.instanceId);
  }

  getPlaying(): boolean {
    return native.getPlaying(this.instanceId);
  }

  create(path: IVlcInitPath, options: IVlcInitOptions): string {
    return native.create(path, options, this.instanceId);
  }

  play(): void {
    native.play(this.instanceId);
  }

  pause(): void {
    native.pause(this.instanceId);
  }

  toggle(): void {
    native.toggle(this.instanceId);
  }

  stop(): void {
    native.stop(this.instanceId);
  }

  setVolume(volume: number): void {
    native.setVolume(volume, this.instanceId);
  }

  getVolume(): number {
    return native.getVolume(this.instanceId);
  }

  setMuted(muted: boolean): void {
    native.setMuted(muted, this.instanceId);
  }

  getMuted(): boolean {
    return native.getMuted(this.instanceId);
  }

  seek(time: number): void {
    native.seek(time, this.instanceId);
  }

  getProgress(): number {
    return native.getProgress(this.instanceId);
  }

  setProgress(progress: number): void {
    native.setProgress(progress, this.instanceId);
  }

  getDuration(): number {
    return native.getDuration(this.instanceId);
  }

  getPlayed(): number {
    return native.getPlayed(this.instanceId);
  }

  getBuffered(): number {
    return native.getBuffered(this.instanceId);
  }

  setPlaybackRate(rate: number): void {
    native.setPlaybackRate(rate, this.instanceId);
  }

  getPlaybackRate(): number {
    return native.getPlaybackRate(this.instanceId);
  }

  setSubtitleTrack(id: number): void {
    native.setSubtitleTrack(id, this.instanceId);
  }

  getSubtitleTrack(): IVlcTrack[] {
    return native.getSubtitleTrack(this.instanceId);
  }

  addSubtitleFile(subtitlePath: string): void {
    native.addSubtitleFile(subtitlePath, this.instanceId);
  }

  setAudioTrack(id: number): void {
    native.setAudioTrack(id, this.instanceId);
  }

  getAudioTrack(): IVlcTrack[] {
    return native.getAudioTrack(this.instanceId);
  }

  onEvent(eventName: string, callback: (payload: IVlcEventPayload) => void): void {
    native.onEvent(
      eventName,
      (error: Error | null, arg: [string, number, string]) => {
        if (error) {
          throw error;
        }

        callback({
          instanceId: this.instanceId,
          eventType: arg[0],
          value: arg[1],
          additionalInfo: arg[2],
        });
      },
      this.instanceId,
    );
  }

  destroy(): void {
    native.destroy(this.instanceId);
  }
}
