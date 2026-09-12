import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './NotificationsPage.module.css';

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchNotifications();
  }, [pagination.page, filter]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(filter !== 'all' && { read: filter === 'read' ? 'true' : 'false' })
      });

      const response = await api.get(`/api/notifications?${params}`);
      if (response.data.success) {
        setNotifications(response.data.data.notifications || []);
        setUnreadCount(response.data.data.unreadCount || 0);
        setPagination(response.data.data.pagination);
      }
    } catch (error) {
      showNotification('Failed to fetch notifications', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await api.put(`/api/notifications/${id}/read`);
      fetchNotifications();
      showNotification('Notification marked as read', 'success');
    } catch (error) {
      showNotification('Failed to mark as read', 'error');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/api/notifications/read-all');
      showNotification('All notifications marked as read', 'success');
      fetchNotifications();
    } catch (error) {
      showNotification('Failed to mark all as read', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this notification?')) return;

    try {
      await api.delete(`/api/notifications/${id}`);
      showNotification('Notification deleted', 'success');
      fetchNotifications();
    } catch (error) {
      showNotification('Failed to delete notification', 'error');
    }
  };

  // Priority -> PBW status-pill tokens (success/warning/danger/info).
  const getPriorityColor = (priority) => {
    const colors = {
      'LOW': { bg: 'rgba(115, 115, 115, 0.12)', text: '#737373' },
      'MEDIUM': { bg: 'rgba(0, 128, 128, 0.12)', text: '#008080' },
      'HIGH': { bg: 'rgba(217, 119, 6, 0.12)', text: '#d97706' },
      'URGENT': { bg: 'rgba(220, 38, 38, 0.12)', text: '#dc2626' }
    };
    return colors[priority] || colors['LOW'];
  };

  // Notification type -> icon-chip color, mirrors the Dashboard's
  // Announcements widget icon treatment.
  const getTypeChip = (type) => {
    const chips = {
      'SYSTEM': { icon: '📢', bg: 'rgba(99, 102, 241, 0.12)' },
      'FINANCIAL': { icon: '💰', bg: 'rgba(22, 163, 74, 0.12)' },
      'ACHIEVEMENT': { icon: '🏆', bg: 'rgba(253, 153, 17, 0.14)' },
      'CAMPAIGN': { icon: '🎯', bg: 'rgba(0, 128, 128, 0.12)' },
      'ADMIN': { icon: '📋', bg: 'rgba(0, 128, 128, 0.12)' },
      'SECURITY': { icon: '🔒', bg: 'rgba(220, 38, 38, 0.12)' },
      'REMINDER': { icon: '⏰', bg: 'rgba(217, 119, 6, 0.12)' }
    };
    return chips[type] || chips['SYSTEM'];
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className={styles.notificationsPage}>
      <div className={styles.pageHeader}>
        <div className={styles.headerTitleWrap}>
          <span className={styles.pillBadge}>🔔 Notification Center</span>
          <h1 className={styles.pageTitle}>Notifications</h1>
          <p className={styles.pageSubtitle}>Stay updated with your latest activities</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.unreadBadge}>
            {unreadCount} unread
          </span>
          {unreadCount > 0 && (
            <button
              type="button"
              className={styles.markAllBtn}
              onClick={handleMarkAllAsRead}
            >
              Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          type="button"
          className={`${styles.filterBtn} ${filter === 'unread' ? styles.active : ''}`}
          onClick={() => setFilter('unread')}
        >
          Unread
          {unreadCount > 0 && (
            <span className={styles.filterCount}>{unreadCount}</span>
          )}
        </button>
        <button
          type="button"
          className={`${styles.filterBtn} ${filter === 'read' ? styles.active : ''}`}
          onClick={() => setFilter('read')}
        >
          Read
        </button>
      </div>

      {/* Notifications List — icon chip + title + message + timestamp +
          unread indicator, the full-page version of the Dashboard's
          Announcements widget list pattern. */}
      <div className={styles.notificationsList}>
        {notifications.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🔔</div>
            <h3>No notifications</h3>
            <p>You're all caught up! Check back later for updates.</p>
          </div>
        ) : (
          notifications.map((notif) => {
            const priority = getPriorityColor(notif.priority);
            const chip = getTypeChip(notif.type);
            const isUnread = !notif.read;

            return (
              <div
                key={notif._id}
                className={`${styles.notificationItem} ${isUnread ? styles.unread : ''}`}
              >
                <div className={styles.notifIcon} style={{ background: chip.bg }}>
                  {chip.icon}
                </div>
                <div className={styles.notifContent}>
                  <div className={styles.notifHeader}>
                    <div className={styles.notifTitleWrapper}>
                      {isUnread && <span className={styles.unreadDot}></span>}
                      <span className={styles.notifTitle}>{notif.title}</span>
                      <span
                        className={styles.notifPriority}
                        style={{
                          background: priority.bg,
                          color: priority.text
                        }}
                      >
                        {notif.priority}
                      </span>
                    </div>
                    <span className={styles.notifTime}>
                      {formatTime(notif.createdAt)}
                    </span>
                  </div>
                  <p className={styles.notifMessage}>{notif.message}</p>
                  {notif.body && (
                    <p className={styles.notifBody}>{notif.body}</p>
                  )}
                  <div className={styles.notifFooter}>
                    <span className={styles.notifType}>{notif.type}</span>
                    {notif.action && (
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => window.location.href = notif.action}
                      >
                        {notif.actionLabel || 'Learn More'} →
                      </button>
                    )}
                  </div>
                </div>
                <div className={styles.notifActions}>
                  {isUnread && (
                    <button
                      type="button"
                      className={styles.readBtn}
                      onClick={() => handleMarkAsRead(notif._id)}
                      title="Mark as read"
                    >
                      ✓
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(notif._id)}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className={styles.pagination}>
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
          >
            ← Previous
          </button>
          <span className={styles.pageInfo}>
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            type="button"
            disabled={pagination.page >= pagination.pages}
            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
