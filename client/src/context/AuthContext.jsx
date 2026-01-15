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
    localStorage.setItem('user', JSON.stringify(data));
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data);
    return data;
  };

  const register = async (name, email, password, profile = {}) => {
    const { data } = await api.post('/auth/register', { name, email, password, profile });
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
