// client/src/components/member/SalaryProgressCard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import styles from './SalaryProgressCard.module.css';

const SalaryProgressCard = () => {
  const [salaryData, setSalaryData] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [lifetimeSalary, setLifetimeSalary] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchSalaryStatus = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch data from dashboard-stats endpoint
      const res = await api.get('/api/users/dashboard-stats');
      if (res.data?.success && res.data?.data) {
        setSalaryData(res.data.data.salaryQualification);
        setWalletBalance(res.data.data.salaryBalance || 0);
        setLifetimeSalary(res.data.data.totalSalaryEarned || 0);
      }
    } catch (err) {
      console.error('Failed to load salary progress:', err);
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
    }).format(Number(val) || 0);

  if (loading) {
    return (
      <div className={styles.salaryCardContainer}>
        <div className={styles.loadingSkeleton}>
          <div className={styles.skeletonPulseHeader}></div>
          <div className={styles.skeletonPulseRow}></div>
        </div>
      </div>
    );
  }

  const q = salaryData || {};
  const isGold = q.isGoldStarRank || q.isGoldStarAchieved;
  const currentStars = q.currentMatchedStars || 0;
  const requiredStars = q.requiredMinStar || 200;
  const rankProgressPct = Math.min(100, Math.round((currentStars / requiredStars) * 100));

  const leftPct = q.requiredPerLegGrowth > 0
    ? Math.min(100, Math.round(((q.leftGrowthAchieved || 0) / q.requiredPerLegGrowth) * 100))
    : 0;

  const rightPct = q.requiredPerLegGrowth > 0
    ? Math.min(100, Math.round(((q.rightGrowthAchieved || 0) / q.requiredPerLegGrowth) * 100))
    : 0;

  return (
    <div className={styles.salaryCardContainer}>
      {/* Header with Title & Balance */}
      <div className={styles.cardHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.badgeTag}>MONTHLY SALARY WALLET</span>
          <h3 className={styles.mainTitle}>1% Team Turn Over (TTO)</h3>
          <p className={styles.subTitle}>
            Requires <strong>Gold Star Rank (200 Stars)</strong> • 10% Monthly Growth (50:50 Leg Ratio)
          </p>
        </div>

        <div className={styles.balanceBox}>
          <span className={styles.balanceLabel}>SALARY BALANCE</span>
          <strong className={styles.balanceValue}>{formatINR(walletBalance)}</strong>
          <small className={styles.lifetimeEarned}>
            Lifetime: {formatINR(lifetimeSalary)}
          </small>
        </div>
      </div>

      {/* Conditional UI: Pre-Gold Star vs. Gold Star Achieved */}
      {!isGold ? (
        /* ================= 🔒 PRE-GOLD STAR VIEW ================= */
        <div className={styles.preGoldSection}>
          <div className={styles.rankNoticeYellow}>
            <div className={styles.noticeIcon}>⭐</div>
            <div className={styles.noticeText}>
              <strong>Gold Star Rank Required (200 Stars)</strong>
              <p>
                Monthly Royalty Salary unlocks at Gold Star Rank. You currently have{' '}
                <strong>{currentStars} Matched Star{currentStars === 1 ? '' : 's'}</strong> ({q.currentLeftStar || 0} Left : {q.currentRightStar || 0} Right).
              </p>
            </div>
          </div>

          <div className={styles.rankProgressCard}>
            <div className={styles.rankProgressHeader}>
              <span>Progress toward Gold Star Rank</span>
              <strong>{currentStars} / {requiredStars} Stars ({rankProgressPct}%)</strong>
            </div>
            <div className={styles.progressBarTrack}>
              <div
                className={styles.progressBarFillGold}
                style={{ width: `${Math.max(2, rankProgressPct)}%` }}
              ></div>
            </div>
          </div>

          <div className={styles.summaryFooter}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>YOUR CURRENT STARS</span>
              <strong className={styles.summaryValue}>{currentStars} Stars</strong>
            </div>

            <div className={styles.summaryDivider}></div>

            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>STARS NEEDED FOR GOLD STAR</span>
              <strong className={styles.summaryValue}>{Math.max(0, requiredStars - currentStars)} Stars</strong>
            </div>

            <div className={styles.summaryDivider}></div>

            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>STATUS</span>
              <span className={styles.statusBadgeProgress}>🔒 Locked (Pre-Gold Star)</span>
            </div>
          </div>
        </div>
      ) : (
        /* ================= 🏆 GOLD STAR ACHIEVED VIEW ================= */
        <div className={styles.goldStarSection}>
          <div className={styles.rankNoticeGreen}>
            <div className={styles.noticeIcon}>🏆</div>
            <div className={styles.noticeText}>
              <strong>Gold Star Rank Achieved ({currentStars} Stars)</strong>
              <p>Maintain 10% monthly volume growth split equally 50:50 across Left and Right legs.</p>
            </div>
          </div>

          <div className={styles.gaugesContainer}>
            {/* Left Leg Target */}
            <div className={styles.legCard}>
              <div className={styles.legHeader}>
                <span className={styles.legTagLeft}>LEFT LEG GROWTH (50%)</span>
                <span className={styles.pctBadgeLeft}>{leftPct}%</span>
              </div>
              <div className={styles.volumeStatRow}>
                <strong>+{q.leftGrowthAchieved || 0} Stars</strong>
                <small>/ +{q.requiredPerLegGrowth || 10} required</small>
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
                <small>/ +{q.requiredPerLegGrowth || 10} required</small>
              </div>
              <div className={styles.progressBarBg}>
                <div
                  className={styles.progressBarFillRight}
                  style={{ width: `${rightPct}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className={styles.summaryFooter}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>CURRENT MONTH TTO</span>
              <strong className={styles.summaryValue}>{formatINR(q.teamTurnoverThisMonth || q.currentMonthTTO || 0)}</strong>
            </div>

            <div className={styles.summaryDivider}></div>

            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>ESTIMATED 1% SALARY</span>
              <strong className={q.isQualifiedThisMonth ? styles.qualifiedValue : styles.normalValue}>
                {formatINR(q.projected1PercentSalary || q.estimatedSalary || 0)}
              </strong>
            </div>

            <div className={styles.summaryDivider}></div>

            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>STATUS</span>
              <span className={q.isQualifiedThisMonth ? styles.statusBadgeQualified : styles.statusBadgeProgress}>
                {q.isQualifiedThisMonth ? '✓ Qualified' : 'In Progress'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryProgressCard;