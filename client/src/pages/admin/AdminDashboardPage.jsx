// client/src/pages/admin/AdminDashboardPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import styles from './AdminDashboardPage.module.css';

const AdminDashboardPage = () => {
  const [stats, setStats] = useState({
    members: { total: 0, active: 0, newToday: 0 },
    sales: { total: 0, today: 0, thisMonth: 0 },
    income: { total: 0 },
    withdrawals: { pending: 0, total: 0, totalAmount: 0 },
    orders: { total: 0, pending: 0, completed: 0 },
    wallets: { totalIncomeBalance: 0, totalRepurchaseBalance: 0 }
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentRegistrations, setRecentRegistrations] = useState([]);
  const [topPerformers, setTopPerformers] = useState([]);
  const [chartTrends, setChartTrends] = useState([]);
  const [timeRange, setTimeRange] = useState('30d');

  const navigate = useNavigate();

  const fetchDashboardData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      setError(null);

      const response = await api.get(`/api/reports/admin/dashboard?range=${timeRange}`);

      if (response.data?.success) {
        const data = response.data.data;
        setStats({
          members: data.members || { total: 0, active: 0, newToday: 0 },
          sales: data.sales || { total: 0, today: 0, thisMonth: 0 },
          income: data.income || { total: 0 },
          withdrawals: data.withdrawals || { pending: 0, total: 0, totalAmount: 0 },
          orders: data.sales?.orders || data.orders || { total: 0, pending: 0, completed: 0 },
          wallets: data.wallets || { totalIncomeBalance: 0, totalRepurchaseBalance: 0 }
        });
        setRecentOrders(data.recentOrders || []);
        setRecentRegistrations(data.recentRegistrations || []);
        setTopPerformers(data.topPerformers || []);
        setChartTrends(data.chartTrends || []);
      }
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
      if (!isManual) {
        setError('Failed to sync live dashboard telemetry. Please verify connection.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => fetchDashboardData(false), 60000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const statCards = [
    {
      id: 'members',
      label: 'Total Network',
      value: (stats.members.total || 0).toLocaleString(),
      sub: `${stats.members.active || 0} Active`,
      trend: stats.members.newToday > 0 ? `+${stats.members.newToday} Today` : null,
      icon: '👥',
      color: '#2563eb',
      bgLight: '#eff6ff',
      link: '/admin/members'
    },
    {
      id: 'sales',
      label: 'Gross Turnover',
      value: `₹${(stats.sales.total || 0).toLocaleString()}`,
      sub: `Today: ₹${(stats.sales.today || 0).toLocaleString()}`,
      trend: stats.sales.thisMonth ? `Month: ₹${stats.sales.thisMonth.toLocaleString()}` : null,
      icon: '💎',
      color: '#059669',
      bgLight: '#ecfdf5',
      link: '/admin/orders'
    },
    {
      id: 'income',
      label: 'Commissions Paid',
      value: `₹${(stats.income.total || 0).toLocaleString()}`,
      sub: 'Direct, Binary & Overrides',
      icon: '📊',
      color: '#7c3aed',
      bgLight: '#f5f3ff',
      link: '/admin/funds'
    },
    {
      id: 'withdrawals',
      label: 'Pending Payouts',
      value: stats.withdrawals.pending || 0,
      sub: `Volume: ₹${(stats.withdrawals.totalAmount || 0).toLocaleString()}`,
      isActionable: (stats.withdrawals.pending || 0) > 0,
      icon: '💸',
      color: '#d97706',
      bgLight: '#fffbeb',
      link: '/admin/withdrawals'
    },
    {
      id: 'orders',
      label: 'Product Orders',
      value: (stats.orders.total || 0).toLocaleString(),
      sub: `${stats.orders.pending || 0} Awaiting Dispatch`,
      icon: '🛍️',
      color: '#db2777',
      bgLight: '#fdf2f8',
      link: '/admin/orders'
    },
    {
      id: 'wallet',
      label: 'Float Reserve',
      value: `₹${(stats.wallets.totalIncomeBalance || 0).toLocaleString()}`,
      sub: `Repurchase: ₹${(stats.wallets.totalRepurchaseBalance || 0).toLocaleString()}`,
      icon: '💳',
      color: '#0d9488',
      bgLight: '#f0fdfa',
      link: '/admin/funds'
    }
  ];

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.spinner}></div>
        <p className={styles.loadingText}>Synchronizing Live Telemetry from Database...</p>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      {/* Header Banner */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>System Intelligence</h1>
          <p className={styles.headerSubtitle}>Real-time performance analytics, distributor nodes & transaction logs.</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.rangeSelector}>
            {['today', '7d', '30d', '1y'].map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`${styles.rangeBtn} ${timeRange === r ? styles.rangeBtnActive : ''}`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchDashboardData(true)}
            className={`${styles.refreshBtn} ${refreshing ? styles.rotating : ''}`}
            title="Refresh Live Data"
          >
            🔄 {refreshing ? 'Syncing...' : 'Sync Data'}
          </button>
          <button onClick={() => navigate('/admin/products')} className={styles.primaryActionBtn}>
            + Add Product
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.alertBanner}>
          <span>⚠️ {error}</span>
          <button onClick={() => fetchDashboardData(true)} className={styles.retryLink}>
            Reconnect
          </button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className={styles.statsGrid}>
        {statCards.map((card) => (
          <div
            key={card.id}
            className={styles.statCard}
            onClick={() => navigate(card.link)}
            role="button"
            tabIndex={0}
          >
            <div className={styles.statTop}>
              <span className={styles.statLabel}>{card.label}</span>
              <div
                className={styles.statIcon}
                style={{ backgroundColor: card.bgLight, color: card.color }}
              >
                {card.icon}
              </div>
            </div>
            <div className={styles.statValue}>{card.value}</div>
            <div className={styles.statBottom}>
              <span className={styles.statSub}>{card.sub}</span>
              {card.trend && <span className={styles.statTrend}>{card.trend}</span>}
              {card.isActionable && <span className={styles.actionChip}>Action Required</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Dynamic Telemetry Sparkline Chart */}
      <div className={styles.chartPanel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>Turnover & Revenue Trajectory</h2>
            <span className={styles.panelCount}>Aggregation Period: {timeRange.toUpperCase()}</span>
          </div>
        </div>

        {chartTrends.length === 0 ? (
          <div className={styles.chartEmpty}>
            <p>No confirmed sales or turnover transactions recorded in this period.</p>
          </div>
        ) : (
          <div className={styles.svgChartContainer}>
            <svg viewBox="0 0 800 200" className={styles.svgChart} preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {(() => {
                const maxVal = Math.max(...chartTrends.map((d) => d.revenue), 100);
                const points = chartTrends
                  .map((d, i) => {
                    const x = (i / Math.max(chartTrends.length - 1, 1)) * 760 + 20;
                    const y = 180 - (d.revenue / maxVal) * 150;
                    return `${x},${y}`;
                  })
                  .join(' ');

                const firstX = 20;
                const lastX = chartTrends.length > 1 ? 780 : 20;
                const areaPoints = `${firstX},190 ${points} ${lastX},190`;

                return (
                  <>
                    <polygon points={areaPoints} fill="url(#chartGrad)" />
                    <polyline fill="none" stroke="#2563eb" strokeWidth="2.5" points={points} />
                  </>
                );
              })()}
            </svg>
          </div>
        )}
      </div>

      {/* Quick Ops Shortcut Bar */}
      <div className={styles.quickOpsBar}>
        <span className={styles.quickOpsTitle}>Quick Ops:</span>
        <button onClick={() => navigate('/admin/members')} className={styles.quickChip}>
          👤 Verify Members
        </button>
        <button onClick={() => navigate('/admin/withdrawals')} className={styles.quickChip}>
          💳 Process Withdrawals
        </button>
        <button onClick={() => navigate('/admin/packages')} className={styles.quickChip}>
          📦 Plan Configuration
        </button>
        <button onClick={() => navigate('/admin/reports')} className={styles.quickChip}>
          📑 Export Reports
        </button>
      </div>

      {/* Dual Section: Orders & Registrations */}
      <div className={styles.dualSection}>
        {/* Recent Orders Panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Store Purchases</h2>
              <span className={styles.panelCount}>{recentOrders.length} Recent Orders</span>
            </div>
            <button onClick={() => navigate('/admin/orders')} className={styles.viewAllBtn}>
              View All →
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🛍️</span>
              <p className={styles.emptyText}>No recent store orders found</p>
              <span className={styles.emptySubText}>New retail checkouts or package activations will appear here</span>
            </div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Buyer</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr
                      key={order._id}
                      onClick={() => navigate(`/admin/orders/${order._id}`)}
                      className={styles.clickableRow}
                    >
                      <td className={styles.monoCell}>{order.orderNumber || order._id.slice(-6)}</td>
                      <td>
                        <div className={styles.userCell}>
                          <span className={styles.avatarInitials}>
                            {(order.userId?.fullName || 'U')[0]}
                          </span>
                          <span>{order.userId?.fullName || 'Member'}</span>
                        </div>
                      </td>
                      <td className={styles.boldCell}>₹{(order.totalAmount || 0).toLocaleString()}</td>
                      <td>
                        <span className={`${styles.badge} ${styles[order.orderStatus?.toLowerCase() || 'pending']}`}>
                          {order.orderStatus || 'PENDING'}
                        </span>
                      </td>
                      <td className={styles.dateCell}>
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Registrations Panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Recent Registrations</h2>
              <span className={styles.panelCount}>{recentRegistrations.length} Recent Signups</span>
            </div>
            <button onClick={() => navigate('/admin/members')} className={styles.viewAllBtn}>
              Manage →
            </button>
          </div>

          {recentRegistrations.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>👤</span>
              <p className={styles.emptyText}>No registrations recorded</p>
            </div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Distributor</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRegistrations.map((user) => (
                    <tr
                      key={user._id}
                      onClick={() => navigate(`/admin/members/${user._id}`)}
                      className={styles.clickableRow}
                    >
                      <td>
                        <div className={styles.userCell}>
                          <span className={styles.avatarInitials}>
                            {(user.fullName || 'U')[0]}
                          </span>
                          <div>
                            <div className={styles.userName}>{user.fullName || 'User'}</div>
                            <small className={styles.memberIdText}>{user.memberId || 'ID Pending'}</small>
                          </div>
                        </div>
                      </td>
                      <td className={styles.secondaryCell}>{user.email}</td>
                      <td>
                        <span className={`${styles.badge} ${styles[user.status?.toLowerCase() || 'inactive']}`}>
                          {user.status || 'INACTIVE'}
                        </span>
                      </td>
                      <td className={styles.dateCell}>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Top Performers Section */}
      {topPerformers.length > 0 && (
        <div className={styles.topPerformersSection}>
          <h2 className={styles.sectionTitle}>🏆 Top Network Earners</h2>
          <div className={styles.performersGrid}>
            {topPerformers.map((item, index) => (
              <div key={index} className={styles.performerCard}>
                <div className={styles.rankPill}>#{index + 1}</div>
                <div className={styles.performerInfo}>
                  <div className={styles.performerName}>{item.user?.fullName || 'Distributor'}</div>
                  <div className={styles.performerIncome}>₹{(item.total || 0).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;