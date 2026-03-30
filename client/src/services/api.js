import axios from 'axios';
import cache from '../utils/cache';

// Determine API URL based on environment
// Determine API URL based on environment
const getApiUrl = () => {
  // 1. If VITE_API_URL is explicitly set (BEST PRACTICE for cross-domain production)
  if (import.meta.env.VITE_API_URL) {
    let url = import.meta.env.VITE_API_URL;
    // CRITICAL: Ensure URL has a protocol (doesn't just start with ai-healthcare...)
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }
    return url;
  }

  const currentHost = window.location.hostname;
  
  // 2. Local development
  if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
    const port = import.meta.env.VITE_API_PORT || '5001';
    return `http://localhost:${port}/api`;
  }

  // 3. Mobile dev (different device on same network)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(currentHost)) {
     const port = import.meta.env.VITE_API_PORT || '5001';
     return `http://${currentHost}:${port}/api`;
  }

  // 4. Production - Default to /api (works with Vercel/Netlify proxy)
  // If your backend is moved to a DIFFERENT domain (like Railway),
  // YOU MUST set VITE_API_URL in your deployment dashboard.
  return '/api';
};

const api = axios.create({
  baseURL: getApiUrl(),
  headers: { 'Content-Type': 'application/json' }
});

// Log API configuration on startup
console.log('🔧 API Configuration:', {
  baseURL: api.defaults.baseURL,
  hostname: window.location.hostname,
  isProd: import.meta.env.PROD,
  isDev: import.meta.env.DEV,
  mode: import.meta.env.MODE
});

// Cached GET request wrapper
const cachedGet = async (url, options = {}) => {
  const { ttl = 5 * 60 * 1000, skipCache = false } = options;
  const cacheKey = `api_${url}`;

  // Check cache first
  if (!skipCache) {
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('📦 Cache hit:', url);
      return { data: cached, fromCache: true };
    }
  }

  // Make API call
  console.log('🌐 API call:', url);
  const response = await api.get(url);

  // Cache the response
  cache.set(cacheKey, response.data, ttl);

  return { ...response, fromCache: false };
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Clear cache on login/register requests to prevent data leakage
  if (config.url?.includes('auth/login') || config.url?.includes('auth/register')) {
    cache.clear();
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Check if this request should skip auto-logout
    const skipAutoLogout = error.config?.skipAutoLogout;

    if (error.response?.status === 401) {
      console.warn('🔓 401 Unauthorized detected for URL:', error.config?.url);
      console.log('🔓 skipAutoLogout flag status:', !!skipAutoLogout);

      if (!skipAutoLogout) {
        console.log('🚪 Triggering auto-logout and redirecting to /login');
        // Clear only sensitive auth data, preserving UI flags like onboarding tour status
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        cache.clear();
        window.location.href = '/login';
      } else {
        console.log('🛡️ skipAutoLogout is TRUE — keeping user on current page');
      }
    } else if (!error.response) {
      console.error('Network Error:', {
        message: error.message,
        apiUrl: api.defaults.baseURL,
        currentHost: window.location.hostname,
        currentPort: window.location.port
      });
    }

    return Promise.reject(error);
  }
);

export const healthService = {
  // Upload report for AI analysis
  uploadReport: (formData) => api.post('health/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 150000 // 150 seconds for heavy AI processing
  }),
  getReports: () => api.get('health/reports'),
  getReport: (id) => api.get(`health/reports/${id}`),
  getReportStatus: (id) => api.get(`health/reports/${id}/status`),
  deleteReport: (id) => api.delete(`health/reports/${id}`),
  getDashboard: (config) => api.get('health/dashboard', config),
  getHistory: (reportType) => api.get('health/history', { params: { reportType } }),
  compareReport: (id) => api.get(`health/reports/${id}/compare`),
  chatAboutReport: (id, message, chatHistory) => api.post(`health/reports/${id}/chat`, { message, chatHistory }),
  askAI: (data) => api.post('health/ai-chat', data),
  getMetricInfo: (data) => api.post('health/metric-info', data),
  getReportComparison: () => api.get('health/report-comparison'),
  syncDailyProgress: (data) => api.post('health/daily-progress', data),
  getDailyProgress: (date) => api.get(`health/daily-progress/${date}`)
};

