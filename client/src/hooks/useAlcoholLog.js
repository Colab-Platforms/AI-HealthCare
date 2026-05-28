import { useEffect, useCallback, useSyncExternalStore } from 'react';
import api from '../services/api';
import { loadLog, saveLog, mergeAlcoholLogs } from '../utils/alcoholLog';

let storeLog = loadLog();
let storeLoading = true;
let hydratePromise = null;
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn());

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => storeLog;
const getLoadingSnapshot = () => storeLoading;

async function hydrateOnce() {
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    const local = loadLog();
    try {
      const { data } = await api.get('health/alcohol-log');
      const remote = data?.alcoholLog || {};
      const merged = mergeAlcoholLogs(local, remote);

      storeLog = merged;
      saveLog(merged);
      emit();

      if (JSON.stringify(merged) !== JSON.stringify(remote)) {
        const { data: saved } = await api.post('health/alcohol-log', { alcoholLog: merged });
        if (saved?.alcoholLog) {
          storeLog = saved.alcoholLog;
          saveLog(storeLog);
          emit();
        }
      }
    } catch (err) {
      storeLog = local;
      emit();
      console.error('Failed to load alcohol logs from DB:', err);
    } finally {
      storeLoading = false;
      emit();
    }
  })();

  return hydratePromise;
}

export default function useAlcoholLog() {
  const log = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const loading = useSyncExternalStore(subscribe, getLoadingSnapshot, getLoadingSnapshot);

  useEffect(() => {
    hydrateOnce();
  }, []);

  const syncWithServer = useCallback(async (updatedLog) => {
    try {
      const { data } = await api.post('health/alcohol-log', { alcoholLog: updatedLog });
      storeLog = data?.alcoholLog || updatedLog;
      saveLog(storeLog);
      emit();
    } catch (err) {
      console.error('Failed to sync alcohol logs to DB:', err);
      throw err;
    }
  }, []);

  const persistLog = useCallback(
    (updater) => {
      const next = typeof updater === 'function' ? updater(storeLog) : updater;
      storeLog = next;
      saveLog(next);
      emit();
      syncWithServer(next);
    },
    [syncWithServer]
  );

  return { log, persistLog, loading };
}
