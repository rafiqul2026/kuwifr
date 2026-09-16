// client/src/pages/admin/AdminRepurchaseVerificationPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
// Reuses the exact same admin verification-queue UI already proven for
// Buy Package (Admin > Payment Verification) — same table/proof-modal/
// approve-reject-confirm pattern, just fed from the Repurchase Store's own
// pending queue instead of PackagePurchase.
import styles from './AdminPackageAnalyticsPage.module.css';

const AdminRepurchaseVerificationPage = () => {
  const { showNotification } = useNotification();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [proofModalUrl, setProofModalUrl] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // { type: 'APPROVE' | 'REJECT', item }
  const [rejectReason, setRejectReason] = useState('');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/repurchase/admin-analytics');
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

  const formatINR = (val) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Number(val) || 0);

  const openApproveConfirm = (item) => setPendingAction({ type: 'APPROVE', item });
  const openRejectConfirm = (item) => {
    setRejectReason('');
    setPendingAction({ type: 'REJECT', item });
  };
  const closePendingAction = () => {
    if (actionLoadingId) return;
    setPendingAction(null);
    setRejectReason('');
  };

  const executeApprove = async () => {
    const item = pendingAction?.item;
    if (!item) return;

    setActionLoadingId(item._id);
    try {
      const res = await api.patch(`/api/repurchase/approve/${item._id}`);
      if (res.data?.success) {
        showNotification(res.data.message || 'Repurchase order approved successfully!', 'success');
        setPendingAction(null);
        fetchAnalytics();
      } else {
        showNotification(res.data?.message || 'Failed to approve purchase.', 'error');
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to approve purchase.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const executeReject = async () => {
    const item = pendingAction?.item;
    if (!item) return;

    setActionLoadingId(item._id);
    try {
      const res = await api.patch(`/api/repurchase/reject/${item._id}`, {
        reason: rejectReason.trim() || 'Payment could not be verified in company statement.'
      });
      if (res.data?.success) {
        showNotification(res.data.message || 'Payment request marked as rejected.', 'success');
        setPendingAction(null);
        setRejectReason('');
        fetchAnalytics();
      } else {
        showNotification(res.data?.message || 'Failed to reject purchase.', 'error');
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to reject purchase.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredPurchases = (analytics?.purchases || []).filter((p) => {
    const matchesSearch =
      (p.memberId && p.memberId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.memberName && p.memberName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.transactionId && p.transactionId.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFilter =
      selectedFilter === 'ALL' ||
      (selectedFilter === 'PENDING' && p.paymentStatus === 'PENDING_VERIFICATION') ||
      (selectedFilter === 'COMPLETED' && p.paymentStatus === 'COMPLETED');

    return matchesSearch && matchesFilter;
  });

  if (loading && !analytics) {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.spinner}></div>
        <p>Loading Repurchase Sales Intelligence...</p>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className={styles.errorWrapper}>
        <span>⚠️</span>
        <h3>Error loading repurchase analytics</h3>
        <p>{error}</p>
        <button onClick={fetchAnalytics} className={styles.retryBtn}>Retry</button>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.badgeTag}>ADMIN INTELLIGENCE</span>
          <h1 className={styles.title}>Repurchase Store Payment Verification</h1>
          <p className={styles.subtitle}>
            Review pending Repurchase Store payment proofs, approve orders, and track gross revenue.
          </p>
        </div>
        <button onClick={fetchAnalytics} className={styles.refreshBtn}>
          🔄 Refresh Data
        </button>
      </header>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>TOTAL APPROVED REVENUE</span>
          <h2 className={styles.kpiValueGreen}>{formatINR(analytics?.totalRevenue)}</h2>
          <span className={styles.kpiSub}>Gross credited from repurchase orders</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>APPROVED ORDERS</span>
          <h2 className={styles.kpiValueBlue}>{analytics?.totalOrders || 0} Orders</h2>
          <span className={styles.kpiSub}>Verified repurchase orders</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>PENDING VERIFICATIONS</span>
          <h2 className={styles.kpiValueAmber}>{analytics?.pendingCount || 0} Pending</h2>
          <span className={styles.kpiSub}>Awaiting admin payment review</span>
        </div>
      </div>

      <section className={styles.tableSection}>
        <div className={styles.tableHeaderBar}>
          <h3 className={styles.sectionHeading}>Repurchase Requests ({filteredPurchases.length})</h3>

          <div className={styles.controlsRow}>
            <input
              type="text"
              placeholder="Search Member ID, Name, or UTR..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />

            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="ALL">All Records</option>
              <option value="PENDING">⏳ Pending Verification</option>
              <option value="COMPLETED">✅ Approved</option>
            </select>
          </div>
        </div>

        <div className={styles.tableResponsiveWrapper}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Member</th>
                <th>Products</th>
                <th>Amount</th>
                <th>KBP</th>
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
                    No repurchase requests found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <div className={styles.dateCol}>
                        <span>{new Date(item.createdAt).toLocaleDateString('en-IN')}</span>
                        <small>{new Date(item.createdAt).toLocaleTimeString('en-IN')}</small>
                      </div>
                    </td>
                    <td>
                      <div className={styles.memberCol}>
                        <span className={styles.memberIdBadge}>{item.memberId}</span>
                        <strong className={styles.memberNameText}>{item.memberName}</strong>
                      </div>
                    </td>
                    <td>
                      <span
                        className={styles.productNameText}
                        title={item.items?.map((p) => `${p.name} x${p.qty}`).join(', ')}
                      >
                        {item.items?.length || 0} item(s)
                      </span>
                    </td>
                    <td>
                      <strong className={styles.amountCol}>{formatINR(item.totalKSP)}</strong>
                    </td>
                    <td>
                      <span className={styles.packageNamePill}>⭐ {item.totalKBP?.toLocaleString()} KBP</span>
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
                        <span className={styles.statusSuccess}>● Approved</span>
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
                            onClick={() => openApproveConfirm(item)}
                            disabled={actionLoadingId === item._id}
                            className={styles.approveBtn}
                            title="Confirm payment and process order"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => openRejectConfirm(item)}
                            disabled={actionLoadingId === item._id}
                            className={styles.rejectBtn}
                            title="Reject payment request"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className={styles.completedTag}>
                          {item.paymentStatus === 'COMPLETED' ? 'Processed' : 'Closed'}
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

      {pendingAction && (
        <div className={styles.proofModalBackdrop} onClick={closePendingAction}>
          <div className={styles.proofModalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.proofModalHeader}>
              <h3>
                {pendingAction.type === 'APPROVE' ? 'Confirm Repurchase Order' : 'Reject Payment Request'}
              </h3>
              <button onClick={closePendingAction} className={styles.proofModalClose} disabled={!!actionLoadingId}>
                ✕
              </button>
            </div>

            <div className={styles.confirmModalBody}>
              {pendingAction.type === 'APPROVE' ? (
                <>
                  <p>
                    Verify payment and <strong>PROCESS</strong> the repurchase order for Member{' '}
                    <strong>{pendingAction.item.memberId}</strong>?
                  </p>
                  <p className={styles.confirmModalNote}>
                    This creates the order, credits Self Repurchase Cashback to their Repurchase Wallet,
                    distributes 15-level downline commissions, and uplinks KBP to their Life Tension Free funds.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Enter a rejection reason for Member <strong>{pendingAction.item.memberId}</strong>:
                  </p>
                  <textarea
                    className={styles.confirmModalTextarea}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. UTR does not match any transaction in the company bank statement."
                    rows={4}
                    autoFocus
                  />
                </>
              )}
            </div>

            <div className={styles.confirmModalFooter}>
              <button
                type="button"
                className={styles.confirmModalCancelBtn}
                onClick={closePendingAction}
                disabled={!!actionLoadingId}
              >
                Cancel
              </button>
              <button
                type="button"
                className={pendingAction.type === 'APPROVE' ? styles.confirmModalApproveBtn : styles.confirmModalRejectBtn}
                onClick={pendingAction.type === 'APPROVE' ? executeApprove : executeReject}
                disabled={!!actionLoadingId}
              >
                {actionLoadingId
                  ? 'Processing...'
                  : pendingAction.type === 'APPROVE' ? 'Confirm & Approve' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRepurchaseVerificationPage;
