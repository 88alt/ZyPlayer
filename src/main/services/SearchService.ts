import { loggerService } from '@logger';
import { windowService } from '@main/services/WindowService';
import { getTimeout } from '@main/utils/tool';
import { LOG_MODULE } from '@shared/config/logger';
import { WINDOW_NAME } from '@shared/config/window';

const logger = loggerService.withContext(LOG_MODULE.SEARCH);

export class SearchService {
  private static instance: SearchService | null = null;

  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  public getWindowName(uid: string): string {
    return `${WINDOW_NAME.SEARCH}-${uid}`;
  }

  public async openSearchWindow(uid: string): Promise<void> {
    const windowName = this.getWindowName(uid);
    let mainWindow = windowService.getWindow(windowName);

    if (!mainWindow || mainWindow.isDestroyed()) {
      mainWindow = windowService.createSearchWindow(uid);
    }

    windowService.showWindow(mainWindow);
  }

  public async closeSearchWindow(uid: string): Promise<void> {
    const windowName = this.getWindowName(uid);
    const mainWindow = windowService.getWindow(windowName);

    if (mainWindow && !mainWindow.isDestroyed()) {
      windowService.closeWindow(mainWindow);
    }
  }

  public async openUrlInSearchWindow(uid: string, url: string, timeout?: number): Promise<any> {
    const windowName = this.getWindowName(uid);
    let mainWindow = windowService.getWindow(windowName);

    if (!mainWindow || mainWindow.isDestroyed()) {
      mainWindow = windowService.createSearchWindow(uid);
    }

    logger.debug(`Search url: ${url}`);
    await mainWindow.loadURL(url);

    // Get the page content after loading the URL
    // Wait for the page to fully load before getting the content
    await new Promise<void>((resolve) => {
      const loadTimeout = setTimeout(resolve, getTimeout(timeout)); // default timeout
      mainWindow.webContents.once('did-finish-load', () => {
        clearTimeout(loadTimeout);
        setTimeout(resolve, 500); // Small delay to ensure JavaScript has executed
      });
    });

    // Get the page content after ensuring it's fully loaded
    return await mainWindow.webContents.executeJavaScript('document.documentElement.outerHTML');
  }
}

export const searchService = SearchService.getInstance();
