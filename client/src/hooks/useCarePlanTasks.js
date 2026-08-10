import { useState, useEffect, useCallback, useRef } from 'react';
import { healthService } from '../services/api';

const getTodayStr = () => new Date().toISOString().split('T')[0];

const STORAGE_KEY = 'carePlanTasks';

const loadLocal = () => {
  try {
    const { tasks, date } = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (date === getTodayStr()) return tasks || [];
  } catch {}
  return [];
};

const saveLocal = (tasks) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, date: getTodayStr() }));
};

export default function useCarePlanTasks() {
  const [completedTasks, setCompletedTasks] = useState(loadLocal);
  const [loading, setLoading] = useState(true);

  // Fetch from backend on mount
  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await healthService.getDailyProgress(getTodayStr());
        const backendTasks = res?.data?.progress?.completedTasks;
        if (Array.isArray(backendTasks) && backendTasks.length >= completedTasks.length) {
          setCompletedTasks(backendTasks);
          saveLocal(backendTasks);
        }
      } catch {}
      setLoading(false);
    };
    fetch();
  }, []);

  // Sync to backend whenever completedTasks changes (immediate, not debounced,
  // so a quick logout right after checking a box can't drop the write).
  //
  // The first run after loading settles is skipped. That run isn't a user
  // change — it's the state arriving from the server or localStorage — so it
  // wrote the same tasks straight back on every single mount. Besides being a
  // pointless write, that endpoint feeds the Health Score, so it invalidated a
  // score the dashboard had just fetched and forced a second recompute on every
  // page load. Real toggles still sync immediately.
  const skipInitialSync = useRef(true);

  useEffect(() => {
    if (loading) return;
    saveLocal(completedTasks);

    if (skipInitialSync.current) {
      skipInitialSync.current = false;
      return;
    }

    healthService
      .syncDailyProgress({ date: getTodayStr(), completedTasks })
      .catch(() => {});
  }, [completedTasks, loading]);

  const toggleTask = useCallback((index) => {
    setCompletedTasks((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  }, []);

  return { completedTasks, toggleTask, loading };
}
