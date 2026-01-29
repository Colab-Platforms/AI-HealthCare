import { createContext, useContext, useState, useCallback } from 'react';
import { healthService, wearableService, nutritionService } from '../services/api';
import { cache } from '../utils/cache';

const DataContext = createContext();

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
};

export const DataProvider = ({ children }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [wearableData, setWearableData] = useState(null);
  const [nutritionData, setNutritionData] = useState(null);
  const [loading, setLoading] = useState({
    dashboard: false,
    wearable: false,
    nutrition: false
  });

  // Fetch dashboard data with caching
  const fetchDashboard = useCallback(async (forceRefresh = false) => {
    // Check cache first
    if (!forceRefresh) {
      const cached = cache.get('dashboard');
      if (cached) {
        setDashboardData(cached);
        return cached;
      }
    }

    setLoading(prev => ({ ...prev, dashboard: true }));
    try {
      const response = await healthService.getDashboard();
      const data = response.data;
      setDashboardData(data);
      cache.set('dashboard', data, 3 * 60 * 1000); // Cache for 3 minutes
      return data;
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, dashboard: false }));
    }
  }, []);

  // Fetch wearable data with caching
  const fetchWearable = useCallback(async (forceRefresh = false) => {
    // Check cache first
    if (!forceRefresh) {
      const cached = cache.get('wearable');
      if (cached) {
        setWearableData(cached);
        return cached;
      }
    }

    setLoading(prev => ({ ...prev, wearable: true }));
    try {
      const response = await wearableService.getDashboard();
      const data = response.data;
      setWearableData(data);
      cache.set('wearable', data, 2 * 60 * 1000); // Cache for 2 minutes
      return data;
    } catch (error) {
      console.error('Failed to fetch wearable:', error);
      // Return default data on error
      const defaultData = { connected: false };
      setWearableData(defaultData);
      return defaultData;
    } finally {
      setLoading(prev => ({ ...prev, wearable: false }));
    }
  }, []);

  // Fetch nutrition data with caching
  const fetchNutrition = useCallback(async (date, forceRefresh = false) => {
    const cacheKey = `nutrition_${date}`;
    
    // Check cache first
    if (!forceRefresh) {
      const cached = cache.get(cacheKey);
      if (cached) {
        setNutritionData(cached);
        return cached;
      }
    }

    setLoading(prev => ({ ...prev, nutrition: true }));
    try {
      const response = await nutritionService.getDailySummary(date);
      const data = response.data?.summary || null;
      setNutritionData(data);
      if (data) {
        cache.set(cacheKey, data, 5 * 60 * 1000); // Cache for 5 minutes
      }
      return data;
    } catch (error) {
      console.error('Failed to fetch nutrition:', error);
      setNutritionData(null);
      return null;
    } finally {
      setLoading(prev => ({ ...prev, nutrition: false }));
    }
  }, []);

  // Invalidate cache when data changes
  const invalidateCache = useCallback((keys = []) => {
    if (keys.length === 0) {
      // Clear all cache
      cache.clear();
      setDashboardData(null);
      setWearableData(null);
      setNutritionData(null);
    } else {
      keys.forEach(key => {
        cache.delete(key);
        if (key === 'dashboard') setDashboardData(null);
        if (key === 'wearable') setWearableData(null);
        if (key.startsWith('nutrition_')) setNutritionData(null);
      });
    }
  }, []);

  const value = {
    // Data
    dashboardData,
    wearableData,
    nutritionData,
    loading,
    
    // Methods
    fetchDashboard,
    fetchWearable,
    fetchNutrition,
    invalidateCache
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
