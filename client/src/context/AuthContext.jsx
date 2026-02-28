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
    const isEmail = emailOrPhone.includes('@');
    const payload = isEmail ? { email: emailOrPhone, password } : { phone: emailOrPhone, password };
    const { data } = await api.post('/auth/login', payload);
    localStorage.setItem('token', data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    
    // Fetch latest profile data to ensure we have the most recent info
    try {
      const profileResponse = await api.get('/auth/profile');
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

  const register = async (name, email, password, profile = {}, nutritionGoal = null) => {
    const { data } = await api.post('/auth/register', { 
      name, 
      email, 
      password, 
      profile,
      nutritionGoal 
    });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data);
    return data;
  };

  const registerDoctor = async (doctorData) => {
    const { data } = await api.post('/auth/register/doctor', doctorData);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const refreshUser = async () => {
    try {
      const { data } = await api.get('/auth/profile');
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
