import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import api from "../services/api";
import { loadLog, saveLog, mergeSmokeLogs } from "../utils/smokeLog";

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
      const { data } = await api.get("health/smoke-log");
      const remote = data?.smokeLog || {};
      const merged = mergeSmokeLogs(local, remote);

      storeLog = merged;
      saveLog(merged);
      emit();

      if (JSON.stringify(merged) !== JSON.stringify(remote)) {
        const { data: saved } = await api.post("health/smoke-log", { smokeLog: merged });
        if (saved?.smokeLog) {
          storeLog = saved.smokeLog;
          saveLog(storeLog);
          emit();
        }
      }
    } catch (err) {
      storeLog = local;
      emit();
      console.error("Failed to load smoke logs from DB:", err);
    } finally {
      storeLoading = false;
      emit();
    }
  })();

  return hydratePromise;
}

export default function useSmokeLog() {
  const log = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const loading = useSyncExternalStore(subscribe, getLoadingSnapshot, getLoadingSnapshot);

  useEffect(() => {
    hydrateOnce();
  }, []);

  const syncWithServer = useCallback(async (updatedLog) => {
    try {
      const { data } = await api.post("health/smoke-log", { smokeLog: updatedLog });
      storeLog = data?.smokeLog || updatedLog;
      saveLog(storeLog);
      emit();
    } catch (err) {
      console.error("Failed to sync smoke logs to DB:", err);
      throw err;
    }
  }, []);

  const persistLog = useCallback(
    (updater) => {
      const next = typeof updater === "function" ? updater(storeLog) : updater;
      storeLog = next;
      saveLog(next);
      emit();
      syncWithServer(next);
    },
    [syncWithServer]
  );

  return { log, persistLog, loading };
}
