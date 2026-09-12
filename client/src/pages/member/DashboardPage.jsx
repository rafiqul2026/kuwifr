// client/src/pages/member/DashboardPage.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
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
  const [copiedMemberId, setCopiedMemberId] = useState(false);

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

  // Member-since date, e.g. "12 Mar 2024" — used on the hero card.
  const formatJoinDate = (val) => {
    if (!val) return '—';
    try {
      return new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  // Compact "time ago" for the Recently Added widget (PBW's "Recently
  // Added" list pattern) — real join timestamps, not placeholders.
  const timeAgo = (val) => {
    if (!val) return '';
    const diffMs = Date.now() - new Date(val).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || parts[0]?.[0]?.toUpperCase() || '?';
  };

  // Pipeline status -> display label + color (Withdrawal Pipeline / Order
  // Pipeline widgets, mapped from PBW's Grievance Pipeline / Scheme
  // Requests widgets). Any status not listed falls back gracefully.
  const PIPELINE_STYLES = {
    PENDING: { label: 'Pending', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
    PAYMENT_INITIATED: { label: 'Initiated', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
    AWAITING_VERIFICATION: { label: 'Awaiting Verification', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
    VERIFICATION_PENDING: { label: 'Awaiting Verification', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
    APPROVED: { label: 'Approved', color: '#008080', bg: 'rgba(0,128,128,0.12)' },
    VERIFIED: { label: 'Verified', color: '#008080', bg: 'rgba(0,128,128,0.12)' },
    PAID: { label: 'Paid', color: '#008080', bg: 'rgba(0,128,128,0.12)' },
    PROCESSING: { label: 'Processing', color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
    SHIPPED: { label: 'Shipped', color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
    PROCESSED: { label: 'Processed', color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
    DELIVERED: { label: 'Delivered', color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
    COMPLETED: { label: 'Completed', color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
    SUCCESS: { label: 'Success', color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
    REJECTED: { label: 'Rejected', color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
    FAILED: { label: 'Failed', color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
    PROCESSING_FAILED: { label: 'Failed', color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
    CANCELLED: { label: 'Cancelled', color: '#737373', bg: 'rgba(115,115,115,0.12)' },
    REFUNDED: { label: 'Refunded', color: '#737373', bg: 'rgba(115,115,115,0.12)' }
  };
  const pipelineStyle = (status) =>
    PIPELINE_STYLES[status] || { label: (status || 'Unknown').replace(/_/g, ' '), color: '#737373', bg: 'rgba(115,115,115,0.12)' };

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

  // Functional Member ID chip in the header (docx: "Make MEMBER ID
  // Functional and professional like PBW Foundation") — a single click
  // copies the member's own ID to the clipboard, same pattern as the
  // referral link copy buttons below.
  const handleCopyMemberId = async () => {
    if (!sponsorId) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(sponsorId);
      } else {
        const tempInput = document.createElement('textarea');
        tempInput.value = sponsorId;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }
      setCopiedMemberId(true);
      showNotification('Member ID copied!', 'info');
      setTimeout(() => setCopiedMemberId(false), 2000);
    } catch {
      showNotification('Failed to copy Member ID.', 'error');
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

        {/* Hero Greeting Card — gradient welcome banner with role/status
            pill, "member since" date, a context-aware CTA, and inline
            quick stats, styled after PBW Foundation's dashboard hero card
            but built entirely from this member's own live data. */}
        <section className={styles.heroCard}>
          <div className={styles.heroDecorBlobA} aria-hidden="true"></div>
          <div className={styles.heroDecorBlobB} aria-hidden="true"></div>
          <div className={styles.heroMain}>
            <span className={styles.heroPill}>
              {user?.status === 'ACTIVE' ? '✅ Active Member' : '⚡ Activation Pending'}
            </span>
            <h1 className={styles.heroTitle}>
              Welcome back, {user?.fullName || 'Member'}
            </h1>
            <p className={styles.heroSubtitle}>
              Member ID{' '}
              <button
                type="button"
                className={styles.heroIdCopyBtn}
                onClick={handleCopyMemberId}
                title="Click to copy your Member ID"
              >
                <strong>{sponsorId}</strong>
                {copiedMemberId ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                  </svg>
                )}
              </button>
              &nbsp;·&nbsp; Member since {formatJoinDate(stats?.memberSince)}
              {stats?.currentRank?.name ? (
                <>&nbsp;·&nbsp; Rank: <strong>{stats.currentRank.name}</strong></>
              ) : null}
              &nbsp;·&nbsp;
              <span className={user?.status === 'ACTIVE' ? styles.heroStatusPillActive : styles.heroStatusPillInactive}>
                ● {user?.status || 'INACTIVE'}
              </span>
            </p>
            <Link
              to={user?.status === 'ACTIVE' ? '/member/team' : '/member/packages'}
              className={styles.heroCtaBtn}
            >
              {user?.status === 'ACTIVE' ? 'View My Team →' : 'Activate Account →'}
            </Link>
          </div>
          <div className={styles.heroQuickStats}>
            <div className={styles.heroQuickStat}>
              <span className={styles.heroQuickStatValue}>{formatINR(stats?.totalIncome)}</span>
              <span className={styles.heroQuickStatLabel}>Total Income</span>
            </div>
            <div className={styles.heroQuickStatDivider}></div>
            <div className={styles.heroQuickStat}>
              <span className={styles.heroQuickStatValue}>{stats?.totalMembers || 0}</span>
              <span className={styles.heroQuickStatLabel}>Team Size</span>
            </div>
            <div className={styles.heroQuickStatDivider}></div>
            <div className={styles.heroQuickStat}>
              <span className={styles.heroQuickStatValue}>{stats?.currentRank?.name || 'Unranked'}</span>
              <span className={styles.heroQuickStatLabel}>Current Rank</span>
            </div>
          </div>
        </section>

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

        {/* Gradient KPI row (docx: "In Member Dashboard these card will
            show with real live data ... make fully production ready, Like
            PBW FOUNDATION") — PBW's soft pastel-gradient stat cards,
            rebuilt here bound to the same live /api/users/dashboard-stats
            payload the rest of the app uses, not placeholders. */}
        <div className={styles.gradientKpiGrid}>
          <div className={`${styles.gradientKpiCard} ${styles.gradientMint}`}>
            <div className={styles.gradientKpiTop}>
              <span className={styles.gradientKpiIcon}>💰</span>
              <span className={styles.gradientKpiLabel}>Total Income</span>
            </div>
            {loading && !stats ? (
              <div className={styles.gradientSkeleton}></div>
            ) : (
              <h2 className={styles.gradientKpiValue}>{formatINR(stats?.totalIncome)}</h2>
            )}
            <span className={styles.gradientKpiSub}>Lifetime accumulated earnings</span>
          </div>

          <div className={`${styles.gradientKpiCard} ${styles.gradientLavender}`}>
            <div className={styles.gradientKpiTop}>
              <span className={styles.gradientKpiIcon}>🏦</span>
              <span className={styles.gradientKpiLabel}>Total Withdrawal</span>
            </div>
            {loading && !stats ? (
              <div className={styles.gradientSkeleton}></div>
            ) : (
              <h2 className={styles.gradientKpiValue}>{formatINR(stats?.totalWithdrawal)}</h2>
            )}
            <span className={styles.gradientKpiSub}>Payouts dispatched to date</span>
          </div>

          <div className={`${styles.gradientKpiCard} ${styles.gradientPeach}`}>
            <div className={styles.gradientKpiTop}>
              <span className={styles.gradientKpiIcon}>🌐</span>
              <span className={styles.gradientKpiLabel}>Total Team</span>
            </div>
            {loading && !stats ? (
              <div className={styles.gradientSkeleton}></div>
            ) : (
              <h2 className={styles.gradientKpiValue}>{stats?.totalMembers || 0}</h2>
            )}
            <span className={styles.gradientKpiSub}>{stats?.totalActiveMembers || 0} active in network</span>
          </div>

          <div className={`${styles.gradientKpiCard} ${styles.gradientBlue}`}>
            <div className={styles.gradientKpiTop}>
              <span className={styles.gradientKpiIcon}>⭐</span>
              <span className={styles.gradientKpiLabel}>Total Star</span>
            </div>
            {loading && !stats ? (
              <div className={styles.gradientSkeleton}></div>
            ) : (
              <h2 className={styles.gradientKpiValue}>
                {(Number(stats?.totalStar?.left || 0) + Number(stats?.totalStar?.right || 0)).toLocaleString()}
              </h2>
            )}
            <span className={styles.gradientKpiSub}>
              {stats?.totalStar?.left || 0} Left · {stats?.totalStar?.right || 0} Right
            </span>
          </div>
        </div>

        {/* Secondary metric row — the remaining wireframe cards, kept as
            compact standard cards under the bold gradient row above. */}
        <div className={styles.sectionGrid}>
          <div className={`${styles.statCard} ${styles.cardMember}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>MY DIRECT REFERRAL</span>
              <div className={styles.cardIconBox}>👥</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetric}>{stats?.directReferrals || 0}</h2>
              )}
              <span className={styles.metricSubtitle}>Direct Sponsees</span>
            </div>
          </div>

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

          <div className={`${styles.statCard} ${styles.cardFinancial}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>MONTHLY REMUNERATION</span>
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

          <div className={`${styles.statCard} ${styles.cardMeta}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>FUND ACHIEVED</span>
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
        </div>

        {/* ================================================================
            WIDGET GRID — PBW-style multi-widget layout, every widget below
            backed by real, live Kuwifr data (no fabricated numbers):
              Commission Earnings <- income breakdown already on stats
              Growth Snapshot     <- today/week/month new-member counts
              Membership Health   <- KYC/bank/package/photo completion
              Withdrawal Pipeline <- this member's own Withdrawal statuses
              Order Pipeline      <- this member's own Order statuses
              Quick Links         <- My Team / My Business shortcuts
              Left vs Right Leg   <- binary leg comparison (PBW "Top Districts")
              Recently Added      <- most recently joined downline members
              Announcements       <- admin broadcast notifications
            ================================================================ */}
        <div className={styles.widgetsGrid}>
          <div className={styles.widgetsMain}>
            {/* Commission Earnings */}
            <section className={styles.widgetCard}>
              <div className={styles.widgetHeader}>
                <div className={styles.widgetHeaderLeft}>
                  <div className={`${styles.widgetIconBox} ${styles.widgetIconTeal}`}>💸</div>
                  <div>
                    <h3 className={styles.widgetTitle}>Commission Earnings</h3>
                    <p className={styles.widgetSubtitle}>Live breakdown of every income stream</p>
                  </div>
                </div>
                <Link to="/member/income" className={styles.widgetViewAll}>View all →</Link>
              </div>
              <div className={styles.commissionList}>
                {[
                  { label: 'Today\'s Income', value: stats?.todayIncome, max: stats?.totalIncome, icon: '📅' },
                  { label: 'This Week\'s Income', value: stats?.weeklyIncome, max: stats?.totalIncome, icon: '🗓️' },
                  { label: 'Leadership / Match Bonus', value: stats?.leadershipIncome?.total, max: stats?.totalIncome, icon: '🤝' },
                  { label: 'Monthly Rank Salary', value: stats?.currentRemuneration, max: stats?.totalIncome, icon: '📜' },
                  { label: 'Self Repurchase Income', value: stats?.selfRepurchaseIncome, max: stats?.totalIncome, icon: '🛍️' },
                  { label: 'Downline Repurchase Income', value: stats?.downlineRepurchaseIncome, max: stats?.totalIncome, icon: '🔁' },
                  { label: 'Pension Earned', value: stats?.pension?.totalEarned, max: stats?.totalIncome, icon: '🏵️' }
                ].map((row) => {
                  const pct = row.max ? Math.min(100, Math.round((Number(row.value || 0) / Number(row.max)) * 100)) : 0;
                  return (
                    <div className={styles.commissionRow} key={row.label}>
                      <div className={styles.commissionLeft}>
                        <span className={styles.commissionIcon}>{row.icon}</span>
                        <span className={styles.commissionLabel}>{row.label}</span>
                      </div>
                      <div className={styles.commissionBarTrack}>
                        <div className={styles.commissionBarFill} style={{ width: `${pct}%` }}></div>
                      </div>
                      <span className={styles.commissionValue}>{formatINR(row.value)}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Growth Snapshot */}
            <section className={styles.widgetCard}>
              <div className={styles.widgetHeader}>
                <div className={styles.widgetHeaderLeft}>
                  <div className={`${styles.widgetIconBox} ${styles.widgetIconOrange}`}>📈</div>
                  <div>
                    <h3 className={styles.widgetTitle}>Growth Snapshot</h3>
                    <p className={styles.widgetSubtitle}>New members joining your network</p>
                  </div>
                </div>
                <Link to="/member/team" className={styles.widgetViewAll}>View all →</Link>
              </div>
              <div className={styles.growthGrid}>
                <div className={styles.growthBlock}>
                  <span className={styles.growthValue}>{stats?.todayAddMembers ?? 0}</span>
                  <span className={styles.growthLabel}>Today</span>
                </div>
                <div className={styles.growthBlock}>
                  <span className={styles.growthValue}>{stats?.weeklyAddMembers ?? 0}</span>
                  <span className={styles.growthLabel}>This Week</span>
                </div>
                <div className={styles.growthBlock}>
                  <span className={styles.growthValue}>{stats?.monthlyAddMembers ?? 0}</span>
                  <span className={styles.growthLabel}>This Month</span>
                </div>
              </div>
            </section>

            {/* Membership Health */}
            <section className={styles.widgetCard}>
              <div className={styles.widgetHeader}>
                <div className={styles.widgetHeaderLeft}>
                  <div className={`${styles.widgetIconBox} ${styles.widgetIconGreen}`}>💚</div>
                  <div>
                    <h3 className={styles.widgetTitle}>Membership Health</h3>
                    <p className={styles.widgetSubtitle}>Account completeness checklist</p>
                  </div>
                </div>
                <span className={styles.healthPercent}>{stats?.membershipHealth?.percent ?? 0}%</span>
              </div>
              <div className={styles.healthProgressTrack}>
                <div
                  className={styles.healthProgressFill}
                  style={{ width: `${stats?.membershipHealth?.percent ?? 0}%` }}
                ></div>
              </div>
              <div className={styles.healthChecklist}>
                {(stats?.membershipHealth?.checks || []).map((c) => (
                  <div className={styles.healthCheckItem} key={c.key}>
                    <span className={c.done ? styles.healthCheckIconDone : styles.healthCheckIconPending}>
                      {c.done ? '✓' : '•'}
                    </span>
                    <span className={styles.healthCheckLabel}>{c.label}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Withdrawal Pipeline + Order Pipeline */}
            <div className={styles.pipelinePairGrid}>
              <section className={styles.widgetCard}>
                <div className={styles.widgetHeader}>
                  <div className={styles.widgetHeaderLeft}>
                    <div className={`${styles.widgetIconBox} ${styles.widgetIconAmber}`}>🏧</div>
                    <div>
                      <h3 className={styles.widgetTitle}>Withdrawal Pipeline</h3>
                      <p className={styles.widgetSubtitle}>Your requests by status</p>
                    </div>
                  </div>
                  <Link to="/member/withdrawals" className={styles.widgetViewAll}>View all →</Link>
                </div>
                {(stats?.withdrawalPipeline || []).length === 0 ? (
                  <p className={styles.pipelineEmpty}>No withdrawal requests yet.</p>
                ) : (
                  <div className={styles.pipelineList}>
                    {(stats?.withdrawalPipeline || []).map((p) => {
                      const st = pipelineStyle(p.status);
                      return (
                        <div className={styles.pipelineRow} key={p.status}>
                          <span className={styles.pipelineDot} style={{ background: st.color }}></span>
                          <span className={styles.pipelineLabel}>{st.label}</span>
                          <span className={styles.pipelineBadge} style={{ color: st.color, background: st.bg }}>
                            {p.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className={styles.widgetCard}>
                <div className={styles.widgetHeader}>
                  <div className={styles.widgetHeaderLeft}>
                    <div className={`${styles.widgetIconBox} ${styles.widgetIconIndigo}`}>📦</div>
                    <div>
                      <h3 className={styles.widgetTitle}>Order Pipeline</h3>
                      <p className={styles.widgetSubtitle}>Your orders by status</p>
                    </div>
                  </div>
                  <Link to="/member/orders" className={styles.widgetViewAll}>View all →</Link>
                </div>
                {(stats?.orderPipeline || []).length === 0 ? (
                  <p className={styles.pipelineEmpty}>No orders placed yet.</p>
                ) : (
                  <div className={styles.pipelineList}>
                    {(stats?.orderPipeline || []).map((p) => {
                      const st = pipelineStyle(p.status);
                      return (
                        <div className={styles.pipelineRow} key={p.status}>
                          <span className={styles.pipelineDot} style={{ background: st.color }}></span>
                          <span className={styles.pipelineLabel}>{st.label}</span>
                          <span className={styles.pipelineBadge} style={{ color: st.color, background: st.bg }}>
                            {p.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>

          <div className={styles.widgetsSidebar}>
            {/* Quick Links */}
            <div className={styles.quickLinksPair}>
              <Link to="/member/team" className={styles.quickLinkCard}>
                <span className={styles.quickLinkIcon}>👥</span>
                <span className={styles.quickLinkTitle}>My Team</span>
                <span className={styles.quickLinkDesc}>View your full downline network</span>
                <span className={styles.quickLinkArrow}>→</span>
              </Link>
              <Link to="/member/business" className={styles.quickLinkCard}>
                <span className={styles.quickLinkIcon}>📊</span>
                <span className={styles.quickLinkTitle}>My Business</span>
                <span className={styles.quickLinkDesc}>Track KBP volume &amp; matching</span>
                <span className={styles.quickLinkArrow}>→</span>
              </Link>
            </div>

            {/* Left vs Right Leg */}
            <section className={styles.widgetCard}>
              <div className={styles.widgetHeader}>
                <div className={styles.widgetHeaderLeft}>
                  <div className={`${styles.widgetIconBox} ${styles.widgetIconTeal}`}>⚖️</div>
                  <div>
                    <h3 className={styles.widgetTitle}>Left vs Right Leg</h3>
                    <p className={styles.widgetSubtitle}>Binary network comparison</p>
                  </div>
                </div>
              </div>
              {(() => {
                const l = stats?.legComparison?.left || { members: 0, activeMembers: 0, kbp: 0, stars: 0 };
                const r = stats?.legComparison?.right || { members: 0, activeMembers: 0, kbp: 0, stars: 0 };
                const totalMembers = (l.members || 0) + (r.members || 0);
                const leftPct = totalMembers ? Math.round((l.members / totalMembers) * 100) : 50;
                return (
                  <>
                    <div className={styles.legCompareBarTrack}>
                      <div className={styles.legCompareBarLeft} style={{ width: `${leftPct}%` }}></div>
                      <div className={styles.legCompareBarRight} style={{ width: `${100 - leftPct}%` }}></div>
                    </div>
                    <div className={styles.legCompareStatsRow}>
                      <div className={styles.legCompareSide}>
                        <span className={styles.legCompareLabelLeft}>LEFT</span>
                        <span className={styles.legCompareStatLine}>{l.members} members · {l.activeMembers} active</span>
                        <span className={styles.legCompareStatLine}>{Number(l.kbp || 0).toLocaleString()} KBP · {l.stars} ⭐</span>
                      </div>
                      <div className={styles.legCompareSide}>
                        <span className={styles.legCompareLabelRight}>RIGHT</span>
                        <span className={styles.legCompareStatLine}>{r.members} members · {r.activeMembers} active</span>
                        <span className={styles.legCompareStatLine}>{Number(r.kbp || 0).toLocaleString()} KBP · {r.stars} ⭐</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </section>

            {/* Recently Added */}
            <section className={styles.widgetCard}>
              <div className={styles.widgetHeader}>
                <div className={styles.widgetHeaderLeft}>
                  <div className={`${styles.widgetIconBox} ${styles.widgetIconOrange}`}>🆕</div>
                  <div>
                    <h3 className={styles.widgetTitle}>Recently Added</h3>
                    <p className={styles.widgetSubtitle}>Newest members in your downline</p>
                  </div>
                </div>
                <Link to="/member/team" className={styles.widgetViewAll}>View all →</Link>
              </div>
              {(stats?.recentlyJoined || []).length === 0 ? (
                <p className={styles.pipelineEmpty}>No downline members yet.</p>
              ) : (
                <div className={styles.recentList}>
                  {(stats?.recentlyJoined || []).map((m) => (
                    <div className={styles.recentItem} key={m.id}>
                      <span className={styles.recentAvatar}>{getInitials(m.name)}</span>
                      <div className={styles.recentInfo}>
                        <span className={styles.recentName}>{m.name || 'Member'}</span>
                        <span className={styles.recentMeta}>{m.memberId} · Lvl {m.level} · {timeAgo(m.joinedAt)}</span>
                      </div>
                      <span
                        className={m.status === 'ACTIVE' ? styles.recentStatusPillActive : styles.recentStatusPillInactive}
                      >
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Announcements */}
            <section className={styles.widgetCard}>
              <div className={styles.widgetHeader}>
                <div className={styles.widgetHeaderLeft}>
                  <div className={`${styles.widgetIconBox} ${styles.widgetIconIndigo}`}>📢</div>
                  <div>
                    <h3 className={styles.widgetTitle}>Announcements</h3>
                    <p className={styles.widgetSubtitle}>Latest from KUWIFR admin</p>
                  </div>
                </div>
                <Link to="/member/notifications" className={styles.widgetViewAll}>View all →</Link>
              </div>
              {announcements.length === 0 ? (
                <p className={styles.pipelineEmpty}>No announcements right now.</p>
              ) : (
                <div className={styles.announceList}>
                  {announcements.slice(0, 5).map((a) => (
                    <div className={styles.announceItem} key={a._id || a.id}>
                      <span className={styles.announceIcon}>{a.icon || '📢'}</span>
                      <div className={styles.announceText}>
                        <span className={styles.announceTitle}>{a.title}</span>
                        <span className={styles.announceMessage}>{a.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

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