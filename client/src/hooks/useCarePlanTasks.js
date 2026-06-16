import { useState, useEffect, useCallback } from 'react';
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
  // so a quick logout right after checking a box can't drop the write)
  useEffect(() => {
    if (loading) return;
    saveLocal(completedTasks);
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
