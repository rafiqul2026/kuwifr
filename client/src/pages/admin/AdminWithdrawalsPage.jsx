// client/src/pages/admin/AdminWithdrawalsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminWithdrawalsPage.module.css';

const STATUS_FILTERS = ['ALL', 'PENDING', 'APPROVED', 'PROCESSED', 'REJECTED'];

const AdminWithdrawalsPage = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  // Modal State
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [modalAction, setModalAction] = useState(null); // 'APPROVE' | 'REJECT' | 'PROCESS' | 'RECONCILE'
  const [actionInput, setActionInput] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // KPI Dashboard Stats
  const [stats, setStats] = useState({
    pendingCount: 0,
    totalGross: 0,
    totalTds: 0,
    totalNetDisbursed: 0,
    totalCount: 0
  });

  const { showNotification } = useNotification ? useNotification() : {
    showNotification: (msg, type) => console.log(`[${type}] ${msg}`)
  };

  // Fetch Payouts and Ledger Data
  const fetchWithdrawals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: String(page || 1),
        limit: '20'
      });

      if (filterStatus && filterStatus !== 'ALL') {
        params.append('status', filterStatus);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      // Fetch list and KPI summary in parallel
      const [response, statsRes] = await Promise.all([
        api.get(`/api/withdrawals/admin/all?${params.toString()}`).catch(() =>
          api.get(`/api/admin/withdrawals?${params.toString()}`)
        ),
        api.get('/api/withdrawals/admin/stats').catch(() =>
          api.get('/api/admin/withdrawals/stats')
        )
      ]);

      if (response && response.data) {
        const rawList = response.data?.data?.withdrawals || response.data?.withdrawals || response.data?.data || [];
        setWithdrawals(Array.isArray(rawList) ? rawList : []);

        const pageData = response.data?.data?.pagination || response.data?.pagination;
        if (pageData) {
          setPagination(pageData);
        } else {
          setPagination({
            page: 1,
            limit: 20,
            total: Array.isArray(rawList) ? rawList.length : 0,
            pages: 1
          });
        }
      }

      if (statsRes?.data?.success) {
        setStats(statsRes.data.data || {});
      }
    } catch (err) {
      console.error('Failed to fetch admin withdrawals:', err);
      setError('Failed to load withdrawals from server.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, page, searchQuery]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  // Modal Handlers
  const openActionModal = (payout, actionType) => {
    setSelectedPayout(payout);
    setModalAction(actionType);
    setActionInput('');
    setActionNotes('');
  };

  const closeActionModal = () => {
    setSelectedPayout(null);
    setModalAction(null);
    setActionInput('');
    setActionNotes('');
  };

  const handleExecuteModalAction = async () => {
    if (!selectedPayout || !modalAction) return;
    const id = selectedPayout._id || selectedPayout.id;
    setIsProcessing(true);

    try {
      let res;
      if (modalAction === 'APPROVE') {
        res = await api.put(`/api/withdrawals/admin/${id}/approve`, { notes: actionNotes || 'Approved by admin' })
          .catch(() => api.put(`/api/admin/withdrawals/${id}/approve`, { notes: actionNotes || 'Approved by admin' }));
        showNotification('Withdrawal approved successfully!', 'success');
      } else if (modalAction === 'REJECT') {
        if (!actionInput.trim()) {
          showNotification('Please provide a reason for rejection', 'warning');
          setIsProcessing(false);
          return;
        }
        res = await api.put(`/api/withdrawals/admin/${id}/reject`, { reason: actionInput.trim() })
          .catch(() => api.put(`/api/admin/withdrawals/${id}/reject`, { reason: actionInput.trim() }));
        showNotification('Withdrawal rejected and amount refunded to wallet', 'success');
      } else if (modalAction === 'PROCESS') {
        if (!actionInput.trim()) {
          showNotification('Please enter Bank UTR / IMPS Reference Number', 'warning');
          setIsProcessing(false);
          return;
        }
        res = await api.put(`/api/withdrawals/admin/${id}/process`, {
          utrNumber: actionInput.trim(),
          paymentMethod: 'IMPS_BANK_TRANSFER'
        }).catch(() => api.put(`/api/admin/withdrawals/${id}/process`, {
          utrNumber: actionInput.trim(),
          paymentMethod: 'IMPS_BANK_TRANSFER'
        }));
        showNotification('Payout confirmed and marked as PROCESSED', 'success');
      }

      closeActionModal();
      fetchWithdrawals();
    } catch (err) {
      const msg = err.response?.data?.message || 'Operation failed. Please retry.';
      showNotification(msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch ((status || '').toUpperCase()) {
      case 'PROCESSED':
      case 'PAID':
        return styles.badgeGreen;
      case 'APPROVED':
        return styles.badgeBlue;
      case 'REJECTED':
      case 'CANCELLED':
        return styles.badgeRed;
      default:
        return styles.badgeAmber;
    }
  };

  return (
    <div className={styles.withdrawalsPage}>
      {/* 1. Header Toolbar */}
      <div className={styles.header}>
        <div>
          <div className={styles.statusPill}>
            <span className={styles.pulseDot}></span>
            <span>Cluster Production Database</span>
          </div>
          <h1 className={styles.title}>Withdrawal Management</h1>
          <p className={styles.subtitle}>
            Audit member payouts, automated 5% TDS and 5% Admin deductions, and record bank IMPS references.
          </p>
        </div>

        <button onClick={fetchWithdrawals} className={styles.refreshBtn} title="Sync database">
          ↻ Refresh Ledger
        </button>
      </div>

      {/* 2. KPI Metrics Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Pending Disbursals</span>
          <strong className={`${styles.statValue} ${stats.pendingCount > 0 ? styles.amberText : ''}`}>
            {stats.pendingCount || 0}
          </strong>
          <span className={styles.statHelp}>Requiring admin audit</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Gross Payout Volume</span>
          <strong className={styles.statValue}>
            ₹{(stats.totalGross || 0).toLocaleString('en-IN')}
          </strong>
          <span className={styles.statHelp}>{stats.totalCount || 0} total claims</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Statutory TDS (5%)</span>
          <strong className={`${styles.statValue} ${styles.blueText}`}>
            ₹{(stats.totalTds || 0).toLocaleString('en-IN')}
          </strong>
          <span className={styles.statHelp}>Government tax compliance</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Net Disbursed Amount</span>
          <strong className={`${styles.statValue} ${styles.greenText}`}>
            ₹{(stats.totalNetDisbursed || 0).toLocaleString('en-IN')}
          </strong>
          <span className={styles.statHelp}>Disbursed to members</span>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className={styles.filterStrip}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search by ID, Beneficiary Name, Account #..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className={styles.clearSearch}>✕</button>
          )}
        </div>

        <div className={styles.statusPillsRow}>
          {STATUS_FILTERS.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setFilterStatus(st);
                setPage(1);
              }}
              className={`${styles.filterPill} ${filterStatus === st ? styles.filterPillActive : ''}`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Table Wrapper */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loadingArea}>
            <div className={styles.spinner}></div>
            <p>Syncing banking ledger from cluster...</p>
          </div>
        ) : error ? (
          <div className={styles.errorContainer}>
            <span className={styles.errorIcon}>⚠️</span>
            <p>{error}</p>
            <button onClick={fetchWithdrawals} className={styles.retryBtn}>Retry Connection</button>
          </div>
        ) : withdrawals.length === 0 ? (
          <div className={styles.emptyArea}>
            <span className={styles.emptyIcon}>💳</span>
            <h3>No withdrawal records found</h3>
            <p>There are no payouts under "{filterStatus}" status.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>TRANSACTION #</th>
                <th>BENEFICIARY MEMBER</th>
                <th>GROSS AMOUNT</th>
                <th>ADMIN FEE (5%)</th>
                <th>TDS (5%)</th>
                <th>NET PAYABLE</th>
                <th>STATUS</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => {
                const id = w._id || w.id;
                const status = (w.status || 'PENDING').toUpperCase();
                const b = w.bankDetails || {};
                const holder = w.accountHolderName || b.accountName || b.accountHolder || w.memberName || w.userId?.fullName || 'Member';
                const memberId = w.memberId ? `ID: ${w.memberId}` : w.userId?.memberId ? `ID: ${w.userId.memberId}` : 'Direct';
                const accNumber = w.accountNumber || b.accountNumber || 'A/C Verified';
                const bankTitle = w.bankName || b.bankName || 'IMPS';

                const gross = Number(w.grossAmount || w.amount || 0);
                const adminFee = Number(w.adminCharge !== undefined ? w.adminCharge : Math.round(gross * 0.05));
                const tds = Number(w.tdsAmount !== undefined ? w.tdsAmount : Math.round(gross * 0.05));
                const net = Number(w.netAmount !== undefined ? w.netAmount : (gross - adminFee - tds));

                return (
                  <tr key={id}>
                    <td>
                      <strong className={styles.transId}>{w.withdrawalNumber || w.transactionId || `WTH-${String(id).slice(-6)}`}</strong>
                      <span className={styles.dateText}>
                        {w.createdAt || w.requestedAt ? new Date(w.createdAt || w.requestedAt).toLocaleDateString('en-IN') : 'Recent'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.beneficiaryMeta}>
                        <span className={styles.holderName}>{holder}</span>
                        <span className={styles.memberSub}>{memberId}</span>
                        <span className={styles.bankDetailSnippet}>
                          {bankTitle} • {accNumber}
                        </span>
                      </div>
                    </td>
                    <td>
                      <strong className={styles.grossText}>
                        ₹{gross.toLocaleString('en-IN')}
                      </strong>
                    </td>
                    <td className={styles.deductText}>
                      -₹{adminFee.toLocaleString('en-IN')}
                    </td>
                    <td className={styles.deductText}>
                      -₹{tds.toLocaleString('en-IN')}
                    </td>
                    <td>
                      <strong className={styles.netText}>
                        ₹{net.toLocaleString('en-IN')}
                      </strong>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${getStatusBadgeClass(status)}`}>
                        {status}
                      </span>
                      {w.utrNumber && (
                        <small className={styles.utrLabel}>UTR: {w.utrNumber}</small>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className={styles.actionButtons}>
                        {status === 'PENDING' && (
                          <>
                            <button
                              className={styles.approveBtn}
                              onClick={() => openActionModal(w, 'APPROVE')}
                              title="Approve request"
                            >
                              Approve
                            </button>
                            <button
                              className={styles.rejectBtn}
                              onClick={() => openActionModal(w, 'REJECT')}
                              title="Reject & refund"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {status === 'APPROVED' && (
                          <button
                            className={styles.processBtn}
                            onClick={() => openActionModal(w, 'PROCESS')}
                            title="Enter UTR & mark disbursed"
                          >
                            Disburse
                          </button>
                        )}
                        {status === 'PROCESSED' && (
                          <span style={{ fontSize: '12px', fontWeight: '800', color: '#059669' }}>
                            ✓ Disbursed
                          </span>
                        )}
                        {status === 'REJECTED' && (
                          <span style={{ fontSize: '12px', fontWeight: '800', color: '#dc2626' }}>
                            ✕ Rejected
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 5. Pagination */}
      <div className={styles.pagination}>
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </button>
        <span>
          Page {page} of {pagination.pages || 1} ({pagination.total || withdrawals.length} Total Requests)
        </span>
        <button
          disabled={page >= (pagination.pages || 1)}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>

      {/* 6. Action Modal */}
      {selectedPayout && modalAction && (
        <div className={styles.modalOverlay} onClick={() => !isProcessing && closeActionModal()}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>
                  {modalAction === 'APPROVE' && `Approve Payout #${selectedPayout.withdrawalNumber}`}
                  {modalAction === 'REJECT' && `Reject Payout #${selectedPayout.withdrawalNumber}`}
                  {modalAction === 'PROCESS' && `Disburse Payout #${selectedPayout.withdrawalNumber}`}
                </h2>
                <p className={styles.modalSub}>
                  Beneficiary: {selectedPayout.accountHolderName || selectedPayout.bankDetails?.accountName || selectedPayout.memberName} | Net: ₹{Number(selectedPayout.netAmount || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                className={styles.closeModalBtn}
                onClick={closeActionModal}
                disabled={isProcessing}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.financialSnapshot}>
                <div>
                  <small>Gross</small>
                  <strong>₹{Number(selectedPayout.grossAmount || selectedPayout.amount).toLocaleString('en-IN')}</strong>
                </div>
                <div>
                  <small>TDS (5%)</small>
                  <span className={styles.redNumber}>-₹{Number(selectedPayout.tdsAmount).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <small>Admin (5%)</small>
                  <span className={styles.redNumber}>-₹{Number(selectedPayout.adminCharge).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <small>Net Payable</small>
                  <strong className={styles.greenNumber}>₹{Number(selectedPayout.netAmount).toLocaleString('en-IN')}</strong>
                </div>
              </div>

              {modalAction === 'REJECT' && (
                <div className={styles.inputGroup}>
                  <label>Reason for Rejection *</label>
                  <input
                    type="text"
                    placeholder="e.g. Incomplete KYC / Invalid Bank Account"
                    value={actionInput}
                    onChange={(e) => setActionInput(e.target.value)}
                    required
                    className={styles.modalInput}
                  />
                  <small className={styles.helperText}>The full amount will be refunded back to the member's wallet balance.</small>
                </div>
              )}

              {modalAction === 'PROCESS' && (
                <div className={styles.inputGroup}>
                  <label>Bank UTR / IMPS Reference Number *</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-HDFC-992104921"
                    value={actionInput}
                    onChange={(e) => setActionInput(e.target.value)}
                    required
                    className={styles.modalInput}
                  />
                </div>
              )}

              <div className={styles.inputGroup}>
                <label>Administrative Audit Note (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="Add optional notes for the financial ledger..."
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className={styles.modalTextarea}
                />
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={closeActionModal}
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteModalAction}
                  disabled={isProcessing}
                  className={`${styles.submitBtn} ${
                    modalAction === 'REJECT' ? styles.submitReject : styles.submitApprove
                  }`}
                >
                  {isProcessing ? 'Processing Transaction...' : 'Confirm Action'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminWithdrawalsPage;