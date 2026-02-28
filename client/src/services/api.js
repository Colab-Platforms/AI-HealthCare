import axios from 'axios';
import cache from '../utils/cache';

// Determine API URL based on environment
const getApiUrl = () => {
  // If VITE_API_URL is explicitly set, use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Check if we're in production (Vercel, Netlify, etc.)
  const currentHost = window.location.hostname;
  const isProduction =
    import.meta.env.PROD ||
    currentHost.includes('vercel.app') ||
    currentHost.includes('netlify.app') ||
    (currentHost !== 'localhost' && currentHost !== '127.0.0.1');

  // For production, use relative path (same domain)
  if (isProduction) {
    return '/api';
  }

  // For local development only
  if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
    return 'http://localhost:5000/api';
  } else {
    // On mobile or different device in dev, use the same host with port 5000
    return `http://${currentHost}:5000/api`;
  }
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
        localStorage.removeItem('token');
        localStorage.removeItem('user');
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
  uploadReport: (formData) => api.post('/health/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getReports: () => api.get('/health/reports'),
  getReport: (id) => api.get(`/health/reports/${id}`),
  deleteReport: (id) => api.delete(`/health/reports/${id}`),
  getDashboard: () => api.get('/health/dashboard'),
  getHistory: (reportType) => api.get('/health/history', { params: { reportType } }),
  compareReport: (id) => api.get(`/health/reports/${id}/compare`),
  chatAboutReport: (id, message, chatHistory) => api.post(`/health/reports/${id}/chat`, { message, chatHistory }),
  askAI: (data) => api.post('/health/ai-chat', data),
  getMetricInfo: (data) => api.post('/health/metric-info', data),
  getReportComparison: () => api.get('/health/report-comparison')
};

export const authService = {
  register: (data) => api.post('/auth/register', data),
  registerDoctor: (data) => api.post('/auth/register/doctor', data),
  login: (data) => api.post('/auth/login', data)
};

export const notificationService = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count', { skipAutoLogout: true }),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/mark-all-read'),
  deleteOne: (id) => api.delete(`/notifications/${id}`),
  clearAll: () => api.delete('/notifications')
};

export const doctorService = {
  // Public (for patients)
  getAll: (params) => api.get('/doctors', { params }),
  getById: (id) => api.get(`/doctors/${id}`),
  getRecommended: (specializations) => api.get('/doctors/recommended', { params: { specializations } }),
  bookAppointment: (data) => api.post('/doctors/book', data),
  getAppointments: () => api.get('/doctors/appointments'),
  getAppointment: (id) => api.get(`/doctors/appointments/${id}`),

  // Consultation methods
  startConsultation: (appointmentId) => api.post(`/doctors/appointments/${appointmentId}/start`),
  endConsultation: (appointmentId) => api.post(`/doctors/appointments/${appointmentId}/end`),
  getConsultationSummary: (appointmentId) => api.get(`/doctors/appointments/${appointmentId}/summary`),
  submitReview: (appointmentId, reviewData) => api.post(`/doctors/appointments/${appointmentId}/review`, reviewData),
  downloadPrescription: (appointmentId) => api.get(`/doctors/appointments/${appointmentId}/prescription`, { responseType: 'blob' }),

  // Doctor-specific
  getDashboard: () => api.get('/doctors/me/dashboard'),
  getMyProfile: () => api.get('/doctors/me/profile'),
  updateMyProfile: (data) => api.put('/doctors/me/profile', data),
  getMyAppointments: (params) => api.get('/doctors/me/appointments', { params }),
  updateAppointmentStatus: (appointmentId, data) => api.patch(`/doctors/me/appointments/${appointmentId}`, data),
  getPatientProfile: (patientId, appointmentId) => api.get(`/doctors/patient/${patientId}`, { params: { appointmentId } }),
  getDoctorAppointments: (doctorId, status) => api.get(`/doctors/${doctorId}/appointments`, { params: { status } }),

  // Availability Management
  getMyAvailability: () => api.get('/doctors/me/availability'),
  updateMyAvailability: (data) => api.put('/doctors/me/availability', data),
  generateTimeSlots: () => api.post('/doctors/me/generate-slots'),
  getDoctorAvailableSlots: (doctorId, date) => api.get(`/doctors/${doctorId}/available-slots`, { params: { date } }),
  checkSlotAvailability: (doctorId, date, timeSlot) => api.get(`/doctors/${doctorId}/check-slot`, { params: { date, timeSlot } })
};

