// client/src/components/member/SalaryProgressCard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import styles from './SalaryProgressCard.module.css';

const SalaryProgressCard = () => {
  const [salaryData, setSalaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSalaryStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/wallet/salary');
      if (res.data?.success && res.data?.data) {
        setSalaryData(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch salary status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSalaryStatus();
  }, [fetchSalaryStatus]);

  const formatINR = (val) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);

  if (loading) {
    return (
      <div className={styles.loadingSkeletonCard}>
        <div className={styles.skeletonPulseHeader}></div>
        <div className={styles.skeletonPulseRow}></div>
      </div>
    );
  }

  if (error || !salaryData) {
    return null; // Fail silently or render retry button if needed
  }

  const q = salaryData.qualificationStatus || {};
  const isGold = q.isGoldStarRank;
  const isQualified = q.isQualifiedThisMonth;

  // Calculate percentage toward required leg goals (capped at 100%)
  const leftPct = q.requiredPerLegGrowth > 0
    ? Math.min(100, Math.round((q.leftGrowthAchieved / q.requiredPerLegGrowth) * 100))
    : 0;

  const rightPct = q.requiredPerLegGrowth > 0
    ? Math.min(100, Math.round((q.rightGrowthAchieved / q.requiredPerLegGrowth) * 100))
    : 0;

  return (
    <div className={styles.salaryCardContainer}>
      {/* Header with Title & Balance */}
      <div className={styles.cardHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.badgeTag}>MONTHLY SALARY WALLET</span>
          <h3 className={styles.mainTitle}>1% Team Turn Over (TTO)</h3>
          <p className={styles.subTitle}>
            Requires Gold Star Rank (200 Star) + 10% Monthly Growth (50:50 Leg Ratio)
          </p>
        </div>

        <div className={styles.balanceBox}>
          <span className={styles.balanceLabel}>SALARY BALANCE</span>
          <strong className={styles.balanceValue}>{formatINR(salaryData.salaryBalance)}</strong>
          <small className={styles.lifetimeEarned}>
            Lifetime: {formatINR(salaryData.totalSalaryEarned)}
          </small>
        </div>
      </div>

      {/* Rank Status Alert */}
      {!isGold ? (
        <div className={styles.rankNoticeYellow}>
          <div className={styles.noticeIcon}>⭐</div>
          <div className={styles.noticeText}>
            <strong>Gold Star Rank Required</strong>
            <p>
              You need at least 200 Total Stars to qualify for monthly salary benefits.
              Current Volume: <strong>{q.currentTotalStars || 0} / 200 Stars</strong>.
            </p>
          </div>
        </div>
      ) : (
        <div className={styles.rankNoticeGreen}>
          <div className={styles.noticeIcon}>🏆</div>
          <div className={styles.noticeText}>
            <strong>Gold Star Rank Achieved ({q.currentTotalStars} Stars)</strong>
            <p>
              Maintain a 10% monthly volume growth split equally 50:50 across Left and Right legs.
            </p>
          </div>
        </div>
      )}

      {/* 50:50 Leg Ratio Growth Trackers */}
      <div className={styles.gaugesContainer}>
        {/* Left Leg Target */}
        <div className={styles.legCard}>
          <div className={styles.legHeader}>
            <span className={styles.legTagLeft}>LEFT LEG GROWTH (50%)</span>
            <span className={styles.pctBadgeLeft}>{leftPct}%</span>
          </div>
          <div className={styles.volumeStatRow}>
            <strong>+{q.leftGrowthAchieved || 0} Stars</strong>
            <small>/ +{(q.requiredPerLegGrowth || 0).toFixed(1)} required</small>
          </div>
          <div className={styles.progressBarBg}>
            <div
              className={styles.progressBarFillLeft}
              style={{ width: `${leftPct}%` }}
            ></div>
          </div>
        </div>

        {/* Right Leg Target */}
        <div className={styles.legCard}>
          <div className={styles.legHeader}>
            <span className={styles.legTagRight}>RIGHT LEG GROWTH (50%)</span>
            <span className={styles.pctBadgeRight}>{rightPct}%</span>
          </div>
          <div className={styles.volumeStatRow}>
            <strong>+{q.rightGrowthAchieved || 0} Stars</strong>
            <small>/ +{(q.requiredPerLegGrowth || 0).toFixed(1)} required</small>
          </div>
          <div className={styles.progressBarBg}>
            <div
              className={styles.progressBarFillRight}
              style={{ width: `${rightPct}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Turn Over (TTO) & Qualification Summary Footer */}
      <div className={styles.summaryFooter}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>CURRENT MONTH TTO</span>
          <strong className={styles.summaryValue}>{formatINR(q.teamTurnoverThisMonth)}</strong>
        </div>

        <div className={styles.summaryDivider}></div>

        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>ESTIMATED 1% SALARY</span>
          <strong className={isQualified ? styles.qualifiedValue : styles.normalValue}>
            {formatINR(q.projected1PercentSalary)}
          </strong>
        </div>

        <div className={styles.summaryDivider}></div>

        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>STATUS</span>
          <span className={isQualified ? styles.statusBadgeQualified : styles.statusBadgeProgress}>
            {isQualified ? '✓ Qualified' : 'In Progress'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SalaryProgressCard;