// client/src/pages/member/IncomePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './IncomePage.module.css';

const IncomePage = () => {
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [incomeData, setIncomeData] = useState({
    totalIncome: 0,
    directIncome: 0,
    matchingIncome: 0,
    rankBonus: 0,
    todayIncome: 0,
    history: []
  });

  useEffect(() => {
    fetchIncomeStats();
  }, []);

  const fetchIncomeStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/users/sponsor-stats');
      if (res.data?.success) {
        const d = res.data.data;
        const direct = d.directReferrals ? d.directReferrals * 500 : 0;
        const matching = d.binary?.matchingVolume ? d.binary.matchingVolume * 0.1 : 0;
        setIncomeData({
          totalIncome: direct + matching + (d.rankBonus || 0),
          directIncome: direct,
          matchingIncome: matching,
          rankBonus: d.rankBonus || 0,
          todayIncome: d.todayIncome || 0,
          history: d.transactions || []
        });
      }
    } catch {
      showNotification('Failed to load income details', 'error');
    } finally {
      setLoading(false);
    }
  };

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

      {/* Income Streams Grid */}
      <section className={styles.incomeGrid}>
        {/* Total Network Income */}
        <div className={`${styles.incomeCard} ${styles.totalCard}`}>
          <div className={styles.cardTop}>
            <span className={styles.cardIcon}>💰</span>
            <span className={styles.cardChip}>Cumulative</span>
          </div>
          <div className={styles.cardAmount}>
            <small>₹</small>
            {incomeData.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={styles.cardFooter}>
            <span>Total Network Income</span>
            <strong>Direct + Binary Matching</strong>
          </div>
        </div>

        {/* Direct Referral Income */}
        <div className={`${styles.incomeCard} ${styles.directCard}`}>
          <div className={styles.cardTop}>
            <span className={styles.cardIcon}>🎯</span>
            <span className={styles.cardChip}>Sponsor Bonus</span>
          </div>
          <div className={styles.cardAmount}>
            <small>₹</small>
            {incomeData.directIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={styles.cardFooter}>
            <span>Direct Referral Income</span>
            <strong>Direct Sponsor Activations</strong>
          </div>
        </div>

        {/* Binary Matching Income */}
        <div className={`${styles.incomeCard} ${styles.matchingCard}`}>
          <div className={styles.cardTop}>
            <span className={styles.cardIcon}>🌳</span>
            <span className={styles.cardChip}>10% Match</span>
          </div>
          <div className={styles.cardAmount}>
            <small>₹</small>
            {incomeData.matchingIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={styles.cardFooter}>
            <span>Binary Matching Income</span>
            <strong>Matched Left / Right Volume</strong>
          </div>
        </div>
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
            Self Repurchase (25%) and 10-Level Downline Repurchase Incomes are tracked and credited directly inside the <strong>Repurchase</strong> dashboard.
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