export const wearableService = {
  connectDevice: (deviceType, deviceName) => api.post('/wearables/connect', { deviceType, deviceName }),
  disconnectDevice: (deviceType) => api.post(`/wearables/disconnect/${deviceType}`),
  getDevices: () => api.get('/wearables/devices'),
  syncMetrics: (deviceType, metrics) => api.post('/wearables/sync', { deviceType, metrics }),
  addHeartRate: (deviceType, bpm, type) => api.post('/wearables/heart-rate', { deviceType, bpm, type }),
  addSleepData: (deviceType, sleepData) => api.post('/wearables/sleep', { deviceType, sleepData }),
  getDashboard: () => api.get('/wearables/dashboard'),
  generateDemoData: (deviceType) => api.post('/wearables/demo-data', { deviceType })
};

export const adminService = {
  // Stats
  getStats: () => api.get('/admin/stats'),

  // Users
  getUsers: (params) => api.get('/admin/users', { params }),
  getUserDetails: (id) => api.get(`/admin/users/${id}`),
  updateUserStatus: (id, isActive) => api.patch(`/admin/users/${id}/status`, { isActive }),

  // Reports
  getReports: (params) => api.get('/admin/reports', { params }),

  // Deficiency Rules
  getDeficiencyRules: () => api.get('/admin/deficiency-rules'),
  createDeficiencyRule: (data) => api.post('/admin/deficiency-rules', data),
  updateDeficiencyRule: (id, data) => api.put(`/admin/deficiency-rules/${id}`, data),
  deleteDeficiencyRule: (id) => api.delete(`/admin/deficiency-rules/${id}`),

  // Supplements
  getSupplements: () => api.get('/admin/supplements'),
  createSupplement: (data) => api.post('/admin/supplements', data),
  updateSupplement: (id, data) => api.put(`/admin/supplements/${id}`, data),
  deleteSupplement: (id) => api.delete(`/admin/supplements/${id}`),

  // Diet Plans
  getDietPlans: (params) => api.get('/admin/diet-plans', { params }),
  createDietPlan: (data) => api.post('/admin/diet-plans', data),
  updateDietPlan: (id, data) => api.put(`/admin/diet-plans/${id}`, data),
  approveDietPlan: (id, status) => api.patch(`/admin/diet-plans/${id}/approve`, { status }),
  deleteDietPlan: (id) => api.delete(`/admin/diet-plans/${id}`),

  // Doctors Management
  getDoctors: (params) => api.get('/admin/doctors', { params }),
  createDoctor: (data) => api.post('/admin/doctors', data),
  updateDoctor: (id, data) => api.put(`/admin/doctors/${id}`, data),
  approveDoctor: (id) => api.patch(`/admin/doctors/${id}/approve`),
  rejectDoctor: (id, reason) => api.patch(`/admin/doctors/${id}/reject`, { reason }),
  deleteDoctor: (id) => api.delete(`/admin/doctors/${id}`),
  toggleDoctorVisibility: (id) => api.patch(`/admin/doctors/${id}/visibility`),
  getDoctorScheduleOverview: (id) => api.get(`/admin/doctors/${id}/schedule-overview`)
};

export const subscriptionService = {
  getSubscription: () => api.get('/auth/subscription')
};

export const nutritionService = {
  analyzeFood: (foodDescription) => api.post('/nutrition/analyze-food', { foodDescription }),
  logMeal: (mealData) => api.post('/nutrition/log-meal', mealData),
  getTodayLogs: () => api.get('/nutrition/logs/today'),
  getDailySummary: (date) => api.get('/nutrition/summary/daily', { params: { date } }),
  getGoals: () => api.get('/nutrition/goals'),
  updateGoals: (goals) => api.put('/nutrition/goals', goals)
};

export default api;
