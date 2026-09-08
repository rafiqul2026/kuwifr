// client/src/pages/admin/AdminPackageSalesReport.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './AdminPackageSalesReport.module.css'; // 🌟 1. Import the CSS module

export default function AdminPackageSalesReport() {
  const [sales, setSales] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('ALL');
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });

  const fetchReport = async (page = 1) => {
    try {
      setLoading(true);
      const res = await axios.get('/api/admin/package-sales-report', {
        params: { 
          page, 
          packageName: selectedPackage,
          search 
        },
        withCredentials: true
      });
      if (res.data.success) {
        setSales(res.data.data.sales);
        setStats(res.data.data.statistics);
        setPagination(res.data.data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch package sales report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(1);
  }, [selectedPackage]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchReport(1);
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>📈 Package Sales Report</h1>
          <p className={styles.pageSubtitle}>Track real-time package purchases, member distributions, and tier revenue metrics.</p>
        </div>
        <button 
          onClick={() => fetchReport(pagination.page)}
          className={styles.refreshBtn}
        >
          Refresh Report
        </button>
      </div>

      {/* Statistics Cards */}
      <div className={styles.statsGrid}>
        {stats.map((st, idx) => (
          <div key={idx} className={styles.statCard}>
            <h3 className={styles.statLabel}>{st._id || 'Standard Package'}</h3>
            <p className={styles.statValue}>₹{st.totalRevenue?.toLocaleString()}</p>
            <span className={styles.statBadge}>
              {st.totalUnits} Units Sold
            </span>
          </div>
        ))}
      </div>

      {/* Filters & Search Bar */}
      <div className={styles.filterBar}>
        <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
          <input
            type="text"
            placeholder="Search by Member ID, Name, or Email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          <button type="submit" className={styles.searchBtn}>
            Search
          </button>
        </form>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Filter Package:</span>
          <select
            value={selectedPackage}
            onChange={(e) => setSelectedPackage(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">All Packages</option>
            <option value="Starter Package">Starter Package</option>
            <option value="Growth Package">Growth Package</option>
            <option value="Life Safe Package">Life Safe Package</option>
            <option value="Life Safe Elite Package">Life Safe Elite Package</option>
            <option value="Titanium Package">Titanium Package</option>
          </select>
        </div>
      </div>

      {/* Sales Table */}
      <div className={styles.tableContainer}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead className={styles.tableHead}>
              <tr>
                <th>Date & Time</th>
                <th>Member Details</th>
                <th>Package Tier</th>
                <th>Product Included</th>
                <th>Amount</th>
                <th>KBP Earned</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className={styles.tableBody}>
              {loading ? (
                <tr>
                  <td colSpan="7" className={styles.emptyState}>Loading report records...</td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan="7" className={styles.emptyState}>No package sales records found.</td>
                </tr>
              ) : (
                sales.map((item) => (
                  <tr key={item._id}>
                    <td className={`${styles.tableCell} ${styles.dateCell}`}>
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td className={styles.tableCell}>
                      <div className={styles.memberName}>{item.customerName || item.userId?.fullName || 'N/A'}</div>
                      <div className={styles.memberId}>{item.userId?.memberId || 'N/A'}</div>
                    </td>
                    <td className={`${styles.tableCell} ${styles.packageName}`}>{item.packageName}</td>
                    <td className={styles.tableCell}>{item.products?.[0]?.name || 'Standard Kit'}</td>
                    <td className={`${styles.tableCell} ${styles.amount}`}>₹{item.totalAmount?.toLocaleString()}</td>
                    <td className={`${styles.tableCell} ${styles.kbpEarned}`}>+{item.kbpGenerated} KBP</td>
                    <td className={styles.tableCell}>
                      <span className={styles.statusBadge}>
                        {item.status || 'COMPLETED'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}