// client/src/components/layout/AdminLayout.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminLayout.module.css';

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { showNotification } = useNotification ? useNotification() : { showNotification: () => {} };

  // Account dropdown menu (Account / Notifications / Change Password / Log
  // out) — previously the sidebar footer had just a single flat Logout
  // button with no way to reach account info or change a password from the
  // admin panel at all.
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    const handleClickOutside = (e) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [accountMenuOpen]);

  // Navigation Items for Admin Suite (Replaced Package Sales & Activations with Package Sales Report)
  const navItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: '📊' },
    { label: 'Members', path: '/admin/members', icon: '👥' },
    { label: 'Packages', path: '/admin/packages', icon: '📦' },
    { label: 'Package Sales Report', path: '/admin/package-sales-report', icon: '📈' },
    { label: 'Products', path: '/admin/products', icon: '🛍️' },
    { label: 'Orders', path: '/admin/orders', icon: '🛒' },
    { label: 'Transactions', path: '/admin/transactions', icon: '💳' },
    { label: 'Withdrawals', path: '/admin/withdrawals', icon: '💸' },
    { label: 'Income History', path: '/admin/income-history', icon: '🧾' },
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

  // Change Password (OTP) — real flow against the existing
  // /api/auth/change-password/send-otp + /verify endpoints, which already
  // worked server-side but had no working admin (or member) UI wired to
  // them anywhere in the app until now.
  const [pwStep, setPwStep] = useState('form'); // 'form' | 'otp'
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwOtp, setPwOtp] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);

  const resetPasswordModal = () => {
    setShowPasswordModal(false);
    setPwStep('form');
    setPwCurrent('');
    setPwNew('');
    setPwOtp('');
  };

  const handleSendPasswordOtp = async (e) => {
    e.preventDefault();
    if (!pwCurrent || !pwNew) {
      showNotification('Enter your current and new password first.', 'warning');
      return;
    }
    if (pwNew.length < 6) {
      showNotification('New password must be at least 6 characters.', 'warning');
      return;
    }
    setPwSubmitting(true);
    try {
      await api.post('/api/auth/change-password/send-otp');
      setPwStep('otp');
      showNotification('OTP sent to your registered email.', 'success');
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to send OTP.', 'error');
    } finally {
      setPwSubmitting(false);
    }
  };

  const handleVerifyPasswordOtp = async (e) => {
    e.preventDefault();
    if (!pwOtp.trim()) {
      showNotification('Enter the OTP sent to your email.', 'warning');
      return;
    }
    setPwSubmitting(true);
    try {
      await api.post('/api/auth/change-password/verify', {
        currentPassword: pwCurrent,
        newPassword: pwNew,
        otp: pwOtp.trim()
      });
      showNotification('Password changed successfully.', 'success');
      resetPasswordModal();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to change password.', 'error');
    } finally {
      setPwSubmitting(false);
    }
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

        {/* Sidebar Footer with Admin Profile & Account Dropdown */}
        <div className={styles.sidebarFooter} ref={accountMenuRef}>
          <button
            type="button"
            className={styles.adminMetaBtn}
            onClick={() => setAccountMenuOpen((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={accountMenuOpen}
          >
            <div className={styles.adminMeta}>
              <div className={styles.adminAvatar}>
                {(user?.fullName || 'A')[0].toUpperCase()}
              </div>
              <div className={styles.adminText}>
                <div className={styles.adminName}>{user?.fullName || 'Super Admin'}</div>
                <span className={styles.adminRole}>Administrator</span>
              </div>
            </div>
            <span className={styles.accountMenuCaret}>{accountMenuOpen ? '▾' : '▴'}</span>
          </button>

          {accountMenuOpen && (
            <div className={styles.accountDropdown}>
              <div className={styles.accountDropdownHeader}>
                <div className={styles.adminAvatar}>{(user?.fullName || 'A')[0].toUpperCase()}</div>
                <div>
                  <div className={styles.accountDropdownName}>{user?.fullName || 'Super Admin'}</div>
                  <div className={styles.accountDropdownEmail}>{user?.email || ''}</div>
                  <span className={styles.accountDropdownBadge}>Global Admin</span>
                </div>
              </div>
              <button
                type="button"
                className={styles.accountMenuItem}
                onClick={() => { setShowAccountModal(true); setAccountMenuOpen(false); }}
              >
                <span className={styles.accountMenuIcon}>👤</span> Account
              </button>
              <button
                type="button"
                className={styles.accountMenuItem}
                onClick={() => { navigate('/admin/notifications'); setAccountMenuOpen(false); }}
              >
                <span className={styles.accountMenuIcon}>🔔</span> Notifications
              </button>
              <button
                type="button"
                className={styles.accountMenuItem}
                onClick={() => { setShowPasswordModal(true); setAccountMenuOpen(false); }}
              >
                <span className={styles.accountMenuIcon}>🔑</span> Change Password
              </button>
              <div className={styles.accountMenuDivider} />
              <button
                type="button"
                className={`${styles.accountMenuItem} ${styles.accountMenuItemDanger}`}
                onClick={handleLogout}
              >
                <span className={styles.accountMenuIcon}>↪️</span> Log out
              </button>
            </div>
          )}
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

      {/* Account Info Modal */}
      {showAccountModal && (
        <div className={styles.accountModalOverlay} onClick={() => setShowAccountModal(false)}>
          <div className={styles.accountModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.accountModalHeader}>
              <h3>Account</h3>
              <button type="button" onClick={() => setShowAccountModal(false)} className={styles.modalCloseBtn}>✕</button>
            </div>
            <div className={styles.accountModalBody}>
              <div className={styles.accountAvatarLarge}>{(user?.fullName || 'A')[0].toUpperCase()}</div>
              <dl className={styles.accountDetailList}>
                <div><dt>Name</dt><dd>{user?.fullName || '—'}</dd></div>
                <div><dt>Email</dt><dd>{user?.email || '—'}</dd></div>
                <div><dt>Role</dt><dd>{user?.role || 'ADMIN'}</dd></div>
                <div><dt>Member ID</dt><dd>{user?.memberId || '—'}</dd></div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className={styles.accountModalOverlay} onClick={resetPasswordModal}>
          <div className={styles.accountModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.accountModalHeader}>
              <h3>Change Password</h3>
              <button type="button" onClick={resetPasswordModal} className={styles.modalCloseBtn}>✕</button>
            </div>
            <div className={styles.accountModalBody}>
              {pwStep === 'form' ? (
                <form onSubmit={handleSendPasswordOtp} className={styles.pwForm}>
                  <label>Current Password</label>
                  <input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} required />
                  <label>New Password</label>
                  <input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} required minLength={6} />
                  <button type="submit" className={styles.pwSubmitBtn} disabled={pwSubmitting}>
                    {pwSubmitting ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyPasswordOtp} className={styles.pwForm}>
                  <p className={styles.pwOtpNote}>Enter the OTP sent to {user?.email}.</p>
                  <label>OTP</label>
                  <input type="text" value={pwOtp} onChange={(e) => setPwOtp(e.target.value)} required autoFocus />
                  <button type="submit" className={styles.pwSubmitBtn} disabled={pwSubmitting}>
                    {pwSubmitting ? 'Verifying...' : 'Confirm Change'}
                  </button>
                  <button type="button" className={styles.pwBackBtn} onClick={() => setPwStep('form')}>← Back</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLayout;