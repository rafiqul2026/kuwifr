// client/src/pages/member/RanksPage.jsx
import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { useNotification } from "../../hooks/useNotification";
import SalaryProgressCard from "../../components/member/SalaryProgressCard";
import styles from "./RanksPage.module.css";

const formatINR = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(val) || 0);

const FALLBACK_RANKS = [
  {
    _id: '1',
    level: 1,
    name: 'Star Executive',
    code: 'STAR',
    starsRequired: 0,
    salaryPercentage: 0,
    reward: 'Recognition Badge',
    color: '#3b82f6',
    icon: '⭐',
    benefits: ['First milestone of binary pair matching', 'Direct referral privileges'],
    isActive: true
  },
  {
    _id: '2',
    level: 2,
    name: 'Bronze Leader',
    code: 'BRONZE',
    starsRequired: 6,
    salaryPercentage: 0,
    reward: 'Bronze Pin + ₹2,000 Cash Reward',
    color: '#cd7f32',
    icon: '🥉',
    benefits: ['Leadership Recognition', 'Team Overrides'],
    isActive: true
  },
  {
    _id: '3',
    level: 3,
    name: 'Silver Director',
    code: 'SILVER',
    starsRequired: 20,
    salaryPercentage: 0,
    reward: 'Silver Trophy + ₹5,000 Cash Reward',
    color: '#94a3b8',
    icon: '🥈',
    benefits: ['Director Level Perks', 'Special Leadership Trainings'],
    isActive: true
  },
  {
    _id: '4',
    level: 4,
    name: 'Gold Director',
    code: 'GOLD',
    starsRequired: 70,
    salaryPercentage: 0,
    reward: 'Gold Trophy + ₹10,000 Cash Reward',
    color: '#f59e0b',
    icon: '🥇',
    benefits: ['Executive Access', 'Quarterly Growth Meets'],
    isActive: true
  },
  {
    _id: '5',
    level: 5,
    name: 'Ruby Ambassador',
    code: 'RUBY',
    starsRequired: 200,
    salaryPercentage: 0.01,
    reward: 'Ruby Ring + ₹25,000 Cash Reward',
    color: '#ef4444',
    icon: '💎',
    benefits: ['1% Monthly TTO Royalty', 'National Convention VIP Access'],
    isActive: true
  },
  {
    _id: '6',
    level: 6,
    name: 'Emerald Ambassador',
    code: 'EMERALD',
    starsRequired: 700,
    salaryPercentage: 0.0075,
    reward: 'Emerald Shield + ₹60,000 Cash Reward',
    color: '#10b981',
    icon: '🟢',
    benefits: ['0.75% Monthly TTO Royalty', 'Luxury Travel Allowance'],
    isActive: true
  },
  {
    _id: '7',
    level: 7,
    name: 'Diamond King',
    code: 'DIAMOND',
    starsRequired: 2200,
    salaryPercentage: 0.005,
    reward: 'Diamond Trophy + International Trip',
    color: '#06b6d4',
    icon: '💠',
    benefits: ['0.50% Monthly TTO Royalty', 'International Tours'],
    isActive: true
  },
  {
    _id: '8',
    level: 8,
    name: 'Crown Ambassador',
    code: 'CROWN',
    starsRequired: 7000,
    salaryPercentage: 0.004,
    reward: 'Gold Crown + Luxury Car Fund',
    color: '#8b5cf6',
    icon: '👑',
    benefits: ['0.40% Monthly TTO Royalty', 'Car Fund Eligibility'],
    isActive: true
  },
  {
    _id: '9',
    level: 9,
    name: 'Royal Crown',
    code: 'ROYAL_CROWN',
    starsRequired: 15000,
    salaryPercentage: 0.003,
    reward: 'Royal Trophy + Luxury Villa Fund',
    color: '#ec4899',
    icon: '🏰',
    benefits: ['0.30% Monthly TTO Royalty', 'House Fund Eligibility'],
    isActive: true
  },
  {
    _id: '10',
    level: 10,
    name: 'Universal King',
    code: 'UNIVERSAL_KING',
    starsRequired: 35000,
    salaryPercentage: 0.0025,
    reward: 'Global Honor Ring + ₹10,00,000',
    color: '#6366f1',
    icon: '🌌',
    benefits: ['0.25% Monthly TTO Royalty', 'Global Board Member'],
    isActive: true
  },
  {
    _id: '11',
    level: 11,
    name: 'Global Legend',
    code: 'GLOBAL_LEGEND',
    starsRequired: 75000,
    salaryPercentage: 0.002,
    reward: 'Legend Award + ₹25,00,000',
    color: '#d946ef',
    icon: '⚜️',
    benefits: ['0.20% Monthly TTO Royalty', 'Lifetime Council Access'],
    isActive: true
  },
  {
    _id: '12',
    level: 12,
    name: 'Kuwi Emperor',
    code: 'KUWI_EMPEROR',
    starsRequired: 160000,
    salaryPercentage: 0.0015,
    reward: 'Emperor Royal Crest + ₹50,00,000',
    color: '#eab308',
    icon: '🦁',
    benefits: ['0.15% Monthly TTO Royalty', 'Company Lifetime Dividend'],
    isActive: true
  }
];

