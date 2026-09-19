// client/src/pages/admin/AdminPackageAnalyticsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminPackageAnalyticsPage.module.css';

const AdminPackageAnalyticsPage = () => {
  const { showNotification } = useNotification();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  // Client-side pagination — this endpoint already returns every purchase
  // record in one call (no server-side paging), and with 90+ activation
  // requests and growing, rendering the whole filtered list at once made
  // this page an endless scroll. Paginated the already-fetched array
  // instead of touching the endpoint, since search/filter already work the
  // same way.
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [gotoPageInput, setGotoPageInput] = useState('');
  const [proofModalUrl, setProofModalUrl] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  // Native window.confirm()/window.prompt()/alert() were the previous
  // implementation — these are silently blocked or auto-dismissed in many
  // embedded browsers, PWA contexts, and browser-automation tools (a
  // blocked confirm() returns false immediately, making Approve/Reject
  // look completely unresponsive with no error shown). Replaced with
  // proper in-app modals that can never be silently suppressed.
  const [pendingAction, setPendingAction] = useState(null); // { type: 'APPROVE' | 'REJECT', item }
  const [rejectReason, setRejectReason] = useState('');
  const [proofLoadingId, setProofLoadingId] = useState(null);

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

  // Reset to page 1 whenever the search term or filter narrows/changes the
  // result set, so the admin never lands on a stale, now-out-of-range page.
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedFilter]);

  // Currency Formatter
  const formatINR = (val) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Number(val) || 0);

  // Admin Verification Handlers — open an in-app confirmation modal instead
  // of a native dialog (see note above on why window.confirm/prompt failed
  // silently for some admins).
  const openApproveConfirm = (item) => setPendingAction({ type: 'APPROVE', item });
  const openRejectConfirm = (item) => {
    setRejectReason('');
    setPendingAction({ type: 'REJECT', item });
  };
  const closePendingAction = () => {
    if (actionLoadingId) return; // don't let the backdrop dismiss mid-request
    setPendingAction(null);
    setRejectReason('');
  };

  // Payment proof is no longer included in the list payload (it's a
  // base64-encoded screenshot that was making this whole page's initial
  // load pull the full image data for every purchase — see
  // packagePurchase.controller.js#getAdminPackageAnalytics) — fetched here
  // on demand for just the one purchase being viewed.
  const handleViewProof = async (item) => {
    setProofLoadingId(item._id);
    try {
      const res = await api.get(`/api/package-purchases/${item._id}/proof`);
      const proof = res.data?.data?.paymentProof;
      if (proof) {
        setProofModalUrl(proof);
      } else {
        showNotification('No payment proof was uploaded for this purchase.', 'info');
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to load payment proof.', 'error');
    } finally {
      setProofLoadingId(null);
    }
  };

  const executeApprove = async () => {
    const item = pendingAction?.item;
    if (!item) return;

    setActionLoadingId(item._id);
    try {
      const res = await api.patch(`/api/package-purchases/approve/${item._id}`);
      if (res.data?.success) {
        showNotification(res.data.message || 'Member account activated successfully!', 'success');
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
      const res = await api.patch(`/api/package-purchases/reject/${item._id}`, {
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

  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / PAGE_SIZE));
  // Search/filter changing the result set could otherwise strand the admin
  // on a now-empty page (e.g. was on page 4, then a search narrows results
  // to 1 page) — clamp back into range whenever the filtered set shrinks.
  const currentPage = Math.min(page, totalPages);
  const paginatedPurchases = filteredPurchases.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const goToPage = (target) => {
    const clamped = Math.max(1, Math.min(target, totalPages));
    setPage(clamped);
  };

  const handleGotoPageSubmit = (e) => {
    e.preventDefault();
    const target = parseInt(gotoPageInput, 10);
    if (!target || target < 1 || target > totalPages) {
      showNotification(`Enter a page number between 1 and ${totalPages}.`, 'warning');
      return;
    }
    goToPage(target);
    setGotoPageInput('');
  };

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
                <th className={styles.serialCol}>S.No.</th>
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
                  <td colSpan="11" className={styles.noData}>
                    No package sales found matching criteria.
                  </td>
                </tr>
              ) : (
                paginatedPurchases.map((item, index) => (
                  <tr key={item._id}>
                    <td className={styles.serialCol}>
                      {(currentPage - 1) * PAGE_SIZE + index + 1}
                    </td>
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
                      {item.purchaseType === 'UPGRADE' ? (
                        <div className={styles.upgradeCell}>
                          <span className={styles.upgradeTag}>⬆ UPGRADE</span>
                          <span className={styles.upgradePath}>
                            {item.previousPackageName || 'Previous'} → <strong>{item.packageName}</strong>
                          </span>
                        </div>
                      ) : (
                        <span className={styles.packageNamePill}>{item.packageName}</span>
                      )}
                    </td>
                    <td>
                      {(() => {
                        const productLabel = item.selectedProducts?.length > 0
                          ? item.selectedProducts.map((p) => p.name).join(' + ')
                          : (item.selectedProduct?.name || 'Direct Package');
                        return (
                          <span className={styles.productNameText} title={productLabel}>
                            {productLabel}
                          </span>
                        );
                      })()}
                    </td>
                    <td>
                      <strong className={styles.amountCol}>{formatINR(item.packagePrice)}</strong>
                      {item.purchaseType === 'UPGRADE' && (
                        <small className={styles.amountSubNote}>full upgrade price, 0 KBP</small>
                      )}
                    </td>
                    <td>
                      <span className={styles.paymentMethodTag}>{item.paymentMethod || 'UPI'}</span>
                    </td>
                    <td>
                      <code className={styles.txnCode}>{item.transactionId}</code>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleViewProof(item)}
                        className={styles.viewProofBtn}
                        disabled={proofLoadingId === item._id}
                      >
                        {proofLoadingId === item._id ? 'Loading...' : '👁️ View Proof'}
                      </button>
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
                            onClick={() => openApproveConfirm(item)}
                            disabled={actionLoadingId === item._id}
                            className={styles.approveBtn}
                            title="Confirm payment and activate member account"
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

        {filteredPurchases.length > 0 && (
          <div className={styles.paginationRow}>
            <span className={styles.pageInfo}>
              Showing page {currentPage} of {totalPages} ({filteredPurchases.length} requests)
            </span>

            <form onSubmit={handleGotoPageSubmit} className={styles.gotoPageForm}>
              <label htmlFor="packageSalesGotoPage" className={styles.gotoPageLabel}>Go to page</label>
              <input
                id="packageSalesGotoPage"
                type="number"
                min="1"
                max={totalPages}
                value={gotoPageInput}
                onChange={(e) => setGotoPageInput(e.target.value)}
                placeholder={`1-${totalPages}`}
                className={styles.gotoPageInput}
              />
              <button type="submit" className={styles.gotoPageBtn}>Go</button>
            </form>

            <div className={styles.pageBtns}>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => goToPage(currentPage - 1)}
                className={styles.pageBtn}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => goToPage(currentPage + 1)}
                className={styles.pageBtn}
              >
                Next
              </button>
            </div>
          </div>
        )}
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

      {/* Approve / Reject Confirmation Modal */}
      {pendingAction && (
        <div className={styles.proofModalBackdrop} onClick={closePendingAction}>
          <div className={styles.proofModalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.proofModalHeader}>
              <h3>
                {pendingAction.type === 'APPROVE' ? 'Confirm Activation' : 'Reject Payment Request'}
              </h3>
              <button onClick={closePendingAction} className={styles.proofModalClose} disabled={!!actionLoadingId}>
                ✕
              </button>
            </div>

            <div className={styles.confirmModalBody}>
              {pendingAction.type === 'APPROVE' ? (
                <>
                  <p>
                    {pendingAction.item.purchaseType === 'UPGRADE' ? (
                      <>Verify and <strong>UPGRADE</strong> Member <strong>{pendingAction.item.memberId}</strong> to <strong>{pendingAction.item.packageName}</strong>?</>
                    ) : (
                      <>Verify and <strong>ACTIVATE</strong> Member <strong>{pendingAction.item.memberId}</strong> with <strong>{pendingAction.item.packageName}</strong>?</>
                    )}
                  </p>
                  <p className={styles.confirmModalNote}>
                    {pendingAction.item.purchaseType === 'UPGRADE'
                      ? 'This raises their package tier and daily/weekly/monthly binary cap (they paid the full package price). No referral/matching income or extra KBP is credited for an upgrade.'
                      : 'This marks their account ACTIVE, allocates their KBP, and applies their daily binary cap.'}
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

export default AdminPackageAnalyticsPage;