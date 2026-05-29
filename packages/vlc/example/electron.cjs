const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { ipc, instances } = require('../lib/control.cjs');
const { VLC_IPC_CHANNEL } = require('../lib/constants.cjs');

let mainWindow = null;

ipc();

app.whenReady().then(async () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 760,
    // minWidth: 960,
    // minHeight: 540,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false,
      nodeIntegration: false,
    },
  });

  // Override VLC_CREATE to register event forwarding after the player is created.
  // The native addon requires the player to exist before onEvent() can succeed.
  ipcMain.removeHandler(VLC_IPC_CHANNEL.VLC_CREATE);
  ipcMain.handle(VLC_IPC_CHANNEL.VLC_CREATE, (_e, vlcPath, options, instanceId) => {
    const id = instanceId ?? `player_${Date.now()}`;
    const { VlcApi } = require('../lib/control.cjs');
    const api = new VlcApi(id);
    const resultId = api.create(vlcPath, options);
    instances.set(resultId, api);
    for (const eventName of [
      // 'buffering',
      'playing',
      'paused',
      'stopped',
      'ended',
      'error',
      'time-changed',
      'position-changed',
    ]) {
      api.onEvent(eventName, (payload) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(VLC_IPC_CHANNEL.VLC_ON_EVENT, payload);
        }
      });
    }
    return resultId;
  });

  mainWindow.on('close', () => {});

  await mainWindow.loadFile(path.join(__dirname, 'index.html'));
});

app.on('window-all-closed', () => {
  app.quit();
});
