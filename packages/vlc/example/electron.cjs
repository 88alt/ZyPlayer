const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { ipc } = require('../lib/control.cjs');
const { VLC_IPC_CHANNEL } = require('../lib/constants.cjs');

// Pass a callback to register event forwarding after each player is created.
// Lifecycle cleanup (page refresh / window close) is handled internally.
ipc((wc, instanceId, api) => {
  const win = BrowserWindow.fromWebContents(wc);

  for (const eventName of ['playing', 'paused', 'stopped', 'ended', 'error', 'time-changed', 'position-changed']) {
    api.onEvent(eventName, (payload) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send(VLC_IPC_CHANNEL.VLC_ON_EVENT, payload);
      }
    });
  }
});

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));
});

app.on('window-all-closed', () => {
  app.quit();
});
