// client/src/pages/member/IncomePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './IncomePage.module.css';

// Income Stream dropdown options — must match the category keys the backend
// understands (server/src/controllers/income.controller.js#INCOME_STREAM_CATEGORIES).
const INCOME_STREAM_OPTIONS = [
  { key: 'ALL', label: 'All Income Streams' },
  { key: 'DIRECT', label: 'Direct Income' },
  { key: 'MATCHING', label: 'Matching (Income)' },
  { key: 'LEADERSHIP', label: 'Leadership (Income)' },
  { key: 'REMUNERATION', label: 'Remuneration (Income)' },
  { key: 'REPURCHASE_SELF', label: 'Re-purchase (Self) Income' },
  { key: 'REPURCHASE_DOWNLINE', label: 'Downline Re-purchase Income' },
  { key: 'LIFE_TENSION_FREE', label: 'Life Tension Free Income' },
  { key: 'PENSION', label: 'Pension Income' }
];

const formatINR = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(val) || 0);

const IncomePage = () => {
  const { showNotification } = useNotification();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [streams, setStreams] = useState([]); // live per-category totals from /api/income/streams
  const [grandTotal, setGrandTotal] = useState(0);

  const [selectedStream, setSelectedStream] = useState('ALL');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState(null); // { total, totalCount, transactions } for selectedStream

  // Today/Weekly/Total Income, Total Withdrawal, Leadership Income, Self &
  // Downline Repurchase Income, Pension — moved here from the Member
  // Dashboard (docx: "please add the below cards in the income page of the
  // member sidebar, for that member dashboard will look like clean").
  // Fetched from the same dashboard-stats endpoint the dashboard used, kept
  // isolated so a failure here never blocks the stream breakdown above.
  const [incomeSnapshot, setIncomeSnapshot] = useState(null);

  const fetchStreamBreakdown = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/income/streams');
      if (res.data?.success && res.data?.data) {
        setStreams(res.data.data.streams || []);
        setGrandTotal(res.data.data.grandTotal || 0);
      }
    } catch {
      showNotification('Failed to load income stream breakdown', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  const fetchStreamHistory = useCallback(async (categoryKey) => {
    if (categoryKey === 'ALL') {
      setHistoryData(null);
      return;
    }
    try {
      setHistoryLoading(true);
      const res = await api.get(`/api/income/streams/${categoryKey}?limit=25`);
      if (res.data?.success && res.data?.data) {
        setHistoryData(res.data.data);
      }
    } catch {
      showNotification('Failed to load transaction history for this income stream', 'error');
    } finally {
      setHistoryLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchStreamBreakdown();
  }, [fetchStreamBreakdown]);

  useEffect(() => {
    fetchStreamHistory(selectedStream);
  }, [selectedStream, fetchStreamHistory]);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/users/dashboard-stats')
      .then((res) => {
        if (cancelled) return;
        if (res.data?.success && res.data?.data) {
          setIncomeSnapshot(res.data.data);
        }
      })
      .catch(() => {
        // Non-critical — the stream breakdown below still works fine.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const getStream = (key) => streams.find((s) => s.key === key) || { total: 0, today: 0, count: 0 };

  const todayTotal = streams.reduce((sum, s) => sum + (Number(s.today) || 0), 0);
  const directTotal = getStream('DIRECT').total;
  const matchingTotal = getStream('MATCHING').total;

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.modernSpinner}></div>
        <p>Loading network income overview...</p>
      </div>
    );
  }

  return (
    <div className={styles.incomeContainer}>
      {/* Header */}
      <header className={styles.pageHeader}>
        <div className={styles.headerTitleWrap}>
          <span className={styles.pillBadge}>📊 Financial Ledger</span>
          <h1 className={styles.pageTitle}>Income Overview</h1>
          <p className={styles.pageSubtitle}>
            Track your direct referrals, binary matching volume, and overall network earnings in real time.
          </p>
        </div>
      </header>

      {/* Snapshot cards moved here from the Member Dashboard */}
      <section className={styles.snapshotSection}>
        <h2 className={styles.snapshotHeading}>Income Snapshot</h2>
        <div className={styles.snapshotGrid}>
          <div className={styles.snapshotCard}>
            <div className={styles.snapshotCardHeader}>
              <span className={styles.snapshotCardTitle}>TODAY INCOME</span>
              <div className={`${styles.snapshotIconBox} ${styles.snapshotIconTeal}`}>💵</div>
            </div>
            <h3 className={styles.snapshotValue}>{formatINR(incomeSnapshot?.todayIncome)}</h3>
            <span className={styles.snapshotSub}>Daily Earnings</span>
          </div>

          <div className={styles.snapshotCard}>
            <div className={styles.snapshotCardHeader}>
              <span className={styles.snapshotCardTitle}>WEEKLY INCOME</span>
              <div className={`${styles.snapshotIconBox} ${styles.snapshotIconTeal}`}>💷</div>
            </div>
            <h3 className={styles.snapshotValue}>{formatINR(incomeSnapshot?.weeklyIncome)}</h3>
            <span className={styles.snapshotSub}>This Week's Earnings</span>
          </div>

          <div className={styles.snapshotCard}>
            <div className={styles.snapshotCardHeader}>
              <span className={styles.snapshotCardTitle}>TOTAL INCOME</span>
              <div className={`${styles.snapshotIconBox} ${styles.snapshotIconTeal}`}>💰</div>
            </div>
            <h3 className={styles.snapshotValue}>{formatINR(incomeSnapshot?.totalIncome)}</h3>
            <span className={styles.snapshotSub}>Lifetime Accumulated</span>
          </div>

          <div className={styles.snapshotCard}>
            <div className={styles.snapshotCardHeader}>
              <span className={styles.snapshotCardTitle}>TOTAL WITHDRAWAL</span>
              <div className={`${styles.snapshotIconBox} ${styles.snapshotIconTeal}`}>🏦</div>
            </div>
            <h3 className={styles.snapshotValue}>{formatINR(incomeSnapshot?.totalWithdrawal)}</h3>
            <span className={styles.snapshotSub}>Payouts Dispatched</span>
          </div>

          <div className={styles.snapshotCard}>
            <div className={styles.snapshotCardHeader}>
              <span className={styles.snapshotCardTitle}>LEADERSHIP INCOME</span>
              <div className={`${styles.snapshotIconBox} ${styles.snapshotIconOrange}`}>👑</div>
            </div>
            <h3 className={styles.snapshotValue}>{formatINR(incomeSnapshot?.leadershipIncome?.total)}</h3>
            <span className={styles.snapshotSub}>Today: {formatINR(incomeSnapshot?.leadershipIncome?.today)}</span>
          </div>

          <div className={styles.snapshotCard}>
            <div className={styles.snapshotCardHeader}>
              <span className={styles.snapshotCardTitle}>SELF REPURCHASE INCOME</span>
              <div className={`${styles.snapshotIconBox} ${styles.snapshotIconOrange}`}>🔄</div>
            </div>
            <h3 className={styles.snapshotValue}>{formatINR(incomeSnapshot?.selfRepurchaseIncome)}</h3>
            <span className={styles.snapshotSub}>Lifetime Self Repurchase Cashback</span>
          </div>

          <div className={styles.snapshotCard}>
            <div className={styles.snapshotCardHeader}>
              <span className={styles.snapshotCardTitle}>DOWNLINE REPURCHASE INCOME</span>
              <div className={`${styles.snapshotIconBox} ${styles.snapshotIconOrange}`}>🔁</div>
            </div>
            <h3 className={styles.snapshotValue}>{formatINR(incomeSnapshot?.downlineRepurchaseIncome)}</h3>
            <span className={styles.snapshotSub}>Lifetime Downline Repurchase Income</span>
          </div>

          <div className={styles.snapshotCard}>
            <div className={styles.snapshotCardHeader}>
              <span className={styles.snapshotCardTitle}>PENSION</span>
              <div className={`${styles.snapshotIconBox} ${styles.snapshotIconOrange}`}>🏦</div>
            </div>
            <h3 className={styles.snapshotValue}>{incomeSnapshot?.pension?.active ? 'Active' : 'Not Active'}</h3>
            <span className={styles.snapshotSub}>Lifetime Paid: {formatINR(incomeSnapshot?.pension?.totalEarned)}</span>
          </div>
        </div>
      </section>

      {/* Income Streams Grid — Total / Direct / Matching (live, from IncomeTransaction) */}
      <section className={styles.incomeGrid}>
        <div className={`${styles.incomeCard} ${styles.totalCard}`}>
          <div className={styles.cardTop}>
            <span className={styles.cardIcon}>💰</span>
            <span className={styles.cardChip}>Cumulative</span>
          </div>
          <div className={styles.cardAmount}>
            <small>₹</small>
            {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={styles.cardFooter}>
            <span>Total Network Income</span>
            <strong>Today: {formatINR(todayTotal)}</strong>
          </div>
        </div>

        <div className={`${styles.incomeCard} ${styles.directCard}`}>
          <div className={styles.cardTop}>
            <span className={styles.cardIcon}>🎯</span>
            <span className={styles.cardChip}>Sponsor Bonus</span>
          </div>
          <div className={styles.cardAmount}>
            <small>₹</small>
            {directTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={styles.cardFooter}>
            <span>Direct Referral Income</span>
            <strong>Direct Sponsor Activations</strong>
          </div>
        </div>

        <div className={`${styles.incomeCard} ${styles.matchingCard}`}>
          <div className={styles.cardTop}>
            <span className={styles.cardIcon}>🌳</span>
            <span className={styles.cardChip}>Binary Match</span>
          </div>
          <div className={styles.cardAmount}>
            <small>₹</small>
            {matchingTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={styles.cardFooter}>
            <span>Binary Matching Income</span>
            <strong>Matched Left / Right Volume</strong>
          </div>
        </div>
      </section>

      {/* ================= INCOME STREAM DROPDOWN ================= */}
      <section className={styles.streamSection}>
        <div className={styles.streamSectionHeader}>
          <div>
            <h2>Income Stream Breakdown</h2>
            <p>Every income category, live from your transaction ledger — pick one for its full history.</p>
          </div>
          <div className={styles.streamSelectWrap}>
            <label htmlFor="incomeStreamSelect">Income:</label>
            <select
              id="incomeStreamSelect"
              className={styles.streamSelect}
              value={selectedStream}
              onChange={(e) => setSelectedStream(e.target.value)}
            >
              {INCOME_STREAM_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedStream === 'ALL' ? (
          // Overview: every stream's live today/total side by side
          <div className={styles.streamOverviewGrid}>
            {INCOME_STREAM_OPTIONS.filter((opt) => opt.key !== 'ALL').map((opt) => {
              const s = getStream(opt.key);
              return (
                <button
                  type="button"
                  key={opt.key}
                  className={styles.streamOverviewCard}
                  onClick={() => setSelectedStream(opt.key)}
                >
                  <span className={styles.streamOverviewLabel}>{opt.label}</span>
                  <strong className={styles.streamOverviewValue}>{formatINR(s.total)}</strong>
                  <span className={styles.streamOverviewSub}>Today: {formatINR(s.today)} · {s.count} txn{s.count === 1 ? '' : 's'}</span>
                </button>
              );
            })}
          </div>
        ) : (
          // Detail: the selected stream's live total + transaction history
          <div className={styles.streamDetailBox}>
            <div className={styles.streamDetailHeader}>
              <div>
                <span className={styles.streamDetailLabel}>
                  {INCOME_STREAM_OPTIONS.find((o) => o.key === selectedStream)?.label}
                </span>
                <strong className={styles.streamDetailTotal}>
                  {formatINR(historyData?.total ?? getStream(selectedStream).total)}
                </strong>
              </div>
              <span className={styles.streamDetailCount}>
                {historyData?.totalCount ?? getStream(selectedStream).count} transaction
                {(historyData?.totalCount ?? getStream(selectedStream).count) === 1 ? '' : 's'}
              </span>
            </div>

            {historyLoading ? (
              <div className={styles.streamHistoryLoading}>
                <div className={styles.modernSpinner}></div>
              </div>
            ) : !historyData?.transactions?.length ? (
              <div className={styles.streamEmptyState}>
                <span>💳</span>
                <p>No transactions yet for this income stream</p>
              </div>
            ) : (
              <div className={styles.streamTransactionList}>
                {historyData.transactions.map((tx) => (
                  <div key={tx._id || tx.transactionId} className={styles.streamTransactionItem}>
                    <div className={styles.streamTxLeft}>
                      <span className={styles.streamTxType}>{tx.type?.replace(/_/g, ' ')}</span>
                      <span className={styles.streamTxDate}>
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <strong className={styles.streamTxAmount}>+{formatINR(tx.creditedAmount)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Repurchase Notice Banner */}
      <div
        className={styles.repurchaseNoticeBox}
        onClick={() => navigate('/member/repurchase')}
        role="button"
        tabIndex={0}
      >
        <div className={styles.noticeIconWrap}>🛍️</div>
        <div className={styles.noticeContent}>
          <h4>Looking for Repurchase Earnings & Wallets?</h4>
          <p>
            Self Repurchase and 10-Level Downline Repurchase Incomes are tracked and credited directly inside the <strong>Repurchase</strong> dashboard.
          </p>
        </div>
        <div className={styles.noticeAction}>
          <span>Open Repurchase Hub →</span>
        </div>
      </div>
    </div>
  );
};

export default IncomePage;
