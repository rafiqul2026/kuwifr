// client/src/pages/admin/AdminPackageAnalyticsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import styles from './AdminPackageAnalyticsPage.module.css';

const AdminPackageAnalyticsPage = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/package-purchases/admin-analytics');
      if (res.data?.success) {
        setAnalytics(res.data.data);
      } else {
        throw new Error(res.data?.message || 'Failed to fetch analytics');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Currency Formatter
  const formatINR = (val) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Number(val) || 0);

  // Search & Filter Logic
  const filteredPurchases = (analytics?.purchases || []).filter((p) => {
    const matchesSearch =
      (p.memberId && p.memberId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.memberName && p.memberName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.transactionId && p.transactionId.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFilter =
      selectedFilter === 'ALL' || p.packageName?.toUpperCase() === selectedFilter.toUpperCase();

    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.spinner}></div>
        <p>Loading Package Sales Intelligence...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorWrapper}>
        <span>⚠️</span>
        <h3>Error loading package analytics</h3>
        <p>{error}</p>
        <button onClick={fetchAnalytics} className={styles.retryBtn}>Retry</button>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      {/* Top Header */}
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.badgeTag}>ADMIN INTELLIGENCE</span>
          <h1 className={styles.title}>Package Sales & Member Activations</h1>
          <p className={styles.subtitle}>
            Monitor lifetime package volume, revenue collections, and individual member purchase receipts.
          </p>
        </div>
        <button onClick={fetchAnalytics} className={styles.refreshBtn}>
          🔄 Refresh Data
        </button>
      </header>

      {/* KPI Overview Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>TOTAL PACKAGE REVENUE</span>
          <h2 className={styles.kpiValueGreen}>{formatINR(analytics?.totalRevenue)}</h2>
          <span className={styles.kpiSub}>Gross revenue from activations</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>TOTAL PACKAGES SOLD</span>
          <h2 className={styles.kpiValueBlue}>{analytics?.totalUnitsSold || 0} Units</h2>
          <span className={styles.kpiSub}>Total active plan purchases</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>UNIQUE MEMBERS ACTIVATED</span>
          <h2 className={styles.kpiValuePurple}>
            {new Set((analytics?.purchases || []).map((p) => p.memberId)).size}
          </h2>
          <span className={styles.kpiSub}>Individual active IDs</span>
        </div>
      </div>

      {/* Breakdown by Package Tier */}
      <section className={styles.tierSection}>
        <h3 className={styles.sectionHeading}>Sales Breakdown by Package Tier</h3>
        <div className={styles.tierGrid}>
          {Object.entries(analytics?.packageCounts || {}).map(([pkgName, count]) => (
            <div key={pkgName} className={styles.tierCard}>
              <div className={styles.tierIcon}>📦</div>
              <div>
                <strong className={styles.tierName}>{pkgName}</strong>
                <span className={styles.tierCount}>{count} Members Purchased</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Detailed Member Purchases Table */}
      <section className={styles.tableSection}>
        <div className={styles.tableHeaderBar}>
          <h3 className={styles.sectionHeading}>Member Activation Logs ({filteredPurchases.length})</h3>
          
          <div className={styles.controlsRow}>
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search Member ID, Name, or TXN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />

            {/* Filter Dropdown */}
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="ALL">All Packages</option>
              {Object.keys(analytics?.packageCounts || {}).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.tableResponsiveWrapper}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Member ID</th>
                <th>Member Name</th>
                <th>Package Purchased</th>
                <th>Selected Product</th>
                <th>Amount Paid</th>
                <th>Payment Mode</th>
                <th>Transaction ID</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan="9" className={styles.noData}>
                    No package sales found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <div className={styles.dateCol}>
                        <span>{new Date(item.activationDate || item.createdAt).toLocaleDateString('en-IN')}</span>
                        <small>{new Date(item.activationDate || item.createdAt).toLocaleTimeString('en-IN')}</small>
                      </div>
                    </td>
                    <td>
                      <span className={styles.memberIdBadge}>{item.memberId}</span>
                    </td>
                    <td className={styles.nameCol}>{item.memberName}</td>
                    <td>
                      <span className={styles.packageNamePill}>{item.packageName}</span>
                    </td>
                    <td>
                      <span className={styles.productNameText}>
                        {item.selectedProduct?.name || 'Direct Package'}
                      </span>
                    </td>
                    <td>
                      <strong className={styles.amountCol}>{formatINR(item.packagePrice)}</strong>
                    </td>
                    <td>
                      <span className={styles.paymentMethodTag}>{item.paymentMethod || 'UPI'}</span>
                    </td>
                    <td>
                      <code className={styles.txnCode}>{item.transactionId}</code>
                    </td>
                    <td>
                      <span className={styles.statusSuccess}>● {item.paymentStatus || 'COMPLETED'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AdminPackageAnalyticsPage;