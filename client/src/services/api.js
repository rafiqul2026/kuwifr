// client/src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach bearer token if present in localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Strict Infinite-Loop Prevention
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Check if error is 401 Unauthorized
    if (error.response?.status === 401) {
      // 1. Never try to refresh if the failed request itself was an auth endpoint
      const isAuthUrl =
        originalRequest.url?.includes('/api/auth/login') ||
        originalRequest.url?.includes('/api/auth/register') ||
        originalRequest.url?.includes('/api/auth/refresh-token') ||
        originalRequest.url?.includes('/api/auth/logout');

      if (isAuthUrl || originalRequest._retry) {
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
        return Promise.reject(error);
      }

      // 2. If already in the process of refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      // 3. If there is no token anywhere, do not attempt to refresh
      const existingToken = localStorage.getItem('token');
      if (!existingToken && !document.cookie.includes('token')) {
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(
          `${api.defaults.baseURL}/api/auth/refresh-token`,
          {},
          { withCredentials: true }
        );

        if (response.data?.success && response.data?.data?.token) {
          const newToken = response.data.data.token;
          localStorage.setItem('token', newToken);
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;

          processQueue(null, newToken);
          isRefreshing = false;
          return api(originalRequest);
        } else {
          throw new Error('Refresh token invalid');
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        isRefreshing = false;
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

export default api;