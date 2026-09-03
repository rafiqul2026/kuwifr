// client/src/pages/admin/AdminNotificationsPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminNotificationsPage.module.css';

const NOTIFICATION_TYPES = [
  'SYSTEM',
  'FINANCIAL',
  'ACHIEVEMENT',
  'CAMPAIGN',
  'ADMIN',
  'SECURITY',
  'REMINDER'
];

const PRIORITY_TYPES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const PRESET_ICONS = ['📢', '🎯', '💳', '⭐', '⚠️', '🚀', '🎁', '👑', '🎉', '🔔'];

const COLOR_PRESETS = [
  '#2563eb', // Blue (System)
  '#059669', // Emerald (Financial/Payout)
  '#f59e0b', // Amber (Campaign/Bonanza)
  '#dc2626', // Red (Urgent)
  '#7c3aed', // Purple (Achievement)
  '#0284c7'  // Cyan (Reminders)
];

const INITIAL_FORM = {
  title: '',
  message: '',
  body: '',
  type: 'SYSTEM',
  priority: 'MEDIUM',
  icon: '📢',
  color: '#2563eb',
  action: '',
  actionLabel: 'Learn More',
  sendEmail: true
};

const AdminNotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { showNotification } = useNotification ? useNotification() : {
    showNotification: (msg, type) => console.log(`[${type}] ${msg}`)
  };

  // Resilient multi-route fetcher
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      let res;
      try {
        res = await api.get('/api/admin/notifications');
      } catch {
        try {
          res = await api.get('/api/notifications/admin');
        } catch {
          res = await api.get('/api/notifications');
        }
      }

      if (res.data?.success || Array.isArray(res.data)) {
        const list = res.data?.data?.notifications || res.data?.notifications || (Array.isArray(res.data) ? res.data : []);
        setNotifications(Array.isArray(list) ? list : []);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
      showNotification('Unable to fetch live notification ledger.', 'warning');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time catalog filtering
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        notif.title?.toLowerCase().includes(q) ||
        notif.message?.toLowerCase().includes(q);

      const matchesType = filterType === 'ALL' || notif.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [notifications, searchQuery, filterType]);

  // KPI Metrics
  const stats = useMemo(() => {
    const total = notifications.length;
    const totalRecipients = notifications.reduce((sum, n) => sum + Number(n.recipientCount || 1), 0);
    const urgentCount = notifications.filter((n) => n.priority === 'URGENT' || n.priority === 'HIGH').length;
    const financialCount = notifications.filter((n) => n.type === 'FINANCIAL' || n.type === 'CAMPAIGN').length;
    return { total, totalRecipients, urgentCount, financialCount };
  }, [notifications]);

  // Search Members with debounce
  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      setSearchLoading(true);
      let res;
      try {
        res = await api.get(`/api/admin/notifications/users/search?q=${query.trim()}`);
      } catch {
        try {
          res = await api.get(`/api/notifications/users/search?q=${query.trim()}`);
        } catch {
          res = await api.get(`/api/admin/users/search?q=${query.trim()}`);
        }
      }

      if (res?.data?.success) {
        setSearchResults(res.data.data.users || []);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setSelectedUsers([]);
    setSearchResults([]);
    setUserSearch('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.message) {
      showNotification('Title and message are required.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        userIds: selectedUsers.length > 0 ? selectedUsers : null
      };

      let res;
      try {
        res = await api.post('/api/admin/notifications/send', payload);
      } catch {
        try {
          res = await api.post('/api/notifications/admin/send', payload);
        } catch {
          res = await api.post('/api/notifications', payload);
        }
      }

      showNotification(res.data?.message || 'Notification broadcast sent to members!', 'success');
      setShowModal(false);
      resetForm();
      fetchNotifications();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to send notifications';
      showNotification(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this broadcast notification from member portals?')) return;
    try {
      try {
        await api.delete(`/api/admin/notifications/${id}`);
      } catch {
        await api.delete(`/api/notifications/${id}`);
      }
      showNotification('Notification deleted successfully', 'success');
      setNotifications((prev) => prev.filter((n) => (n._id || n.id) !== id));
    } catch (error) {
      showNotification('Failed to delete notification', 'error');
    }
  };

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'URGENT':
        return { background: '#fee2e2', color: '#dc2626' };
      case 'HIGH':
        return { background: '#fef3c7', color: '#b45309' };
      case 'MEDIUM':
        return { background: '#eff6ff', color: '#1d4ed8' };
      default:
        return { background: '#f1f5f9', color: '#475569' };
    }
  };

  return (
    <div className={styles.notificationsPage}>
      {/* 1. Header Toolbar */}
      <div className={styles.header}>
        <div>
          <div className={styles.statusPill}>
            <span className={styles.pulseDot}></span>
            <span>Cluster Production Dispatcher</span>
          </div>
          <h1 className={styles.title}>Send Notifications & Site Broadcasts</h1>
          <p className={styles.subtitle}>
            Broadcast system announcements, bonanza launches, and financial notices directly to all member portals.
          </p>
        </div>

        <div className={styles.topActions}>
          <button onClick={fetchNotifications} className={styles.refreshBtn} title="Sync database">
            ↻ Refresh
          </button>
          <button
            className={styles.createBtn}
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          >
            + New Notification
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Sent Campaigns</span>
          <strong className={styles.statValue}>{stats.total}</strong>
          <span className={styles.statHelp}>Broadcast alert rows</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Delivered to Members</span>
          <strong className={`${styles.statValue} ${styles.greenText}`}>
            {stats.totalRecipients}
          </strong>
          <span className={styles.statHelp}>Delivered inboxes</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Urgent Priority</span>
          <strong className={`${styles.statValue} ${styles.redText}`}>
            {stats.urgentCount}
          </strong>
          <span className={styles.statHelp}>High-attention banners</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Financial & Bonanza</span>
          <strong className={`${styles.statValue} ${styles.blueText}`}>
            {stats.financialCount}
          </strong>
          <span className={styles.statHelp}>Incentive alerts</span>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className={styles.filterStrip}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search sent alerts by title or message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className={styles.clearSearch}>✕</button>
          )}
        </div>

        <div className={styles.categoryPillsRow}>
          {['ALL', ...NOTIFICATION_TYPES].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`${styles.filterPill} ${filterType === t ? styles.filterPillActive : ''}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Sent Notifications Feed */}
      <div className={styles.feedCard}>
        <div className={styles.feedHeaderRow}>
          <h2>Sent Broadcast Notifications</h2>
          <span>{filteredNotifications.length} alerts matching</span>
        </div>

        {loading ? (
          <div className={styles.loadingArea}>
            <div className={styles.spinner}></div>
            <p>Syncing broadcast feed from cluster...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className={styles.emptyArea}>
            <span className={styles.emptyIcon}>📢</span>
            <h3>No notifications sent yet</h3>
            <p>Broadcast alerts created here appear on all member dashboards instantly.</p>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className={styles.createBtn}
              style={{ marginTop: '12px' }}
            >
              + Broadcast First Notification
            </button>
          </div>
        ) : (
          <div className={styles.notificationsList}>
            {filteredNotifications.map((notif) => {
              const id = notif._id || notif.id;
              const prioStyle = getPriorityStyle(notif.priority);

              return (
                <div
                  key={id}
                  className={styles.notificationItem}
                  style={{ borderLeftColor: notif.color || '#2563eb' }}
                >
                  <div
                    className={styles.notifIconCircle}
                    style={{ backgroundColor: `${notif.color || '#2563eb'}18`, color: notif.color || '#2563eb' }}
                  >
                    {notif.icon || '📢'}
                  </div>

                  <div className={styles.notifContent}>
                    <div className={styles.notifTopMeta}>
                      <div className={styles.notifBadges}>
                        <span className={styles.notifTypeBadge}>{notif.type || 'SYSTEM'}</span>
                        <span className={styles.notifPriority} style={prioStyle}>
                          {notif.priority || 'MEDIUM'}
                        </span>
                        <span className={styles.recipientBadge}>
                          👥 {notif.recipientCount ? `${notif.recipientCount} Recipients (All Members)` : 'Site-Wide'}
                        </span>
                      </div>

                      <span className={styles.notifDate}>
                        {notif.createdAt ? new Date(notif.createdAt).toLocaleString('en-IN') : 'Recent'}
                      </span>
                    </div>

                    <h3 className={styles.notifTitle}>{notif.title}</h3>
                    <p className={styles.notifMessage}>{notif.message}</p>

                    {notif.action && (
                      <div className={styles.actionSnippet}>
                        <small>Direct Link:</small>
                        <code>{notif.action}</code>
                      </div>
                    )}
                  </div>

                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(id)}
                    title="Delete Notification Broadcast"
                  >
                    🗑️
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Create Notification Modal Card */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => !isSubmitting && setShowModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Create & Broadcast Notification</h2>
                <p>Broadcast alerts are visible on the dashboard and announcement bells for all members.</p>
              </div>
              <button
                className={styles.closeModalBtn}
                onClick={() => setShowModal(false)}
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.modalForm}>
              <div className={styles.formGrid}>
                {/* Title */}
                <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                  <label>Notification Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    placeholder="e.g. Goa Leadership Bonanza 2026 Live!"
                  />
                </div>

                {/* Type */}
                <div className={styles.formGroup}>
                  <label>Category Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    {NOTIFICATION_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div className={styles.formGroup}>
                  <label>Priority Level *</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    {PRIORITY_TYPES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Icon Selection with Presets */}
                <div className={styles.formGroup}>
                  <label>Badge Icon</label>
                  <div className={styles.iconSelectionRow}>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      className={styles.iconInput}
                      maxLength={4}
                    />
                    <div className={styles.presetIcons}>
                      {PRESET_ICONS.map((ic) => (
                        <button
                          type="button"
                          key={ic}
                          onClick={() => setFormData({ ...formData, icon: ic })}
                          className={`${styles.presetIconBtn} ${formData.icon === ic ? styles.presetIconActive : ''}`}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Color Preset Palette */}
                <div className={styles.formGroup}>
                  <label>Accent Color</label>
                  <div className={styles.colorSelectionRow}>
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className={styles.colorNativeInput}
                    />
                    <div className={styles.colorPresets}>
                      {COLOR_PRESETS.map((col) => (
                        <button
                          type="button"
                          key={col}
                          onClick={() => setFormData({ ...formData, color: col })}
                          className={`${styles.colorChip} ${formData.color === col ? styles.colorChipActive : ''}`}
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Message Body */}
                <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                  <label>Message Content *</label>
                  <textarea
                    rows="3"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                    placeholder="Write your announcement details here. Members will see this across all devices..."
                  />
                </div>

                {/* Action URL */}
                <div className={styles.formGroup}>
                  <label>Direct Navigation URL</label>
                  <input
                    type="text"
                    value={formData.action}
                    onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                    placeholder="e.g. /member/bonanza or /shop"
                  />
                </div>

                {/* Action Label */}
                <div className={styles.formGroup}>
                  <label>Button Label</label>
                  <input
                    type="text"
                    value={formData.actionLabel}
                    onChange={(e) => setFormData({ ...formData, actionLabel: e.target.value })}
                    placeholder="e.g. View Bonanza"
                  />
                </div>
              </div>

              {/* Specific User Target Selection */}
              <div className={styles.userSelection}>
                <label className={styles.selectionTitle}>
                  Target Recipients (Leave empty to broadcast to ALL members)
                </label>

                <div className={styles.userSearch}>
                  <input
                    type="text"
                    placeholder="Search specific members by name, email, or member ID..."
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      searchUsers(e.target.value);
                    }}
                  />
                  {searchLoading && <span className={styles.searchSpinner}>⏳</span>}

                  {searchResults.length > 0 && (
                    <div className={styles.searchResults}>
                      {searchResults.map((user) => (
                        <div key={user._id} className={styles.searchResultItem}>
                          <label>
                            <input
                              type="checkbox"
                              checked={selectedUsers.includes(user._id)}
                              onChange={() => toggleUserSelection(user._id)}
                            />
                            <span>
                              <strong>{user.fullName}</strong> ({user.email}) - {user.memberId || 'Member'}
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedUsers.length > 0 && (
                  <div className={styles.selectedUsers}>
                    <span>{selectedUsers.length} specific members selected</span>
                    <button
                      type="button"
                      onClick={() => setSelectedUsers([])}
                      className={styles.clearBtn}
                    >
                      Clear selection (Revert to ALL)
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn} disabled={isSubmitting}>
                  {isSubmitting
                    ? 'Broadcasting...'
                    : selectedUsers.length > 0
                    ? `Send to ${selectedUsers.length} Members`
                    : '📢 Broadcast to All Members'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotificationsPage;