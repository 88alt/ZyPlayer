import { loggerService } from '@logger';
import { request } from '@main/utils/request';
import { LOG_MODULE } from '@shared/config/logger';
import { urlResolve } from '@shared/modules/headers';
import { fileTypeFromBuffer } from 'file-type';

const logger = loggerService.withContext(`${LOG_MODULE.SYSTEM_HELPER}<m3u8>`);

const M3U8_CONTENT_TYPES = [
  'application/vnd.apple.mpegurl',
  'application/x-mpegURL',
  'application/mpegurl',
  'application/m3u8',
  'audio/mpegurl',
  'audio/x-mpegurl',
];

export const checkM3u8 = async (url: string, headers: Record<string, any> = {}): Promise<boolean> => {
  // 扩展名判断
  try {
    const filename = new URL(url.trim(), 'http://placeholder.local').pathname.split('/').pop() || '';
    const index = filename.lastIndexOf('.');
    if (index > 0) {
      const ext = filename.slice(index + 1).toLowerCase();
      if (ext === 'm3u8') return true;
    }
  } catch {}

  // 数据流内容类型判断
  for (const method of ['GET', 'HEAD']) {
    try {
      const resp = await request.request({
        url,
        method,
        responseType: 'arraybuffer',
        headers: {
          ...headers,
          ...(method === 'GET' ? { Range: 'bytes=0-16' } : {}), // 8/12/16
          Accept: '*/*',
        },
      });
      if (resp.status !== 200 && resp.status !== 206) continue;

      const contentType = resp.headers['content-type']?.split(';')[0]?.trim()?.toLowerCase();
      if (contentType && M3U8_CONTENT_TYPES.includes(contentType)) return true;

      if (method === 'HEAD') continue;

      if (resp.data && resp.data.byteLength > 0) {
        const detected = await fileTypeFromBuffer(resp.data);
        const mime = detected?.mime?.toLowerCase();
        if (mime && M3U8_CONTENT_TYPES.includes(mime)) return true;
      }
    } catch {}
  }

  return false;
};

