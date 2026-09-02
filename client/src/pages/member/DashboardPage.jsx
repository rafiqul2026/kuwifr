// client/src/pages/member/DashboardPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import SalaryProgressCard from '../../components/member/SalaryProgressCard';
import styles from './DashboardPage.module.css';

const DashboardPage = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedSide, setCopiedSide] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/users/dashboard-stats');
      if (res.data?.success && res.data?.data) {
        setStats(res.data.data);
      } else {
        throw new Error('Could not parse dashboard data');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
      showNotification('Could not load dashboard statistics', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Indian Rupee formatting (e.g., ₹1,50,000)
  const formatINR = (val) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num);
  };

  const copyLink = (side, url) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedSide(side);
    showNotification(`${side.toUpperCase()} referral link copied to clipboard!`, 'info');
    setTimeout(() => setCopiedSide(null), 2000);
  };

  if (error && !stats) {
    return (
      <div className={styles.dashboardScene}>
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>⚠️</div>
          <h3>Unable to load dashboard</h3>
          <p>{error}</p>
          <button type="button" className={styles.retryBtn} onClick={fetchDashboardData}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboardScene}>
      {/* ================= 3D FLOATING BACKGROUND ELEMENTS ================= */}
      <div className={styles.ambientCanvas} aria-hidden="true">
        <div className={`${styles.glowBlob} ${styles.blobTopLeft}`}></div>
        <div className={`${styles.glowBlob} ${styles.blobTopRight}`}></div>
        <div className={`${styles.glowBlob} ${styles.blobCenterRight}`}></div>
        <div className={`${styles.glowBlob} ${styles.blobBottomLeft}`}></div>

        <div className={`${styles.floating3DObject} ${styles.sphereTopRight}`}></div>
        <div className={`${styles.floating3DObject} ${styles.sphereMidLeft}`}></div>
        <div className={`${styles.floating3DObject} ${styles.sphereBottomRight}`}></div>

        <div className={`${styles.floating3DObject} ${styles.cubeTopLeft}`}>
          <div className={styles.cubeFaceFront}></div>
          <div className={styles.cubeFaceTop}></div>
          <div className={styles.cubeFaceRight}></div>
        </div>

        <div className={`${styles.floating3DObject} ${styles.cubeBottomRight}`}>
          <div className={styles.cubeFaceFront}></div>
          <div className={styles.cubeFaceTop}></div>
          <div className={styles.cubeFaceRight}></div>
        </div>

        <div className={`${styles.floating3DObject} ${styles.geoRingTop}`}></div>
        <div className={`${styles.floating3DObject} ${styles.geoRingBottom}`}></div>
      </div>

      {/* ================= FOREGROUND DASHBOARD CONTENT ================= */}
      <div className={styles.contentLayer}>
        {/* Dashboard Header */}
        <header className={styles.dashboardHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.greetingBadge}>
              <span className={styles.greetingDot}></span>
              MEMBER DASHBOARD
            </div>
            <h1 className={styles.welcomeTitle}>
              Welcome back, <span className={styles.nameHighlight}>{user?.fullName || 'Member'}</span>
            </h1>
            <p className={styles.welcomeSub}>
              Member ID: <strong className={styles.idCode}>{user?.memberId || 'KFR------'}</strong>
              <span className={styles.subDivider}>•</span>
              Status:{' '}
              <span className={user?.status === 'ACTIVE' ? styles.statusPillActive : styles.statusPillInactive}>
                ● {user?.status || 'INACTIVE'}
              </span>
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.refreshButton}
              onClick={fetchDashboardData}
              disabled={loading}
              title="Refresh statistics"
            >
              <svg
                className={loading ? styles.spinIcon : ''}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </header>

        {/* Inactive Member Activation Banner */}
        {user?.status !== 'ACTIVE' && (
          <div className={styles.activationNoticeBanner}>
            <div className={styles.noticeIconBox}>⚡</div>
            <div className={styles.noticeTextBox}>
              <h4>Your Member ID is currently INACTIVE</h4>
              <p>Purchase any 1 of our 5 packages to activate your account and begin earning matching and all commissions.</p>
            </div>
            {/* Direct Client-Side Routing to Buy Package */}
            <Link to="/member/packages" className={styles.noticeActionBtn}>
              Activate Account →
            </Link>
          </div>
        )}

        {/* 4-ROW INFORMATION HIERARCHY GRID */}
        <div className={styles.statsGridContainer}>
          {/* ================= ROW 1: FINANCIAL OVERVIEW ================= */}
          {/* 1. Today Income */}
          <div className={`${styles.statCard} ${styles.cardFinancial}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>TODAY INCOME</span>
              <div className={styles.cardIconBox}>💵</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetric}>{formatINR(stats?.todayIncome)}</h2>
              )}
              <span className={styles.metricSubtitle}>Daily Earnings</span>
            </div>
          </div>

          {/* 2. Total Income */}
          <div className={`${styles.statCard} ${styles.cardFinancial}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>TOTAL INCOME</span>
              <div className={styles.cardIconBox}>💰</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetric}>{formatINR(stats?.totalIncome)}</h2>
              )}
              <span className={styles.metricSubtitle}>Lifetime Accumulated</span>
            </div>
          </div>

          {/* 3. Total Withdrawal */}
          <div className={`${styles.statCard} ${styles.cardFinancial}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>TOTAL WITHDRAWAL</span>
              <div className={styles.cardIconBox}>🏦</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetric}>{formatINR(stats?.totalWithdrawal)}</h2>
              )}
              <span className={styles.metricSubtitle}>Payouts Dispatched</span>
            </div>
          </div>

          {/* ================= ROW 2: MEMBER ACQUISITION ================= */}
          {/* 4. Today Add Members */}
          <div className={`${styles.statCard} ${styles.cardMember}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>TODAY ADD MEMBERS</span>
              <div className={styles.cardIconBox}>👥</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetric}>{stats?.todayAddMembers || 0}</h2>
              )}
              <span className={styles.metricSubtitle}>Registrations Today</span>
            </div>
          </div>

          {/* 5. Today Active Members */}
          <div className={`${styles.statCard} ${styles.cardMember}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>TODAY ACTIVE MEMBERS</span>
              <div className={styles.cardIconBox}>⚡</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetric}>{stats?.todayActiveMembers || 0}</h2>
              )}
              <span className={styles.metricSubtitle}>Activated Plans Today</span>
            </div>
          </div>

          {/* 6. Total Members */}
          <div className={`${styles.statCard} ${styles.cardMember}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>TOTAL MEMBERS</span>
              <div className={styles.cardIconBox}>🌐</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetric}>{stats?.totalMembers || 0}</h2>
              )}
              <span className={styles.metricSubtitle}>Full Downline Network</span>
            </div>
          </div>

          {/* ================= ROW 3: ACTIVE & STAR VOLUME ================= */}
          {/* 7. Total Active Members */}
          <div className={`${styles.statCard} ${styles.cardTeam}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>TOTAL ACTIVE MEMBERS</span>
              <div className={styles.cardIconBox}>✅</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetric}>{stats?.totalActiveMembers || 0}</h2>
              )}
              <span className={styles.metricSubtitle}>Network Wide Active</span>
            </div>
          </div>

          {/* 8. Today Star */}
          <div className={`${styles.statCard} ${styles.cardStar}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>TODAY STAR</span>
              <div className={styles.cardIconBox}>⭐</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonSplit}></div>
              ) : (
                <div className={styles.dualVolumeBox}>
                  <div className={styles.volumeColumn}>
                    <span className={styles.sideLabelLeft}>Left Star</span>
                    <strong className={styles.sideValueLeft}>
                      {(stats?.todayStar?.left || 0).toLocaleString()}
                    </strong>
                  </div>
                  <div className={styles.volumeDivider}></div>
                  <div className={styles.volumeColumn}>
                    <span className={styles.sideLabelRight}>Right Star</span>
                    <strong className={styles.sideValueRight}>
                      {(stats?.todayStar?.right || 0).toLocaleString()}
                    </strong>
                  </div>
                </div>
              )}
              <span className={styles.metricSubtitle}>Today's Leg Volume (KBP)</span>
            </div>
          </div>

          {/* 9. Total Star */}
          <div className={`${styles.statCard} ${styles.cardStar}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>TOTAL STAR</span>
              <div className={styles.cardIconBox}>🌟</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonSplit}></div>
              ) : (
                <div className={styles.dualVolumeBox}>
                  <div className={styles.volumeColumn}>
                    <span className={styles.sideLabelLeft}>Left Star</span>
                    <strong className={styles.sideValueLeft}>
                      {(stats?.totalStar?.left || 0).toLocaleString()}
                    </strong>
                  </div>
                  <div className={styles.volumeDivider}></div>
                  <div className={styles.volumeColumn}>
                    <span className={styles.sideLabelRight}>Right Star</span>
                    <strong className={styles.sideValueRight}>
                      {(stats?.totalStar?.right || 0).toLocaleString()}
                    </strong>
                  </div>
                </div>
              )}
              <span className={styles.metricSubtitle}>Lifetime Binary Volume (KBP)</span>
            </div>
          </div>

          {/* ================= ROW 4: RANK, FUND & SPONSOR ================= */}
          {/* 10. Current Rank */}
          <div className={`${styles.statCard} ${styles.cardMeta}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>CURRENT RANK</span>
              <div className={styles.cardIconBox}>🏆</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetaText}>{stats?.currentRank?.name || 'Not Achieved'}</h2>
              )}
              <span className={styles.metricSubtitle}>Career Progression</span>
            </div>
          </div>

          {/* 11. Current Fund Achieved */}
          <div className={`${styles.statCard} ${styles.cardMeta}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>CURRENT FUND ACHIEVED</span>
              <div className={styles.cardIconBox}>🎯</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <div className={styles.fundMetaGroup}>
                  <span className={styles.fundIcon}>{stats?.currentFundAchieved?.icon || '🎯'}</span>
                  <h2 className={styles.primaryMetaText}>{stats?.currentFundAchieved?.name || 'Not Achieved'}</h2>
                </div>
              )}
              <span className={styles.metricSubtitle}>Life Tension Free Benefit</span>
            </div>
          </div>

          {/* 12. My Direct Sponsor */}
          <div className={`${styles.statCard} ${styles.cardMeta}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>MY DIRECT SPONSOR</span>
              <div className={styles.cardIconBox}>🤝</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <div className={styles.sponsorMetaGroup}>
                  <h2 className={styles.primaryMetaText}>{stats?.directSponsor?.name || 'Direct Sponsor'}</h2>
                  <span className={styles.sponsorIdBadge}>
                    ID: {stats?.directSponsor?.memberId || 'ROOT'}
                  </span>
                </div>
              )}
              <span className={styles.metricSubtitle}>Upline Guidance</span>
            </div>
          </div>
        </div>

        {/* ================= SALARY WALLET LIVE PROGRESS CARD ================= */}
        <SalaryProgressCard />

        {/* ================= DIRECT REFERRAL LINKS SECTION ================= */}
        {stats?.referralLinks && (
          <section className={styles.referralShareSection}>
            <div className={styles.referralHeader}>
              <div className={styles.referralHeaderIcon}>🔗</div>
              <div>
                <h3>Your Direct Referral Links</h3>
                <p>Share your personalized link to place new registrations directly into your Left or Right team</p>
              </div>
            </div>

            <div className={styles.referralGrid}>
              {/* Left Side Referral */}
              <div className={styles.referralBox}>
                <div className={styles.referralSidePillLeft}>
                  <span className={styles.sideDotLeft}></span>
                  LEFT TEAM PLACEMENT
                </div>
                <div className={styles.linkCopyRow}>
                  <input
                    type="text"
                    readOnly
                    value={stats.referralLinks.left?.url || ''}
                    className={styles.referralInput}
                  />
                  <button
                    type="button"
                    className={styles.copyButton}
                    onClick={() => copyLink('left', stats.referralLinks.left?.url)}
                  >
                    {copiedSide === 'left' ? '✓ Copied' : 'Copy Link'}
                  </button>
                </div>
              </div>

              {/* Right Side Referral */}
              <div className={styles.referralBox}>
                <div className={styles.referralSidePillRight}>
                  <span className={styles.sideDotRight}></span>
                  RIGHT TEAM PLACEMENT
                </div>
                <div className={styles.linkCopyRow}>
                  <input
                    type="text"
                    readOnly
                    value={stats.referralLinks.right?.url || ''}
                    className={styles.referralInput}
                  />
                  <button
                    type="button"
                    className={styles.copyButton}
                    onClick={() => copyLink('right', stats.referralLinks.right?.url)}
                  >
                    {copiedSide === 'right' ? '✓ Copied' : 'Copy Link'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;