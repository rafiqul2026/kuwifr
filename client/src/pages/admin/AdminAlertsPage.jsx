// client/src/pages/admin/AdminAlertsPage.jsx
//
// Personal admin alert inbox — real system events (new signups, pending
// KYC, pending withdrawal requests) for the logged-in admin, modeled after
// PBW Foundation's notification inbox (stat cards + All/Unread/Read tabs +
// search + per-item "View details"). This is distinct from
// AdminNotificationsPage, which is the broadcast composer admins use to
// SEND announcements out to members.
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminAlertsPage.module.css';

const TYPE_ICON_CLASS = {
  SIGNUP: styles.iconGreen,
  KYC: styles.iconAmber,
  WITHDRAWAL: styles.iconTeal
};

const formatRelativeTime = (date) => {
  if (!date) return '';
  const now = new Date();
  const diffMs = now - new Date(date);
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  const months = Math.floor(days / 30);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return `about ${months} month${months === 1 ? '' : 's'} ago`;
};

const AdminAlertsPage = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [alerts, setAlerts] = useState([]);
  const [counts, setCounts] = useState({ all: 0, unread: 0, read: 0 });
  const [latestAt, setLatestAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('ALL'); // ALL | UNREAD | READ
  const [search, setSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [busy, setBusy] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/admin/alerts');
      if (res.data?.success) {
        setAlerts(res.data.data.alerts || []);
        setCounts(res.data.data.counts || { all: 0, unread: 0, read: 0 });
        setLatestAt(res.data.data.latestAt || null);
      }
    } catch (err) {
      console.error('Failed to load admin alerts:', err);
      showNotification('Failed to load alerts.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleMarkAllRead = async () => {
    setBusy(true);
    try {
      await api.post('/api/admin/alerts/mark-all-read');
      await fetchAlerts();
      showNotification('All alerts marked as read.', 'success');
    } catch (err) {
      showNotification('Failed to mark alerts as read.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Clear all alerts from this inbox? This only affects your view — the underlying activity (signups, KYC, withdrawals) is not deleted.')) return;
    setBusy(true);
    try {
      await api.post('/api/admin/alerts/clear-all');
      await fetchAlerts();
      showNotification('Alerts cleared.', 'success');
    } catch (err) {
      showNotification('Failed to clear alerts.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = async (id) => {
    setOpenMenuId(null);
    try {
      await api.post(`/api/admin/alerts/${id}/dismiss`);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      setCounts((prev) => ({
        all: Math.max(0, prev.all - 1),
        unread: prev.unread,
        read: prev.read
      }));
    } catch (err) {
      showNotification('Failed to dismiss alert.', 'error');
    }
  };

  const filtered = useMemo(() => {
    let list = alerts;
    if (tab === 'UNREAD') list = list.filter((a) => !a.read);
    if (tab === 'READ') list = list.filter((a) => a.read);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (a) => a.title.toLowerCase().includes(q) || a.message.toLowerCase().includes(q)
      );
    }
    return list;
  }, [alerts, tab, search]);

  return (
    <div className={styles.alertsPage}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Alerts</h1>
          <p className={styles.pageSubtitle}>Activity and alerts across your admin account.</p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.markReadBtn}
            onClick={handleMarkAllRead}
            disabled={busy || counts.unread === 0}
          >
            ✓✓ Mark all read
          </button>
          <button
            type="button"
            className={styles.clearAllBtn}
            onClick={handleClearAll}
            disabled={busy || counts.all === 0}
          >
            🗑 Clear all
          </button>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconNeutral}`}>🔔</div>
          <div>
            <span className={styles.statLabel}>All</span>
            <div className={styles.statValue}>{counts.all}</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconTeal}`}>🔔</div>
          <div>
            <span className={styles.statLabel}>Unread</span>
            <div className={styles.statValue}>{counts.unread}</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconGreen}`}>✓✓</div>
          <div>
            <span className={styles.statLabel}>Read</span>
            <div className={styles.statValue}>{counts.read}</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconNeutral}`}>ⓘ</div>
          <div>
            <span className={styles.statLabel}>Latest</span>
            <div className={styles.statValueSmall}>{latestAt ? formatRelativeTime(latestAt) : '—'}</div>
          </div>
        </div>
      </div>

      <div className={styles.toolbarRow}>
        <div className={styles.tabGroup}>
          {['ALL', 'UNREAD', 'READ'].map((t) => (
            <button
              key={t}
              type="button"
              className={`${styles.tabBtn} ${tab === t ? styles.tabBtnActive : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'ALL' ? 'All' : t === 'UNREAD' ? 'Unread' : 'Read'}
              {t === 'UNREAD' && counts.unread > 0 && <span className={styles.tabCount}>{counts.unread}</span>}
            </button>
          ))}
        </div>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search alerts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingWrapper}>
          <div className={styles.spinner} />
          <p>Loading alerts...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🔔</span>
          <p>No alerts to show here.</p>
        </div>
      ) : (
        <div className={styles.alertList}>
          {filtered.map((alert) => (
            <div key={alert.id} className={`${styles.alertCard} ${!alert.read ? styles.alertCardUnread : ''}`}>
              <div className={`${styles.alertIcon} ${TYPE_ICON_CLASS[alert.type] || styles.iconNeutral}`}>
                {alert.icon}
              </div>
              <div className={styles.alertBody}>
                <div className={styles.alertTop}>
                  <span className={styles.alertTitle}>{alert.title}</span>
                  <span className={styles.alertBadge}>{alert.badge}</span>
                  {!alert.read && <span className={styles.unreadDot} />}
                </div>
                <p className={styles.alertMessage}>{alert.message}</p>
                <span className={styles.alertTime}>{formatRelativeTime(alert.createdAt)}</span>
                <button type="button" className={styles.viewDetailsLink} onClick={() => navigate(alert.link)}>
                  View details →
                </button>
              </div>
              <div className={styles.alertMenuWrap}>
                <button
                  type="button"
                  className={styles.alertMenuBtn}
                  onClick={() => setOpenMenuId(openMenuId === alert.id ? null : alert.id)}
                >
                  ⋮
                </button>
                {openMenuId === alert.id && (
                  <div className={styles.alertMenuDropdown}>
                    <button type="button" onClick={() => handleDismiss(alert.id)}>
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminAlertsPage;