export const fixAdM3u8Ai = async (m3u8Url: string, headers: Record<string, any> = {}) => {
  const startTime = Date.now();

  // 获取m3u8内容
  const fetchM3u8 = async (url: string) => {
    const { data: content } = await request.request({
      url,
      method: 'GET',
      ...headers,
    });
    return content
      .trim()
      .split('\n')
      .map((line: string) => (line.startsWith('#') ? line : urlResolve(url, line)))
      .join('\n')
      .replace(/\n\n/g, '\n');
  };

  let m3u8Content = await fetchM3u8(m3u8Url);

  // 处理嵌套m3u8
  let lastUrl = m3u8Content.split('\n').filter(Boolean).slice(-1)[0] || '';
  if (lastUrl.length < 5) {
    lastUrl = m3u8Content.split('\n').filter(Boolean).slice(-2)[0] || '';
  }
  if (lastUrl.includes('.m3u8') && lastUrl !== m3u8Url) {
    m3u8Url = urlResolve(m3u8Url, lastUrl);
    m3u8Content = await fetchM3u8(m3u8Url);
  }

  const m3u8Lines = m3u8Content.trim().split('\n').filter(Boolean);
  const isSsaiTag = m3u8Content.includes('#EXT-X-DISCONTINUITY');
  let result = m3u8Content;

  if (isSsaiTag) {
    logger.info('帧率指纹通道去广');

    const commonFps = [23.976, 24, 25, 29.97, 30, 50, 60];
    const fpsCounts: Record<string, number> = Object.fromEntries(commonFps.map((fps) => [fps, 0]));

    // 统计帧率
    for (const line of m3u8Lines) {
      if (!line.startsWith('#EXTINF:')) continue;

      const dur = Number.parseFloat(line.slice(8).split(',')[0].trim());
      if (!Number.isFinite(dur)) continue;

      for (const fps of commonFps) {
        const frames = dur * fps;
        const diff = Math.abs(frames - Math.round(frames));
        if (diff < 0.05) fpsCounts[fps]++;
      }
    }

    let mainFps = 24;
    let maxMatch = 0;
    for (const fps of commonFps) {
      if (fpsCounts[fps] > maxMatch) {
        maxMatch = fpsCounts[fps];
        mainFps = fps;
      }
    }

    logger.info(`主视频帧率: ${mainFps}fps`);

    // 剔除广告块
    const finalLines: string[] = [];
    let currentBlock: string[] = [];
    let isAdBlock = false;

    const flushBlock = () => {
      if (currentBlock.length > 0) {
        if (!isAdBlock) {
          finalLines.push(...currentBlock);
        } else {
          logger.debug(`剔除疑似广告区块: \n${currentBlock.join('\n')}`);
        }
        currentBlock = [];
      }
    };

    for (const line of m3u8Lines) {
      const t = line.trim();
      if (!t) continue;

      if (
        t.startsWith('#EXTM3U') ||
        t.startsWith('#EXT-X-VERSION') ||
        t.startsWith('#EXT-X-TARGETDURATION') ||
        t.startsWith('#EXT-X-MEDIA-SEQUENCE') ||
        t.startsWith('#EXT-X-PLAYLIST-TYPE') ||
        t.startsWith('#EXT-X-ENDLIST')
      ) {
        finalLines.push(line);
        continue;
      }

      if (t.startsWith('#EXT-X-DISCONTINUITY')) {
        flushBlock();
        currentBlock = [line];
        isAdBlock = false;
        continue;
      }

      currentBlock.push(line);

      if (line.startsWith('#EXTINF:')) {
        const dur = Number.parseFloat(line.split(':')[1].split(',')[0].trim());
        const frames = dur * mainFps;
        const diff = Math.abs(frames - Math.round(frames));
        if (diff > 0.1) isAdBlock = true;
      }
    }
    flushBlock();

    // 重新拼接
    const finalContent = finalLines
      .map((line) => {
        const t = line.trim();
        return t && !t.startsWith('#') ? urlResolve(m3u8Url, t) : line;
      })
      .join('\n');

    result = finalContent;
  } else {
    logger.info('常规技术通道去广');

    const commonPrefixLength = (a: string, b: string): number => {
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i++;
      return i;
    };

    const lines = m3u8Lines;

    // 寻找首片段和尾片段
    let firstSegment = '';
    let maxPrefixLen = 0;
    // let firstCandidate = '';
    let secondCandidate = '';
    let count1 = 1;
    let count2 = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith('#')) {
        if (!firstSegment) {
          firstSegment = line;
        } else {
          const prefixLen = commonPrefixLength(firstSegment, line);
          if (maxPrefixLen > prefixLen + 1) {
            if (secondCandidate.length < 5) secondCandidate = line;
            count2++;
          } else {
            maxPrefixLen = prefixLen;
            count1++;
          }
        }
        if (count1 + count2 >= 30) break;
      }
    }

    if (count2 > count1) firstSegment = secondCandidate;
    // const firstLen = firstSegment.length;
    // const middleLen = Math.round(lines.length / 2).toString().length;

    // const reverseString = (str: string): string => [...str].reverse().join('');

    // const lastSegment = lines.toReversed().find((line: string) => {
    //   if (!line.startsWith('#')) {
    //     const revMatch = commonPrefixLength(reverseString(firstSegment), reverseString(line));
    //     maxPrefixLen = commonPrefixLength(firstSegment, line);
    //     return firstLen - maxPrefixLen <= middleLen + revMatch || maxPrefixLen > 10;
    //   }
    //   return false;
    // });
    // logger.debug(`最后区块：${lastSegment}`);

    // 剔除广告块
    const currentBlock: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith('#')) {
        if (commonPrefixLength(firstSegment, line) < maxPrefixLen) {
          currentBlock.push(line);
          lines.splice(i - 1, 2);
          i -= 2;
        } else {
          lines[i] = urlResolve(m3u8Url, line);
        }
      } else {
        lines[i] = line.replace(/URI="(.*)"/, (_, u) => `URI="${urlResolve(m3u8Url, u)}"`);
      }
    }

    if (currentBlock.length) logger.debug(`剔除疑似广告区块: \n${currentBlock.join('\n')}`);

    result = lines.join('\n');
  }

  logger.info(`处理耗时: ${Date.now() - startTime}ms`);
  // logger.silly(`最终区块: \n${result}`);

  return result;
};
