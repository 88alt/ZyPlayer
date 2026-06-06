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

const hlsCleanerBySSAI = async (m3u8Lines: string[], m3u8Url: string, _headers: Record<string, any> = {}) => {
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
        logger.warn(`剔除疑似广告区块: \n${currentBlock.join('\n')}`);
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

  return finalContent;
};

const hlsCleanerByUrlPattern = async (m3u8Lines: string[], m3u8Url: string, headers: Record<string, any> = {}) => {
  interface IAdBlockCandidate {
    position: number;
    quantity: number;
    time: string;
    type: number;
    char3Or6Count?: number;
    timelineDuration?: number;
  }

  interface ISegmentBlock {
    k1: number;
    n: number;
    t: number;
    l: number;
    tt: number;
  }

  const isCommentLine = (line: string): boolean => line.startsWith('#');
  const isExtinfLine = (line: string): boolean => line.startsWith('#EXTINF');
  const isExtXLine = (line: string): boolean => line.startsWith('#EXT-X-');

  const getCommonPrefixLength = (str1: string, str2: string): number => {
    const maxLength = Math.min(str1.length, str2.length);
    let index = 0;

    while (index < maxLength && str1[index] === str2[index]) {
      index++;
    }

    return index;
  };

  const countChar3Or6 = (str: string): number => {
    let count = 0;

    for (let i = 0; i < str.length; i++) {
      if (str[i] === '3' || str[i] === '6') {
        count++;
      }
    }

    return count;
  };

  const findFirstUrlByMostCommonBase = (urls: string[]): string => {
    const groupedByBase: Record<string, string[]> = {};

    for (const url of urls) {
      const baseUrl =
        url.lastIndexOf('://') === url.lastIndexOf('/') - 1 ? url : url.slice(0, url.lastIndexOf('/') + 1);
      groupedByBase[baseUrl] ||= [];
      // if (!groupedByBase[baseUrl]) groupedByBase[baseUrl] = [];
      groupedByBase[baseUrl].push(url);
    }

    return Object.values(groupedByBase).sort((a, b) => b.length - a.length)[0]?.[0] || '';
  };

  const matchAdTime = (weightedDuration: number, segmentCount: number, adTimeList: string[]): boolean => {
    const weightedDurationStr = `${weightedDuration.toString()}00000`;

    return adTimeList.some((item) => {
      const [count, durationPrefix] = item.split('|');
      return segmentCount === Number(count) && weightedDurationStr.startsWith(durationPrefix);
    });
  };

  const reverseString = (str: string): string => [...str].reverse().join('');

  const AD_TIME_PATTERNS: string[] = ['6|150.56000', '5|107.88000'];

  let playlistLines = m3u8Lines.slice(); // 浅拷贝

  const segmentUrlSamples: string[] = [];
  for (const line of playlistLines) {
    if (!isCommentLine(line)) {
      segmentUrlSamples.push(line);
      if (segmentUrlSamples.length >= 30) break;
    }
  }

  const firstSegmentUrl = findFirstUrlByMostCommonBase(segmentUrlSamples);

  // logger.info(`第一个区块: ${firstSegmentUrl}`);

  const firstSegmentUrlLength = firstSegmentUrl.length;
  const segmentIndexLength = Math.round(playlistLines.length / 2).toString().length;
  const minPrefixLength = firstSegmentUrl.lastIndexOf('/') + 1;

  const prefixLengthCounts: Record<number, number> = {};
  let checkedSegmentCount = 0;

  for (let i = playlistLines.length - 1; i >= 0; i--) {
    const line = playlistLines[i];

    if (isCommentLine(line)) continue;

    const commonSuffixLength = getCommonPrefixLength(reverseString(firstSegmentUrl), reverseString(line));
    let currentPrefixLength = getCommonPrefixLength(firstSegmentUrl, line);

    if (currentPrefixLength < minPrefixLength) currentPrefixLength = minPrefixLength;

    prefixLengthCounts[currentPrefixLength] = (prefixLengthCounts[currentPrefixLength] || 0) + 1;
    checkedSegmentCount++;

    if (
      firstSegmentUrlLength - currentPrefixLength <= segmentIndexLength + commonSuffixLength ||
      checkedSegmentCount > 10
    ) {
      break;
    }
  }

  let maxPrefixLength = Number(Object.entries(prefixLengthCounts).reduce((a, b) => (a[1] > b[1] ? a : b))[0]);

  if (maxPrefixLength - minPrefixLength > 6) maxPrefixLength--;

  // logger.info(`最大前缀长度: ${maxPrefixLength}`);

  let detectedAdUrls: string[] = [];
  let totalAdDuration = 0;

  /**
   * 一轮
   * 通过 URL 前缀差异识别广告块
   */
  {
    let currentBlockDuration = 0;
    let currentExtinfLineCount = 0;
    let differentUrlLineCount = 0;
    let lastDifferentUrlLineIndex = 0;

    const collectDifferentUrlAds = (lastDifferentUrlLineIndex: number, collectLineCount: number) => {
      for (let offset = 0; offset < collectLineCount; offset += 2) {
        totalAdDuration += Number.parseFloat(playlistLines[lastDifferentUrlLineIndex - offset - 1].slice(8));
        detectedAdUrls.push(playlistLines[lastDifferentUrlLineIndex - offset]);
      }
    };

    for (let lineIndex = 0; lineIndex < playlistLines.length; lineIndex++) {
      const line = playlistLines[lineIndex];

      if (isExtinfLine(line)) {
        currentBlockDuration += Number.parseFloat(line.slice(8));
        currentExtinfLineCount += 2;
      }

      if (isCommentLine(line)) continue;

      if (getCommonPrefixLength(firstSegmentUrl, line) < maxPrefixLength) {
        differentUrlLineCount += 2;
        lastDifferentUrlLineIndex = lineIndex;
        continue;
      }

      if (
        currentExtinfLineCount === differentUrlLineCount + 2 &&
        currentBlockDuration < 40 &&
        differentUrlLineCount > 2
      ) {
        collectDifferentUrlAds(lastDifferentUrlLineIndex, differentUrlLineCount);
        playlistLines.splice(lastDifferentUrlLineIndex - differentUrlLineCount + 1, differentUrlLineCount);

        lineIndex = lastDifferentUrlLineIndex - differentUrlLineCount;
      }

      currentBlockDuration = 0;
      differentUrlLineCount = 0;
      currentExtinfLineCount = 0;
      lastDifferentUrlLineIndex = 0;
    }

    if (currentExtinfLineCount === differentUrlLineCount && currentBlockDuration < 40 && differentUrlLineCount > 2) {
      collectDifferentUrlAds(lastDifferentUrlLineIndex, currentExtinfLineCount);
      playlistLines.splice(lastDifferentUrlLineIndex - differentUrlLineCount + 1, differentUrlLineCount);
    }
  }

  // 防误删过多回退机制
  if (totalAdDuration > 120) {
    playlistLines = m3u8Lines.slice();
    detectedAdUrls = [];
    totalAdDuration = 0;
  }

  // 如果疑似广告 URL 实际重定向到正常视频段，则撤销删除。
  if (totalAdDuration > 0) {
    try {
      const { headers: redirectHeaders } = await request.request({
        url: detectedAdUrls[0],
        method: 'GET',
        headers,
      });

      const redirectLocation = redirectHeaders.location || redirectHeaders.Location;
      if (redirectLocation && getCommonPrefixLength(firstSegmentUrl, redirectLocation) >= maxPrefixLength) {
        playlistLines = m3u8Lines.slice();
        detectedAdUrls = [];
        totalAdDuration = 0;
      }
    } catch {}
  }

  if (totalAdDuration !== 0 && detectedAdUrls.length !== 0) {
    logger.warn(`剔除疑似广告区块: 差异广告(${totalAdDuration}s) \n${detectedAdUrls.join('\n')}`);
  }

  /**
   * 二轮
   * 根据时间、分段特征识别广告块
   */
  if (detectedAdUrls.length < 1) {
    const adBlockCandidates: IAdBlockCandidate[] = [];
    const segmentBlockRecords: ISegmentBlock[] = [];

    let type0Count = 0;
    let type1Count = 0;
    let type2Count = 0;

    const addAdBlockCandidate = (
      position: number,
      quantity: number,
      time: string,
      type: number,
      char3Or6Count?: number, // 后加
      timelineDuration?: number, // 后加
    ) => {
      adBlockCandidates.push({
        position,
        quantity,
        time,
        type,
        char3Or6Count,
        timelineDuration,
      });
    };

    // let uniqueDurationCount = 0;
    let blockStartIndex = 0;
    let segmentCount = 0;
    let char3Or6Count = 0;
    let totalTimelineDuration = 0;
    let blockDuration = 0;
    let currentSegmentDuration = 0;
    let weightedDuration = 0;
    let segmentOrder = 0;
    let uniqueDurationText = '';

    for (let lineIndex = 0; lineIndex < playlistLines.length; lineIndex++) {
      let line = playlistLines[lineIndex];

      if (isExtinfLine(line)) {
        const durationText = line.slice(8);
        currentSegmentDuration = Number.parseFloat(durationText);

        segmentCount++;

        if (segmentCount === 1) blockStartIndex = lineIndex;

        if (!uniqueDurationText.includes(durationText)) {
          uniqueDurationText = uniqueDurationText + durationText;
          // uniqueDurationCount++;
        }

        char3Or6Count += countChar3Or6(durationText);
        segmentOrder++;

        blockDuration += currentSegmentDuration;
        weightedDuration += currentSegmentDuration * (2 * segmentOrder + 1);
        totalTimelineDuration += currentSegmentDuration;

        lineIndex++;
        line = playlistLines[lineIndex];
      }

      if (isExtXLine(line)) {
        if (segmentCount > 0) {
          segmentBlockRecords.push({
            k1: blockStartIndex,
            n: segmentCount,
            t: blockDuration,
            l: char3Or6Count,
            tt: totalTimelineDuration,
          });
        }

        if (segmentCount >= 3 && char3Or6Count > segmentCount * 4 && blockDuration < 30) {
          addAdBlockCandidate(blockStartIndex, segmentCount, blockDuration.toFixed(5), 0);
          type0Count++;
        }

        if (
          matchAdTime(weightedDuration, segmentCount, AD_TIME_PATTERNS) ||
          matchAdTime(
            weightedDuration - currentSegmentDuration * (2 * segmentOrder + 1),
            segmentCount,
            AD_TIME_PATTERNS,
          )
        ) {
          addAdBlockCandidate(blockStartIndex, segmentCount, blockDuration.toFixed(5), 1);
          type1Count++;
        }

        // uniqueDurationCount = 0;
        blockDuration = 0;
        segmentCount = 0;
        char3Or6Count = 0;
        segmentOrder = 0;
        weightedDuration = 0;
        uniqueDurationText = '';
      }
    }

    if (segmentBlockRecords.length < 10) {
      const isLongSegmentBlock = segmentBlockRecords.some((record) => record.t > 120);

      if (isLongSegmentBlock) {
        const validAdLikeRecords = segmentBlockRecords.filter((record) => record.t < 40 && record.n > 2);

        // validAdLikeRecords.forEach((record) => {
        //   logger.warn(
        //     `剔除疑似广告区块: 时间广告(${record.t}s) <位置>${record.k1}| <数量>${record.n}| 3的数量 ${record.l}| <进度>${Math.floor(record.tt / 60)}分钟${Math.floor(record.tt - Math.floor(record.tt / 60) * 60)}秒`,
        //   );
        //   addAdBlockCandidate(record.k1, record.n, record.t.toFixed(5), 2);
        //   type2Count++;
        // });

        for (const record of validAdLikeRecords) {
          addAdBlockCandidate(record.k1, record.n, record.t.toFixed(5), 2, record.l, record.tt);

          type2Count++;
        }
      }
    }

    let filteredCandidates = adBlockCandidates;
    if (type0Count > 4) filteredCandidates = adBlockCandidates.filter((candidate) => candidate.type !== 0);
    if (type1Count > 4) filteredCandidates = adBlockCandidates.filter((candidate) => candidate.type !== 1);
    if (type2Count > 4) filteredCandidates = adBlockCandidates.filter((candidate) => candidate.type !== 2);

    const removeMinTimeAdBlocks = (candidates: IAdBlockCandidate[]) => {
      const timeCountMap: Map<string, number> = new Map();
      for (const candidate of candidates) {
        timeCountMap.set(candidate.time, (timeCountMap.get(candidate.time) || 0) + 1);
      }

      // let minTimeCount = 4;
      let minTimeCount = Number.POSITIVE_INFINITY;
      for (const count of timeCountMap.values()) {
        if (count < minTimeCount) {
          minTimeCount = count;
        }
      }

      const minTimeCandidates = candidates
        .filter((candidate) => timeCountMap.get(candidate.time) === minTimeCount)
        .sort((a, b) => b.position - a.position); // 删除必须倒序，否则 splice 后 position 会错

      const removedPositions = new Set<number>();
      const removedLogBlocks: Array<{ position: number; quantity: number; time: string; lines: string[] }> = [];

      for (const candidate of minTimeCandidates) {
        const { position, quantity, time } = candidate;

        if (removedPositions.has(position)) continue;
        removedPositions.add(position);

        if (quantity >= 20) continue;

        const isPrevDiscontinuity = playlistLines[position - 1]?.startsWith('#EXT-X-DISCONTINUITY');
        const removeStart = isPrevDiscontinuity ? position - 1 : position;
        const removeCount = quantity * 2 + (isPrevDiscontinuity ? 1 : 0);
        const removedLines = playlistLines.slice(removeStart, removeStart + removeCount);

        removedLogBlocks.push({ position, quantity, time, lines: removedLines });

        playlistLines.splice(removeStart, removeCount);
      }

      removedLogBlocks
        .sort((a, b) => a.position - b.position)
        .forEach(({ time, lines }) => {
          if (Number(time) !== 0 && lines.length !== 0) {
            logger.warn(`剔除疑似广告区块: 时间广告(${time}s) \n${lines.join('\n')}`);
          }
        });
    };

    removeMinTimeAdBlocks(filteredCandidates);
  }

  // 重新拼接
  const finalContent = playlistLines
    .map((line) => {
      const t = line.trim();
      return t && !t.startsWith('#') ? urlResolve(m3u8Url, t) : line;
    })
    .join('\n');

  return finalContent;
};

