// client/src/services/api.js
import axios from 'axios';

// Unified deployment:
// Development -> http://localhost:5000/api
// Production  -> /api (same Vercel domain)
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '' : 'http://localhost:5000');

const api = axios.create({
  baseURL: API_BASE_URL,
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
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor
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

    if (error.response?.status === 401) {
      const requestUrl = originalRequest.url || '';

      const isAuthUrl =
        requestUrl.includes('/auth/login') ||
        requestUrl.includes('/auth/register') ||
        requestUrl.includes('/auth/refresh-token') ||
        requestUrl.includes('/auth/logout');

      if (isAuthUrl || originalRequest._retry) {
        localStorage.removeItem('token');
        delete api.defaults.headers.common.Authorization;

        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${token}`;

            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const existingToken = localStorage.getItem('token');

      if (!existingToken && !document.cookie.includes('token')) {
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const response = await api.post(
          '/auth/refresh-token',
          {},
          { withCredentials: true }
        );

        if (response.data?.success && response.data?.data?.token) {
          const newToken = response.data.data.token;

          localStorage.setItem('token', newToken);

          api.defaults.headers.common.Authorization =
            `Bearer ${newToken}`;

          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization =
            `Bearer ${newToken}`;

          processQueue(null, newToken);

          isRefreshing = false;

          return api(originalRequest);
        }

        throw new Error('Refresh token invalid');
      } catch (refreshErr) {
        processQueue(refreshErr, null);

        isRefreshing = false;

        localStorage.removeItem('token');
        delete api.defaults.headers.common.Authorization;

        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

export default api;