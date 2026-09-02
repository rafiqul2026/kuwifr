import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminNotificationsPage.module.css';

const AdminNotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
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
  });
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/notifications');
      if (response.data.success) {
        setNotifications(response.data.data.notifications || []);
      }
    } catch (error) {
      showNotification('Failed to fetch notifications', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        userIds: selectedUsers.length > 0 ? selectedUsers : null
      };

      await api.post('/api/admin/notifications/send', payload);
      showNotification('Notifications sent successfully', 'success');
      setShowModal(false);
      resetForm();
      fetchNotifications();
    } catch (error) {
      showNotification(error.response?.data?.message || 'Failed to send notifications', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this notification?')) return;
    try {
      await api.delete(`/api/admin/notifications/${id}`);
      showNotification('Notification deleted', 'success');
      fetchNotifications();
    } catch (error) {
      showNotification('Failed to delete notification', 'error');
    }
  };

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await api.get(`/api/admin/users/search?q=${query}`);
      if (response.data.success) {
        setSearchResults(response.data.data.users || []);
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const resetForm = () => {
    setFormData({
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
    });
    setSelectedUsers([]);
    setSearchResults([]);
    setUserSearch('');
  };

  const notificationTypes = [
    'SYSTEM', 'FINANCIAL', 'ACHIEVEMENT', 'CAMPAIGN', 'ADMIN', 'SECURITY', 'REMINDER'
  ];

  const priorityTypes = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

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
      <div className={styles.header}>
        <h1>Send Notifications</h1>
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

      <div className={styles.notificationsList}>
        <h2>Sent Notifications</h2>
        {notifications.length === 0 ? (
          <div className={styles.emptyState}>
            <span>📢</span>
            <p>No notifications sent yet</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div key={notif._id} className={styles.notificationItem}>
              <div className={styles.notifIcon} style={{ color: notif.color }}>
                {notif.icon}
              </div>
              <div className={styles.notifContent}>
                <div className={styles.notifHeader}>
                  <span className={styles.notifTitle}>{notif.title}</span>
                  <span 
                    className={styles.notifPriority}
                    style={{ background: notif.priority === 'URGENT' ? '#ef4444' : 
                                      notif.priority === 'HIGH' ? '#f59e0b' : 
                                      notif.priority === 'MEDIUM' ? '#3b82f6' : '#94a3b8' }}
                  >
                    {notif.priority}
                  </span>
                </div>
                <p className={styles.notifMessage}>{notif.message}</p>
                <div className={styles.notifMeta}>
                  <span>Type: {notif.type}</span>
                  <span>Recipients: {notif.recipientCount || 0}</span>
                  <span>Sent: {new Date(notif.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <button 
                className={styles.deleteBtn}
                onClick={() => handleDelete(notif._id)}
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Send Notification</h2>
              <button className={styles.closeModalBtn} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                  >
                    {notificationTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                  >
                    {priorityTypes.map(priority => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Icon</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({...formData, icon: e.target.value})}
                    placeholder="📢"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Color</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.sendEmail}
                      onChange={(e) => setFormData({...formData, sendEmail: e.target.checked})}
                    />
                    Send Email
                  </label>
                </div>
                <div className={styles.formGroup}>
                  <label>Message *</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    rows="3"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Body (Optional)</label>
                  <textarea
                    value={formData.body}
                    onChange={(e) => setFormData({...formData, body: e.target.value})}
                    rows="2"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Action URL</label>
                  <input
                    type="text"
                    value={formData.action}
                    onChange={(e) => setFormData({...formData, action: e.target.value})}
                    placeholder="/member/dashboard"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Action Label</label>
                  <input
                    type="text"
                    value={formData.actionLabel}
                    onChange={(e) => setFormData({...formData, actionLabel: e.target.value})}
                    placeholder="Learn More"
                  />
                </div>
              </div>

              <div className={styles.userSelection}>
                <label>Select Recipients (Optional - leave empty for all members)</label>
                <div className={styles.userSearch}>
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      searchUsers(e.target.value);
                    }}
                  />
                  {searchResults.length > 0 && (
                    <div className={styles.searchResults}>
                      {searchResults.map(user => (
                        <div key={user._id} className={styles.searchResultItem}>
                          <label>
                            <input
                              type="checkbox"
                              checked={selectedUsers.includes(user._id)}
                              onChange={() => toggleUserSelection(user._id)}
                            />
                            {user.fullName} ({user.email})
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedUsers.length > 0 && (
                  <div className={styles.selectedUsers}>
                    <span>{selectedUsers.length} members selected</span>
                    <button 
                      type="button"
                      onClick={() => setSelectedUsers([])}
                      className={styles.clearBtn}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn}>
                  Send Notification
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