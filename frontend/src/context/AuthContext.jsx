import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getStoredToken, setStoredToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await api.getMe();
      if (data && (data.user || data.id)) {
        setUser(data.user || data);
      } else {
        setUser(null);
        setStoredToken(null);
      }
    } catch (err) {
      console.warn('Failed to load user profile:', err);
      setUser(null);
      setStoredToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (credentials) => {
    setError(null);
    try {
      const data = await api.login(credentials);
      if (data.token || data.access_token) {
        setStoredToken(data.token || data.access_token, true);
        const userData = data.user || null;
        setUser(userData);
        if (!userData) {
          await fetchUser();
        }
        return { success: true, user: userData };
      }
      throw new Error(data.message || 'Login failed.');
    } catch (err) {
      setError(err.message || 'Login failed.');
      throw err;
    }
  };

  const register = async (credentials) => {
    setError(null);
    try {
      const data = await api.register(credentials);
      if (data.token || data.access_token) {
        setStoredToken(data.token || data.access_token, true);
        const userData = data.user || null;
        setUser(userData);
        if (!userData) {
          await fetchUser();
        }
        // Directly resolve without any profile setup requirement
        return { success: true, user: userData };
      }
      throw new Error(data.message || 'Registration failed.');
    } catch (err) {
      setError(err.message || 'Registration failed.');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.logout().catch(() => {});
    } finally {
      setStoredToken(null);
      setUser(null);
    }
  };

  const refreshBalance = async () => {
    try {
      const data = await api.getMe();
      if (data && (data.user || data.id)) {
        setUser(data.user || data);
      }
    } catch (err) {
      console.warn('Failed to refresh balance:', err);
    }
  };

  const value = {
    user,
    setUser,
    loading,
    error,
    login,
    register,
    logout,
    refreshBalance,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
