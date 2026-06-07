import { isArray, isArrayEmpty, isNil } from '@shared/modules/validate';
import type { IModels } from '@shared/types/db';
import { throttle } from 'es-toolkit';
import type { Ref } from 'vue';
import { ref } from 'vue';

import { addHistory, findHistory, putHistory } from '@/api/moment';

type IHistoryQueryParams = Parameters<typeof findHistory>[0];
type IAddHistoryDoc = Parameters<typeof addHistory>[0];

interface IUseHistoryOptions<TSource = unknown> {
  source: Ref<TSource>;
  getQuery: (source: TSource) => IHistoryQueryParams;
  createDoc: (source: TSource) => IAddHistoryDoc;
  onLoaded?: (history: IModels['history']) => void;
  onSaved?: (history: IModels['history']) => void;
  throttleWait?: number;
}

export const useHistory = <TSource = unknown>({
  source,
  getQuery,
  createDoc,
  onLoaded,
  onSaved,
  throttleWait = 3000,
}: IUseHistoryOptions<TSource>) => {
  const historyData = ref({} as IModels['history']);

  const resetHistoryData = () => {
    historyData.value = {} as IModels['history'];
  };

  const getHistoryData = async () => {
    try {
      const resp = await findHistory(getQuery(source.value));

      const history = isNil(resp?.id) ? ({} as IModels['history']) : resp;

      historyData.value = history;

      onLoaded?.(history);
    } catch (error) {
      console.error('Failed to get history data:', error);
      resetHistoryData();
    }
  };

  const saveHistoryData = async () => {
    const id = historyData.value?.id;
    const doc = createDoc(source.value);

    try {
      const resp = isNil(id) ? await addHistory(doc) : await putHistory({ id: [id], doc });

      historyData.value =
        isArray(resp) && !isArrayEmpty(resp) && !isNil(resp[0]?.id) ? resp[0] : ({} as IModels['history']);

      onSaved?.(historyData.value);
    } catch (error) {
      console.error('Failed to save history data:', error);
      resetHistoryData();
    }
  };

  const throttleSaveHistory = throttle(saveHistoryData, throttleWait, {
    edges: ['leading', 'trailing'],
  });

  return {
    historyData,
    getHistoryData,
    saveHistoryData,
    throttleSaveHistory,
    resetHistoryData,
  };
};
