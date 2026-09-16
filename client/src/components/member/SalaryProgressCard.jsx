// client/src/components/dashboard/SalaryProgressCard.jsx (or embedded in DashboardPage.jsx)
import React from 'react';
import styles from './SalaryProgressCard.module.css';

const SalaryProgressCard = ({ data }) => {
  // NOTE: these field names must match SalaryService.getLiveSalaryProgress()'s
  // actual return shape (server/src/services/salary.service.js), NOT a
  // "currentStars/leftStars/..." shape that was never actually returned by
  // the backend — that mismatch previously made this whole card render its
  // zero defaults regardless of the member's real live data.
  const salary = data?.salaryQualification || {};
  // Carry Forward Star business rule: this card's "progress toward Gold
  // Star Rank" must use the SAME carry-forward stars (raw lifetime stars
  // minus whatever's already locked into the member's highest achieved
  // rank) as the rest of the Rank & Rewards page — not the raw lifetime
  // total, which double-counts stars already locked into a lower rank
  // already achieved. The actual Gold Star salary QUALIFICATION check
  // (isCurrentlyQualified/isGoldStarAchieved below) is unaffected — it
  // still evaluates against the real, authoritative threshold server-side.
  const leftStars = data?.carryForwardStar?.left || 0;
  const rightStars = data?.carryForwardStar?.right || 0;
  const currentStars = Math.min(leftStars, rightStars);
  const starsNeeded = salary.requiredMinStar !== undefined ? salary.requiredMinStar : 200;
  const progressPercentage = starsNeeded > 0
    ? Math.max(0, Math.min(100, Math.round((currentStars / starsNeeded) * 100)))
    : 0;
  const isQualified = salary.isCurrentlyQualified || false;

  let statusText = 'Locked (Pre-Gold Star)';
  if (isQualified) {
    statusText = 'Unlocked — Qualified This Month';
  } else if (salary.isGoldStarAchieved === false) {
    statusText = `Locked — ${currentStars}/${starsNeeded} Stars`;
  } else if (salary.has5050Balance === false) {
    statusText = 'Locked — Leg Growth Not Balanced 50:50';
  } else if (salary.has10PercentGrowth === false) {
    statusText = 'Locked — Monthly Growth Below 10%';
  }

  return (
    <div className={styles.salaryCardWrapper}>
      <div className={styles.cardHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.categoryPill}>MONTHLY REMUNERATION WALLET</span>
          <h3>1% Team Turn Over (TTO)</h3>
          <p>Requires Gold Star Rank (200 Stars) • 10% Monthly Growth (50:50 Leg Ratio)</p>
        </div>
        <div className={styles.balanceBadge}>
          <span className={styles.balanceLabel}>REMUNERATION BALANCE</span>
          <strong>₹{Number(data?.salaryBalance || 0).toLocaleString('en-IN')}</strong>
          <small>Lifetime: ₹{Number(data?.totalSalaryEarned || 0).toLocaleString('en-IN')}</small>
        </div>
      </div>

      <div className={styles.rankNoticeBanner}>
        <span className={styles.starIcon}>⭐</span>
        <div className={styles.rankNoticeContent}>
          <strong>Gold Star Rank Required (200 Stars)</strong>
          <p>
            Monthly Remuneration unlocks at Gold Star Rank. You currently have{' '}
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
            ● {statusText}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SalaryProgressCard;