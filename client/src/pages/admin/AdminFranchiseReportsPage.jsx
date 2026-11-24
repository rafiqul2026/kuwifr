// client/src/pages/admin/AdminFranchiseReportsPage.jsx
// One report covering every franchise: territory, sales, franchise income,
// payouts and stock. Backed by GET /api/admin/franchise-reports.
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminInsights.module.css';
import { formatINR, formatNum, formatDate, downloadCsv, statusBadgeClass } from './adminInsightsUtils';

const isoDaysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

const PRESETS = [
  { key: 'all', label: 'All time', from: '', to: '' },
  { key: '7', label: 'Last 7 days', from: () => isoDaysAgo(6) },
  { key: '30', label: 'Last 30 days', from: () => isoDaysAgo(29) },
  { key: 'month', label: 'This month', from: () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1, 12).toISOString().slice(0, 10); } }
];

const AdminFranchiseReportsPage = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preset, setPreset] = useState('all');
  const [includeRevoked, setIncludeRevoked] = useState(false);
  const [data, setData] = useState({ rows: [], totals: {} });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const params = { from: from || undefined, to: to || undefined, status: includeRevoked ? 'all' : undefined };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/franchise-reports', {
        params: { from: from || undefined, to: to || undefined, status: includeRevoked ? 'all' : undefined }
      });
      setData(res.data?.data || { rows: [], totals: {} });
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to load franchise reports.', 'error');
    } finally {
      setLoading(false);
    }
  }, [from, to, includeRevoked, showNotification]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const applyPreset = (p) => {
    setPreset(p.key);
    setFrom(typeof p.from === 'function' ? p.from() : p.from || '');
    setTo(p.to || '');
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadCsv('/api/admin/franchise-reports', params, 'franchise-report.csv');
    } catch {
      showNotification('Export failed. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const rangeLabel = from || to ? `${from ? formatDate(from) : 'start'} – ${to ? formatDate(to) : 'today'}` : 'all time';
  const tot = data.totals || {};

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Franchise Reports</h1>
          <p className={styles.pageSubtitle}>
            Every franchise side by side: territory size, package and repurchase sales from its territory, franchise
            income, payouts and stock. Sales, income and stock movement follow the date range; members and stock
            balance are as of today.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btn} onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting…' : '⬇ Export CSV'}
          </button>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.segmented}>
          {PRESETS.map((p) => (
            <button key={p.key} type="button" className={preset === p.key ? styles.segmentedActive : ''} onClick={() => applyPreset(p)}>
              {p.label}
            </button>
          ))}
        </div>
        <input type="date" className={styles.select} value={from} max={to || undefined} onChange={(e) => { setPreset('custom'); setFrom(e.target.value); }} aria-label="From date" />
        <span className={styles.muted}>to</span>
        <input type="date" className={styles.select} value={to} min={from || undefined} onChange={(e) => { setPreset('custom'); setTo(e.target.value); }} aria-label="To date" />
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={includeRevoked} onChange={(e) => setIncludeRevoked(e.target.checked)} />
          Include revoked
        </label>
      </div>

      <div className={styles.cardGrid}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Franchises</span>
          <span className={styles.cardValue}>{formatNum(tot.franchises)}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Territory members</span>
          <span className={styles.cardValue}>{formatNum(tot.territoryMembers)}</span>
        </div>
        <div className={`${styles.card} ${styles.cardAccent}`}>
          <span className={styles.cardLabel}>Territory sales</span>
          <span className={styles.cardValue}>{formatINR(tot.salesAmount)}</span>
          <span className={styles.cardHint}>{rangeLabel}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Franchise income</span>
          <span className={styles.cardValue}>{formatINR(tot.franchiseIncome)}</span>
          <span className={styles.cardHint}>{rangeLabel}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Stock with franchises</span>
          <span className={styles.cardValue}>{formatNum(tot.stockBalanceKBP)} KBP</span>
          <span className={styles.cardHint}>{formatNum(tot.stockBalanceQty)} unit(s)</span>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Building franchise reports…</div>
      ) : data.rows.length === 0 ? (
        <div className={styles.empty}>No franchises to report on.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Franchise</th>
                <th>Status</th>
                <th className={styles.num}>Members</th>
                <th className={styles.num}>Active</th>
                <th className={styles.num}>Package sales</th>
                <th className={styles.num}>Repurchase sales</th>
                <th className={styles.num}>Franchise income</th>
                <th className={styles.num}>Paid / Pending</th>
                <th className={styles.num}>Stock balance</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <React.Fragment key={r._id}>
                  <tr>
                    <td>
                      <div className={styles.memberCell}>
                        <strong>{r.member?.fullName}</strong>
                        <span>{r.member?.memberId} · since {formatDate(r.approvedAt)}</span>
                      </div>
                    </td>
                    <td><span className={statusBadgeClass(styles, r.status)}>{r.status}</span></td>
                    <td className={styles.num}>
                      {formatNum(r.territory.members)}
                      {r.territory.newInRange !== null && r.territory.newInRange !== undefined && (
                        <span className={styles.muted}> (+{r.territory.newInRange})</span>
                      )}
                    </td>
                    <td className={styles.num}>{formatNum(r.territory.active)}</td>
                    <td className={styles.num}>{formatINR(r.sales.packageAmount)}<br /><span className={styles.muted}>{r.sales.packageOrders} order(s)</span></td>
                    <td className={styles.num}>{formatINR(r.sales.repurchaseAmount)}<br /><span className={styles.muted}>{r.sales.repurchaseOrders} order(s)</span></td>
                    <td className={`${styles.num} ${styles.strong}`}>{formatINR(r.income.franchiseTotal)}</td>
                    <td className={styles.num}>
                      <span className={styles.positive}>{formatINR(r.payouts.paid)}</span><br />
                      <span className={r.payouts.pending ? styles.pendingText : styles.muted}>{formatINR(r.payouts.pending)}</span>
                    </td>
                    <td className={styles.num}>{formatNum(r.stock.balanceQty)} unit(s)<br /><span className={styles.muted}>{formatNum(r.stock.balanceKBP)} KBP</span></td>
                    <td>
                      <button type="button" className={styles.linkBtn} onClick={() => setExpanded(expanded === r._id ? null : r._id)}>
                        {expanded === r._id ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {expanded === r._id && (
                    <tr>
                      <td colSpan={10} style={{ background: '#fcfcfa', whiteSpace: 'normal' }}>
                        <div className={styles.formGrid} style={{ padding: '6px 0' }}>
                          <dl className={styles.kv}>
                            <dt>Territory own KBP</dt><dd>{formatNum(r.territory.kbp)}</dd>
                            <dt>Package KBP ({rangeLabel})</dt><dd>{formatNum(r.sales.packageKBP)}</dd>
                            <dt>Repurchase KBP ({rangeLabel})</dt><dd>{formatNum(r.sales.repurchaseKBP)}</dd>
                          </dl>
                          <dl className={styles.kv}>
                            <dt>Activation override</dt><dd>{formatINR(r.income.activationOverride)}</dd>
                            <dt>KBP override</dt><dd>{formatINR(r.income.kbpOverride)}</dd>
                            <dt>Product sale commission</dt><dd>{formatINR(r.income.saleCommission)}</dd>
                            <dt>All income (lifetime)</dt><dd>{formatINR(r.income.allIncomeLifetime)}</dd>
                          </dl>
                          <dl className={styles.kv}>
                            <dt>Stock assigned</dt><dd>{formatNum(r.stock.liftedQty)} · {formatNum(r.stock.liftedKBP)} KBP</dd>
                            <dt>Sold</dt><dd>{formatNum(r.stock.soldQty)} · {formatINR(r.stock.soldKSP)}</dd>
                            <dt>Dispatched</dt><dd>{formatNum(r.stock.dispatchedQty)} · {formatNum(r.stock.dispatchedKBP)} KBP</dd>
                            <dt>Returned</dt><dd>{formatNum(r.stock.returnedQty)}</dd>
                            <dt>Balance value</dt><dd>{formatINR(r.stock.balanceKSP)}</dd>
                          </dl>
                        </div>
                        <div className={styles.formActions} style={{ justifyContent: 'flex-start' }}>
                          <button type="button" className={styles.btn} onClick={() => navigate(`/admin/members/${r.member?._id}`)}>Open member</button>
                          <button type="button" className={styles.btn} onClick={() => navigate('/admin/franchise-inventory')}>Open inventory</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminFranchiseReportsPage;
