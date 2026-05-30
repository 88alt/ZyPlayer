import { loggerService } from '@logger';
import { LOG_MODULE } from '@shared/config/logger';
import { randomUUID } from '@zy/crypto';
import { instances as vlcInstances, ipc as vlcIpcListen, VlcApi } from '@zy/vlc/control';
import type { IVlcInitOptions, IVlcInitPath } from '@zy/vlc/renderer';
import { ipcMain } from 'electron';

const logger = loggerService.withContext(LOG_MODULE.VLC);

const VLC_CREATE_CHANNEL = 'vlc:create';
const VLC_ON_EVENT_CHANNEL = 'vlc:onEvent';
const VLC_FORWARD_EVENTS = [
  'playing',
  'paused',
  'stopped',
  'ended',
  'error',
  'time-changed',
  'position-changed',
] as const;

export const registerVlcIpc = () => {
  try {
    vlcIpcListen();

    ipcMain.removeHandler(VLC_CREATE_CHANNEL);
    ipcMain.handle(
      VLC_CREATE_CHANNEL,
      (event: Electron.IpcMainInvokeEvent, path: IVlcInitPath, options: IVlcInitOptions, instanceId?: string) => {
        const id = instanceId ?? randomUUID();
        const api = new VlcApi(id);
        const resultId = api.create(path, options);
        vlcInstances.set(resultId, api);

        for (const eventName of VLC_FORWARD_EVENTS) {
          api.onEvent(eventName, (payload) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send(VLC_ON_EVENT_CHANNEL, payload);
            }
          });
        }

        return resultId;
      },
    );
  } catch (error) {
    logger.error('Failed to register VLC IPC', error as Error);
  }
};
