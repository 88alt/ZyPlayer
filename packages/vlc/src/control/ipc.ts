import { ipcMain } from 'electron';

import { VLC_IPC_CHANNEL } from '../constants/ipc';
import { VlcApi } from './api';

const instances = new Map<string, VlcApi>();

const getInstance = (id: string): VlcApi | undefined => {
  return instances.get(id);
};

export const ipc = (): void => {
  ipcMain.handle(VLC_IPC_CHANNEL.VLC_CREATE, (_event, path, options, instanceId?) => {
    const id = instanceId ?? `player_${Date.now()}`;
    const api = new VlcApi(id);
    const resultId = api.create(path, options);
    instances.set(resultId, api);
    return resultId;
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_ATTACH, (_event, handle, instanceId?) => {
    getInstance(instanceId ?? 'default')?.attach(handle);
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_SET_FRAME_FORMAT, (_event, width, height, instanceId?) => {
    getInstance(instanceId ?? 'default')?.setFrameFormat(width, height);
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_GET_FRAME_RGBA, (_event, instanceId?) => {
    return getInstance(instanceId ?? 'default')?.getFrameRgba();
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_GET_STATE, (_event, instanceId?) => {
    return getInstance(instanceId ?? 'default')?.getState();
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_PLAY, (_event, instanceId?) => {
    getInstance(instanceId ?? 'default')?.play();
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_STOP, (_event, instanceId?) => {
    getInstance(instanceId ?? 'default')?.stop();
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_PAUSE, (_event, instanceId?) => {
    getInstance(instanceId ?? 'default')?.pause();
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_TOGGLE, (_event, instanceId?) => {
    getInstance(instanceId ?? 'default')?.toggle();
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_SET_VOLUME, (_event, vol, instanceId?) => {
    getInstance(instanceId ?? 'default')?.setVolume(vol);
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_GET_VOLUME, (_event, instanceId?) => {
    return getInstance(instanceId ?? 'default')?.getVolume();
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_SET_MUTED, (_event, muted, instanceId?) => {
    getInstance(instanceId ?? 'default')?.setMuted(Boolean(muted));
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_GET_MUTED, (_event, instanceId?) => {
    return getInstance(instanceId ?? 'default')?.getMuted();
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_SEEK, (_event, time, instanceId?) => {
    getInstance(instanceId ?? 'default')?.seek(time);
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_SET_PROGRESS, (_event, progress, instanceId?) => {
    getInstance(instanceId ?? 'default')?.setProgress(progress);
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_GET_PROGRESS, (_event, instanceId?) => {
    return getInstance(instanceId ?? 'default')?.getProgress();
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_GET_DURATION, (_event, instanceId?) => {
    return getInstance(instanceId ?? 'default')?.getDuration();
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_GET_PLAYED, (_event, instanceId?) => {
    return getInstance(instanceId ?? 'default')?.getPlayed();
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_GET_BUFFERED, (_event, instanceId?) => {
    return getInstance(instanceId ?? 'default')?.getBuffered();
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_GET_ENDED, (_event, instanceId?) => {
    return getInstance(instanceId ?? 'default')?.getEnded();
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_SET_PLAYBACK_RATE, (_event, rate, instanceId?) => {
    getInstance(instanceId ?? 'default')?.setPlaybackRate(rate);
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_GET_PLAYBACK_RATE, (_event, instanceId?) => {
    return getInstance(instanceId ?? 'default')?.getPlaybackRate();
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_SET_SUBTITLE_TRACK, (_event, track, instanceId?) => {
    getInstance(instanceId ?? 'default')?.setSubtitleTrack(track);
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_GET_SUBTITLE_TRACK, (_event, instanceId?) => {
    return getInstance(instanceId ?? 'default')?.getSubtitleTrack();
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_ADD_SUBTITLE_FILE, (_event, path, instanceId?) => {
    getInstance(instanceId ?? 'default')?.addSubtitleFile(path);
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_SET_AUDIO_TRACK, (_event, track, instanceId?) => {
    getInstance(instanceId ?? 'default')?.setAudioTrack(track);
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_GET_AUDIO_TRACK, (_event, instanceId?) => {
    return getInstance(instanceId ?? 'default')?.getAudioTrack();
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_ON_EVENT, (_event, eventName, callback, instanceId?) => {
    getInstance(instanceId ?? 'default')?.onEvent(eventName, callback);
  });

  ipcMain.handle(VLC_IPC_CHANNEL.VLC_DESTROY, (_event, instanceId?) => {
    const id = instanceId ?? 'default';
    const api = instances.get(id);
    api?.destroy();
    instances.delete(id);
  });
};

export { instances };