const RanksPage = () => {
  const [ranks, setRanks] = useState([]);
  const [myRanks, setMyRanks] = useState({
    current: null,
    currentStars: 0,
    currentLeftStars: 0,
    currentRightStars: 0,
    totalRanks: 0,
    achievements: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('ALL');
  // Current Fund Achieved, Reward Achieved, Current Remuneration, Monthly/
  // Today/Total Star, Star For Next Rank — moved here from the Member
  // Dashboard (docx: "in this page Add the below cards"). Fetched from the
  // same dashboard-stats endpoint the dashboard used, isolated so a
  // failure here never blocks the rank ladder above.
  const [rankSnapshot, setRankSnapshot] = useState(null);
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchRankData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/users/dashboard-stats')
      .then((res) => {
        if (cancelled) return;
        if (res.data?.success && res.data?.data) {
          setRankSnapshot(res.data.data);
        }
      })
      .catch(() => {
        // Non-critical — the rank ladder below still works fine.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchRankData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [allRanksRes, myRanksRes] = await Promise.all([
        api.get("/api/ranks/all").catch(() => ({ data: { success: false } })),
        api.get("/api/ranks/my-ranks").catch(() => ({ data: { success: false } })),
      ]);

      let loadedRanks = FALLBACK_RANKS;
      if (allRanksRes.data?.success && Array.isArray(allRanksRes.data.data?.ranks) && allRanksRes.data.data.ranks.length > 0) {
        loadedRanks = allRanksRes.data.data.ranks;
      }
      setRanks(loadedRanks);

      if (myRanksRes.data?.success && myRanksRes.data.data) {
        const d = myRanksRes.data.data;
        setMyRanks({
          current: d.current || null,
          currentStars: typeof d.currentStars === 'number' ? d.currentStars : 0,
          currentLeftStars: typeof d.currentLeftStars === 'number' ? d.currentLeftStars : 0,
          currentRightStars: typeof d.currentRightStars === 'number' ? d.currentRightStars : 0,
          totalRanks: d.totalRanks || (Array.isArray(d.achievements) ? d.achievements.length : 0),
          achievements: Array.isArray(d.achievements) ? d.achievements : []
        });
      } else {
        setMyRanks({
          current: null,
          currentStars: 0,
          currentLeftStars: 0,
          currentRightStars: 0,
          totalRanks: 0,
          achievements: []
        });
      }
    } catch (err) {
      console.error("Failed to fetch rank data:", err);
      setError("Failed to load rank progression data");
      setRanks(FALLBACK_RANKS);
      showNotification("Using synchronized rank ladder", "info");
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = (progress) => {
    if (progress >= 100) return "#16a34a";
    if (progress >= 50) return "#d97706";
    return "#008080";
  };

  const getRankIcon = (rank) => {
    return rank?.icon || "🏆";
  };

  const getRankColor = (rank) => {
    return rank?.color || "#008080";
  };

  const getRankConditions = (rank) => {
    const conditions = {
      1: {
        requirement: "2:1 or 1:2 — that means 3 Direct Joining, Minimum 3,000 KBP",
        timeLimit: "Time Limit: 15 days from the date of joining",
        salary: null
      },
      2: {
        requirement: "6 Kuwi Stars — Left 3 Star : Right 3 Star",
        timeLimit: "No Time Limit",
        salary: null
      },
      3: {
        requirement: "20 Kuwi Stars — Left 10 Star : Right 10 Star",
        timeLimit: "No Time Limit",
        salary: null
      },
      4: {
        requirement: "70 Kuwi Stars — Left 35 Star : Right 35 Star",
        timeLimit: "No Time Limit",
        salary: null
      },
      5: {
        requirement: "200 Kuwi Stars — Left 100 Star : Right 100 Star",
        timeLimit: "No Time Limit",
        salary: "1% Remuneration on Monthly TTO"
      },
      6: {
        requirement: "700 Kuwi Stars — Left 350 Star : Right 350 Star",
        timeLimit: "No Time Limit",
        salary: "0.75% Remuneration on Monthly TTO"
      },
      7: {
        requirement: "2,200 Kuwi Stars — Left 1,100 Star : Right 1,100 Star",
        timeLimit: "No Time Limit",
        salary: "0.50% Remuneration on Monthly TTO"
      },
      8: {
        requirement: "7,000 Kuwi Stars — Left 3,500 Star : Right 3,500 Star",
        timeLimit: "No Time Limit",
        salary: "0.40% Remuneration on Monthly TTO"
      },
      9: {
        requirement: "15,000 Kuwi Stars — Left 7,500 Star : Right 7,500 Star",
        timeLimit: "No Time Limit",
        salary: "0.30% Remuneration on Monthly TTO"
      },
      10: {
        requirement: "35,000 Kuwi Stars — Left 17,500 Star : Right 17,500 Star",
        timeLimit: "No Time Limit",
        salary: "0.25% Remuneration on Monthly TTO"
      },
      11: {
        requirement: "75,000 Kuwi Stars — Left 37,500 Star : Right 37,500 Star",
        timeLimit: "No Time Limit",
        salary: "0.20% Remuneration on Monthly TTO"
      },
      12: {
        requirement: "160,000 Kuwi Stars — Left 80,000 Star : Right 80,000 Star",
        timeLimit: "No Time Limit",
        salary: "0.15% Remuneration on Monthly TTO"
      }
    };
    return conditions[rank?.level] || { requirement: "Complete required Kuwi Stars, balanced Left : Right", timeLimit: "No Time Limit", salary: null };
  };

  const isRankAchieved = (rank) => {
    return myRanks.achievements?.some(
      (a) => a.rankId?._id === rank._id || a.rankId === rank._id || a.rankLevel === rank.level
    );
  };

  const filteredRanks = activeFilter === 'ALL'
    ? ranks
    : activeFilter === 'ACHIEVED'
      ? ranks.filter((r) => isRankAchieved(r))
      : ranks.filter((r) => !isRankAchieved(r));

  // "Next to next basis" sequential unlock (comp plan: "these cards will
  // lock until the Achievement of the [previous] Rank. After Achieve
  // [previous] Rank, [this] Rank progress bar will continue.") — only the
  // SINGLE lowest-level not-yet-achieved rank is actually "in progress";
  // every rank beyond it must show as fully Locked, even if the member's
  // raw star count would otherwise compute a nonzero-looking percentage
  // for it (e.g. Platinum/Gold/Sapphire all showing "In Progress" while
  // Silver Star itself is still unachieved). Computed off the full,
  // level-sorted `ranks` list — NOT `filteredRanks` — so the lock boundary
  // never shifts just because the visible filter/tab changed.
  const nextUnlockedLevel = (() => {
    const sortedByLevel = [...ranks].sort((a, b) => (a.level || 0) - (b.level || 0));
    const firstUnachieved = sortedByLevel.find((r) => !isRankAchieved(r));
    return firstUnachieved ? firstUnachieved.level : null;
  })();

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading career ranks and achievements...</p>
      </div>
    );
  }

  return (
    <div className={styles.ranksPage}>
      {/* ============ HEADER ============ */}
      <header className={styles.pageHeader}>
        <div className={styles.headerTitleWrap}>
          <span className={styles.headerTag}>🏆 Uncommon Ranks and Rewards</span>
          <h1 className={styles.pageTitle}>Rank and Rewards</h1>
          <p className={styles.pageSubtitle}>
            Rank and Reward starts from 1st Pair Matching only. Every tier requires an equally balanced Left : Right Kuwi Star count — build your team evenly on both legs to unlock rewards and monthly TTO royalties.
          </p>
        </div>
        <div className={styles.starsCount}>
          <span className={styles.starsIcon}>⭐</span>
          <div>
            <strong>{myRanks.currentStars}</strong>
            <small>Kuwi Stars</small>
          </div>
        </div>
      </header>

      {/* ============ CURRENT RANK HERO CARD ============ */}
      <section className={styles.currentRankCard}>
        <div className={styles.currentRankLeft}>
          <div className={styles.currentRankBadge}>
            <span className={styles.currentRankIcon}>
              {getRankIcon(myRanks.current)}
            </span>
          </div>
          <div className={styles.currentRankInfo}>
            <span className={styles.currentRankLabel}>Current Rank</span>
            <h2 className={styles.currentRankName}>
              {myRanks.current?.name || "Member (No Rank Yet)"}
            </h2>
            <span className={styles.currentRankStars}>
              ⭐ {myRanks.currentStars} Kuwi Stars Earned
            </span>
          </div>
        </div>
        <div className={styles.currentRankRight}>
          <div className={styles.achievementStats}>
            <div className={styles.achievementStat}>
              <span className={styles.statNumber}>{myRanks.totalRanks}</span>
              <span className={styles.statLabel}>Achievements</span>
            </div>
            <div className={styles.achievementDivider}></div>
            <div className={styles.achievementStat}>
              <span className={styles.statNumber}>
                {ranks.filter((r) => isRankAchieved(r)).length}/{ranks.length}
              </span>
              <span className={styles.statLabel}>Completed</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ RANK & REWARD SNAPSHOT (moved here from the
          Member Dashboard) ============ */}
      <section className={styles.snapshotSection}>
        <h2 className={styles.snapshotHeading}>Rank & Reward Snapshot</h2>
        <div className={styles.snapshotGrid}>
          <div className={styles.snapshotCard}>
            <div className={styles.snapshotCardHeader}>
              <span className={styles.snapshotCardTitle}>CURRENT RANK</span>
              <div className={styles.snapshotIconBox}>🏆</div>
            </div>
            <h3 className={styles.snapshotValueText}>{rankSnapshot?.currentRank?.name || 'Not Achieved'}</h3>
            <span className={styles.snapshotSub}>Career Progression</span>
          </div>

          <div className={styles.snapshotCard}>
            <div className={styles.snapshotCardHeader}>
              <span className={styles.snapshotCardTitle}>CURRENT FUND ACHIEVED</span>
              <div className={styles.snapshotIconBox}>🎯</div>
            </div>
            <h3 className={styles.snapshotValueText}>
              {rankSnapshot?.currentFundAchieved?.icon || '🎯'} {rankSnapshot?.currentFundAchieved?.name || 'Not Achieved'}
            </h3>
            <span className={styles.snapshotSub}>Life Tension Free Benefit</span>
          </div>

          <div className={styles.snapshotCard}>
            <div className={styles.snapshotCardHeader}>
              <span className={styles.snapshotCardTitle}>REWARD ACHIEVED</span>
              <div className={styles.snapshotIconBox}>🎁</div>
            </div>
            <h3 className={styles.snapshotValueText}>{rankSnapshot?.rewardAchieved?.name || 'Not Achieved'}</h3>
            <span className={styles.snapshotSub}>
              {rankSnapshot?.rewardAchieved?.value ? `Value: ${formatINR(rankSnapshot.rewardAchieved.value)}` : `From ${rankSnapshot?.currentRank?.name || 'Your Rank'}`}
            </span>
          </div>

          <div className={styles.snapshotCard}>
            <div className={styles.snapshotCardHeader}>
              <span className={styles.snapshotCardTitle}>CURRENT REMUNERATION</span>
              <div className={styles.snapshotIconBox}>📜</div>
            </div>
            <h3 className={styles.snapshotValue}>{formatINR(rankSnapshot?.currentRemuneration)}</h3>
            <span className={styles.snapshotSub}>This Month's Rank Salary</span>
          </div>

          <div className={styles.snapshotCard}>
            <div className={styles.snapshotCardHeader}>
              <span className={styles.snapshotCardTitle}>MONTHLY STAR</span>
              <div className={styles.snapshotIconBox}>🌟</div>
            </div>
            <div className={styles.snapshotDualBox}>
              <span className={styles.snapshotDualLeft}>Left: <strong>{rankSnapshot?.monthlyStar?.left || 0}</strong></span>
              <span className={styles.snapshotDualRight}>Right: <strong>{rankSnapshot?.monthlyStar?.right || 0}</strong></span>
            </div>
            <span className={styles.snapshotSub}>Qualified This Month</span>
          </div>

          <div className={styles.snapshotCard}>
            <div className={styles.snapshotCardHeader}>
              <span className={styles.snapshotCardTitle}>TODAY STAR</span>
              <div className={styles.snapshotIconBox}>⭐</div>
            </div>
            <div className={styles.snapshotDualBox}>
              <span className={styles.snapshotDualLeft}>Left: <strong>{rankSnapshot?.todayStar?.left || 0}</strong></span>
              <span className={styles.snapshotDualRight}>Right: <strong>{rankSnapshot?.todayStar?.right || 0}</strong></span>
            </div>
            <span className={styles.snapshotSub}>Today's Stars</span>
          </div>

          <div className={styles.snapshotCard}>
            <div className={styles.snapshotCardHeader}>
              <span className={styles.snapshotCardTitle}>TOTAL STAR</span>
              <div className={styles.snapshotIconBox}>🌟</div>
            </div>
            <div className={styles.snapshotDualBox}>
              <span className={styles.snapshotDualLeft}>Left: <strong>{rankSnapshot?.totalStar?.left || 0}</strong></span>
              <span className={styles.snapshotDualRight}>Right: <strong>{rankSnapshot?.totalStar?.right || 0}</strong></span>
            </div>
            <span className={styles.snapshotSub}>Lifetime Stars</span>
          </div>

          <div className={styles.snapshotCard}>
            <div className={styles.snapshotCardHeader}>
              <span className={styles.snapshotCardTitle}>STAR FOR NEXT RANK</span>
              <div className={styles.snapshotIconBox}>🚀</div>
            </div>
            {rankSnapshot?.starForNextRank?.rankName ? (
              <div className={styles.snapshotDualBox}>
                <span className={styles.snapshotDualLeft}>Left: <strong>{rankSnapshot.starForNextRank.left || 0}</strong></span>
                <span className={styles.snapshotDualRight}>Right: <strong>{rankSnapshot.starForNextRank.right || 0}</strong></span>
              </div>
            ) : (
              <h3 className={styles.snapshotValueText}>Max Rank Achieved</h3>
            )}
            <span className={styles.snapshotSub}>
              {rankSnapshot?.starForNextRank?.rankName ? `Required Per Leg for ${rankSnapshot.starForNextRank.rankName}` : 'All Ranks Completed'}
            </span>
          </div>
        </div>

        {/* Remuneration (Rank Salary) Live Progress — moved here alongside
            the rest of the rank data it belongs with. */}
        <SalaryProgressCard data={rankSnapshot} />
      </section>

      {/* ============ SEGMENTED FILTER BUTTONS ============ */}
      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.filterBtn} ${activeFilter === 'ALL' ? styles.active : ''}`}
          onClick={() => setActiveFilter('ALL')}
        >
          All Ranks ({ranks.length})
        </button>
        <button
          type="button"
          className={`${styles.filterBtn} ${activeFilter === 'ACHIEVED' ? styles.active : ''}`}
          onClick={() => setActiveFilter('ACHIEVED')}
        >
          ✅ Achieved ({ranks.filter((r) => isRankAchieved(r)).length})
        </button>
        <button
          type="button"
          className={`${styles.filterBtn} ${activeFilter === 'LOCKED' ? styles.active : ''}`}
          onClick={() => setActiveFilter('LOCKED')}
        >
          🔒 In Progress / Locked ({ranks.filter((r) => !isRankAchieved(r)).length})
        </button>
      </div>

      {/* ============ RANKS GRID ============ */}
      <div className={styles.ranksGrid}>
        {filteredRanks.length === 0 ? (
          <div className={styles.emptyState}>
            <span>🏆</span>
            <p>No ranks found for this filter</p>
          </div>
        ) : (
          filteredRanks.map((rank, index) => {
            const isAchieved = isRankAchieved(rank);
            // Uncommon Ranks and Rewards: every tier needs the SAME star
            // count on BOTH legs (e.g. Bronze = 6 total, but only counts
            // once you have 3 Left AND 3 Right), so progress tracks the
            // limiting (smaller) leg against half the requirement — not the
            // combined total, which could read 100% from one lopsided leg.
            //
            // rank.requiredPerLeg is computed server-side as this tier's own
            // raw starsRequired/2 (e.g. Silver Star = 20 stars -> 10 per
            // leg — matching the comp plan's own "Left 10 Stars : Right 10
            // Stars" text exactly). Fall back to deriving the same half
            // locally only if the API response predates this field (e.g.
            // the static FALLBACK_RANKS list used when unreachable).
            const requiredPerLeg = typeof rank.requiredPerLeg === 'number'
              ? rank.requiredPerLeg
              : (rank.starsRequired > 0 ? Math.ceil(rank.starsRequired / 2) : 0);
            const limitingLegStars = Math.min(myRanks.currentLeftStars || 0, myRanks.currentRightStars || 0);
            const progress = requiredPerLeg > 0
              ? Math.min(100, Math.round((limitingLegStars / requiredPerLeg) * 100))
              : rank.level === 1 ? (isAchieved ? 100 : 0) : 0;

            const rankColor = getRankColor(rank);
            const rankIcon = getRankIcon(rank);
            // Sequential lock: this card is still out of reach if it isn't
            // achieved AND it isn't the single next rank up for grabs.
            const isLockedAhead = !isAchieved && typeof nextUnlockedLevel === 'number' && rank.level > nextUnlockedLevel;
            const isNext = !isAchieved && !isLockedAhead && progress > 0;
            const conditions = getRankConditions(rank);
            const isHighestAchieved = isAchieved && myRanks.current?._id === rank._id;
            const lockedOnRank = isLockedAhead
              ? [...ranks].sort((a, b) => (a.level || 0) - (b.level || 0)).find((r) => !isRankAchieved(r))
              : null;

            return (
              <article
                key={rank._id || rank.level}
                className={`${styles.rankCard} ${isAchieved ? styles.achieved : ''} ${isNext ? styles.next : ''}`}
                style={{
                  borderLeftColor: isAchieved ? rankColor : isNext ? '#d97706' : '#e5e5e5',
                  animationDelay: `${index * 0.03}s`
                }}
              >
                <div className={styles.rankCardHeader}>
                  <div className={styles.rankIconWrapper} style={{ background: isAchieved ? rankColor : '#f3f3f3' }}>
                    <span className={styles.rankIcon}>{rankIcon}</span>
                  </div>
                  <div className={styles.rankCardInfo}>
                    <div className={styles.rankNameRow}>
                      <h3 className={styles.rankName}>{rank.name}</h3>
                      <span className={styles.rankLevel}>Level {rank.level}</span>
                    </div>
                    <div className={styles.rankMeta}>
                      <span className={styles.rankStars}>
                        ⭐ {rank.starsRequired ? `${rank.starsRequired.toLocaleString()} Stars Required` : 'Direct Pair Milestone'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.rankStatus}>
                    <span className={`${styles.statusBadge} ${isAchieved ? styles.achievedBadge : isNext ? styles.nextBadge : styles.lockedBadge}`}>
                      {isAchieved ? '✅ Achieved' : isNext ? '⏳ In Progress' : '🔒 Locked'}
                    </span>
                  </div>
                </div>

                <div className={styles.rankCardBody}>
                  {/* Rank Conditions */}
                  <div className={styles.rankConditions}>
                    <div className={styles.conditionItem}>
                      <span className={styles.conditionIcon}>📋</span>
                      <span className={styles.conditionText}>
                        <strong>Requirement:</strong> {conditions.requirement}
                      </span>
                    </div>
                    <div className={styles.conditionItem}>
                      <span className={styles.conditionIcon}>⏰</span>
                      <span className={styles.conditionText}>
                        <strong>Time Limit:</strong> {conditions.timeLimit}
                      </span>
                    </div>
                    {conditions.salary && (
                      <div className={`${styles.conditionItem} ${styles.salaryCondition}`}>
                        <span className={styles.conditionIcon}>💰</span>
                        <span className={styles.conditionText}>
                          <strong>Monthly Royalty:</strong> {conditions.salary}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar — only for the single next-up rank */}
                  {!isAchieved && !isLockedAhead && rank.starsRequired > 0 && (
                    <div className={styles.progressWrapper}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{
                            width: `${progress}%`,
                            background: getProgressColor(progress)
                          }}
                        />
                      </div>
                      <div className={styles.progressTextRow}>
                        <span>
                          L: {(myRanks.currentLeftStars || 0).toLocaleString()} / R: {(myRanks.currentRightStars || 0).toLocaleString()}
                          {' '}(need {requiredPerLeg.toLocaleString()} on each leg)
                        </span>
                        <strong>{progress}% Complete</strong>
                      </div>
                    </div>
                  )}

                  {/* Locked — every rank beyond the current next-up tier
                      stays locked, with no progress preview, until the
                      ranks in between are achieved in order. */}
                  {isLockedAhead && (
                    <div className={styles.lockedWrapper}>
                      <span className={styles.lockedIcon}>🔒</span>
                      <span className={styles.lockedText}>
                        Locked — achieve <strong>{lockedOnRank?.name || 'the previous rank'}</strong> first to unlock progress on this rank.
                      </span>
                    </div>
                  )}

                  {/* Achieved Details */}
                  {isAchieved && (
                    <div className={styles.achievedDetails}>
                      {rank.reward && (
                        <div className={styles.rewardTag}>
                          🎁 <strong>Reward:</strong> {rank.reward}
                        </div>
                      )}
                      {rank.salaryPercentage > 0 && isHighestAchieved && (
                        <div className={styles.salaryTag}>
                          💰 <strong>Active Royalty:</strong> {(rank.salaryPercentage * 100).toFixed(2)}% on TTO monthly
                        </div>
                      )}
                      {rank.benefits && rank.benefits.length > 0 && (
                        <div className={styles.benefitsTags}>
                          {rank.benefits.map((benefit, i) => (
                            <span key={i} className={styles.benefitTag}>{benefit}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Next Rank Info */}
                  {isNext && (
                    <div className={styles.nextInfo}>
                      <span>
                        Need <strong>{Math.max(0, requiredPerLeg - (myRanks.currentLeftStars || 0)).toLocaleString()}</strong> more on Left
                        {' '}and <strong>{Math.max(0, requiredPerLeg - (myRanks.currentRightStars || 0)).toLocaleString()}</strong> more on Right
                        {' '}to unlock {rank.name}
                      </span>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RanksPage;