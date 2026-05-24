import { useEffect, useRef } from 'react';
import type { Pool } from 'workerpool';
import workerpool from 'workerpool';

export function useWorkerPool(workerUrl: string) {
  const poolRef = useRef<Pool | null>(null);

  const getPool = () => {
    if (!poolRef.current) {
      poolRef.current = workerpool.pool(workerUrl, {
        maxWorkers: 1,
        workerOpts: { type: 'module' },
        workerType: 'web',
      });
    }
    return poolRef.current;
  };

  const exec = async (method: string, args: unknown[]) => {
    const pool = getPool();
    return pool.exec(method, args);
  };

  useEffect(() => {
    return () => {
      if (poolRef.current) {
        poolRef.current.terminate();
        poolRef.current = null;
      }
    };
  }, []);

  return { exec };
}
