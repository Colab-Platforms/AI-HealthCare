import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { healthService, wearableService, nutritionService } from '../services/api';
import { cache } from '../utils/cache';
import { useAuth } from './AuthContext';

const DataContext = createContext();

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
};

export const DataProvider = ({ children }) => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [wearableData, setWearableData] = useState(null);
  const [nutritionData, setNutritionData] = useState(null);
  const [nutritionLogs, setNutritionLogs] = useState(null);
  const [weeklyTrends, setWeeklyTrends] = useState(null);
  const [healthGoals, setHealthGoals] = useState(null);
  const [loading, setLoading] = useState({
    dashboard: false,
    wearable: false,
    nutrition: false,
    logs: false,
    goals: false
  });

  // Clear all data when user changes (login/logout/register)
  useEffect(() => {
    if (!user) {
      // User logged out or not authenticated
      cache.clear();
      setDashboardData(null);
      setWearableData(null);
      setNutritionData(null);
      setNutritionLogs(null);
      setWeeklyTrends(null);
      setHealthGoals(null);
    }
  }, [user?.id]); // Only trigger when user ID changes

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
      cache.set('dashboard', data, 10 * 60 * 1000); // Cache for 10 minutes
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

  // Fetch nutrition logs with caching
  const fetchNutritionLogs = useCallback(async (date, forceRefresh = false) => {
    const cacheKey = `logs_${date}`;
    if (!forceRefresh) {
      const cached = cache.get(cacheKey);
      if (cached) {
        setNutritionLogs(cached);
        return cached;
      }
    }

    setLoading(prev => ({ ...prev, logs: true }));
    try {
      const response = await nutritionService.getLogs(date);
      const data = response.data?.logs || response.data?.foodLogs || [];
      setNutritionLogs(data);
      cache.set(cacheKey, data, 5 * 60 * 1000);
      return data;
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      return [];
    } finally {
      setLoading(prev => ({ ...prev, logs: false }));
    }
  }, []);

  // Fetch weekly trends with caching
  const fetchWeeklyTrends = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = cache.get('weekly_trends');
      if (cached) {
        setWeeklyTrends(cached);
        return cached;
      }
    }

    try {
      const response = await nutritionService.getWeeklySummary();
      const data = response.data?.trends || [];
      setWeeklyTrends(data);
      cache.set('weekly_trends', data, 15 * 60 * 1000);
      return data;
    } catch (error) {
      console.error('Failed to fetch weekly trends:', error);
      return [];
    }
  }, []);

  // Fetch health goals with caching
  const fetchHealthGoals = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = cache.get('health_goals');
      if (cached) {
        setHealthGoals(cached);
        return cached;
      }
    }

    setLoading(prev => ({ ...prev, goals: true }));
    try {
      const response = await nutritionService.getGoals();
      const data = response.data?.healthGoal || null;
      setHealthGoals(data);
      cache.set('health_goals', data, 30 * 60 * 1000);
      return data;
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Failed to fetch health goals:', error);
      }
      setHealthGoals(null);
      return null;
    } finally {
      setLoading(prev => ({ ...prev, goals: false }));
    }
  }, []);

  // Fetch active diet plan with caching
  const fetchDietPlan = useCallback(async (forceRefresh = false) => {
    // Check cache first
    if (!forceRefresh) {
      const cached = cache.get('diet_plan');
      if (cached) {
        return cached;
      }
    }

    try {
      const { dietRecommendationService } = await import('../services/api');
      const { data } = await dietRecommendationService.getActiveDietPlan();
      if (data.success && data.dietPlan) {
        cache.set('diet_plan', data.dietPlan, 15 * 60 * 1000); // Cache for 15 minutes
        return data.dietPlan;
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch diet plan:', error);
      return null;
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
        if (key.startsWith('logs_')) setNutritionLogs(null);
        if (key === 'weekly_trends') setWeeklyTrends(null);
        if (key === 'health_goals') setHealthGoals(null);
      });
    }
  }, []);

  // Clear all data when user changes (for logout/login scenarios)
  const clearAllData = useCallback(() => {
    cache.clear();
    setDashboardData(null);
    setWearableData(null);
    setNutritionData(null);
  }, []);

  const value = {
    // Data
    dashboardData,
    wearableData,
    nutritionData,
    nutritionLogs,
    weeklyTrends,
    healthGoals,
    loading,

    // Methods
    fetchDashboard,
    fetchWearable,
    fetchNutrition,
    fetchNutritionLogs,
    fetchWeeklyTrends,
    fetchHealthGoals,
    fetchDietPlan,
    invalidateCache,
    clearAllData
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
