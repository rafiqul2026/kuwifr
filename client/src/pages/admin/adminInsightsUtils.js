// client/src/pages/admin/adminInsightsUtils.js
// Small helpers shared by the admin insight pages.
import api from '../../services/api';

export const formatINR = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(val) || 0);

export const formatNum = (val) => (Number(val) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export const formatDate = (val, withTime = false) => {
  if (!val) return '—';
  return new Date(val).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {})
  });
};

/** Downloads a CSV from an authenticated admin endpoint (adds format=csv). */
export const downloadCsv = async (url, params, fallbackName) => {
  const res = await api.get(url, { params: { ...params, format: 'csv' }, responseType: 'blob' });
  const disposition = res.headers?.['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const name = match ? match[1] : fallbackName;
  const blobUrl = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
};

export const statusBadgeClass = (styles, status) => {
  const s = String(status || '').toUpperCase();
  if (['ACTIVE', 'APPROVED', 'PROCESSED', 'CREDITED', 'LIFT'].includes(s)) return styles.badgeGreen;
  if (['PENDING', 'PROCESSING', 'INACTIVE', 'PENDING_VERIFICATION', 'DISPATCH'].includes(s)) return styles.badgeAmber;
  if (['REJECTED', 'FAILED', 'CANCELLED', 'SUSPENDED', 'DEACTIVATED', 'BLOCKED', 'REVOKED', 'REVERSED'].includes(s)) return styles.badgeRed;
  return styles.badge;
};
