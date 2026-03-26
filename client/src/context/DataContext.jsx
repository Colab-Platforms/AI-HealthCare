import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { healthService, wearableService, nutritionService, dietRecommendationService } from '../services/api';
import toast from 'react-hot-toast';
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
  
  // Initialize states from cache to prevent "loading every time" flash
  const [dashboardData, setDashboardData] = useState(() => cache.get('dashboard'));
  const [wearableData, setWearableData] = useState(() => cache.get('wearable'));
  
  const today = new Date().toISOString().split('T')[0];
  const [nutritionData, setNutritionData] = useState(() => cache.get(`nutrition_${today}`));
  const [nutritionLogs, setNutritionLogs] = useState(() => cache.get(`logs_${today}`));
  
  const [weeklyTrends, setWeeklyTrends] = useState(() => cache.get('weekly_trends'));
  const [healthGoals, setHealthGoals] = useState(() => cache.get('health_goals'));
  
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

  const invalidateCache = useCallback(async (keys = []) => {
    if (keys.length === 0) {
      cache.clear();
    } else {
      keys.forEach(key => cache.delete(key));
    }
    
    // Refresh relevant data if currently in memory - AWAIT these to ensure cache is updated before triggerRefresh
    const promises = [];
    if (keys.length === 0 || keys.includes('dashboard')) promises.push(fetchDashboard(true));
    if (keys.length === 0 || keys.includes('wearable')) promises.push(fetchWearable(true));
    if (keys.length === 0 || keys.includes('diet_plan')) promises.push(fetchDietPlan(true));
    
    await Promise.allSettled(promises);
    
    // Always trigger refresh after clearing/updating cache
    setDataRefreshTrigger(prev => prev + 1);
  }, [fetchDashboard, fetchWearable, fetchDietPlan]);


  const clearAllData = useCallback(() => {
    cache.clear();
    setDashboardData(null);
    setWearableData(null);
    setNutritionData(null);
    setNutritionLogs(null);
    setWeeklyTrends([]);
    setHealthGoals(null);
    setPendingAnalysisIds([]);
    setPendingDietPlanIds([]);
    setDataRefreshTrigger(0);
  }, []);

  const [pendingAnalysisIds, setPendingAnalysisIds] = useState([]);
  const [pendingDietPlanIds, setPendingDietPlanIds] = useState([]);
  const [dataRefreshTrigger, setDataRefreshTrigger] = useState(0);

  const triggerRefresh = useCallback(() => {
    setDataRefreshTrigger(prev => prev + 1);
  }, []);

  // Use a ref for the navigate function to avoid dependency loops if needed, 
  // but since this is a context provider, we can't use useNavigate here unless we wrap it properly.
  // Actually, DataProvider is inside BrowserRouter usually.
  
  // Track and poll for pending analyses
  useEffect(() => {
    if (pendingAnalysisIds.length === 0) return;

    let pollInterval = setInterval(async () => {
      const results = await Promise.all(
        pendingAnalysisIds.map(async (id) => {
          try {
            const { data } = await healthService.getReportStatus(id);
            return { id, status: data.status };
          } catch (e) {
            return { id, status: 'error' };
          }
        })
      );

      const completed = results.filter(r => r.status === 'completed' || r.status === 'failed');
      
      if (completed.length > 0) {
        completed.forEach(async (report) => {
          if (report.status === 'completed') {
            toast.success('Report analysis completed!', {
              duration: 4000,
              icon: '📋',
              id: `completed-${report.id}`
            });
            await invalidateCache(['dashboard', 'diet_plan']);
          } else if (report.status === 'failed') {
            toast.error('Report analysis failed. Please try again.', { id: `failed-${report.id}` });
          }
        });

        setPendingAnalysisIds(prev => prev.filter(id => !completed.find(c => c.id === id)));
      }
    }, 5000);


    return () => clearInterval(pollInterval);
  }, [pendingAnalysisIds, invalidateCache, triggerRefresh]);

  const addPendingAnalysis = useCallback((id) => {
    setPendingAnalysisIds(prev => [...new Set([...prev, id])]);
  }, []);

  const addPendingDietPlan = useCallback((id) => {
    setPendingDietPlanIds(prev => [...new Set([...prev, id])]);
  }, []);

  // Track and poll for pending diet plans
  useEffect(() => {
    if (pendingDietPlanIds.length === 0) return;

    let pollInterval = setInterval(async () => {
      const results = await Promise.all(
        pendingDietPlanIds.map(async (id) => {
          try {
            const { data } = await dietRecommendationService.getDietPlanStatus(id);
            return { id, status: data.status };
          } catch (e) {
            return { id, status: 'error' };
          }
        })
      );


      const completed = results.filter(r => r.status === 'completed' || r.status === 'failed');
      
      if (completed.length > 0) {
        completed.forEach(async (plan) => {
          if (plan.status === 'completed') {
            toast.success('Diet plan generated successfully!', {
              duration: 4000,
              icon: '🍽️',
              id: `completed-diet-${plan.id}`
            });
            await invalidateCache(['diet_plan', 'dashboard']);
          } else if (plan.status === 'failed') {
            toast.error('Diet plan generation failed.', { id: `failed-diet-${plan.id}` });
          }
        });

        setPendingDietPlanIds(prev => prev.filter(id => !completed.find(c => c.id === id)));
      }
    }, 5000);


    return () => clearInterval(pollInterval);
  }, [pendingDietPlanIds, invalidateCache, triggerRefresh]);

  const value = {
    // Data
    dashboardData,
    wearableData,
    nutritionData,
    nutritionLogs,
    weeklyTrends,
    healthGoals,
    loading,
    pendingAnalysisIds,
    dataRefreshTrigger,

    // Methods
    fetchDashboard,
    fetchWearable,
    fetchNutrition,
    fetchNutritionLogs,
    fetchWeeklyTrends,
    fetchHealthGoals,
    fetchDietPlan,
    invalidateCache,
    addPendingAnalysis,
    addPendingDietPlan,
    triggerRefresh,
    clearAllData
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
