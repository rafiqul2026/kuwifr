// client/src/pages/admin/AdminIncomePayoutsPage.jsx
// Income by stream (platform-wide and per member) and payouts: what has
// already been paid to members' banks vs what is still pending.
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminInsights.module.css';
import { formatINR, formatNum, formatDate, downloadCsv, statusBadgeClass } from './adminInsightsUtils';

const PAGE_SIZE = 25;

const VIEWS = [
  { value: '', label: 'All members' },
  { value: 'earners', label: 'Has income' },
  { value: 'pending', label: 'Pending payout' },
  { value: 'balance', label: 'Unwithdrawn balance' }
];

const SORT_OPTIONS = [
  { value: 'earned', label: 'Highest earned' },
  { value: 'paid', label: 'Highest paid out' },
  { value: 'pending', label: 'Highest pending' },
  { value: 'balance', label: 'Highest wallet balance' },
  { value: 'newest', label: 'Newest members' },
  { value: 'memberId', label: 'Member ID (A–Z)' }
];

const TYPE_LABELS = {
  REFERRAL_INCOME: 'Direct Referral',
  MATCHING_INCOME: 'Binary Matching',
  LEADERSHIP_INCOME_L1: 'Leadership L1',
  LEADERSHIP_INCOME_L2: 'Leadership L2',
  LEADERSHIP_INCOME_L3: 'Leadership L3',
  REPURCHASE_SELF: 'Self Repurchase',
  REPURCHASE_DOWNLINE: 'Downline Repurchase',
  RANK_SALARY: 'Rank Salary',
  FUND_SALARY: 'Fund Salary',
  FUND_INCOME: 'Fund Income',
  FRANCHISE_ACTIVATION_OVERRIDE: 'Franchise Activation',
  FRANCHISE_KBP_OVERRIDE: 'Franchise KBP'
};

