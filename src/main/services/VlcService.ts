import { loggerService } from '@logger';
import { LOG_MODULE } from '@shared/config/logger';
import { VLC_IPC_CHANNEL } from '@zy/vlc/constants';
import { ipc as vlcIpcListen } from '@zy/vlc/control';

const logger = loggerService.withContext(LOG_MODULE.VLC);

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
    vlcIpcListen((wc, _instanceId, api) => {
      for (const eventName of VLC_FORWARD_EVENTS) {
        api.onEvent(eventName, (payload) => {
          if (wc && !wc.isDestroyed()) {
            wc.send(VLC_IPC_CHANNEL.VLC_ON_EVENT, payload);
          }
        });
      }
    });
  } catch (error) {
    logger.error('Failed to register VLC IPC', error as Error);
  }
};
