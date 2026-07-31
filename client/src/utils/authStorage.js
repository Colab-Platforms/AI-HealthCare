// Auth storage that actually honors "Remember me":
// - remembered sessions live in localStorage (survive browser close/reopen)
// - non-remembered sessions live in sessionStorage (cleared when the tab/browser closes)
// The "remember" preference itself always lives in localStorage — it's not
// sensitive, and needs to be readable before we know which storage to use.

const REMEMBER_KEY = 'rememberMe';
const AUTH_KEYS = ['token', 'refreshToken', 'user'];

export const isRememberMe = () => localStorage.getItem(REMEMBER_KEY) !== 'false';

export const setRememberMe = (remember) => {
  localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false');
};

const activeStorage = () => (isRememberMe() ? localStorage : sessionStorage);

export const getToken = () => activeStorage().getItem('token');
export const getRefreshToken = () => activeStorage().getItem('refreshToken');
export const getUserRaw = () => activeStorage().getItem('user');

export const setToken = (token) => activeStorage().setItem('token', token);
export const setRefreshToken = (refreshToken) => activeStorage().setItem('refreshToken', refreshToken);
export const setUserRaw = (userJson) => activeStorage().setItem('user', userJson);

export const setAuthData = ({ token, refreshToken, user }) => {
  const storage = activeStorage();
  if (token) storage.setItem('token', token);
  if (refreshToken) storage.setItem('refreshToken', refreshToken);
  if (user) storage.setItem('user', typeof user === 'string' ? user : JSON.stringify(user));
};

// Clears both storages — safe even if the remember preference changed mid-session
export const clearAuthData = () => {
  AUTH_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
};
