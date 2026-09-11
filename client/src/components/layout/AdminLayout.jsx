// client/src/components/layout/AdminLayout.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import styles from './AdminLayout.module.css';

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Navigation Items for Admin Suite (Replaced Package Sales & Activations with Package Sales Report)
  const navItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: '📊' },
    { label: 'Members', path: '/admin/members', icon: '👥' },
    { label: 'Packages', path: '/admin/packages', icon: '📦' },
    { label: 'Package Sales Report', path: '/admin/package-sales-report', icon: '📈' },
    { label: 'Products', path: '/admin/products', icon: '🛍️' },
    { label: 'Orders', path: '/admin/orders', icon: '🛒' },
    { label: 'Withdrawals', path: '/admin/withdrawals', icon: '💸' },
    { label: 'Ranks', path: '/admin/ranks', icon: '🏆' },
    { label: 'Funds', path: '/admin/funds', icon: '🏦' },
    { label: 'Franchise', path: '/admin/franchise', icon: '🏢' },
    { label: 'Reports', path: '/admin/reports', icon: '📑' },
    { label: 'Campaigns', path: '/admin/campaigns', icon: '🎯' },
    { label: 'Alerts', path: '/admin/alerts', icon: '🔔' },
    { label: 'Notifications', path: '/admin/notifications', icon: '📣' },
    { label: 'Settings', path: '/admin/settings', icon: '⚙️' },
    { label: 'Audit Logs', path: '/admin/audit', icon: '🛡️' }
  ];

  // Personal admin alert inbox unread count — powers the header bell badge,
  // matching PBW Foundation's header notification bell. Polled the same
  // way the dashboard polls its own stats.
  const fetchUnreadAlerts = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/alerts');
      if (res.data?.success) {
        setUnreadAlerts(res.data.data?.counts?.unread || 0);
      }
    } catch (err) {
      // Non-critical — the bell just stays at its last known count.
    }
  }, []);

  useEffect(() => {
    fetchUnreadAlerts();
    const interval = setInterval(fetchUnreadAlerts, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadAlerts]);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className={styles.layoutWrapper}>
      {/* Mobile Top Header Bar */}
      <header className={styles.mobileTopBar}>
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={styles.hamburgerBtn}
          aria-label="Toggle Navigation"
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>
        <span className={styles.brandTitle}>KUWIFR Admin</span>
        <div className={styles.mobileHeaderRight}>
          <span className={styles.adminRolePill}>Super Admin</span>
        </div>
      </header>

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className={styles.mobileBackdrop}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Responsive Admin Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.brand}>
            <span className={styles.brandIcon}>🚀</span>
            <span className={styles.brandName}>KUWIFR</span>
          </div>
          <span className={styles.badgePanel}>Admin Suite</span>
        </div>

        <nav className={styles.navMenu}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer with Admin Profile & Logout */}
        <div className={styles.sidebarFooter}>
          <div className={styles.adminMeta}>
            <div className={styles.adminAvatar}>
              {(user?.fullName || 'A')[0].toUpperCase()}
            </div>
            <div className={styles.adminText}>
              <div className={styles.adminName}>{user?.fullName || 'Super Admin'}</div>
              <span className={styles.adminRole}>Administrator</span>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {/* Desktop Sticky Header */}
        <header className={styles.desktopHeader}>
          <div className={styles.headerLeft}>
            <span className={styles.systemStatus}>● Live Cluster</span>
          </div>
          <div className={styles.headerRight}>
            <button
              type="button"
              onClick={() => navigate('/admin/alerts')}
              className={styles.bellButton}
              aria-label="Alerts"
              title="Alerts"
            >
              🔔
              {unreadAlerts > 0 && (
                <span className={styles.bellBadge}>{unreadAlerts > 9 ? '9+' : unreadAlerts}</span>
              )}
            </button>
            <span className={styles.adminEmail}>{user?.email || 'admin@kuwifr.com'}</span>
            <button type="button" onClick={handleLogout} className={styles.desktopLogout}>
              Logout
            </button>
          </div>
        </header>

        {/* Active Route Outlet */}
        <div className={styles.contentBody}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;