const MemberIncomeDrawer = ({ userId, onClose }) => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/api/admin/insights/income-payouts/member/${userId}`)
      .then((res) => { if (!cancelled) setData(res.data?.data || null); })
      .catch((err) => {
        showNotification(err.response?.data?.message || 'Failed to load member history.', 'error');
        onClose();
      });
    return () => { cancelled = true; };
  }, [userId, onClose, showNotification]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const walletTotal = data ? (data.wallet.incomeBalance || 0) + (data.wallet.repurchaseBalance || 0) + (data.wallet.salaryBalance || 0) : 0;

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <aside className={styles.drawer} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Member income history">
        {!data ? (
          <div className={styles.loading}>Loading member history…</div>
        ) : (
          <>
            <div className={styles.drawerHeader}>
              <div>
                <h2 className={styles.pageTitle} style={{ fontSize: 20 }}>{data.user.fullName}</h2>
                <p className={styles.pageSubtitle}>{data.user.memberId} · {data.user.phoneNumber || data.user.email}</p>
              </div>
              <div className={styles.headerActions}>
                <button type="button" className={styles.btn} onClick={() => navigate(`/admin/members/${data.user._id}`)}>Open profile</button>
                <button type="button" className={styles.btn} onClick={onClose} aria-label="Close">✕</button>
              </div>
            </div>

            <div className={styles.cardGrid}>
              <div className={`${styles.card} ${styles.cardAccent}`}>
                <span className={styles.cardLabel}>Total earned</span>
                <span className={styles.cardValue}>{formatINR(data.totalEarned)}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Paid out</span>
                <span className={`${styles.cardValue} ${styles.positive}`}>{formatINR(data.paidOut)}</span>
              </div>
              <div className={`${styles.card} ${data.pendingPayout > 0 ? styles.cardWarn : ''}`}>
                <span className={styles.cardLabel}>Pending payout</span>
                <span className={styles.cardValue}>{formatINR(data.pendingPayout)}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Wallet balance</span>
                <span className={styles.cardValue}>{formatINR(walletTotal)}</span>
                <span className={styles.cardHint}>Earned, not yet withdrawn</span>
              </div>
            </div>

            <h3 className={styles.sectionTitle}>Income by stream</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Stream</th><th className={styles.num}>Credits</th><th className={styles.num}>Amount</th></tr></thead>
                <tbody>
                  {data.streams.map((s) => (
                    <tr key={s.key}>
                      <td>{s.label}</td>
                      <td className={`${styles.num} ${styles.muted}`}>{s.count}</td>
                      <td className={`${styles.num} ${s.total ? styles.strong : styles.muted}`}>{formatINR(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className={styles.sectionTitle}>Payouts (withdrawals)</h3>
            {data.withdrawals.length === 0 ? (
              <div className={styles.empty}>No withdrawal requests yet.</div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Requested</th><th>Ref</th><th className={styles.num}>Gross</th><th className={styles.num}>Net to bank</th><th>Status</th><th>Paid on / UTR</th></tr>
                  </thead>
                  <tbody>
                    {data.withdrawals.map((w) => (
                      <tr key={w._id}>
                        <td>{formatDate(w.createdAt, true)}</td>
                        <td className={styles.muted}>{w.withdrawalNumber || '—'}</td>
                        <td className={styles.num}>{formatINR(w.grossAmount ?? w.amount)}</td>
                        <td className={styles.num}>{formatINR(w.netAmount)}</td>
                        <td><span className={statusBadgeClass(styles, w.status)}>{w.status}</span></td>
                        <td className={styles.muted}>
                          {w.payment?.processedAt ? formatDate(w.payment.processedAt) : '—'}
                          {w.payment?.utrNumber || w.payment?.transactionId ? ` · ${w.payment.utrNumber || w.payment.transactionId}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 className={styles.sectionTitle}>Recent income credits</h3>
            {data.transactions.length === 0 ? (
              <div className={styles.empty}>No income yet.</div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Date</th><th>Stream</th><th className={styles.num}>KBP</th><th className={styles.num}>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.transactions.map((t) => (
                      <tr key={t._id}>
                        <td>{formatDate(t.createdAt, true)}</td>
                        <td>{TYPE_LABELS[t.type] || t.type}</td>
                        <td className={`${styles.num} ${styles.muted}`}>{t.kbp ? formatNum(t.kbp) : '—'}</td>
                        <td className={styles.num}>{formatINR(t.creditedAmount)}</td>
                        <td><span className={statusBadgeClass(styles, t.status)}>{t.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
};

const AdminIncomePayoutsPage = () => {
  const { showNotification } = useNotification();
  const [summary, setSummary] = useState(null);
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [view, setView] = useState('');
  const [sort, setSort] = useState('earned');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0, streams: [] });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [openUserId, setOpenUserId] = useState(null);

  useEffect(() => {
    api.get('/api/admin/insights/income-payouts/summary')
      .then((res) => setSummary(res.data?.data || null))
      .catch(() => showNotification('Failed to load income summary.', 'error'));
  }, [showNotification]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/insights/income-payouts', { params: { q, view, sort, page, limit: PAGE_SIZE } });
      if (res.data?.success) setData(res.data.data);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to load income report.', 'error');
    } finally {
      setLoading(false);
    }
  }, [q, view, sort, page, showNotification]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadCsv('/api/admin/insights/income-payouts', { q, view, sort }, 'income-payouts.csv');
    } catch {
      showNotification('Export failed. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const closeDrawer = useCallback(() => setOpenUserId(null), []);
  const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));
  const walletTotal = summary ? summary.walletBalances.income + summary.walletBalances.repurchase + summary.walletBalances.salary : 0;

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Income &amp; Payouts</h1>
          <p className={styles.pageSubtitle}>
            Every income stream shown separately, and for each member: what they earned, what has already been paid
            to their bank, what is still waiting for payout, and what is sitting in their wallet. Click a member for
            their full history.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btn} onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting…' : '⬇ Export CSV'}
          </button>
        </div>
      </div>

      {summary && (
        <>
          <div className={styles.cardGrid}>
            <div className={`${styles.card} ${styles.cardAccent}`}>
              <span className={styles.cardLabel}>Total income credited</span>
              <span className={styles.cardValue}>{formatINR(summary.totalEarned)}</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Paid out</span>
              <span className={`${styles.cardValue} ${styles.positive}`}>{formatINR(summary.payouts.paidGross)}</span>
              <span className={styles.cardHint}>{summary.payouts.paidCount} payout(s) · {formatINR(summary.payouts.paidNet)} net to bank</span>
            </div>
            <div className={`${styles.card} ${summary.payouts.pendingGross > 0 ? styles.cardWarn : ''}`}>
              <span className={styles.cardLabel}>Pending payout</span>
              <span className={styles.cardValue}>{formatINR(summary.payouts.pendingGross)}</span>
              <span className={styles.cardHint}>{summary.payouts.pendingCount} request(s) waiting</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>In member wallets</span>
              <span className={styles.cardValue}>{formatINR(walletTotal)}</span>
              <span className={styles.cardHint}>Earned, not yet withdrawn</span>
            </div>
          </div>

          <div className={styles.cardGrid}>
            {summary.streams.map((s) => (
              <div key={s.key} className={styles.card}>
                <span className={styles.cardLabel}>{s.label}</span>
                <span className={styles.cardValue} style={{ fontSize: 17 }}>{formatINR(s.total)}</span>
                <span className={styles.cardHint}>{s.count} credit(s)</span>
              </div>
            ))}
          </div>
        </>
      )}

      <form
        className={styles.filterBar}
        onSubmit={(e) => { e.preventDefault(); setPage(1); setQ(qInput.trim()); }}
      >
        <input className={styles.input} placeholder="Search Member ID, name, phone or email…" value={qInput} onChange={(e) => setQInput(e.target.value)} />
        <div className={styles.segmented}>
          {VIEWS.map((v) => (
            <button key={v.value} type="button" className={view === v.value ? styles.segmentedActive : ''} onClick={() => { setPage(1); setView(v.value); }}>
              {v.label}
            </button>
          ))}
        </div>
        <select className={styles.select} value={sort} onChange={(e) => { setPage(1); setSort(e.target.value); }}>
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="submit" className={styles.btnPrimary}>Search</button>
      </form>

      <div className={styles.resultsMeta}>{loading ? 'Loading…' : `${formatNum(data.total)} member(s)`}</div>

      {loading ? (
        <div className={styles.loading}>Loading income report…</div>
      ) : data.rows.length === 0 ? (
        <div className={styles.empty}>No members match these filters.</div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Member</th>
                  {data.streams.map((s) => <th key={s.key} className={styles.num}>{s.label}</th>)}
                  <th className={styles.num}>Total earned</th>
                  <th className={styles.num}>Paid out</th>
                  <th className={styles.num}>Pending</th>
                  <th className={styles.num}>Wallet</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <div className={styles.memberCell}>
                        <strong>{r.fullName || '—'}</strong>
                        <span>{r.memberId}</span>
                      </div>
                    </td>
                    {data.streams.map((s) => (
                      <td key={s.key} className={`${styles.num} ${r.streams?.[s.key] ? '' : styles.muted}`}>
                        {r.streams?.[s.key] ? formatINR(r.streams[s.key]) : '—'}
                      </td>
                    ))}
                    <td className={`${styles.num} ${styles.strong}`}>{formatINR(r.totalEarned)}</td>
                    <td className={`${styles.num} ${r.paidOut ? styles.positive : styles.muted}`}>{formatINR(r.paidOut)}</td>
                    <td className={`${styles.num} ${r.pendingPayout ? styles.pendingText : styles.muted}`}>{formatINR(r.pendingPayout)}</td>
                    <td className={styles.num}>{formatINR(r.walletBalance)}</td>
                    <td><button type="button" className={styles.linkBtn} onClick={() => setOpenUserId(r._id)}>History →</button></td>
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

      {openUserId && <MemberIncomeDrawer userId={openUserId} onClose={closeDrawer} />}
    </div>
  );
};

export default AdminIncomePayoutsPage;
