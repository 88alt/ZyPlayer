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
   * @param input - 输入字符串（URL、文件路径或特殊协议）
   * @returns 文件扩展名
   */
  const getFileExtension = (input: string): string => {
    if (!input?.trim()) return 'unknown';

    // 特殊协议处理
    const protocolPatterns = [
      { pattern: /^magnet:/i, ext: 'magnet' },
      { pattern: /^thunder:/i, ext: 'thunder' },
      { pattern: /^ed2k:/i, ext: 'ed2k' },
    ];

    for (const { pattern, ext } of protocolPatterns) {
      if (pattern.test(input)) return ext;
    }

    try {
      const filename = new URL(input.trim(), 'http://placeholder.local').pathname.split('/').pop() || '';
      const index = filename.lastIndexOf('.');
      if (index <= 0) return 'unknown'; // 没有扩展名或隐藏文件（如 .gitignore）
      const ext = filename.slice(index + 1).toLowerCase();
      return /^[a-z0-9]+$/i.test(ext) ? ext : 'unknown';
    } catch {}

    return 'unknown';
  };

  /**
   * 内容类型到文件扩展名的映射表
   * 包含视频、音频和流媒体格式的常见MIME类型
   */
  const MIME_TO_EXTENSION: Readonly<Record<string, string>> = {
    // HLS
    'application/vnd.apple.mpegurl': 'm3u8',
    'application/x-mpegURL': 'm3u8',
    'application/mpegurl': 'm3u8',
    'application/m3u8': 'm3u8',
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
  const getExtensionFromMime = (mime: string): string => {
    return MIME_TO_EXTENSION[mime?.toLowerCase()] || 'unknown';
  };

  /**
   * 根据文件扩展名获取内容类型
   */
  const getMimeFromExtension = (extension: string): string => {
    return EXTENSION_TO_MIME[extension?.toLowerCase()] || 'unknown';
  };

  /**
   * 视频类型与播放器映射
   */
  const extensionMapDecoder = (type?: string): IDecoderType | 'unknown' => {
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
        return 'unknown';
    }
  };

  const getDecoderFromExtension = (type: string): IDecoderWithAutoType => {
    const decoder = extensionMapDecoder(type);
    return decoder !== 'unknown' ? decoder : 'auto';
  };

  /**
   * 获取媒体流的内容类型并转换为文件扩展名
   * @param url - 媒体资源URL
   * @param headers - 请求头
   * @returns 文件扩展名
   */
  const getStreamContentTypeToExtension = async (url: string, headers: Record<string, any> = {}): Promise<string> => {
    if (!url?.trim()) return 'unknown';

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
          if (mimeExtension !== 'unknown') return mimeExtension;
        }

        if (method === 'HEAD') continue;

        if (resp.data && resp.data.byteLength > 0) {
          const detected = await fileTypeFromBuffer(resp.data);
          const mime = detected?.mime?.toLowerCase();
          if (mime) {
            const mimeExtension = getExtensionFromMime(mime);
            if (mimeExtension !== 'unknown') return mimeExtension;
          }
        }
      } catch {}
    }

    return 'unknown';
  };

  /**
   * 检测链接协议
   * @param url - 媒体资源URL
   * @returns 是否有效协议
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
   * @returns 媒体类型标识符
   */
  const checkMediaType = async (url: string, headers: Record<string, any> = {}): Promise<string> => {
    if (!isValidMediaUrl(url)) return 'unknown';

    // 优先从 URL 扩展名判断
    const extension1 = getFileExtension(url);
    console.debug('[mediaUtils][checkMediaType] extension1:', extension1);
    if (extension1 !== 'unknown' && extensionMapDecoder(extension1) !== 'unknown') return extension1;

    // 其次从流内容类型判断
    const extension2 = await getStreamContentTypeToExtension(url, headers);
    console.debug('[mediaUtils][checkMediaType] extension2:', extension2);
    if (extension2 !== 'unknown' && extensionMapDecoder(extension2) !== 'unknown') return extension2;

    return 'unknown';
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
