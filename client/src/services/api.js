// client/src/services/api.js
import axios from 'axios';

/**
 * KUWIFR API BASE URL
 *
 * Production:
 *   Frontend and backend share the same Vercel domain.
 *   API requests therefore use /api/... directly.
 *
 * Development:
 *   Vite frontend runs on :5173 and proxies /api to :5000.
 *
 * IMPORTANT:
 *   Application endpoints already contain /api.
 *   Therefore the base URL must NOT contain /api.
 */

const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim();

const API_BASE_URL = import.meta.env.PROD
  ? (
      configuredApiUrl &&
      !configuredApiUrl.includes('localhost') &&
      !configuredApiUrl.includes('127.0.0.1')
        ? configuredApiUrl.replace(/\/+$/, '').replace(/\/api$/, '')
        : ''
    )
  : (
      configuredApiUrl
        ? configuredApiUrl.replace(/\/+$/, '').replace(/\/api$/, '')
        : 'http://localhost:5000'
    );

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});