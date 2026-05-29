const { contextBridge } = require('electron');
const { electronAPI } = require('@electron-toolkit/preload');

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI);
} else {
  window.electron = electronAPI;
}
