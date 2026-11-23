// client/src/pages/admin/AdminKbpReportPage.jsx
// Every member's KBP: own (package), left/right leg, matched, carry-forward,
// and repurchase KBP. Backed by GET /api/admin/insights/kbp.
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminInsights.module.css';
import { formatNum, formatDate, downloadCsv, statusBadgeClass } from './adminInsightsUtils';

const PAGE_SIZE = 25;

const SORT_OPTIONS = [
  { value: 'team', label: 'Highest team KBP' },
  { value: 'own', label: 'Highest own KBP' },
  { value: 'left', label: 'Highest left leg' },
  { value: 'right', label: 'Highest right leg' },
  { value: 'matched', label: 'Highest matched' },
  { value: 'repurchase', label: 'Highest repurchase KBP' },
  { value: 'newest', label: 'Newest members' },
  { value: 'memberId', label: 'Member ID (A–Z)' }
];

const AdminKbpReportPage = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('team');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0, totals: {} });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const params = { q, status, sort };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/insights/kbp', { params: { q, status, sort, page, limit: PAGE_SIZE } });
      if (res.data?.success) setData(res.data.data);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to load KBP report.', 'error');
    } finally {
      setLoading(false);
    }
  }, [q, status, sort, page, showNotification]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadCsv('/api/admin/insights/kbp', params, 'kbp-report.csv');
    } catch {
      showNotification('Export failed. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>KBP Report</h1>
          <p className={styles.pageSubtitle}>
            How much KBP every member has: their own package KBP, the KBP on each binary leg, how much has been
            matched, the unmatched carry-forward, and repurchase KBP.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btn} onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting…' : '⬇ Export CSV'}
          </button>
        </div>
      </div>

      <div className={styles.cardGrid}>
        <div className={`${styles.card} ${styles.cardAccent}`}>
          <span className={styles.cardLabel}>Total own KBP</span>
          <span className={styles.cardValue}>{formatNum(data.totals?.ownKBP)}</span>
          <span className={styles.cardHint}>Sum of every member's package KBP</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Members with KBP</span>
          <span className={styles.cardValue}>{formatNum(data.totals?.membersWithKBP)}</span>
          <span className={styles.cardHint}>of {formatNum(data.total)} matching members</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Repurchase KBP</span>
          <span className={styles.cardValue}>{formatNum(data.totals?.ownRepurchaseKBP)}</span>
          <span className={styles.cardHint}>From completed repurchase orders</span>
        </div>
      </div>

      <form
        className={styles.filterBar}
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQ(qInput.trim());
        }}
      >
        <input
          className={styles.input}
          placeholder="Search Member ID, name, phone or email…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
        <select className={styles.select} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <select className={styles.select} value={sort} onChange={(e) => { setPage(1); setSort(e.target.value); }}>
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="submit" className={styles.btnPrimary}>Search</button>
        {(q || status) && (
          <button type="button" className={styles.btn} onClick={() => { setQInput(''); setQ(''); setStatus(''); setPage(1); }}>
            Reset
          </button>
        )}
      </form>

      <div className={styles.resultsMeta}>{loading ? 'Loading…' : `${formatNum(data.total)} member(s)`}</div>

      {loading ? (
        <div className={styles.loading}>Loading KBP report…</div>
      ) : data.rows.length === 0 ? (
        <div className={styles.empty}>No members match these filters.</div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Status</th>
                  <th className={styles.num}>Own KBP</th>
                  <th className={styles.num}>Left KBP</th>
                  <th className={styles.num}>Right KBP</th>
                  <th className={styles.num}>Team KBP</th>
                  <th className={styles.num}>Matched</th>
                  <th className={styles.num}>Carry L / R</th>
                  <th className={styles.num}>Repurchase KBP</th>
                  <th className={styles.num}>Rep. L / R</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <button type="button" className={styles.linkBtn} onClick={() => navigate(`/admin/members/${r._id}`)}>
                        <span className={styles.memberCell} style={{ textAlign: 'left' }}>
                          <strong>{r.fullName || '—'}</strong>
                          <span>{r.memberId}</span>
                        </span>
                      </button>
                    </td>
                    <td><span className={statusBadgeClass(styles, r.status)}>{r.status}</span></td>
                    <td className={`${styles.num} ${styles.strong}`}>{formatNum(r.ownKBP)}</td>
                    <td className={styles.num}>{formatNum(r.leftKBP)}</td>
                    <td className={styles.num}>{formatNum(r.rightKBP)}</td>
                    <td className={`${styles.num} ${styles.strong}`}>{formatNum(r.teamKBP)}</td>
                    <td className={styles.num}>{formatNum(r.matchedKBP)}</td>
                    <td className={`${styles.num} ${styles.muted}`}>{formatNum(r.carryLeftKBP)} / {formatNum(r.carryRightKBP)}</td>
                    <td className={styles.num}>{formatNum(r.ownRepurchaseKBP)}</td>
                    <td className={`${styles.num} ${styles.muted}`}>{formatNum(r.leftRepurchaseKBP)} / {formatNum(r.rightRepurchaseKBP)}</td>
                    <td className={styles.muted}>{formatDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.pagination}>
            <button type="button" className={styles.btn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" className={styles.btn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminKbpReportPage;
