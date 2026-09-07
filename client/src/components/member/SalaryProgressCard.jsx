// client/src/components/dashboard/SalaryProgressCard.jsx (or embedded in DashboardPage.jsx)
import React from 'react';
import styles from './SalaryProgressCard.module.css';

const SalaryProgressCard = ({ data }) => {
  const salary = data?.salaryQualification || {};
  const currentStars = salary.currentStars || 0;
  const leftStars = salary.leftStars || 0;
  const rightStars = salary.rightStars || 0;
  const starsNeeded = salary.starsNeeded !== undefined ? salary.starsNeeded : 200;
  const progressPercentage = salary.progressPercentage || 0;
  const isQualified = salary.isQualified || false;

  return (
    <div className={styles.salaryCardWrapper}>
      <div className={styles.cardHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.categoryPill}>MONTHLY SALARY WALLET</span>
          <h3>1% Team Turn Over (TTO)</h3>
          <p>Requires Gold Star Rank (200 Stars) • 10% Monthly Growth (50:50 Leg Ratio)</p>
        </div>
        <div className={styles.balanceBadge}>
          <span className={styles.balanceLabel}>SALARY BALANCE</span>
          <strong>₹{Number(data?.salaryBalance || 0).toLocaleString('en-IN')}</strong>
          <small>Lifetime: ₹{Number(data?.totalSalaryEarned || 0).toLocaleString('en-IN')}</small>
        </div>
      </div>

      <div className={styles.rankNoticeBanner}>
        <span className={styles.starIcon}>⭐</span>
        <div className={styles.rankNoticeContent}>
          <strong>Gold Star Rank Required (200 Stars)</strong>
          <p>
            Monthly Royalty Salary unlocks at Gold Star Rank. You currently have{' '}
            <strong>{currentStars} Matched Stars</strong> ({leftStars} Left : {rightStars} Right).
          </p>
        </div>
      </div>

      <div className={styles.progressBarSection}>
        <div className={styles.progressLabels}>
          <span>Progress toward Gold Star Rank</span>
          <strong>{currentStars} / 200 Stars ({progressPercentage}%)</strong>
        </div>
        <div className={styles.track}>
          <div className={styles.fill} style={{ width: `${progressPercentage}%` }}></div>
        </div>
      </div>

      <div className={styles.statsSummaryFooter}>
        <div className={styles.statCol}>
          <span>YOUR CURRENT STARS</span>
          <strong>{currentStars} Stars</strong>
        </div>

        <div className={styles.statCol}>
          <span>STARS NEEDED FOR GOLD STAR</span>
          <strong>{starsNeeded} Stars</strong>
        </div>

        <div className={styles.statCol}>
          <span>STATUS</span>
          <span className={isQualified ? styles.statusUnlocked : styles.statusLocked}>
            ● {salary.statusText || 'Locked (Pre-Gold Star)'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SalaryProgressCard;