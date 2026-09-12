// client/src/pages/admin/AdminIncomeHistoryPage.jsx
//
// Full, filterable income transaction history for the Admin panel — added
// per the user's explicit request (uploaded docx): "PLEASE ADD ALL THE
// TRANSCTION HISTORY IN ADMIN PANEL. ADMIN SHOULD KNOW WHICH MEMBER GET
// REFERRAL INCOME FROM WHICH MEMBER WITH DATE AND TIME. AND ADD THE ALL
// OTHER HISTORY IN ADMIN PANEL."
//
// Backed by GET /api/admin/income/history (server/src/routes/admin.routes.js),
// which returns every IncomeTransaction — any type, not just referral/
// matching — enriched with WHO received it (recipient) and, for Direct/
// Referral and Matching Income specifically, WHICH member generated it, on
// WHICH package, at WHAT KBP value (see IncomeService.enrichTransactionHistory
// on the backend for exactly what's filled in and why older, pre-fix
// matching transactions can't be retroactively attributed to a source
// member).
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminIncomeHistoryPage.module.css';

const TYPE_OPTIONS = [
  { value: '', label: 'All Income Types' },
  { value: 'REFERRAL_INCOME', label: 'Direct / Referral Income' },
  { value: 'MATCHING_INCOME', label: 'Matching Income' },
  { value: 'LEADERSHIP_INCOME_L1', label: 'Leadership Income (L1)' },
  { value: 'LEADERSHIP_INCOME_L2', label: 'Leadership Income (L2)' },
  { value: 'LEADERSHIP_INCOME_L3', label: 'Leadership Income (L3)' },
  { value: 'REPURCHASE_SELF', label: 'Re-purchase (Self)' },
  { value: 'REPURCHASE_DOWNLINE', label: 'Downline Re-purchase' },
  { value: 'RANK_SALARY', label: 'Rank Salary' },
  { value: 'FUND_SALARY', label: 'Fund Salary / Pension' },
  { value: 'FUND_INCOME', label: 'Fund Income' },
  { value: 'FRANCHISE_ACTIVATION_OVERRIDE', label: 'Franchise Activation Override' },
  { value: 'FRANCHISE_KBP_OVERRIDE', label: 'Franchise KBP Override' }
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses (Credited + Failed)' },
  { value: 'CREDITED', label: 'Credited' },
  { value: 'FAILED', label: 'Failed / Capped to ₹0' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'REVERSED', label: 'Reversed' }
];

const TYPE_LABELS = TYPE_OPTIONS.reduce((acc, o) => {
  if (o.value) acc[o.value] = o.label;
  return acc;
}, {});

const formatINR = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(val) || 0);

const formatDateTime = (val) => {
  if (!val) return '—';
  return new Date(val).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const PAGE_SIZE = 25;

const AdminIncomeHistoryPage = () => {
  const { showNotification } = useNotification ? useNotification() : { showNotification: () => {} };

  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [memberIdInput, setMemberIdInput] = useState('');
  const [appliedMemberId, setAppliedMemberId] = useState('');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: PAGE_SIZE };
      if (type) params.type = type;
      if (status) params.status = status;
      if (appliedMemberId) params.memberId = appliedMemberId;

      const res = await api.get('/api/admin/income/history', { params });
      if (res.data?.success) {
        setRows(res.data.data.transactions || []);
        setTotalCount(res.data.data.totalCount || 0);
      }
    } catch (err) {
      console.error('Failed to load income history:', err);
      showNotification('Failed to load income transaction history.', 'error');
    } finally {
      setLoading(false);
    }
  }, [type, status, appliedMemberId, page, showNotification]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedMemberId(memberIdInput.trim());
  };

  const handleResetFilters = () => {
    setType('');
    setStatus('');
    setMemberIdInput('');
    setAppliedMemberId('');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className={styles.historyPage}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Income Transaction History</h1>
          <p className={styles.pageSubtitle}>
            Every income credit across the platform — who received it, who generated it, on which package, at what
            KBP value, with date &amp; time.
          </p>
        </div>
      </div>

      <form className={styles.filterBar} onSubmit={handleSearch}>
        <select className={styles.filterSelect} value={type} onChange={(e) => { setPage(1); setType(e.target.value); }}>
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select className={styles.filterSelect} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <input
          type="text"
          className={styles.filterInput}
          placeholder="Recipient Member ID, email, or referral code..."
          value={memberIdInput}
          onChange={(e) => setMemberIdInput(e.target.value)}
        />

        <button type="submit" className={styles.searchBtn}>🔍 Search</button>
        {(type || status || appliedMemberId) && (
          <button type="button" className={styles.resetBtn} onClick={handleResetFilters}>
            ✕ Reset
          </button>
        )}
      </form>

      <div className={styles.resultsMeta}>
        {loading ? 'Loading...' : `${totalCount} transaction${totalCount === 1 ? '' : 's'} found`}
      </div>

      {loading ? (
        <div className={styles.loadingWrapper}>
          <div className={styles.spinner} />
          <p>Loading income history...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🧾</span>
          <p>No income transactions match these filters.</p>
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.historyTable}>
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Recipient</th>
                  <th>Type</th>
                  <th>Generated By</th>
                  <th>Package / Detail</th>
                  <th>KBP</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tx) => (
                  <tr key={tx._id || tx.transactionId}>
                    <td className={styles.dateCell}>{formatDateTime(tx.createdAt)}</td>
                    <td>
                      <div className={styles.memberCell}>
                        <strong>{tx.recipientFullName || '—'}</strong>
                        <span>{tx.recipientMemberId || tx.recipientEmail || '—'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.typeBadge}>{TYPE_LABELS[tx.type] || tx.type?.replace(/_/g, ' ')}</span>
                    </td>
                    <td>
                      {tx.sourceMemberName ? (
                        <div className={styles.memberCell}>
                          <strong>{tx.sourceMemberName}</strong>
                          <span>
                            {tx.sourceMemberId || tx.sourceMemberEmail || '—'}
                            {tx.triggeredByLeg ? ` · ${tx.triggeredByLeg} leg` : ''}
                          </span>
                        </div>
                      ) : tx.sourceAttributionNote ? (
                        <span className={styles.notRecordedNote} title={tx.sourceAttributionNote}>Not recorded (older txn)</span>
                      ) : (
                        <span className={styles.dimText}>—</span>
                      )}
                    </td>
                    <td className={styles.dimText}>{tx.packageName || '—'}</td>
                    <td>{typeof tx.kbp === 'number' ? tx.kbp.toLocaleString('en-IN') : '—'}</td>
                    <td className={styles.amountCell}>{formatINR(tx.creditedAmount)}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${tx.status === 'CREDITED' ? styles.statusCredited : tx.status === 'FAILED' ? styles.statusFailed : styles.statusOther}`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.paginationRow}>
            <button
              type="button"
              className={styles.pageBtn}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Previous
            </button>
            <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
            <button
              type="button"
              className={styles.pageBtn}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminIncomeHistoryPage;