export const fixAdM3u8Ai = async (m3u8Url: string, headers: Record<string, any> = {}) => {
  logger.info('开始清理');
  const startTime = Date.now();

  // 获取m3u8内容
  const fetchM3u8 = async (url: string): Promise<string> => {
    const { data: content } = await request.request({
      url,
      method: 'GET',
      headers,
    });
    return content
      .trim()
      .split('\n')
      .map((line: string) => (line.startsWith('#') ? line : line.startsWith('http') ? line : urlResolve(url, line)))
      .join('\n')
      .replace(/\n\n/g, '\n');
  };

  let m3u8Content = await fetchM3u8(m3u8Url);

  // 处理嵌套m3u8
  const lastBlockUrl = m3u8Content
    .trim()
    .split('\n')
    .filter((line) => line.length >= 5 && !line.startsWith('#'))
    .pop();
  if (lastBlockUrl && lastBlockUrl.includes('.m3u8') && lastBlockUrl !== m3u8Url) {
    m3u8Url = urlResolve(m3u8Url, lastBlockUrl);
    m3u8Content = await fetchM3u8(m3u8Url);
  }

  const m3u8Lines = m3u8Content.trim().split('\n').filter(Boolean);
  const isSsaiTag = m3u8Content.includes('#EXT-X-DISCONTINUITY');
  let result = m3u8Content;

  if (isSsaiTag) {
    logger.info('模式: 帧率指纹');
    result = await hlsCleanerBySSAI(m3u8Lines, m3u8Url, headers);
  } else {
    logger.info('模式: 匹配模式');
    result = await hlsCleanerByUrlPattern(m3u8Lines, m3u8Url, headers);
  }

  logger.info(`处理耗时: ${Date.now() - startTime}ms`);
  // logger.silly(`最终区块: \n${result}`);

  return result;
};
