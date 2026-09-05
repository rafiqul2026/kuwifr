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
  const [proofModalUrl, setProofModalUrl] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

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

  // Admin Verification Handlers
  const handleApprove = async (id, memberId, pkgName) => {
    const confirmed = window.confirm(
      `Verify and ACTIVATE Member ${memberId} with ${pkgName}?\n\nThis will mark their account ACTIVE, allocate their KBP, and apply their daily binary cap.`
    );
    if (!confirmed) return;

    setActionLoadingId(id);
    try {
      const res = await api.patch(`/api/package-purchases/approve/${id}`);
      if (res.data?.success) {
        alert(res.data.message || 'Member account activated successfully!');
        fetchAnalytics();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve purchase.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id, memberId) => {
    const reason = window.prompt(`Enter rejection reason for Member ${memberId}:`);
    if (reason === null) return;

    setActionLoadingId(id);
    try {
      const res = await api.patch(`/api/package-purchases/reject/${id}`, {
        reason: reason.trim() || 'Payment could not be verified in company statement.'
      });
      if (res.data?.success) {
        alert(res.data.message || 'Payment request marked as rejected.');
        fetchAnalytics();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject purchase.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Search & Filter Logic
  const filteredPurchases = (analytics?.purchases || []).filter((p) => {
    const matchesSearch =
      (p.memberId && p.memberId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.memberName && p.memberName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.transactionId && p.transactionId.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFilter =
      selectedFilter === 'ALL' ||
      (selectedFilter === 'PENDING' && p.paymentStatus === 'PENDING_VERIFICATION') ||
      (selectedFilter === 'COMPLETED' && p.paymentStatus === 'COMPLETED') ||
      p.packageName?.toUpperCase() === selectedFilter.toUpperCase();

    return matchesSearch && matchesFilter;
  });

  if (loading && !analytics) {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.spinner}></div>
        <p>Loading Package Sales Intelligence...</p>
      </div>
    );
  }

  if (error && !analytics) {
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
            Review pending payment proofs, approve activations, and track gross revenue.
          </p>
        </div>
        <button onClick={fetchAnalytics} className={styles.refreshBtn}>
          🔄 Refresh Data
        </button>
      </header>

      {/* KPI Overview Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>TOTAL APPROVED REVENUE</span>
          <h2 className={styles.kpiValueGreen}>{formatINR(analytics?.totalRevenue)}</h2>
          <span className={styles.kpiSub}>Gross credited from activations</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>ACTIVE PACKAGES SOLD</span>
          <h2 className={styles.kpiValueBlue}>{analytics?.totalUnitsSold || 0} Units</h2>
          <span className={styles.kpiSub}>Verified active plan accounts</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>PENDING VERIFICATIONS</span>
          <h2 className={styles.kpiValueAmber}>{analytics?.pendingCount || 0} Pending</h2>
          <span className={styles.kpiSub}>Awaiting admin payment review</span>
        </div>
      </div>

      {/* Breakdown by Package Tier */}
      <section className={styles.tierSection}>
        <h3 className={styles.sectionHeading}>Sales Count by Package Tier</h3>
        <div className={styles.tierGrid}>
          {Object.entries(analytics?.packageCounts || {}).map(([pkgName, count]) => (
            <div key={pkgName} className={styles.tierCard}>
              <div className={styles.tierIcon}>📦</div>
              <div>
                <strong className={styles.tierName}>{pkgName}</strong>
                <span className={styles.tierCount}>{count} Members Activated</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Member Activation Logs Table */}
      <section className={styles.tableSection}>
        <div className={styles.tableHeaderBar}>
          <h3 className={styles.sectionHeading}>Member Activation Requests ({filteredPurchases.length})</h3>
          
          <div className={styles.controlsRow}>
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search Member ID, Name, or UTR..."
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
              <option value="ALL">All Records</option>
              <option value="PENDING">⏳ Pending Verification</option>
              <option value="COMPLETED">✅ Approved & Active</option>
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
                <th>Member</th>
                <th>Package</th>
                <th>Product</th>
                <th>Amount</th>
                <th>Mode</th>
                <th>UTR / Ref ID</th>
                <th>Proof</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan="10" className={styles.noData}>
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
                      <div className={styles.memberCol}>
                        <span className={styles.memberIdBadge}>{item.memberId}</span>
                        <strong className={styles.memberNameText}>{item.memberName}</strong>
                      </div>
                    </td>
                    <td>
                      <span className={styles.packageNamePill}>{item.packageName}</span>
                    </td>
                    <td>
                      <span className={styles.productNameText} title={item.selectedProduct?.name}>
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
                      {item.paymentProof ? (
                        <button
                          type="button"
                          onClick={() => setProofModalUrl(item.paymentProof)}
                          className={styles.viewProofBtn}
                        >
                          👁️ View Proof
                        </button>
                      ) : (
                        <span className={styles.noProofTag}>No Proof</span>
                      )}
                    </td>
                    <td>
                      {item.paymentStatus === 'PENDING_VERIFICATION' && (
                        <span className={styles.statusPending}>⏳ Pending Approval</span>
                      )}
                      {item.paymentStatus === 'COMPLETED' && (
                        <span className={styles.statusSuccess}>● Active</span>
                      )}
                      {item.paymentStatus === 'FAILED' && (
                        <span className={styles.statusFailed}>✕ Rejected</span>
                      )}
                    </td>
                    <td>
                      {item.paymentStatus === 'PENDING_VERIFICATION' ? (
                        <div className={styles.actionBtnGroup}>
                          <button
                            type="button"
                            onClick={() => handleApprove(item._id, item.memberId, item.packageName)}
                            disabled={actionLoadingId === item._id}
                            className={styles.approveBtn}
                            title="Confirm payment and activate member account"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(item._id, item.memberId)}
                            disabled={actionLoadingId === item._id}
                            className={styles.rejectBtn}
                            title="Reject payment request"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className={styles.completedTag}>
                          {item.paymentStatus === 'COMPLETED' ? 'Activated' : 'Closed'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Screenshot Proof Preview Modal */}
      {proofModalUrl && (
        <div className={styles.proofModalBackdrop} onClick={() => setProofModalUrl(null)}>
          <div className={styles.proofModalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.proofModalHeader}>
              <h3>Payment Screenshot Verification Proof</h3>
              <button onClick={() => setProofModalUrl(null)} className={styles.proofModalClose}>
                ✕
              </button>
            </div>
            <div className={styles.proofModalImgWrap}>
              <img src={proofModalUrl} alt="Member Payment Proof" className={styles.proofModalImg} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPackageAnalyticsPage;