// client/src/pages/admin/AdminTransactionsPage.jsx
//
// Unified Transactions view — built to mirror the PBW Foundation admin
// panel the user asked KUWIFR to match: one page combining every payment
// transaction (package + repurchase orders) with Revenue/Total/Captured/
// Pending/Failed summary cards computed over ALL matching records (not
// just the visible page), search, status filter, date range, CSV export,
// and a paginated table with Member/Amount/Status/Transaction ID/Date/
// Actions columns. Backed by GET /api/admin/transactions
// (order.controller.js: getUnifiedTransactions) and
// GET /api/admin/transactions/export for the Export button.
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminTransactionsPage.module.css';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'CAPTURED', label: 'Captured' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' }
];

const PAGE_SIZE = 20;

const formatINR = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(val) || 0);

const formatDateTime = (val) => {
  if (!val) return '—';
  return new Date(val).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const AdminTransactionsPage = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification ? useNotification() : { showNotification: () => {} };

  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ revenue: 0, total: 0, captured: 0, pending: 0, failed: 0 });
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: PAGE_SIZE };
      if (appliedSearch) params.search = appliedSearch;
      if (status !== 'ALL') params.status = status;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get('/api/admin/transactions', { params });
      if (res.data?.success) {
        setRows(res.data.data.transactions || []);
        setSummary(res.data.data.summary || { revenue: 0, total: 0, captured: 0, pending: 0, failed: 0 });
        setTotalCount(res.data.data.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
      showNotification('Failed to load transactions.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, appliedSearch, status, startDate, endDate, showNotification]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const handleReset = () => {
    setSearchInput('');
    setAppliedSearch('');
    setStatus('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleExport = () => {
    // Auth here rides the same httpOnly `token` cookie every other admin
    // request uses (see auth middleware) — deliberately NOT putting the
    // bearer token in the URL/query string, which would leak into browser
    // history and server access logs.
    const params = new URLSearchParams();
    if (appliedSearch) params.set('search', appliedSearch);
    if (status !== 'ALL') params.set('status', status);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const base = api.defaults.baseURL || '';
    window.open(`${base}/api/admin/transactions/export?${params.toString()}`, '_blank');
  };

  const copyToClipboard = (text, rowId) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedId(rowId);
      setTimeout(() => setCopiedId(null), 1500);
    }).catch(() => {});
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className={styles.txPage}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Transactions</h1>
          <p className={styles.pageSubtitle}>All package and repurchase payment transactions across the organization.</p>
        </div>
      </div>

      <form className={styles.filterBar} onSubmit={handleSearch}>
        <input
          type="text"
          className={styles.filterInput}
          placeholder="Search by name, email, or transaction ID..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select className={styles.filterSelect} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <input type="date" className={styles.filterInput} value={startDate} onChange={(e) => { setPage(1); setStartDate(e.target.value); }} title="From date" />
        <input type="date" className={styles.filterInput} value={endDate} onChange={(e) => { setPage(1); setEndDate(e.target.value); }} title="To date" />
        <button type="submit" className={styles.searchBtn}>🔍 Search</button>
        <button type="button" className={styles.refreshBtn} onClick={fetchTransactions}>↻ Refresh</button>
        <button type="button" className={styles.exportBtn} onClick={handleExport}>⬇ Export</button>
        {(appliedSearch || status !== 'ALL' || startDate || endDate) && (
          <button type="button" className={styles.resetBtn} onClick={handleReset}>✕ Reset</button>
        )}
      </form>

      <div className={styles.statGrid}>
        <div className={`${styles.statCard} ${styles.statRevenue}`}>
          <span className={styles.statIcon}>💳</span>
          <div>
            <span className={styles.statLabel}>Revenue</span>
            <strong className={styles.statValue}>{formatINR(summary.revenue)}</strong>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>📄</span>
          <div>
            <span className={styles.statLabel}>Total</span>
            <strong className={styles.statValue}>{(summary.total || 0).toLocaleString('en-IN')}</strong>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statCaptured}`}>
          <span className={styles.statIcon}>✅</span>
          <div>
            <span className={styles.statLabel}>Captured</span>
            <strong className={styles.statValue}>{(summary.captured || 0).toLocaleString('en-IN')}</strong>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statPending}`}>
          <span className={styles.statIcon}>⏳</span>
          <div>
            <span className={styles.statLabel}>Pending</span>
            <strong className={styles.statValue}>{(summary.pending || 0).toLocaleString('en-IN')}</strong>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statFailed}`}>
          <span className={styles.statIcon}>✕</span>
          <div>
            <span className={styles.statLabel}>Failed</span>
            <strong className={styles.statValue}>{(summary.failed || 0).toLocaleString('en-IN')}</strong>
          </div>
        </div>
      </div>

      <div className={styles.resultsMeta}>
        {loading ? 'Loading...' : `Showing ${rows.length ? (page - 1) * PAGE_SIZE + 1 : 0}–${(page - 1) * PAGE_SIZE + rows.length} of ${totalCount} transactions`}
      </div>

      {loading ? (
        <div className={styles.loadingWrapper}>
          <div className={styles.spinner} />
          <p>Loading transactions...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🧾</span>
          <p>No transactions match these filters.</p>
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.txTable}>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Transaction ID</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tx) => (
                  <tr key={tx._id}>
                    <td>
                      <div className={styles.memberCell}>
                        <strong>{tx.memberName}</strong>
                        <span>{tx.memberId || tx.memberEmail || '—'}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.amountCol}>
                        <strong className={styles.amountVal}>{formatINR(tx.amount)}</strong>
                        <span className={styles.orderTypeTag}>{tx.orderType === 'PACKAGE' ? 'Package' : 'Repurchase'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles['status_' + tx.statusBucket]}`}>
                        {tx.statusBucket === 'CAPTURED' ? '✓ Captured' : tx.statusBucket === 'PENDING' ? '⏳ Pending' : tx.statusBucket === 'FAILED' ? '✕ Failed' : tx.paymentStatus}
                      </span>
                    </td>
                    <td>
                      <code className={styles.txIdCode}>{tx.transactionId}</code>
                    </td>
                    <td className={styles.dateCell}>{formatDateTime(tx.createdAt)}</td>
                    <td>
                      <div className={styles.actionsCell}>
                        <button type="button" className={styles.miniBtn} onClick={() => navigate(`/admin/orders/${tx._id}`)}>View</button>
                        <button type="button" className={styles.miniBtn} onClick={() => copyToClipboard(tx.transactionId, tx._id)}>
                          {copiedId === tx._id ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.paginationRow}>
            <button type="button" className={styles.pageBtn} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ← Previous
            </button>
            <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
            <button type="button" className={styles.pageBtn} disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminTransactionsPage;
