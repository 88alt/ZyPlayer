import { appLocale } from '@main/services/AppLocale';
import { configManager } from '@main/services/ConfigManager';
import { generateUserAgent } from '@main/utils/systemInfo';
import { IPC_CHANNEL } from '@shared/config/ipcChannel';
import { app, session, webContents } from 'electron';

/**
 * init the useragent of the webview session
 * remove the zyfun and Electron from the useragent
 */
export function initSessionUserAgent() {
  const wvSession = session.fromPartition('persist:webview');
  // const originUA = wvSession.getUserAgent();
  const defaultUA = generateUserAgent();

  wvSession.setUserAgent(defaultUA);
  wvSession.webRequest.onBeforeSendHeaders((details, cb) => {
    const ua = configManager.ua;
    const language = appLocale.defaultLang();

    const headers = {
      ...details.requestHeaders,
      'User-Agent': ua,
      'Accept-Language': `${language}, en;q=0.9, *;q=0.5`,
    };
    cb({ requestHeaders: headers });
  });
}

const attachKeyboardHandler = (contents: Electron.WebContents) => {
  if (contents.getType?.() !== 'webview') {
    return;
  }

  const handleBeforeInput = (event: Electron.Event, input: Electron.Input) => {
    if (!input) {
      return;
    }

    const key = input.key?.toLowerCase();
    if (!key) {
      return;
    }

    // Helper to check if this is a shortcut we handle
    const isHandledShortcut = (k: string) => {
      const isFindShortcut = (input.control || input.meta) && k === 'f';
      const isPrintShortcut = (input.control || input.meta) && k === 'p';
      const isSaveShortcut = (input.control || input.meta) && k === 's';
      const isEscape = k === 'escape';
      const isEnter = k === 'enter';
      return isFindShortcut || isPrintShortcut || isSaveShortcut || isEscape || isEnter;
    };

    if (!isHandledShortcut(key)) {
      return;
    }

    const host = contents.hostWebContents;
    if (!host || host.isDestroyed()) {
      return;
    }

    const isFindShortcut = (input.control || input.meta) && key === 'f';
    const isPrintShortcut = (input.control || input.meta) && key === 'p';
    const isSaveShortcut = (input.control || input.meta) && key === 's';

    // Always prevent Cmd/Ctrl+F to override the guest page's native find dialog
    if (isFindShortcut) {
      event.preventDefault();
    }

    // Prevent default print/save dialogs and handle them with custom logic
    if (isPrintShortcut || isSaveShortcut) {
      event.preventDefault();
    }

    // Send the hotkey event to the renderer
    // The renderer will decide whether to preventDefault for Escape and Enter
    // based on whether the search bar is visible
    host.send(IPC_CHANNEL.WEBVIEW_SEARCH_HOTKEY, {
      webviewId: contents.id,
      key,
      control: Boolean(input.control),
      meta: Boolean(input.meta),
      shift: Boolean(input.shift),
      alt: Boolean(input.alt),
    });
  };

  contents.on('before-input-event', handleBeforeInput);
  contents.once('destroyed', () => {
    contents.removeListener('before-input-event', handleBeforeInput);
  });
};

export function initWebviewHotkeys() {
  webContents.getAllWebContents().forEach((contents) => {
    if (contents.isDestroyed()) return;
    attachKeyboardHandler(contents);
  });

  app.on('web-contents-created', (_, contents) => {
    attachKeyboardHandler(contents);
  });
}
