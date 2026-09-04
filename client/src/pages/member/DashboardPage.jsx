// client/src/pages/member/DashboardPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

  // Fetch Member Dashboard Analytics
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

  // ============================================================
  // 🌐 PERMANENT PRODUCTION DOMAIN RESOLUTION FOR REFERRAL LINKS
  // Ensures links always use https://www.kuwifr.in
  // ============================================================
  const LIVE_PRODUCTION_DOMAIN = 'https://www.kuwifr.in';
  const sponsorId = user?.memberId || stats?.memberId || 'KFR665384';

  const referralLinks = useMemo(() => {
    return {
      left: `${LIVE_PRODUCTION_DOMAIN}/register?ref=${sponsorId}&pos=L`,
      right: `${LIVE_PRODUCTION_DOMAIN}/register?ref=${sponsorId}&pos=R`
    };
  }, [sponsorId]);

  // Robust Cross-Device Copy to Clipboard
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
      showNotification(`${side.toUpperCase()} team referral link copied to clipboard!`, 'info');
      setTimeout(() => setCopiedSide(null), 2200);
    } catch (err) {
      showNotification('Failed to copy link. Please select and copy manually.', 'error');
    }
  };

  // Native Mobile Share (WhatsApp, Telegram, System Sheet)
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
            <Link to="/member/packages" className={styles.noticeActionBtn}>
              Activate Account →
            </Link>
          </div>
        )}

        {/* 4-ROW INFORMATION HIERARCHY GRID */}
        <div className={styles.statsGridContainer}>
          {/* ================= ROW 1: FINANCIAL OVERVIEW ================= */}
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

          {/* ================= ROW 2: MEMBER ACQUISITION ================= */}
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
              <span className={styles.metricSubtitle}>Activated Plans Today</span>
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

          {/* ================= ROW 3: ACTIVE & STAR VOLUME ================= */}
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

        {/* ================= 🔗 PRODUCTION DIRECT REFERRAL LINKS SECTION ================= */}
        <section className={styles.referralShareSection}>
          <div className={styles.referralHeader}>
            <div className={styles.referralHeaderIcon}>🔗</div>
            <div className={styles.referralHeaderDetails}>
              <h3>Your Direct Referral Links</h3>
              <p>Share your personalized link to place new registrations directly into your Left or Right team</p>
            </div>
          </div>

          <div className={styles.referralGrid}>
            {/* 1. Left Side Referral Placement */}
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
                    {copiedSide === 'left' ? (
                      <>
                        <span className={styles.btnCheckIcon}>✓</span>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={styles.btnSvg}
                        >
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className={styles.shareIconButton}
                    onClick={() => handleNativeShare('left', referralLinks.left)}
                    title="Share Link via WhatsApp or Mobile Apps"
                    aria-label="Share Left Link"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={styles.btnSvg}
                    >
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

            {/* 2. Right Side Referral Placement */}
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
                    {copiedSide === 'right' ? (
                      <>
                        <span className={styles.btnCheckIcon}>✓</span>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={styles.btnSvg}
                        >
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className={styles.shareIconButton}
                    onClick={() => handleNativeShare('right', referralLinks.right)}
                    title="Share Link via WhatsApp or Mobile Apps"
                    aria-label="Share Right Link"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={styles.btnSvg}
                    >
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