/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, TOKEN_KEY, getStoredToken } from '../lib/api';

const AuthContext = createContext(null);

const getUrlToken = () => {
  if (typeof window === 'undefined') {
    return '';
  }
  return new URLSearchParams(window.location.search).get('token') || '';
};

const persistSessionToken = (token) => {
  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_KEY, token);
};

const persistLoginToken = (token) => {
  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_KEY, token);
};

const clearTokens = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
};

export const AuthProvider = ({ children }) => {
  const initialToken = getUrlToken() || getStoredToken();
  const [token, setToken] = useState(initialToken);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(initialToken));

  useEffect(() => {
    const urlToken = getUrlToken();
    if (!urlToken) {
      return;
    }

    persistSessionToken(urlToken);
    setToken(urlToken);
    const params = new URLSearchParams(window.location.search);
    params.delete('token');
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);
  }, []);

  useEffect(() => {
    const hydrate = async () => {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const data = await apiRequest('/auth/me', { token });
        const userData = data.user;
        if (userData.impersonateBy) {
          userData.isImpersonated = true;
          userData.originalSuperAdminId = userData.originalRole === 'super_admin' ? userData.impersonateBy : null;
        }
        setUser(userData);
      } catch {
        clearTokens();
        setToken('');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    hydrate();
  }, [token]);

  const login = async (email, password) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    if (!data || typeof data !== 'object' || !data.token || !data.user) {
      throw new Error('Unexpected login response from API');
    }
    persistLoginToken(data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    clearTokens();
    setToken('');
    setUser(null);
  };

  const setSessionToken = (nextToken) => {
    persistSessionToken(nextToken);
    setToken(nextToken);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
      setSessionToken,
    }),
    [token, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};