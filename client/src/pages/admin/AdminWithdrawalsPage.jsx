// client/src/pages/admin/AdminWithdrawalsPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminWithdrawalsPage.module.css';

const STATUS_FILTERS = ['ALL', 'PENDING', 'APPROVED', 'PROCESSED', 'REJECTED'];

const DEFAULT_PAGINATION = {
  page: 1,
  limit: 20,
  total: 0,
  pages: 1
};

const AdminWithdrawalsPage = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [modalAction, setModalAction] = useState(null); // 'APPROVE' | 'REJECT' | 'PROCESS' | 'RECONCILE'
  const [actionInput, setActionInput] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { showNotification } = useNotification ? useNotification() : {
    showNotification: (msg, type) => console.log(`[${type}] ${msg}`)
  };

  const fetchWithdrawals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: String(pagination.page || 1),
        limit: String(pagination.limit || 20),
        ...(filterStatus !== 'ALL' && { status: filterStatus }),
        ...(searchQuery.trim() && { search: searchQuery.trim() })
      });

      let response;
      if (filterStatus === 'PENDING') {
        try {
          response = await api.get(`/api/admin/withdrawals/pending?${params}`);
        } catch {
          response = await api.get(`/api/withdrawals/admin/pending?${params}`);
        }
      } else {
        try {
          response = await api.get(`/api/admin/withdrawals?${params}`);
        } catch {
          try {
            response = await api.get(`/api/withdrawals/admin/all?${params}`);
          } catch {
            response = await api.get(`/api/withdrawals?${params}`);
          }
        }
      }

      if (response && response.data) {
        const rawList = response.data?.data?.withdrawals || response.data?.withdrawals || response.data?.data || [];
        setWithdrawals(Array.isArray(rawList) ? rawList : []);

        const pageData = response.data?.data?.pagination || response.data?.pagination;
        if (pageData && typeof pageData.pages === 'number') {
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
    } catch (err) {
      console.error('Failed to fetch withdrawals:', err);
      setError('Failed to load withdrawals from cloud cluster.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, pagination.page, pagination.limit, searchQuery]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  // Real-time catalog filtering
  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((w) => {
      const q = searchQuery.toLowerCase().trim();
      const holder =
        w.accountHolderName ||
        w.bankDetails?.accountName ||
        w.bankDetails?.accountHolder ||
        w.userId?.fullName ||
        '';
      const num = w.withdrawalNumber || w.transactionId || '';
      const bank = w.bankName || w.bankDetails?.bankName || '';

      const matchesSearch =
        !q ||
        holder.toLowerCase().includes(q) ||
        num.toLowerCase().includes(q) ||
        bank.toLowerCase().includes(q);

      const matchesStatus =
        filterStatus === 'ALL' || (w.status || '').toUpperCase() === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [withdrawals, searchQuery, filterStatus]);

  // Financial KPI Metrics
  const stats = useMemo(() => {
    const totalCount = withdrawals.length;
    const grossTotal = withdrawals.reduce((acc, w) => acc + Number(w.grossAmount || w.amount || 0), 0);
    const tdsTotal = withdrawals.reduce((acc, w) => acc + Number(w.tdsAmount || Math.round(Number(w.grossAmount || w.amount || 0) * 0.05)), 0);
    const netTotal = withdrawals.reduce((acc, w) => acc + Number(w.netAmount || (Number(w.grossAmount || w.amount || 0) * 0.9)), 0);
    const pendingCount = withdrawals.filter((w) => (w.status || '').toUpperCase() === 'PENDING').length;

    return { totalCount, grossTotal, tdsTotal, netTotal, pendingCount };
  }, [withdrawals]);

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
      if (modalAction === 'APPROVE') {
        try {
          await api.put(`/api/admin/withdrawals/${id}/approve`, { notes: actionNotes || 'Approved by admin' });
        } catch {
          await api.put(`/api/withdrawals/admin/${id}/approve`, { notes: actionNotes || 'Approved by admin' });
        }
        showNotification('Withdrawal approved successfully', 'success');
      } else if (modalAction === 'REJECT') {
        if (!actionInput.trim()) {
          showNotification('Please provide a reason for rejection', 'warning');
          setIsProcessing(false);
          return;
        }
        try {
          await api.put(`/api/admin/withdrawals/${id}/reject`, { reason: actionInput });
        } catch {
          await api.put(`/api/withdrawals/admin/${id}/reject`, { reason: actionInput });
        }
        showNotification('Withdrawal rejected and refunded to wallet', 'success');
      } else if (modalAction === 'PROCESS') {
        if (!actionInput.trim()) {
          showNotification('Please enter Bank UTR / IMPS Reference Number', 'warning');
          setIsProcessing(false);
          return;
        }
        try {
          await api.put(`/api/admin/withdrawals/${id}/process`, {
            utrNumber: actionInput.trim(),
            paymentMethod: 'IMPS_BANK_TRANSFER'
          });
        } catch {
          await api.put(`/api/withdrawals/admin/${id}/process`, {
            utrNumber: actionInput.trim(),
            paymentMethod: 'IMPS_BANK_TRANSFER'
          });
        }
        showNotification('Payout confirmed and marked as PROCESSED', 'success');
      } else if (modalAction === 'RECONCILE') {
        if (!actionInput.trim()) {
          showNotification('Please enter the Tax Deducted Reference Number', 'warning');
          setIsProcessing(false);
          return;
        }
        try {
          await api.put(`/api/admin/withdrawals/${id}/reconcile-tds`, {
            referenceNumber: actionInput.trim(),
            notes: actionNotes || 'Statutory TDS Reconciled'
          });
        } catch {
          await api.put(`/api/withdrawals/admin/${id}/reconcile-tds`, {
            referenceNumber: actionInput.trim(),
            notes: actionNotes || 'Statutory TDS Reconciled'
          });
        }
        showNotification('TDS reference reconciled successfully', 'success');
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

  const getStatusBadge = (status) => {
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
          {/* UPDATED: Automated 5% TDS and 5% Admin deductions */}
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
            {stats.pendingCount}
          </strong>
          <span className={styles.statHelp}>Requiring admin audit</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Gross Payout Volume</span>
          <strong className={styles.statValue}>
            ₹{stats.grossTotal.toLocaleString('en-IN')}
          </strong>
          <span className={styles.statHelp}>{stats.totalCount} total withdrawal claims</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Statutory TDS (5%)</span>
          <strong className={`${styles.statValue} ${styles.blueText}`}>
            ₹{stats.tdsTotal.toLocaleString('en-IN')}
          </strong>
          <span className={styles.statHelp}>Government tax compliance</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Net Disbursed Amount</span>
          <strong className={`${styles.statValue} ${styles.greenText}`}>
            ₹{stats.netTotal.toLocaleString('en-IN')}
          </strong>
          <span className={styles.statHelp}>Net payable to members</span>
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
            onChange={(e) => setSearchQuery(e.target.value)}
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
                setPagination((prev) => ({ ...prev, page: 1 }));
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
        ) : filteredWithdrawals.length === 0 ? (
          <div className={styles.emptyArea}>
            <span className={styles.emptyIcon}>💳</span>
            <h3>No withdrawal records found</h3>
            <p>There are no payouts matching the current filter selection.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>TRANSACTION #</th>
                <th>BENEFICIARY MEMBER</th>
                <th>GROSS AMOUNT</th>
                {/* UPDATED TO ADMIN FEE (5%) */}
                <th>ADMIN FEE (5%)</th>
                <th>TDS (5%)</th>
                <th>NET PAYABLE</th>
                <th>STATUS</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredWithdrawals.map((w) => {
                const id = w._id || w.id;
                const status = (w.status || 'PENDING').toUpperCase();
                const b = w.bankDetails || {};
                const holder = w.accountHolderName || b.accountName || b.accountHolder || w.userId?.fullName || 'Active Member';
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
                        {w.createdAt ? new Date(w.createdAt).toLocaleDateString('en-IN') : 'Recent'}
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
                      <span className={`${styles.statusBadge} ${getStatusBadge(status)}`}>
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
                            title="Enter UTR & pay"
                          >
                            Disburse
                          </button>
                        )}
                        {status === 'PROCESSED' && (
                          <button
                            className={styles.reconcileBtn}
                            onClick={() => openActionModal(w, 'RECONCILE')}
                            title="Audit TDS reference"
                          >
                            Reconcile TDS
                          </button>
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
          disabled={pagination.page <= 1}
          onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
        >
          Previous
        </button>
        <span>
          Page {pagination.page || 1} of {pagination.pages || 1} ({pagination.total || withdrawals.length} Total Requests)
        </span>
        <button
          disabled={pagination.page >= pagination.pages}
          onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
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
                  {modalAction === 'RECONCILE' && `Reconcile TDS #${selectedPayout.withdrawalNumber}`}
                </h2>
                <p className={styles.modalSub}>
                  Beneficiary: {selectedPayout.accountHolderName || selectedPayout.bankDetails?.accountName || selectedPayout.bankDetails?.accountHolder || selectedPayout.userId?.fullName} | Net: ₹{Number(selectedPayout.netAmount).toLocaleString('en-IN')}
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
              {/* Financial Snapshot */}
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
                  {/* UPDATED: Admin (5%) */}
                  <small>Admin (5%)</small>
                  <span className={styles.redNumber}>-₹{Number(selectedPayout.adminCharge).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <small>Net Payable</small>
                  <strong className={styles.greenNumber}>₹{Number(selectedPayout.netAmount).toLocaleString('en-IN')}</strong>
                </div>
              </div>

              {/* Dynamic Inputs */}
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

              {modalAction === 'RECONCILE' && (
                <div className={styles.inputGroup}>
                  <label>TDS Challan / Reference Number *</label>
                  <input
                    type="text"
                    placeholder="e.g. TDS-CHALLAN-2026-Q2"
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