export const authService = {
  register: (data) => api.post('auth/register', data),
  registerDoctor: (data) => api.post('auth/register/doctor', data),
  login: (data) => api.post('auth/login', data)
};

export const notificationService = {
  getAll: () => api.get('notifications'),
  getUnreadCount: () => api.get('notifications/unread-count', { skipAutoLogout: true }),
  markAsRead: (id) => api.put(`notifications/${id}/read`),
  markAllAsRead: () => api.put('notifications/mark-all-read'),
  deleteOne: (id) => api.delete(`notifications/${id}`),
  clearAll: () => api.delete('notifications')
};

export const doctorService = {
  // Public (for patients)
  getAll: (params) => api.get('doctors', { params }),
  getById: (id) => api.get(`doctors/${id}`),
  getRecommended: (specializations) => api.get('doctors/recommended', { params: { specializations } }),
  bookAppointment: (data) => api.post('doctors/book', data),
  getAppointments: () => api.get('doctors/appointments'),
  getAppointment: (id) => api.get(`doctors/appointments/${id}`),

  // Consultation methods
  startConsultation: (appointmentId) => api.post(`doctors/appointments/${appointmentId}/start`),
  endConsultation: (appointmentId) => api.post(`doctors/appointments/${appointmentId}/end`),
  getConsultationSummary: (appointmentId) => api.get(`doctors/appointments/${appointmentId}/summary`),
  submitReview: (appointmentId, reviewData) => api.post(`doctors/appointments/${appointmentId}/review`, reviewData),
  downloadPrescription: (appointmentId) => api.get(`doctors/appointments/${appointmentId}/prescription`, { responseType: 'blob' }),

  // Doctor-specific
  getDashboard: () => api.get('doctors/me/dashboard'),
  getMyProfile: () => api.get('doctors/me/profile'),
  updateMyProfile: (data) => api.put('doctors/me/profile', data),
  getMyAppointments: (params) => api.get('doctors/me/appointments', { params }),
  updateAppointmentStatus: (appointmentId, data) => api.patch(`doctors/me/appointments/${appointmentId}`, data),
  getPatientProfile: (patientId, appointmentId) => api.get(`doctors/patient/${patientId}`, { params: { appointmentId } }),
  getDoctorAppointments: (doctorId, status) => api.get(`doctors/${doctorId}/appointments`, { params: { status } }),

  // Availability Management
  getMyAvailability: () => api.get('doctors/me/availability'),
  updateMyAvailability: (data) => api.put('doctors/me/availability', data),
  generateTimeSlots: () => api.post('doctors/me/generate-slots'),
  getDoctorAvailableSlots: (doctorId, date) => api.get(`doctors/${doctorId}/available-slots`, { params: { date } }),
  checkSlotAvailability: (doctorId, date, timeSlot) => api.get(`doctors/${doctorId}/check-slot`, { params: { date, timeSlot } })
};

export const wearableService = {
  connectDevice: (deviceType, deviceName) => api.post('wearables/connect', { deviceType, deviceName }),
  disconnectDevice: (deviceType) => api.post(`wearables/disconnect/${deviceType}`),
  getDevices: () => api.get('wearables/devices'),
  syncMetrics: (deviceType, metrics) => api.post('wearables/sync', { deviceType, metrics }),
  addHeartRate: (deviceType, bpm, type) => api.post('wearables/heart-rate', { deviceType, bpm, type }),
  addSleepData: (deviceType, sleepData) => api.post('wearables/sleep', { deviceType, sleepData }),
  getDashboard: () => api.get('wearables/dashboard'),
  generateDemoData: (deviceType) => api.post('wearables/demo-data', { deviceType })
};

export const adminService = {
  // Stats
  getStats: () => api.get('admin/stats'),

  // Users
  getUsers: (params) => api.get('admin/users', { params }),
  getUserDetails: (id) => api.get(`admin/users/${id}`),
  updateUserStatus: (id, isActive) => api.patch(`admin/users/${id}/status`, { isActive }),
  impersonateUser: (id) => api.post(`admin/users/${id}/impersonate`),

  // Reports
  getReports: (params) => api.get('admin/reports', { params }),

  // Deficiency Rules
  getDeficiencyRules: () => api.get('admin/deficiency-rules'),
  createDeficiencyRule: (data) => api.post('admin/deficiency-rules', data),
  updateDeficiencyRule: (id, data) => api.put(`admin/deficiency-rules/${id}`, data),
  deleteDeficiencyRule: (id) => api.delete(`admin/deficiency-rules/${id}`),

  // Supplements
  getSupplements: () => api.get('admin/supplements'),
  createSupplement: (data) => api.post('admin/supplements', data),
  updateSupplement: (id, data) => api.put(`admin/supplements/${id}`, data),
  deleteSupplement: (id) => api.delete(`admin/supplements/${id}`),

  // Diet Plans
  getDietPlans: (params) => api.get('admin/diet-plans', { params }),
  createDietPlan: (data) => api.post('admin/diet-plans', data),
  updateDietPlan: (id, data) => api.put(`admin/diet-plans/${id}`, data),
  approveDietPlan: (id, status) => api.patch(`admin/diet-plans/${id}/approve`, { status }),
  deleteDietPlan: (id) => api.delete(`admin/diet-plans/${id}`),

  // Doctors Management
  getDoctors: (params) => api.get('admin/doctors', { params }),
  createDoctor: (data) => api.post('admin/doctors', data),
  updateDoctor: (id, data) => api.put(`admin/doctors/${id}`, data),
  approveDoctor: (id) => api.patch(`admin/doctors/${id}/approve`),
  rejectDoctor: (id, reason) => api.patch(`admin/doctors/${id}/reject`, { reason }),
  deleteDoctor: (id) => api.delete(`admin/doctors/${id}`),
  toggleDoctorVisibility: (id) => api.patch(`admin/doctors/${id}/visibility`),
  getDoctorScheduleOverview: (id) => api.get(`admin/doctors/${id}/schedule-overview`),

  // Food Cache (Global Intelligence)
  getFoodCache: (params) => api.get('admin/food-cache', { params }),
  createFoodCache: (data) => api.post('admin/food-cache', data),
  bulkCreateFoodCache: (data) => api.post('admin/food-cache/bulk', data),
  updateFoodCache: (id, data) => api.put(`admin/food-cache/${id}`, data),
  deleteFoodCache: (id) => api.delete(`admin/food-cache/${id}`),
  clearFoodCache: () => api.delete('admin/food-cache/clear-all')
};

export const subscriptionService = {
  getSubscription: () => api.get('auth/subscription')
};

export const nutritionService = {
  analyzeFood: (foodDescription) => api.post('nutrition/analyze-food', { foodDescription }),
  logMeal: (mealData) => api.post('nutrition/log-meal', mealData),
  getTodayLogs: () => api.get('nutrition/logs/today'),
  getLogs: (date) => api.get('nutrition/logs', { params: { date } }),
  getDailySummary: (date) => api.get('nutrition/summary/daily', { params: { date } }),
  getWeeklySummary: () => api.get('nutrition/summary/weekly'),
  getGoals: () => api.get('nutrition/goals'),
  updateGoals: (goals) => api.put('nutrition/goals', goals)
};

export const dietRecommendationService = {
  generateDietPlan: (data) => api.post('diet-recommendations/diet-plan/generate', data),
  getActiveDietPlan: (config) => api.get('diet-recommendations/diet-plan/active', config),

  getDietPlanHistory: () => api.get('diet-recommendations/diet-plan/history'),
  getDietPlanById: (planId) => api.get(`diet-recommendations/diet-plan/${planId}`),
  getDietPlanStatus: (planId) => api.get(`diet-recommendations/diet-plan/${planId}/status`),
  rateDietPlan: (planId, rating) => api.post(`diet-recommendations/diet-plan/${planId}/rate`, { rating }),
  generateSupplements: () => api.post('diet-recommendations/supplements/generate'),
  getActiveSupplements: () => api.get('diet-recommendations/supplements/active'),
  trackSupplementUsage: (recommendationId, data) => api.post(`diet-recommendations/supplements/${recommendationId}/track`, data)
};

export default api;
