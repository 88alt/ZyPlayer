import { convertStandardToUri, convertWebToElectron, isSafeHeader, removeUnSafeHeaders } from '@shared/modules/headers';
import singleton from '@shared/modules/singleton';
import { fileTypeFromBuffer } from 'file-type';

import { sendRecBarrage } from '@/api/film';
import { normalRequest } from '@/utils/request';

import type { IDecoderType, IDecoderWithAutoType } from '../types';

const publicBarrageSend = (options: any) => {
  try {
    if (!options.id || !options.text || Number.isNaN(Number.parseFloat(options.time))) {
      return;
    }

    const doc = {
      id: options.id,
      text: options.text,
      time: options.time,
      color: options.color,
      type: options.type,
    };

    sendRecBarrage(doc);
  } catch {}
};

const mediaUtils = (() => {
  /**
   * 获取文件扩展名（支持URL、路径和特殊协议识别）
   * @param {string} input - 输入字符串（URL、文件路径或特殊协议）
   * @returns {string} 文件扩展名（小写），无扩展名返回空字符串
   */
  const getFileExtension = (input: string): string => {
    if (!input?.trim()) return '';

    // 特殊协议处理
    const protocolPatterns = [
      { pattern: /^magnet:/i, ext: 'magnet' },
      { pattern: /^thunder:/i, ext: 'thunder' },
      { pattern: /^ed2k:/i, ext: 'ed2k' },
    ];

    for (const { pattern, ext } of protocolPatterns) {
      if (pattern.test(input)) return ext;
    }

    // 处理URL查询参数和哈希
    const cleanInput = input.split(/[?#]/)[0];

    // 获取最后一个点号后的内容
    const lastDotIndex = cleanInput.lastIndexOf('.');
    if (lastDotIndex === -1) return '';

    const extension = cleanInput.slice(lastDotIndex + 1).toLowerCase();
    return /^[a-z0-9]+$/i.test(extension) ? extension : '';
  };

  /**
   * 内容类型到文件扩展名的映射表
   * 包含视频、音频和流媒体格式的常见MIME类型
   */
  const MIME_TO_EXTENSION: Readonly<Record<string, string>> = {
    // HLS
    'application/vnd.apple.mpegurl': 'm3u8',
    'application/x-mpegURL': 'm3u8',
    'audio/mpegurl': 'm3u8',
    'audio/x-mpegurl': 'm3u8',
    // 'application/octet-stream': 'm3u8', // 常见于HLS流

    // DASH
    'application/dash+xml': 'mpd',

    // MPEG
    'video/mp2t': 'ts',
    'video/mpeg': 'ts',
    'video/mpeg2': 'ts',

    // 视频
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/x-matroska': 'mkv',
    'video/x-flv': 'flv',
    'video/x-msvideo': 'avi', // AVI格式的两种MIME类型
    'video/avi': 'avi',
    'video/x-ms-wmv': 'wmv',
    'video/3gpp': '3gp',
    'video/ogg': 'ogv', // 更正视频OGG的标准扩展名
    'video/webm': 'webm',

    // 音频
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/aac': 'aac',
    'audio/ogg': 'oga',
    'audio/flac': 'flac',
    'audio/x-m4a': 'm4a',

    // 其他
    // 'application/vnd.ms-sstr+xml': 'ism',
  };

  // 反向映射：扩展名到内容类型
  const EXTENSION_TO_MIME: Readonly<Record<string, string>> = Object.entries(MIME_TO_EXTENSION).reduce(
    (acc, [contentType, extension]) => {
      // 确保每个扩展名只映射到一个内容类型
      if (!acc[extension]) {
        acc[extension] = contentType;
      }
      return acc;
    },
    {} as Record<string, string>,
  );

  /**
   * 根据内容类型获取文件扩展名
   */
  const getExtensionFromMime = (mime: string): string | undefined => {
    return MIME_TO_EXTENSION[mime?.toLowerCase()];
  };

  /**
   * 根据文件扩展名获取内容类型
   */
  const getMimeFromExtension = (extension: string): string | undefined => {
    return EXTENSION_TO_MIME[extension?.toLowerCase()];
  };

  /**
   * 视频类型与播放器映射
   */
  const extensionMapDecoder = (type?: string): IDecoderType | undefined => {
    switch (type) {
      case 'hls':
      case 'm3u8':
        return 'hls';
      case 'dash':
      case 'm4s':
      case 'mpd':
        return 'dash'; // dash/shaka
      case 'flv':
        return 'flv';
      case 'ts':
      case 'mpegts':
      case 'm2ts':
        return 'mpegts';
      case 'webtorrent':
      case 'torrent':
      case 'magnet':
        return 'torrent';
      case 'mp4':
      case 'mkv':
        return 'mp4';
      case 'mp3':
      case 'm4a':
      case '3gp':
      case 'ogg':
      case 'webm':
        return 'audio';
      default:
        return undefined;
    }
  };

  const getDecoderFromExtension = (type: string): IDecoderWithAutoType => {
    return extensionMapDecoder(type) || 'auto';
  };

  /**
   * 获取媒体流的内容类型并转换为文件扩展名
   * @param {string} url - 媒体资源URL
   * @param {Record<string, any>} headers - 请求头
   * @returns {Promise<string | undefined>} 文件扩展名或undefined
   */
  const getStreamContentTypeToExtension = async (
    url: string,
    headers: Record<string, any> = {},
  ): Promise<string | undefined> => {
    const REQUEST_METHODS = ['HEAD', 'GET'];

    for (const method of REQUEST_METHODS) {
      try {
        const resp = await normalRequest.request(
          {
            url,
            method,
            responseType: 'arraybuffer',
            headers: {
              ...convertWebToElectron(headers),
              ...(method === 'GET' ? { Range: 'bytes=0-16' } : {}), // 8/12/16
              Accept: '*/*',
            },
          },
          { joinTime: false },
        );
        if (resp.status !== 200 && resp.status !== 206) continue;

        const contentType = resp.headers['content-type']?.split(';')[0]?.trim()?.toLowerCase();
        if (contentType) {
          const mimeExtension = getExtensionFromMime(contentType);
          if (mimeExtension) return mimeExtension;
        }

        if (method === 'HEAD') continue;

        if (resp.data && resp.data.byteLength > 0) {
          const detected = await fileTypeFromBuffer(resp.data);
          if (detected?.mime) {
            const mimeExtension = getExtensionFromMime(detected.mime);
            if (mimeExtension) return mimeExtension;
          }
        }
      } catch (error) {
        console.error(`[mediaUtils][getMediaType][${method}][error]:`, error);
      }
    }

    return undefined;
  };

  /**
   * 检测链接协议
   * @param {string} url - 媒体资源URL
   * @returns {boolean} 是否有效协议
   */
  const isValidMediaUrl = (url: string): boolean => {
    if (!url) return false;

    const VALID_PROTOCOLS = ['http:', 'https:', 'magnet:'];
    try {
      const { protocol } = new URL(url);
      return VALID_PROTOCOLS.includes(protocol);
    } catch {
      return false;
    }
  };

  /**
   * 检测媒体资源的类型，优先使用URL扩展名，其次使用Content-Type头
   * @param url 媒体资源URL
   * @param headers 请求头
   * @returns 媒体类型标识符或undefined
   */
  const checkMediaType = async (url: string, headers: Record<string, any> = {}): Promise<string | undefined> => {
    if (!isValidMediaUrl(url)) return undefined;

    // 优先从 URL 扩展名判断
    const extension1 = getFileExtension(url);
    console.debug('[mediaUtils][checkMediaType] extension1:', extension1);
    if (extensionMapDecoder(extension1)) return extension1;

    // 其次从流内容类型判断
    const extension2 = await getStreamContentTypeToExtension(url, headers);
    console.debug('[mediaUtils][checkMediaType] extension2:', extension2);
    if (extensionMapDecoder(extension2)) return extension2;

    return undefined;
  };

  /**
   * 检测浏览器是否支持 HEVC (H.265) 视频格式
   * ref: https://github.com/StaZhu/enable-chromium-hevc-hardware-decoding#mediacapabilities
   * @returns 返回布尔值，true 表示支持，false 表示不支持
   */
  const isHEVCVideoSupported = (): boolean => {
    // hvc1.1.6.L123.B0 参数的一部分（显然是一个表示 HEVC 及其配置文件的值）。
    return document.createElement('video').canPlayType('video/mp4; codecs="hvc1.1.6.L123.B0"') === 'probably';
  };

  // 导出函数
  return {
    checkMediaType,
    removeUnSafeHeaders,
    convertStandardToUri,
    convertWebToElectron,
    getExtensionFromMime,
    getMimeFromExtension,
    getFileExtension,
    getStreamContentTypeToExtension,
    getDecoderFromExtension,
    isHEVCVideoSupported,
    isSafeHeader,
    isValidMediaUrl,
  };
})();

export { mediaUtils, publicBarrageSend, singleton };
