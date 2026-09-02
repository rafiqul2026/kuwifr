import React, { useState, useEffect } from 'react';
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
  const [error, setError] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentRegistrations, setRecentRegistrations] = useState([]);
  const [topPerformers, setTopPerformers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/reports/admin/dashboard');
      if (response.data.success) {
        const data = response.data.data;
        setStats({
          members: data.members || { total: 0, active: 0, newToday: 0 },
          sales: data.sales || { total: 0, today: 0, thisMonth: 0 },
          income: data.income || { total: 0 },
          withdrawals: data.withdrawals || { pending: 0, total: 0, totalAmount: 0 },
          orders: data.sales?.orders || { total: 0, pending: 0, completed: 0 },
          wallets: data.wallets || { totalIncomeBalance: 0, totalRepurchaseBalance: 0 }
        });
        setRecentOrders(data.recentOrders || []);
        setRecentRegistrations(data.recentRegistrations || []);
        setTopPerformers(data.topPerformers || []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { id: 'members', label: 'Total Members', value: stats.members.total, sub: `${stats.members.active} Active`, icon: '👥', color: '#2563eb' },
    { id: 'sales', label: 'Total Sales', value: `₹${(stats.sales.total || 0).toLocaleString()}`, sub: `Today: ₹${(stats.sales.today || 0).toLocaleString()}`, icon: '💰', color: '#22c55e' },
    { id: 'income', label: 'Total Income Distributed', value: `₹${(stats.income.total || 0).toLocaleString()}`, icon: '📊', color: '#8b5cf6' },
    { id: 'withdrawals', label: 'Pending Withdrawals', value: stats.withdrawals.pending, sub: `Total: ₹${(stats.withdrawals.totalAmount || 0).toLocaleString()}`, icon: '💸', color: '#f59e0b' },
    { id: 'orders', label: 'Total Orders', value: stats.orders.total, sub: `${stats.orders.pending} Pending`, icon: '🛒', color: '#ec4899' },
    { id: 'wallet', label: 'Wallet Balance', value: `₹${(stats.wallets.totalIncomeBalance || 0).toLocaleString()}`, sub: `Repurchase: ₹${(stats.wallets.totalRepurchaseBalance || 0).toLocaleString()}`, icon: '💳', color: '#14b8a6' },
  ];

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <span>⚠️</span>
        <p>{error}</p>
        <button onClick={fetchDashboardData} className={styles.retryBtn}>Retry</button>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h1>Admin Dashboard</h1>
        <p className={styles.subtitle}>Overview of your business</p>
      </div>

      <div className={styles.statsGrid}>
        {statCards.map((card) => (
          <div key={card.id} className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: card.color }}>
              {card.icon}
            </div>
            <div className={styles.statContent}>
              <span className={styles.statLabel}>{card.label}</span>
              <span className={styles.statValue}>{card.value}</span>
              {card.sub && <span className={styles.statSub}>{card.sub}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.bottomSection}>
        <div className={styles.recentOrders}>
          <h2>Recent Orders</h2>
          {recentOrders.length === 0 ? (
            <div className={styles.emptyState}>No recent orders</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Member</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order._id} onClick={() => navigate(`/admin/orders/${order._id}`)}>
                      <td>{order.orderNumber}</td>
                      <td>{order.userId?.fullName || 'N/A'}</td>
                      <td>₹{order.totalAmount?.toLocaleString()}</td>
                      <td>
                        <span className={`${styles.status} ${styles[order.orderStatus?.toLowerCase()]}`}>
                          {order.orderStatus}
                        </span>
                      </td>
                      <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={styles.recentRegistrations}>
          <h2>Recent Registrations</h2>
          {recentRegistrations.length === 0 ? (
            <div className={styles.emptyState}>No recent registrations</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRegistrations.map((user) => (
                    <tr key={user._id} onClick={() => navigate(`/admin/members/${user._id}`)}>
                      <td>{user.fullName}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`${styles.status} ${styles[user.status?.toLowerCase()]}`}>
                          {user.status}
                        </span>
                      </td>
                      <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {topPerformers.length > 0 && (
        <div className={styles.topPerformers}>
          <h2>Top Performers</h2>
          <div className={styles.performerList}>
            {topPerformers.map((performer, index) => (
              <div key={index} className={styles.performerItem}>
                <span className={styles.performerRank}>#{index + 1}</span>
                <span className={styles.performerName}>{performer.user?.fullName || 'Unknown'}</span>
                <span className={styles.performerIncome}>₹{performer.total?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;