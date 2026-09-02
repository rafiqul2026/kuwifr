import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './AdminLayout.module.css';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/admin' },
  { id: 'members', label: 'Members', icon: '👥', path: '/admin/members' },
  { id: 'packages', label: 'Packages', icon: '📦', path: '/admin/packages' },
  { id: 'products', label: 'Products', icon: '🛍️', path: '/admin/products' },
  { id: 'orders', label: 'Orders', icon: '🛒', path: '/admin/orders' },
  { id: 'withdrawals', label: 'Withdrawals', icon: '💸', path: '/admin/withdrawals' },
  { id: 'ranks', label: 'Ranks', icon: '🏆', path: '/admin/ranks' },
  { id: 'funds', label: 'Funds', icon: '🏦', path: '/admin/funds' },
  { id: 'rules', label: 'Business Rules', icon: '📋', path: '/admin/rules' },
  { id: 'reports', label: 'Reports', icon: '📈', path: '/admin/reports' },
  { id: 'campaigns', label: 'Campaigns', icon: '🎯', path: '/admin/campaigns' },
  { id: 'notifications', label: 'Notifications', icon: '🔔', path: '/admin/notifications' },
  { id: 'settings', label: 'Settings', icon: '⚙️', path: '/admin/settings' },
  { id: 'audit', label: 'Audit Logs', icon: '📝', path: '/admin/audit' },
];

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className={styles.adminLayout}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button 
            className={styles.menuBtn} 
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <div className={styles.logo}>KUWIFR Admin</div>
        </div>
        <div className={styles.headerRight}>
          <button 
            className={styles.notificationBtn}
            onClick={() => navigate('/admin/notifications')}
          >
            🔔
          </button>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.fullName || 'Admin'}</span>
            <span className={styles.userRole}>Administrator</span>
          </div>
          <button 
            className={styles.logoutBtn}
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
        <nav className={styles.sidebarNav}>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`${styles.navItem} ${location.pathname === item.path || location.pathname.startsWith(item.path + '/') ? styles.active : ''}`}
              onClick={() => {
                navigate(item.path);
                if (window.innerWidth <= 1024) setSidebarOpen(false);
              }}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className={styles.mainContent}>
        <Outlet />
      </main>

      {/* Mobile Overlay */}
      {!sidebarOpen && window.innerWidth <= 1024 && (
        <div 
          className={styles.overlay}
          onClick={() => setSidebarOpen(true)}
        />
      )}
    </div>
  );
};

export default AdminLayout;