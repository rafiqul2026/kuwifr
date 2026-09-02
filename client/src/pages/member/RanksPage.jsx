// client/src/pages/member/RanksPage.jsx
import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { useNotification } from "../../hooks/useNotification";
import styles from "./RanksPage.module.css";

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
    totalRanks: 0,
    achievements: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchRankData();
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
          totalRanks: d.totalRanks || (Array.isArray(d.achievements) ? d.achievements.length : 0),
          achievements: Array.isArray(d.achievements) ? d.achievements : []
        });
      } else {
        setMyRanks({
          current: null,
          currentStars: 0,
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
    if (progress >= 100) return "#10b981";
    if (progress >= 50) return "#f59e0b";
    return "#2563eb";
  };

  const getRankIcon = (rank) => {
    return rank?.icon || "🏆";
  };

  const getRankColor = (rank) => {
    return rank?.color || "#2563eb";
  };

  const getRankConditions = (rank) => {
    const conditions = {
      1: {
        requirement: "2:1 or 1:2 Direct 3 joining with Minimum 3000 KBP",
        timeLimit: "Time Limit: 15 days from the date of joining",
        salary: null
      },
      2: {
        requirement: "6 Kuwi Stars",
        timeLimit: "No Time Limit",
        salary: null
      },
      3: {
        requirement: "20 Kuwi Stars",
        timeLimit: "No Time Limit",
        salary: null
      },
      4: {
        requirement: "70 Kuwi Stars",
        timeLimit: "No Time Limit",
        salary: null
      },
      5: {
        requirement: "200 Kuwi Stars",
        timeLimit: "No Time Limit",
        salary: "1% Salary on TTO monthly"
      },
      6: {
        requirement: "700 Kuwi Stars",
        timeLimit: "No Time Limit",
        salary: "0.75% Salary on TTO monthly"
      },
      7: {
        requirement: "2,200 Kuwi Stars",
        timeLimit: "No Time Limit",
        salary: "0.50% Salary on TTO monthly"
      },
      8: {
        requirement: "7,000 Kuwi Stars",
        timeLimit: "No Time Limit",
        salary: "0.40% Salary on TTO monthly"
      },
      9: {
        requirement: "15,000 Kuwi Stars",
        timeLimit: "No Time Limit",
        salary: "0.30% Salary on TTO monthly"
      },
      10: {
        requirement: "35,000 Kuwi Stars",
        timeLimit: "No Time Limit",
        salary: "0.25% Salary on TTO monthly"
      },
      11: {
        requirement: "75,000 Kuwi Stars",
        timeLimit: "No Time Limit",
        salary: "0.20% Salary on TTO monthly"
      },
      12: {
        requirement: "160,000 Kuwi Stars",
        timeLimit: "No Time Limit",
        salary: "0.15% Salary on TTO monthly"
      }
    };
    return conditions[rank?.level] || { requirement: "Complete required Kuwi Stars", timeLimit: "No Time Limit", salary: null };
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
          <span className={styles.headerTag}>🏆 Career & Royalty Ladder</span>
          <h1 className={styles.pageTitle}>Ranks & Progression</h1>
          <p className={styles.pageSubtitle}>
            Rank and Reward starts from 1st Pair Matching only. Build Kuwi Stars to unlock leadership ranks and monthly TTO royalties.
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
            const progress = rank.starsRequired > 0
              ? Math.min(100, Math.round((myRanks.currentStars / rank.starsRequired) * 100))
              : rank.level === 1 ? (isAchieved ? 100 : 0) : 0;

            const rankColor = getRankColor(rank);
            const rankIcon = getRankIcon(rank);
            const isNext = !isAchieved && progress > 0;
            const conditions = getRankConditions(rank);
            const isHighestAchieved = isAchieved && myRanks.current?._id === rank._id;

            return (
              <article
                key={rank._id || rank.level}
                className={`${styles.rankCard} ${isAchieved ? styles.achieved : ''} ${isNext ? styles.next : ''}`}
                style={{
                  borderLeftColor: isAchieved ? rankColor : isNext ? '#f59e0b' : '#e2e8f0',
                  animationDelay: `${index * 0.03}s`
                }}
              >
                <div className={styles.rankCardHeader}>
                  <div className={styles.rankIconWrapper} style={{ background: isAchieved ? rankColor : '#f1f5f9' }}>
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

                  {/* Progress Bar */}
                  {!isAchieved && rank.starsRequired > 0 && (
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
                        <span>{myRanks.currentStars} / {rank.starsRequired.toLocaleString()} Stars</span>
                        <strong>{progress}% Complete</strong>
                      </div>
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
                      <span>Need <strong>{(rank.starsRequired - myRanks.currentStars).toLocaleString()}</strong> more stars to unlock {rank.name}</span>
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