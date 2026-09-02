// client/src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useNotification } from '../hooks/useNotification';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { showNotification } = useNotification();

  // ============ CHECK AUTH SESSION ============
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');

    // If no token exists, member is unauthenticated
    if (!token && !document.cookie.includes('token')) {
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/api/auth/me');
      if (response.data?.success && response.data?.data?.user) {
        setUser(response.data.data.user);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
      }
    } catch {
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('token');
      localStorage.removeItem('authToken');
    } finally {
      setLoading(false);
    }
  }, []);

  // ============ LOGIN ============
  const login = async (userId, password) => {
    try {
      const response = await api.post('/api/auth/login', {
        userId: userId?.trim(),
        email: userId?.trim(),
        password
      });

      if (response.data?.success) {
        const { user: userData, token } = response.data.data;

        if (token) {
          localStorage.setItem('token', token);
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }

        setUser(userData);
        setIsAuthenticated(true);
        setLoading(false);
        showNotification('Login successful!', 'success');
        return { success: true, data: response.data.data };
      }
      return { success: false, message: 'Login failed' };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed. Please try again.';

      if (message.includes('verify your email')) {
        showNotification('Please verify your email before logging in.', 'warning');
      } else if (message.includes('Invalid User ID') || message.includes('Invalid credentials')) {
        showNotification('Invalid User ID or password. Please try again.', 'error');
      } else {
        showNotification(message, 'error');
      }

      return { success: false, message };
    }
  };

  // ============ REGISTER ============
  const register = async (userData) => {
    try {
      const response = await api.post('/api/auth/register', userData);
      if (response.data?.success) {
        const { user: newUser, token } = response.data.data;

        if (token) {
          localStorage.setItem('token', token);
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }

        setUser(newUser);
        setIsAuthenticated(true);
        setLoading(false);
        return { success: true, data: response.data.data };
      }
      return { success: false, message: 'Registration failed' };
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed. Please try again.';

      if (error.response?.data?.errors) {
        const errorMessages = error.response.data.errors.map((e) => e.message).join(', ');
        showNotification(errorMessages, 'error');
      } else if (message.includes('already exists')) {
        showNotification('User already exists with this phone number or email', 'error');
      } else {
        showNotification(message, 'error');
      }

      return { success: false, message };
    }
  };

  // ============ LOGOUT ============
  const logout = async () => {
    try {
      await api.post('/api/auth/logout').catch(() => {});
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('token');
      localStorage.removeItem('authToken');
      delete api.defaults.headers.common['Authorization'];
      showNotification('Logged out successfully', 'info');
    }
  };

  const updateUser = (updatedData) => {
    setUser((prev) => (prev ? { ...prev, ...updatedData } : null));
  };

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    updateUser,
    checkAuth
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;