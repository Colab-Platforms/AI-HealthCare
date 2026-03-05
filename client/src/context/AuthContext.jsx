import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  const login = async (emailOrPhone, password) => {
    // Clear any existing data before logging in new user
    localStorage.clear();
    sessionStorage.clear();

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
    const { data } = await api.post('auth/login', payload);

    // Set new token and user data
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;

    // Fetch latest profile data to ensure we have the most recent info
    try {
      const profileResponse = await api.get('auth/profile');
      const userData = { ...data, ...profileResponse.data };
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return userData;
    } catch (error) {
      // Fallback to login response data if profile fetch fails
      localStorage.setItem('user', JSON.stringify(data));
      setUser(data);
      return data;
    }
  };

  const register = async (name, email, phone, password, profile = {}, nutritionGoal = null) => {
    // Clear any existing data before registering new user
    localStorage.clear();
    sessionStorage.clear();

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
      nutritionGoal
    });

    // Set new token and user data
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data);
    return data;
  };

  const registerDoctor = async (doctorData) => {
    // Clear any existing data before registering new doctor
    localStorage.clear();
    sessionStorage.clear();

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
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data);
    return data;
  };

  const logout = () => {
    // Clear all storage to prevent data leakage between users
    localStorage.clear();
    sessionStorage.clear();

    // Clear API headers
    delete api.defaults.headers.common['Authorization'];

    // Clear user state
    setUser(null);

    // Clear service worker cache
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      }).catch(err => console.error('Cache clear error:', err));
    }
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const refreshUser = async () => {
    try {
      const { data } = await api.get('auth/profile');
      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
      return data;
    } catch (error) {
      console.error('Failed to refresh user:', error);
      return null;
    }
  };

  // Role checks
  const isAdmin = () => user?.role === 'admin';
  const isDoctor = () => user?.role === 'doctor';
  const isPatient = () => user?.role === 'patient' || user?.role === 'client';
  const isDoctorApproved = () => user?.doctorProfile?.approvalStatus === 'approved';
  const isSubscribed = () => user?.subscription?.status === 'active';

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      registerDoctor,
      logout,
      updateUser,
      refreshUser,
      loading,
      isAdmin,
      isDoctor,
      isPatient,
      isDoctorApproved,
      isSubscribed
    }}>
      {children}
    </AuthContext.Provider>
  );
};
