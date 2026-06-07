import { isArray, isArrayEmpty, isNil } from '@shared/modules/validate';
import type { IModels } from '@shared/types/db';
import type { Ref } from 'vue';
import { ref } from 'vue';

import { addStar, delStar, findStar, putStar } from '@/api/moment';

type IStarQueryParams = Parameters<typeof findStar>[0];
type IAddStarDoc = Parameters<typeof addStar>[0];

interface IUseStarOptions<TSource = unknown> {
  source: Ref<TSource>;
  getQuery: (source: TSource) => IStarQueryParams;
  createDoc: (source: TSource) => IAddStarDoc;
}

export const useStar = <TSource = unknown>({ source, getQuery, createDoc }: IUseStarOptions<TSource>) => {
  const starData = ref({} as IModels['star']);

  const resetStarData = () => {
    starData.value = {} as IModels['star'];
  };

  const getStarData = async () => {
    try {
      const resp = await findStar(getQuery(source.value));

      starData.value = isNil(resp?.id) ? ({} as IModels['star']) : resp;
    } catch (error) {
      console.error('Failed to get star data:', error);
      resetStarData();
    }
  };

  const saveStarData = async () => {
    const id = starData.value?.id;
    const doc = createDoc(source.value);

    try {
      const resp = isNil(id) ? await addStar(doc) : await putStar({ id: [id], doc });

      starData.value = isArray(resp) && !isArrayEmpty(resp) && !isNil(resp[0]?.id) ? resp[0] : ({} as IModels['star']);
    } catch (error) {
      console.error('Failed to save star data:', error);
      resetStarData();
    }
  };

  const deleteStarData = async () => {
    const id = starData.value?.id;

    if (isNil(id)) return;

    try {
      await delStar({ id: [id] });
    } catch (error) {
      console.error('Failed to delete star data:', error);
    } finally {
      resetStarData();
    }
  };

  const handleSwitchStar = async () => {
    isNil(starData.value?.id) ? await saveStarData() : await deleteStarData();
  };

  return {
    starData,
    getStarData,
    saveStarData,
    deleteStarData,
    handleSwitchStar,
    resetStarData,
  };
};
