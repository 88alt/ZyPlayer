import { loggerService } from '@logger';
import { request } from '@main/utils/request';
import { LOG_MODULE } from '@shared/config/logger';
import { randomNanoid } from '@shared/modules/crypto';
import { toUnix } from '@shared/modules/date';
import { isArrayEmpty, isNil, isPositiveFiniteNumber, isStrEmpty, isString } from '@shared/modules/validate';

const logger = loggerService.withContext(LOG_MODULE.FILM_REC_HOT);

export interface IRecommHot {
  vod_id: string | number;
  vod_name: string;
  vod_hot: number;
  vod_pic?: string;
  vod_remarks?: string;
}

export interface IRecommSearchOptions {
  kw: string;
  pageSize?: number;
  page?: number;
}

/**
 * 豆瓣
 *
 * @see https://www.douban.com/j/search_suggest?debug=true&q=我
 */
export const douban = async (doc: IRecommSearchOptions = { kw: '' }): Promise<IRecommHot[]> => {
  const { kw } = doc;

  if (!isString(kw) || isStrEmpty(kw)) return [];

  try {
    const url = 'https://www.douban.com/j/search_suggest';
    const { data: resp } = await request.request({
      url,
      method: 'GET',
      params: {
        debug: true,
        q: kw,
      },
    });

    const rawList = resp?.cards;
    if (isNil(rawList) || isArrayEmpty(rawList)) return [];

    return rawList
      .map((item) => ({
        vod_id: item.url.match(/subject\/(\d+)\//)?.[1] ?? randomNanoid(),
        vod_name: item.title ?? '',
        vod_hot: Number(item.card_subtitle.match(/^(\d+(?:\.\d+)?)分/)?.[1] || 0),
        vod_pic: item.cover_url ?? '',
        vod_remarks: item.card_subtitle ?? '',
      }))
      .sort((a, b) => b.vod_hot - a.vod_hot);
  } catch (error) {
    logger.error('Failed to fetch douban search', error as Error);
    return [];
  }
};

/**
 * 海信
 *
 * @see https://public-wxtv.hismarttv.com/weixintv/voice/suggestedWord?index=2&keyWord=我&objtypeSelect=1&page=1&pageSize=60&productCode=vod&searchPlatform=ios&sequence=1775225175193&serviceType=vod&sourceType=2&subscriberId=666666&userType=2
 */
export const hisense = async (doc: IRecommSearchOptions = { kw: '' }): Promise<IRecommHot[]> => {
  try {
    let { kw, pageSize = 20, page = 1 } = doc;

    if (!isString(kw) || isStrEmpty(kw)) return [];

    if (isString(pageSize)) pageSize = Number.parseInt(pageSize);
    if (isString(page)) page = Number.parseInt(page);
    if (!isPositiveFiniteNumber(pageSize)) pageSize = 20;
    if (!isPositiveFiniteNumber(page)) page = 1;

    const url = 'https://public-wxtv.hismarttv.com/weixintv/voice/suggestedWord';
    const { data: resp } = await request.request({
      url,
      method: 'GET',
      params: {
        index: 0,
        keyWord: kw,
        objtypeSelect: 1,
        page,
        pageSize,
        productCode: 'vod',
        searchPlatform: 'h5',
        sequence: toUnix(),
        serviceType: 'vod',
        sourceType: 2,
        subscriberId: '666666',
        userType: 2,
      },
    });

    if (resp?.resultCode !== 0) return [];

    const rawList = resp?.searchResultList;
    if (isNil(rawList) || isArrayEmpty(rawList)) return [];

    return rawList
      .map((item) => ({
        vod_id: randomNanoid(),
        vod_name: item.wordName ?? '',
        vod_hot: 0,
        vod_pic: '',
        vod_remarks: item?.productCode ?? '',
      }))
      .sort((a, b) => b.vod_hot - a.vod_hot);
  } catch (error) {
    logger.error('Failed to fetch hisense search', error as Error);
    return [];
  }
};

/**
 * 爱奇艺
 *
 * @see https://suggest.video.iqiyi.com/?if=mobile&key=我
 */
export const iqiyi = async (doc: IRecommSearchOptions = { kw: '' }): Promise<IRecommHot[]> => {
  const { kw } = doc;

  if (!isString(kw) || isStrEmpty(kw)) return [];

  try {
    const url = 'https://suggest.video.iqiyi.com/';
    const { data: resp } = await request.request({
      url,
      method: 'GET',
      headers: {
        referer: 'https://so.iqiyi.com/',
      },
      params: {
        if: 'mobile',
        key: kw,
      },
    });

    if (resp.code !== 'A00000') return [];

    const rawList = resp?.data;
    if (isNil(rawList) || isArrayEmpty(rawList)) return [];

    return rawList
      .map((item) => ({
        vod_id: randomNanoid(),
        vod_name: item.name ?? '',
        vod_hot: Number(item.final_score) || 0,
        vod_pic: item.picture_url ?? '',
        vod_remarks: item.presentation_element?.show_reason ?? '',
      }))
      .sort((a, b) => b.vod_hot - a.vod_hot);
  } catch (error) {
    logger.error('Failed to fetch iqiyi search', error as Error);
    return [];
  }
};

/**
 * 喜粤TV
 *
 * @see https://tv.aiseet.atianqi.com/i-tvbin/qtv_video/search/get_search_smart_box?format=json&page_num=0&page_size=20&key=我
 */
export const snm = async (doc: IRecommSearchOptions = { kw: '' }): Promise<IRecommHot[]> => {
  try {
    let { kw, pageSize = 20, page = 1 } = doc;

    if (!isString(kw) || isStrEmpty(kw)) return [];

    if (isString(pageSize)) pageSize = Number.parseInt(pageSize);
    if (isString(page)) page = Number.parseInt(page);
    if (!isPositiveFiniteNumber(pageSize)) pageSize = 20;
    if (!isPositiveFiniteNumber(page)) page = 1;

    const url = 'https://tv.aiseet.atianqi.com/i-tvbin/qtv_video/search/get_search_smart_box';
    const { data: resp } = await request.request({
      url,
      method: 'GET',
      params: {
        format: 'json',
        key: kw,
        page_num: page - 1,
        page_size: pageSize,
      },
    });

    const rawList = resp.data?.search_data?.vecGroupData?.[0]?.group_data;
    if (isNil(rawList) || isArrayEmpty(rawList)) return [];

    return rawList
      .map((item) => ({
        vod_id: randomNanoid(),
        vod_name: item.action?.search_keyword?.strVal || item.dtReportInfo?.reportData?.keyword_txt || '',
        vod_remarks: item.cell_info?.title ?? '',
        vod_pic: item.cell_info?.image_url ?? '',
        vod_hot: 0,
      }))
      .sort((a, b) => b.vod_hot - a.vod_hot);
  } catch (error) {
    logger.error('Failed to fetch snm search', error as Error);
    return [];
  }
};

export default {
  douban,
  hisense,
  iqiyi,
  snm,
};
