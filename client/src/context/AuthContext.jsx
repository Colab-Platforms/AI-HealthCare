import { createContext, useContext, useState, useEffect, useRef } from 'react';
import api, { fcmService } from '../services/api';
import { requestNotificationPermission, onForegroundMessage } from '../services/firebase';
import toast from 'react-hot-toast';
import { getToken, getUserRaw, getRefreshToken, setAuthData, setRememberMe, clearAuthData } from '../utils/authStorage';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const fcmListenerSet = useRef(false);

  useEffect(() => {
    try {
      const token = getToken();
      const userData = getUserRaw();
      if (token && userData) {
        setUser(JSON.parse(userData));
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        // Refresh FCM token on every app load (handles token rotation after reload)
        setupFCM();
      }
    } catch (error) {
      clearAuthData();
    } finally {
      setLoading(false);
    }
  }, []);

  // Request permission + register FCM token with backend (non-blocking)
  const setupFCM = async () => {
    try {
      const token = await requestNotificationPermission();
      if (!token) return;

      const deviceLabel = `${navigator.platform} — ${navigator.userAgent.split(') ')[0].split('(')[1] || 'Browser'}`;
      await fcmService.registerToken(token, 'web', deviceLabel.slice(0, 100));

      // Store token locally for deregistration on logout
      localStorage.setItem('fcmToken', token);

      // Listen for foreground notifications — only set once
      if (!fcmListenerSet.current) {
        onForegroundMessage((payload) => {
          const { title, body } = payload.notification || {};
          if (title) toast(body ? `${title}: ${body}` : title, { icon: '🔔', duration: 5000 });
        });
        fcmListenerSet.current = true;
      }
    } catch (e) {
      // FCM failure must never block login
      console.warn('FCM setup failed (non-critical):', e.message);
    }
  };

  const login = async (emailOrPhone, password, rememberMe = true) => {
    // Clear any existing session from both storages before deciding where the new one lives
    clearAuthData();
    setRememberMe(rememberMe);

    // Clear service worker cache immediately
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      } catch (err) {
        console.error('Cache clear error:', err);
      }
    }

    const isEmail = emailOrPhone.includes('@');
    const payload = isEmail ? { email: emailOrPhone, password } : { phone: emailOrPhone, password };
    const { data } = await api.post('auth/login', payload, { skipAutoLogout: true });

    setAuthData({ token: data.token, refreshToken: data.refreshToken, user: data });
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;

    // Fetch latest profile data to ensure we have the most recent info
    try {
      const profileResponse = await api.get('auth/profile');
      const userData = { ...data, ...profileResponse.data };
      setAuthData({ user: userData });
      setUser(userData);
      setupFCM(); // non-blocking
      return userData;
    } catch (error) {
      setAuthData({ user: data });
      setUser(data);
      setupFCM(); // non-blocking
      return data;
    }
  };

  const loginWithGoogle = async (accessToken, rememberMe = true) => {
    clearAuthData();
    setRememberMe(rememberMe);

    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      } catch (err) {
        console.error('Cache clear error:', err);
      }
    }

    const { data } = await api.post('auth/google', { accessToken }, { skipAutoLogout: true });

    setAuthData({ token: data.token, refreshToken: data.refreshToken, user: data });
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;

    try {
      const profileResponse = await api.get('auth/profile');
      const userData = { ...data, ...profileResponse.data };
      setAuthData({ user: userData });
      setUser(userData);
      setupFCM();
      return userData;
    } catch (error) {
      setAuthData({ user: data });
      setUser(data);
      setupFCM();
      return data;
    }
  };

  const register = async (name, email, phone, password, profile = {}, nutritionGoal = null, otp = null) => {
    // Clear any existing session — signup always starts a remembered session (no checkbox here)
    clearAuthData();
    setRememberMe(true);

    // Clear service worker cache immediately
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      } catch (err) {
        console.error('Cache clear error:', err);
      }
    }

    const { data } = await api.post('auth/register', {
      name,
      email,
      phone,
      password,
      profile,
      nutritionGoal,
      otp
    });

    // Set new token and user data
    setAuthData({ token: data.token, user: data });
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data);
    setupFCM(); // non-blocking
    return data;
  };

  const registerDoctor = async (doctorData) => {
    // Clear any existing session — signup always starts a remembered session (no checkbox here)
    clearAuthData();
    setRememberMe(true);

    // Clear service worker cache immediately
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      } catch (err) {
        console.error('Cache clear error:', err);
      }
    }

    const { data } = await api.post('auth/register/doctor', doctorData);

    // Set new token and user data
    setAuthData({ token: data.token, user: data });
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data);
    return data;
  };

  const logout = async () => {
    // Clear local state FIRST, synchronously — callers often navigate right
    // after calling logout() without awaiting it (see Layout.jsx), and if we
    // clear `user` only after an awaited network call, there's a window
    // where the route guards still see a logged-in user and bounce between
    // /dashboard and /login a few times before this finishes. The
    // server-side refresh-token invalidation below doesn't need to block
    // the UI from reflecting "logged out" — it's best-effort cleanup
    const refreshToken = getRefreshToken();
    const fcmToken = localStorage.getItem('fcmToken');

    clearAuthData();
    delete api.defaults.headers.common['Authorization'];
    setUser(null);

    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      }).catch(err => console.error('Cache clear error:', err));
    }

    // Fire-and-forget server-side cleanup — doesn't block the UI.
    if (fcmToken) {
      fcmService.deregisterToken(fcmToken).catch(() => {});
      localStorage.removeItem('fcmToken');
    }
    api.post('auth/logout', { refreshToken }).catch(err => console.warn('Logout log failed:', err.message));
  };

  const updateUser = (userData) => {
    setUser(userData);
    setAuthData({ user: userData });
  };

  const refreshUser = async () => {
    try {
      const { data } = await api.get('auth/profile');
      setUser(data);
      setAuthData({ user: data });
      return data;
    } catch (error) {
      console.error('Failed to refresh user:', error);
      return null;
    }
  };

  // Role checks
  const isAdmin = () => user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperAdmin = () => user?.role === 'superadmin';
  const isDoctor = () => user?.role === 'doctor';
  const isPatient = () => user?.role === 'patient' || user?.role === 'client';
  const isDoctorApproved = () => user?.doctorProfile?.approvalStatus === 'approved';
  const isSubscribed = () => user?.subscription?.status === 'active';

  return (
    <AuthContext.Provider value={{
      user,
      login,
      loginWithGoogle,
      register,
      registerDoctor,
      logout,
      updateUser,
      refreshUser,
      loading,
      isAdmin,
      isSuperAdmin,
      isDoctor,
      isPatient,
      isDoctorApproved,
      isSubscribed
    }}>
      {children}
    </AuthContext.Provider>
  );
};
