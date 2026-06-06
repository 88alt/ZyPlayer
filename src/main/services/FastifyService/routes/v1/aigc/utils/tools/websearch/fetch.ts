import { searchService } from '@main/services/SearchService';
import { request } from '@main/utils/request';
import { getTimeout } from '@main/utils/tool';
import { Readability } from '@mozilla/readability';
import { USER_AGENT } from '@shared/config/userAgent';
import { isHttp } from '@shared/modules/validate';
import { randomUUID } from '@zy/crypto';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';

export type ResponseFormat = 'markdown' | 'html' | 'text';

export interface WebSearchProviderResult {
  title: string;
  content: string;
  url: string;
}

const turndownService = new TurndownService();

export const noContent = 'No content found';

export function createAbortPromise<T>(signal: AbortSignal, finallyPromise: Promise<T>) {
  return new Promise<T>((_resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Operation aborted', 'AbortError'));
      return;
    }

    const abortHandler = () => {
      reject(new DOMException('Operation aborted', 'AbortError'));
    };

    signal.addEventListener('abort', abortHandler, { once: true });

    void finallyPromise.finally(() => {
      signal.removeEventListener('abort', abortHandler);
    });
  });
}

export const fetchWebContent = async (
  url: string,
  format: ResponseFormat = 'markdown',
  usingBrowser: boolean = false,
  httpOptions: RequestInit = {},
): Promise<WebSearchProviderResult> => {
  try {
    // Validate URL before attempting to fetch
    if (!isHttp(url)) {
      throw new Error(`Invalid URL format: ${url}`);
    }

    let html: string;
    if (usingBrowser) {
      const windowApiPromise = searchService.openUrlInSearchWindow(`search-window-${randomUUID()}`, url);

      const promisesToRace: [Promise<string>] = [windowApiPromise];

      if (httpOptions?.signal) {
        const signal = httpOptions.signal;
        const abortPromise = createAbortPromise(signal, windowApiPromise) as Promise<string>;
        promisesToRace.push(abortPromise);
      }

      html = await Promise.race(promisesToRace);
    } else {
      const response = await request.request({
        url,
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT.PC_DARWIN_CHROME,
        },
        signal: httpOptions?.signal
          ? AbortSignal.any([httpOptions.signal, AbortSignal.timeout(getTimeout())])
          : AbortSignal.timeout(getTimeout()),
      });
      html = response.data;
    }

    const doc = new JSDOM(html).window.document;
    const article = new Readability(doc).parse();
    // console.log('Parsed article:', article);

    switch (format) {
      case 'markdown': {
        const markdown = turndownService.turndown(article?.content || '');
        return {
          title: article?.title || url,
          url,
          content: markdown || noContent,
        };
      }
      case 'html':
        return {
          title: article?.title || url,
          url,
          content: article?.content || noContent,
        };
      case 'text':
        return {
          title: article?.title || url,
          url,
          content: article?.textContent || noContent,
        };
    }
  } catch {
    return {
      title: url,
      url,
      content: noContent,
    };
  }
};
