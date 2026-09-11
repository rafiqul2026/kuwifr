// client/src/pages/member/DashboardPage.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import SalaryProgressCard from '../../components/member/SalaryProgressCard';
import styles from './DashboardPage.module.css';

// Member-side "skip/close" for the notification bar (docx follow-up: "so
// member can skip or close the notification, for comfortable use of the
// dashboard"). Dismissing a message hides only THAT message going forward
// — new admin broadcasts still show up — by remembering its id in
// localStorage. Wrapped in try/catch: private browsing / blocked storage
// should never break the dashboard, it just means dismissals don't persist
// across reloads for that visitor.
const DISMISSED_KEY = 'kuwifr_dismissed_dashboard_notifications';

const getDismissedIds = () => {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const addDismissedId = (id) => {
  try {
    const current = getDismissedIds();
    if (!current.includes(id)) {
      // Cap at the most recent 200 so this never grows unbounded.
      const next = [...current, id].slice(-200);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    }
  } catch {
    // Non-critical — dismissal just won't survive a reload for this visitor.
  }
};

/**
 * ============================================================================
 * 📊 MEMBER DASHBOARD COMPONENT (STANDARDIZED COMPACT CARDS)
 * ============================================================================
 */
const DashboardPage = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedSide, setCopiedSide] = useState(null);

  // Admin-set notification bar + admin-controlled offer slider (docx
  // Section 2.4): unread broadcast notifications rotate through a compact
  // bar, and active Offer images (managed on Admin > Notifications >
  // Offer Slider) rotate through a banner carousel — both live right under
  // the header, both update automatically whenever the admin adds new ones.
  const [announcements, setAnnouncements] = useState([]);
  const [offers, setOffers] = useState([]);
  const [annIndex, setAnnIndex] = useState(0);
  const [offerIndex, setOfferIndex] = useState(0);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/users/dashboard-stats');
      if (res.data?.success && res.data?.data) {
        setStats(res.data.data);
      } else {
        throw new Error('Invalid dashboard analytics data');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to load dashboard data';
      setError(errMsg);
      showNotification(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Non-critical extras — a failure here should never block the core
  // earnings dashboard above, so both calls are isolated with allSettled
  // and swallow their own errors.
  const fetchDashboardExtras = useCallback(async () => {
    const [notifRes, offerRes] = await Promise.allSettled([
      api.get('/api/notifications', { params: { read: 'false', limit: 5 } }),
      api.get('/api/offers')
    ]);

    if (notifRes.status === 'fulfilled' && notifRes.value.data?.success) {
      const dismissed = getDismissedIds();
      const list = (notifRes.value.data.data.notifications || []).filter(
        (n) => !dismissed.includes(n._id || n.id)
      );
      setAnnouncements(list);
      setAnnIndex(0);
    }
    if (offerRes.status === 'fulfilled' && offerRes.value.data?.success) {
      setOffers(offerRes.value.data.data.offers || []);
    }
  }, []);

  useEffect(() => {
    fetchDashboardExtras();
  }, [fetchDashboardExtras]);

  // Skip/close one notification bar message — removes it from the rotation
  // immediately (no page reload needed) and remembers it so it stays gone.
  // This does NOT mark it read on the server, so it still shows up in the
  // 🔔 bell dropdown for later — dismissing just clears dashboard clutter.
  const handleDismissAnnouncement = useCallback((id) => {
    addDismissedId(id);
    setAnnouncements((prev) => {
      const next = prev.filter((n) => (n._id || n.id) !== id);
      setAnnIndex((i) => (next.length ? i % next.length : 0));
      return next;
    });
  }, []);

  // Auto-rotate the notification bar every 6s
  useEffect(() => {
    if (announcements.length <= 1) return undefined;
    const timer = setInterval(() => setAnnIndex((i) => (i + 1) % announcements.length), 6000);
    return () => clearInterval(timer);
  }, [announcements.length]);

  // Auto-rotate the offer slider every 4.5s
  useEffect(() => {
    if (offers.length <= 1) return undefined;
    const timer = setInterval(() => setOfferIndex((i) => (i + 1) % offers.length), 4500);
    return () => clearInterval(timer);
  }, [offers.length]);

  // Currency Formatter
  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Number(val) || 0);
  };

  // KBP Volume Formatter
  const formatKBP = (val) => {
    return `${(Number(val) || 0).toLocaleString()} KBP`;
  };

  // Memoized Star Metric Groups
  const todayStars = useMemo(() => ({
    left: Number(stats?.todayStar?.left || 0),
    right: Number(stats?.todayStar?.right || 0)
  }), [stats?.todayStar]);

  const monthlyStars = useMemo(() => ({
    left: Number(stats?.monthlyStar?.left || 0),
    right: Number(stats?.monthlyStar?.right || 0)
  }), [stats?.monthlyStar]);

  const totalStars = useMemo(() => ({
    left: Number(stats?.totalStar?.left || 0),
    right: Number(stats?.totalStar?.right || 0)
  }), [stats?.totalStar]);

  const todayBusiness = useMemo(() => ({
    left: Number(stats?.todayLeftBusiness || 0),
    right: Number(stats?.todayRightBusiness || 0)
  }), [stats?.todayLeftBusiness, stats?.todayRightBusiness]);

  const starForNextRank = useMemo(() => ({
    rankName: stats?.starForNextRank?.rankName || null,
    left: Number(stats?.starForNextRank?.left || 0),
    right: Number(stats?.starForNextRank?.right || 0)
  }), [stats?.starForNextRank]);

  const LIVE_PRODUCTION_DOMAIN = 'https://www.kuwifr.in';
  const sponsorId = user?.memberId || stats?.memberId || 'KFR665384';

  const referralLinks = useMemo(() => ({
    left: `${LIVE_PRODUCTION_DOMAIN}/register?ref=${sponsorId}&pos=L`,
    right: `${LIVE_PRODUCTION_DOMAIN}/register?ref=${sponsorId}&pos=R`
  }), [sponsorId]);

  const handleCopyLink = async (side, url) => {
    if (!url) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const tempInput = document.createElement('textarea');
        tempInput.value = url;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }
      setCopiedSide(side);
      showNotification(`${side.toUpperCase()} referral link copied!`, 'info');
      setTimeout(() => setCopiedSide(null), 2000);
    } catch {
      showNotification('Failed to copy link.', 'error');
    }
  };

  const handleNativeShare = (side, url) => {
    const teamLabel = side === 'left' ? 'LEFT' : 'RIGHT';
    if (navigator.share) {
      navigator.share({
        title: `Join KUWIFR Network (${teamLabel} Team)`,
        text: `Register under my KUWIFR ${teamLabel} Team placement.\nSponsor ID: ${sponsorId}\nJoin Link:`,
        url: url
      }).catch(() => {});
    } else {
      handleCopyLink(side, url);
    }
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
      {/* 3D Ambient Canvas Background */}
      <div className={styles.ambientCanvas} aria-hidden="true">
        <div className={`${styles.glowBlob} ${styles.blobTopLeft}`}></div>
        <div className={`${styles.glowBlob} ${styles.blobTopRight}`}></div>
        <div className={`${styles.glowBlob} ${styles.blobCenterRight}`}></div>
        <div className={`${styles.glowBlob} ${styles.blobBottomLeft}`}></div>
      </div>

      <div className={styles.contentLayer}>
        {/* Compact Header Bar */}
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
              Member ID: <strong className={styles.idCode}>{sponsorId}</strong>
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
                width="14"
                height="14"
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

        {/* Admin-set Notification Bar — rotates through unread admin
            broadcasts (title/message), each dot jumps straight to one. */}
        {announcements.length > 0 && (
          <div className={styles.notificationBar} style={{ borderLeftColor: announcements[annIndex]?.color || '#2563eb' }}>
            <span className={styles.notificationBarIcon}>{announcements[annIndex]?.icon || '📢'}</span>
            <div className={styles.notificationBarText}>
              <strong>{announcements[annIndex]?.title}</strong>
              <span>{announcements[annIndex]?.message}</span>
            </div>
            {announcements[annIndex]?.action && (
              <Link to={announcements[annIndex].action} className={styles.notificationBarAction}>
                {announcements[annIndex].actionLabel || 'View'} →
              </Link>
            )}
            {announcements.length > 1 && (
              <div className={styles.notificationBarDots}>
                {announcements.map((_, i) => (
                  <button
                    type="button"
                    key={i}
                    className={`${styles.dot} ${i === annIndex ? styles.dotActive : ''}`}
                    onClick={() => setAnnIndex(i)}
                    aria-label={`Show notification ${i + 1}`}
                  />
                ))}
              </div>
            )}
            <button
              type="button"
              className={styles.notificationBarClose}
              onClick={() => handleDismissAnnouncement(announcements[annIndex]?._id || announcements[annIndex]?.id)}
              aria-label="Close this notification"
              title="Close"
            >
              ✕
            </button>
          </div>
        )}

        {/* Admin-controlled Offer Slider — image carousel, refreshed
            automatically whenever the admin adds/removes/reorders offers. */}
        {offers.length > 0 && (
          <div className={styles.offerSlider}>
            <div className={styles.offerSlideTrack} style={{ transform: `translateX(-${offerIndex * 100}%)` }}>
              {offers.map((o) =>
                o.linkUrl ? (
                  <a key={o._id} href={o.linkUrl} target="_blank" rel="noopener noreferrer" className={styles.offerSlide}>
                    <img src={o.imageUrl} alt={o.title} />
                  </a>
                ) : (
                  <div key={o._id} className={styles.offerSlide}>
                    <img src={o.imageUrl} alt={o.title} />
                  </div>
                )
              )}
            </div>
            {offers.length > 1 && (
              <div className={styles.offerDots}>
                {offers.map((_, i) => (
                  <button
                    type="button"
                    key={i}
                    className={`${styles.dot} ${i === offerIndex ? styles.dotActive : ''}`}
                    onClick={() => setOfferIndex(i)}
                    aria-label={`Show offer ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Compact Inactive Member Banner */}
        {user?.status !== 'ACTIVE' && (
          <div className={styles.activationNoticeBanner}>
            <div className={styles.noticeIconBox}>⚡</div>
            <div className={styles.noticeTextBox}>
              <h4>Account Currently INACTIVE</h4>
              <p>Purchase any 1 of our 5 packages to activate your account and start earning binary matching income.</p>
            </div>
            <Link to="/member/packages" className={styles.noticeActionBtn}>
              Activate Account →
            </Link>
          </div>
        )}

        {/* ============================================================
            STANDARDIZED COMPACT METRICS GRID (3 DESKTOP / 2 MOBILE)
        ============================================================ */}
        <div className={styles.statsGridContainer}>
          {/* Row 1: Core Financials */}
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

          <div className={`${styles.statCard} ${styles.cardFinancial}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>WEEKLY INCOME</span>
              <div className={styles.cardIconBox}>💷</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetric}>{formatINR(stats?.weeklyIncome)}</h2>
              )}
              <span className={styles.metricSubtitle}>This Week's Earnings</span>
            </div>
          </div>

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

          {/* Row 2: Member Network Counts */}
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
              <span className={styles.metricSubtitle}>Activated Today</span>
            </div>
          </div>

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

          {/* Row 3: Today Business (raw left/right volume generated today,
              BEFORE matching — distinct from Weekly KBP Match below), Carry
              Forward Business (single merged Left/Right card), Monthly Star */}
          <div className={`${styles.statCard} ${styles.cardKbp}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>TODAY BUSINESS</span>
              <div className={styles.cardIconBox}>📊</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonSplit}></div>
              ) : (
                <div className={styles.dualVolumeBox}>
                  <div className={styles.volumeColumn}>
                    <span className={styles.sideLabelLeft}>Left:</span>
                    <strong className={styles.sideValueLeft}>{todayBusiness.left.toLocaleString()}</strong>
                  </div>
                  <div className={styles.volumeDivider}></div>
                  <div className={styles.volumeColumn}>
                    <span className={styles.sideLabelRight}>Right:</span>
                    <strong className={styles.sideValueRight}>{todayBusiness.right.toLocaleString()}</strong>
                  </div>
                </div>
              )}
              <span className={styles.metricSubtitle}>Today's KBP Generated (Pre-Match)</span>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.cardKbp}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>CARRY FORWARD BUSINESS</span>
              <div className={styles.cardIconBox}>🔁</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonSplit}></div>
              ) : (
                <div className={styles.dualVolumeBox}>
                  <div className={styles.volumeColumn}>
                    <span className={styles.sideLabelLeft}>Left:</span>
                    <strong className={styles.sideValueLeft}>{(stats?.carryForwardBusiness?.left || 0).toLocaleString()}</strong>
                  </div>
                  <div className={styles.volumeDivider}></div>
                  <div className={styles.volumeColumn}>
                    <span className={styles.sideLabelRight}>Right:</span>
                    <strong className={styles.sideValueRight}>{(stats?.carryForwardBusiness?.right || 0).toLocaleString()}</strong>
                  </div>
                </div>
              )}
              <span className={styles.metricSubtitle}>Unmatched Volume Carried Forward (KBP)</span>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.cardStar}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>MONTHLY STAR</span>
              <div className={styles.cardIconBox}>🌟</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonSplit}></div>
              ) : (
                <div className={styles.dualVolumeBox}>
                  <div className={styles.volumeColumn}>
                    <span className={styles.sideLabelLeft}>Left:</span>
                    <strong className={styles.sideValueLeft}>{monthlyStars.left}</strong>
                  </div>
                  <div className={styles.volumeDivider}></div>
                  <div className={styles.volumeColumn}>
                    <span className={styles.sideLabelRight}>Right:</span>
                    <strong className={styles.sideValueRight}>{monthlyStars.right}</strong>
                  </div>
                </div>
              )}
              <span className={styles.metricSubtitle}>Qualified This Month</span>
            </div>
          </div>

          {/* Row 4: Weekly Binary KBP Production & Matching */}
          <div className={`${styles.statCard} ${styles.cardKbp}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>WEEKLY KBP</span>
              <div className={styles.cardIconBox}>⚡</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetric}>{formatKBP(stats?.weeklyKbp?.total)}</h2>
              )}
              <span className={styles.metricSubtitle}>
                L: {(stats?.weeklyKbp?.left || 0).toLocaleString()} / R: {(stats?.weeklyKbp?.right || 0).toLocaleString()} KBP
              </span>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.cardKbp}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>WEEKLY KBP MATCH</span>
              <div className={styles.cardIconBox}>⚖️</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetric}>{formatKBP(stats?.weeklyKbpMatch)}</h2>
              )}
              <span className={styles.metricSubtitle}>Current Cycle Match</span>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.cardKbp}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>TOTAL KBP MATCH</span>
              <div className={styles.cardIconBox}>🎯</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetric}>{formatKBP(stats?.totalKbpMatch)}</h2>
              )}
              <span className={styles.metricSubtitle}>Lifetime Binary Match</span>
            </div>
          </div>

          {/* Row 5: Active Downlines & Star Snapshots */}
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
                    <span className={styles.sideLabelLeft}>Left:</span>
                    <strong className={styles.sideValueLeft}>{todayStars.left}</strong>
                  </div>
                  <div className={styles.volumeDivider}></div>
                  <div className={styles.volumeColumn}>
                    <span className={styles.sideLabelRight}>Right:</span>
                    <strong className={styles.sideValueRight}>{todayStars.right}</strong>
                  </div>
                </div>
              )}
              <span className={styles.metricSubtitle}>Today's Stars</span>
            </div>
          </div>

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
                    <span className={styles.sideLabelLeft}>Left:</span>
                    <strong className={styles.sideValueLeft}>{totalStars.left}</strong>
                  </div>
                  <div className={styles.volumeDivider}></div>
                  <div className={styles.volumeColumn}>
                    <span className={styles.sideLabelRight}>Right:</span>
                    <strong className={styles.sideValueRight}>{totalStars.right}</strong>
                  </div>
                </div>
              )}
              <span className={styles.metricSubtitle}>Lifetime Stars</span>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.cardStar}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>STAR FOR NEXT RANK</span>
              <div className={styles.cardIconBox}>🚀</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonSplit}></div>
              ) : starForNextRank.rankName ? (
                <div className={styles.dualVolumeBox}>
                  <div className={styles.volumeColumn}>
                    <span className={styles.sideLabelLeft}>Left:</span>
                    <strong className={styles.sideValueLeft}>{starForNextRank.left}</strong>
                  </div>
                  <div className={styles.volumeDivider}></div>
                  <div className={styles.volumeColumn}>
                    <span className={styles.sideLabelRight}>Right:</span>
                    <strong className={styles.sideValueRight}>{starForNextRank.right}</strong>
                  </div>
                </div>
              ) : (
                <h2 className={styles.primaryMetaText}>Max Rank Achieved</h2>
              )}
              <span className={styles.metricSubtitle}>
                {starForNextRank.rankName ? `Required Per Leg for ${starForNextRank.rankName}` : 'All Ranks Completed'}
              </span>
            </div>
          </div>

          {/* Row 6: Career & Fund Achievements */}
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

          <div className={`${styles.statCard} ${styles.cardMeta}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>REWARD ACHIEVED</span>
              <div className={styles.cardIconBox}>🎁</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetaText}>{stats?.rewardAchieved?.name || 'Not Achieved'}</h2>
              )}
              <span className={styles.metricSubtitle}>
                {stats?.rewardAchieved?.value ? `Value: ${formatINR(stats.rewardAchieved.value)}` : `From ${stats?.currentRank?.name || 'Your Rank'}`}
              </span>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.cardMeta}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>PENSION</span>
              <div className={styles.cardIconBox}>🏦</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetaText}>{stats?.pension?.active ? 'Active' : 'Not Active'}</h2>
              )}
              <span className={styles.metricSubtitle}>Lifetime Paid: {formatINR(stats?.pension?.totalEarned)}</span>
            </div>
          </div>

          {/* Leadership Income (Cheque Match Bonus) — 50%/30%/20% on the
              matching income of your 1st/2nd/3rd level Leaders. Rates,
              qualifying rank and level count are admin-configurable
              (Admin Settings → Commission & Level Income); full per-level
              history is in the Admin Income Report. */}
          <div className={`${styles.statCard} ${styles.cardFinancial}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>LEADERSHIP INCOME</span>
              <div className={styles.cardIconBox}>👑</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetric}>{formatINR(stats?.leadershipIncome?.total)}</h2>
              )}
              <span className={styles.metricSubtitle}>Today: {formatINR(stats?.leadershipIncome?.today)}</span>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.cardFinancial}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>CURRENT REMUNERATION</span>
              <div className={styles.cardIconBox}>📜</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetric}>{formatINR(stats?.currentRemuneration)}</h2>
              )}
              <span className={styles.metricSubtitle}>This Month's Rank Salary</span>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.cardFinancial}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>SELF REPURCHASE INCOME</span>
              <div className={styles.cardIconBox}>🔄</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetric}>{formatINR(stats?.selfRepurchaseIncome)}</h2>
              )}
              <span className={styles.metricSubtitle}>Lifetime Self Repurchase Cashback</span>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.cardFinancial}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>DOWNLINE REPURCHASE INCOME</span>
              <div className={styles.cardIconBox}>🔁</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetric}>{formatINR(stats?.downlineRepurchaseIncome)}</h2>
              )}
              <span className={styles.metricSubtitle}>Lifetime Downline Repurchase Income</span>
            </div>
          </div>
        </div>

        {/* Remuneration (Rank Salary) Live Progress — `data` was previously
            never passed here, so this card always rendered its zero
            defaults regardless of the member's real stats (matching the
            reported "not showing live data" — the card genuinely never
            received live data at all). */}
        <SalaryProgressCard data={stats} />

        {/* Streamlined Direct Referral Links */}
        <section className={styles.referralShareSection}>
          <div className={styles.referralHeader}>
            <div className={styles.referralHeaderIcon}>🔗</div>
            <div className={styles.referralHeaderDetails}>
              <h3>Your Direct Referral Links</h3>
              <p>Share your personalized link to place new registrations directly into your Left or Right team</p>
            </div>
          </div>

          <div className={styles.referralGrid}>
            {/* Left Referral */}
            <div className={styles.referralBox}>
              <div className={styles.referralSideHeader}>
                <div className={styles.referralSidePillLeft}>
                  <span className={styles.sideDotLeft}></span>
                  LEFT TEAM PLACEMENT
                </div>
                <span className={styles.sponsorNotice}>
                  Sponsor: <strong>{sponsorId}</strong>
                </span>
              </div>

              <div className={styles.linkActionEngine}>
                <div className={styles.referralInputGroup}>
                  <span className={styles.linkPrefixTag}>URL</span>
                  <input
                    type="text"
                    readOnly
                    value={referralLinks.left}
                    className={styles.referralInput}
                    onClick={(e) => e.target.select()}
                  />
                </div>

                <div className={styles.actionBtnCluster}>
                  <button
                    type="button"
                    className={`${styles.copyButton} ${copiedSide === 'left' ? styles.copyButtonActive : ''}`}
                    onClick={() => handleCopyLink('left', referralLinks.left)}
                    title="Copy Left Referral Link"
                  >
                    {copiedSide === 'left' ? 'Copied!' : 'Copy Link'}
                  </button>

                  <button
                    type="button"
                    className={styles.shareIconButton}
                    onClick={() => handleNativeShare('left', referralLinks.left)}
                    title="Share Link"
                    aria-label="Share Left Link"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="18" cy="5" r="3"></circle>
                      <circle cx="6" cy="12" r="3"></circle>
                      <circle cx="18" cy="19" r="3"></circle>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Referral */}
            <div className={styles.referralBox}>
              <div className={styles.referralSideHeader}>
                <div className={styles.referralSidePillRight}>
                  <span className={styles.sideDotRight}></span>
                  RIGHT TEAM PLACEMENT
                </div>
                <span className={styles.sponsorNotice}>
                  Sponsor: <strong>{sponsorId}</strong>
                </span>
              </div>

              <div className={styles.linkActionEngine}>
                <div className={styles.referralInputGroup}>
                  <span className={styles.linkPrefixTag}>URL</span>
                  <input
                    type="text"
                    readOnly
                    value={referralLinks.right}
                    className={styles.referralInput}
                    onClick={(e) => e.target.select()}
                  />
                </div>

                <div className={styles.actionBtnCluster}>
                  <button
                    type="button"
                    className={`${styles.copyButton} ${copiedSide === 'right' ? styles.copyButtonActive : ''}`}
                    onClick={() => handleCopyLink('right', referralLinks.right)}
                    title="Copy Right Referral Link"
                  >
                    {copiedSide === 'right' ? 'Copied!' : 'Copy Link'}
                  </button>

                  <button
                    type="button"
                    className={styles.shareIconButton}
                    onClick={() => handleNativeShare('right', referralLinks.right)}
                    title="Share Link"
                    aria-label="Share Right Link"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="18" cy="5" r="3"></circle>
                      <circle cx="6" cy="12" r="3"></circle>
                      <circle cx="18" cy="19" r="3"></circle>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
export default DashboardPage;