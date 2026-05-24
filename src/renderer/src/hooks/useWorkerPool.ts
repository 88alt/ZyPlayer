import { merge } from 'es-toolkit';
import { onBeforeUnmount, shallowRef } from 'vue';
import type { Pool } from 'workerpool';
import workerpool from 'workerpool';

export function useWorkerPool(workerUrl: string, options) {
  const poolRef = shallowRef<Pool | null>(null);

  const getPool = () => {
    if (!poolRef.value) {
      poolRef.value = workerpool.pool(
        workerUrl,
        merge(
          {
            maxWorkers: 1,
            workerType: 'web',
          },
          options,
        ),
      );
    }
    return poolRef.value;
  };

  const exec = async (method: string, args: unknown[]) => {
    const pool = getPool();
    return pool.exec(method, args);
  };

  onBeforeUnmount(() => {
    if (poolRef.value) {
      poolRef.value.terminate();
    }
    poolRef.value = null;
  });

  return { exec };
}
