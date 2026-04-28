import { loggerService } from '@logger';
import { appLocale } from '@main/services/AppLocale';
import { searchService } from '@main/services/SearchService';
import { windowService } from '@main/services/WindowService';
import { LOG_MODULE } from '@shared/config/logger';
import { WINDOW_NAME } from '@shared/config/window';
import { base64, randomUUID } from '@shared/modules/crypto';
import { isHttp } from '@shared/modules/validate';
import { JSDOM } from 'jsdom';

import { createAbortPromise, fetchWebContent, noContent } from './fetch';

interface SearchItem {
  title: string;
  url: string;
}

interface WebSearchProviderResult {
  title: string;
  content: string;
  url: string;
}

export interface WebSearchProviderResponse {
  query?: string;
  results: WebSearchProviderResult[];
}

const logger = loggerService.withContext(LOG_MODULE.AIGC_HELPER);

class ToolSearchProvider {
  private static instance: ToolSearchProvider;

  private provider = {
    url: `https://cn.bing.com/search?q=%s${appLocale.isCHS() ? '' : '&ensearch=1'}`,
    usingBrowser: false,
  };

  private maxResults = 3;

  constructor() {}

  public static getInstance(): ToolSearchProvider {
    if (!ToolSearchProvider.instance) {
      ToolSearchProvider.instance = new ToolSearchProvider();
    }
    return ToolSearchProvider.instance;
  }

  public async search(query: string, httpOptions?: RequestInit): Promise<WebSearchProviderResponse> {
    const uid = randomUUID();
    // const language = appLocale.defaultLang();
    try {
      if (!query.trim()) {
        throw new Error('Search query cannot be empty');
      }

      const cleanedQuery = query.split('\r\n')[1] ?? query;
      // const queryWithLanguage = language ? `${query} lang:${language.split('-')[0]}` : cleanedQuery;
      const url = this.provider.url.replace('%s', encodeURIComponent(cleanedQuery));
      let content: string = '';
      const promisesToRace: [Promise<string>] = [searchService.openUrlInSearchWindow(uid, url)];
      if (httpOptions?.signal) {
        const abortPromise = createAbortPromise(httpOptions.signal, promisesToRace[0]);
        promisesToRace.push(abortPromise);
      }
      content = await Promise.race(promisesToRace);

      // Parse the content to extract URLs and metadata
      const searchItems = this.parseValidUrls(content).slice(0, this.maxResults);
      const validItems = searchItems.filter((item) => isHttp(item.url)).slice(0, this.maxResults);

      // Fetch content for each URL concurrently
      const fetchPromises = validItems.map(async (item) => {
        // logger.info(`Fetching content for ${item.url}...`);
        return await fetchWebContent(item.url, 'markdown', this.provider.usingBrowser, httpOptions);
      });

      // Wait for all fetches to complete
      const results: WebSearchProviderResult[] = await Promise.all(fetchPromises);
      // logger.info('Fetched search results:', results);
      return {
        query,
        results: results.filter((result) => result.content !== noContent),
      };
    } catch (error) {
      logger.error('Local search failed:', error as Error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      windowService.closeWindow(`${WINDOW_NAME.SEARCH}-${uid}`);
    }
  }

  protected parseValidUrls(htmlContent: string): SearchItem[] {
    const results: SearchItem[] = [];

    try {
      // Parse HTML string into a DOM document
      const doc = new JSDOM(htmlContent).window.document;

      const items = doc.querySelectorAll('#b_results h2');

      items.forEach((item) => {
        const node = item.querySelector('a');
        if (node) {
          const decodedUrl = this.decodeBingUrl(node.href);
          results.push({
            title: node.textContent || '',
            url: decodedUrl,
          });
        }
      });
    } catch (error) {
      logger.error('Failed to parse Bing search HTML:', error as Error);
    }

    return results;
  }

  /**
   * Decode Bing redirect URL to get the actual URL
   * Bing URLs are in format: https://www.bing.com/ck/a?...&u=a1aHR0cHM6Ly93d3cudG91dGlhby5jb20...
   * The 'u' parameter contains Base64 encoded URL with 'a1' prefix
   */
  private decodeBingUrl(bingUrl: string): string {
    try {
      const url = new URL(bingUrl);
      const encodedUrl = url.searchParams.get('u');

      if (!encodedUrl) {
        return bingUrl; // Return original if no 'u' parameter
      }

      // Remove the 'a1' prefix and decode Base64
      const base64Part = encodedUrl.substring(2);
      const decodedUrl = base64.decode({ src: base64Part });

      // Validate the decoded URL
      if (decodedUrl.startsWith('http')) {
        return decodedUrl;
      }

      return bingUrl; // Return original if decoded URL is invalid
    } catch (error) {
      logger.warn('Failed to decode Bing URL:', error as Error);
      return bingUrl; // Return original URL if decoding fails
    }
  }
}

export const toolSearchProvider = ToolSearchProvider.getInstance();
