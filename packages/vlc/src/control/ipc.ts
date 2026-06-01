import type { WebContents } from 'electron';
import { ipcMain } from 'electron';

import { VLC_IPC_CHANNEL } from '../constants/ipc';
import { VlcApi } from './api';

const instances = new Map<string, VlcApi>();
const wcInstanceIds = new Map<number, Set<string>>();

const getInstance = (id: string): VlcApi | undefined => {
  return instances.get(id);
};

function destroyInstances(ids: Iterable<string>): void {
  for (const id of ids) {
    instances.get(id)?.destroy();
  }
}

function trackWebContentsLifecycle(wc: WebContents, wcId: number): void {
  if (wcInstanceIds.has(wcId)) return;

  wcInstanceIds.set(wcId, new Set());

  // Page refresh: destroy all old instances before new page loads
  wc.on('did-start-navigation' as any, (_event: any, _url: string, _isInPlace: boolean, isMainFrame: boolean) => {
    if (!isMainFrame) return;
    const ids = wcInstanceIds.get(wcId);
    if (ids && ids.size > 0) {
      destroyInstances(ids);
      ids.clear();
    }
  });

  // Window / tab close
  wc.on('destroyed', () => {
    const ids = wcInstanceIds.get(wcId);
    if (ids) {
      destroyInstances(ids);
      ids.clear();
    }
    wcInstanceIds.delete(wcId);
  });
}

export type OnVlcCreated = (wc: WebContents, instanceId: string, api: VlcApi) => void;

export const ipc = (onCreated?: OnVlcCreated): void => {
  ipcMain.handle(VLC_IPC_CHANNEL.VLC_CREATE, (event, path, options, instanceId?) => {
    const id = instanceId ?? `vlc_player_${Date.now().toString(36)}`;
    const api = new VlcApi(id);
    const ins = api.create(path, options);

    instances.set(ins, api);
    trackWebContentsLifecycle(event.sender, event.sender.id);
    wcInstanceIds.get(event.sender.id)!.add(ins);

    onCreated?.(event.sender, ins, api);

    return ins;
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

    for (const ids of wcInstanceIds.values()) {
      ids.delete(id);
    }
  });
};

export { instances };
