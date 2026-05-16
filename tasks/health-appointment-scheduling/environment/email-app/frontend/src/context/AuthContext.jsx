import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/api';

const MOCK_CREDENTIALS = {
  username: 'peter',
  password: 'password123'
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await authAPI.getMe();
        setUser(response.data.data.user);
      } catch (error) {
        // Token invalid or expired, clear and try auto-login
        localStorage.removeItem('token');
        await autoLogin();
      }
    } else {
      // No token, perform auto-login
      await autoLogin();
    }
    setLoading(false);
  };

  const login = async (username, password) => {
    try {
      const response = await authAPI.login(username, password);
      const { access_token, user } = response.data.data;
      localStorage.setItem('token', access_token);
      setUser(user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  };

  const autoLogin = async () => {
    try {
      const response = await authAPI.login(
        MOCK_CREDENTIALS.username,
        MOCK_CREDENTIALS.password
      );
      const { access_token, user } = response.data.data;
      localStorage.setItem('token', access_token);
      setUser(user);
      return { success: true };
    } catch (error) {
      console.error('Auto-login failed:', error);
      return { success: false, error };
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await authAPI.register(username, email, password);
      const { access_token, user } = response.data.data;
      localStorage.setItem('token', access_token);
      setUser(user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
