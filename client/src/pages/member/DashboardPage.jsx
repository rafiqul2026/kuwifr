// client/src/pages/member/DashboardPage.jsx

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../hooks/useNotification";
import SalaryProgressCard from "../../components/member/SalaryProgressCard";
import styles from "./DashboardPage.module.css";

/**
 * ============================================================================
 * 📊 MEMBER DASHBOARD COMPONENT
 * ============================================================================
 * Displays:
 * 1. Financial KPIs (Today Income, Total Income, Total Withdrawal)
 * 2. Downline Network Counts (Today Registrations, Today Active, Total Members)
 * 3. Binary Star Volumes (Star Points = KBP / 1000) for Today & Lifetime
 * 4. Recognition & Structure (Current Rank, Achieved Funds, Direct Sponsor)
 * 5. Salary Progress Bar & Direct Referral Links with One-Click Clipboard Copy
 */
const DashboardPage = () => {
  // --------------------------------------------------------------------------
  // 1. Context & Global Hooks
  // --------------------------------------------------------------------------
  const { user } = useAuth();
  const { showNotification } = useNotification();

  // --------------------------------------------------------------------------
  // 2. Component State Management
  // --------------------------------------------------------------------------
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedSide, setCopiedSide] = useState(null);

  // --------------------------------------------------------------------------
  // 3. API Data Fetching: Consolidated Member Statistics
  // --------------------------------------------------------------------------
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // GET /api/users/dashboard-stats contains wallet, team counts, and binary metrics
      const res = await api.get("/api/users/dashboard-stats");

      if (res.data?.success && res.data?.data) {
        setStats(res.data.data);
      } else {
        throw new Error("Invalid dashboard payload received from server");
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.message || "Failed to load dashboard data";
      setError(errMsg);
      showNotification(errMsg, "error");
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  // Initial load hook
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // --------------------------------------------------------------------------
  // 4. Utility: Currency Formatter (Indian Rupee: ₹)
  // --------------------------------------------------------------------------
  const formatINR = (val) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  // --------------------------------------------------------------------------
  // 5. Star Conversion Helper (1 Star = 1,000 KBP)
  // --------------------------------------------------------------------------
  /**
   * If the backend returns raw KBP (e.g. 3,000 and 1,000), this helper
   * guarantees that Star display values reflect genuine star units (3 and 1)
   * while gracefully handling backend responses that are already scaled.
   */
  const resolveStarCount = (starMetric, kbpMetric) => {
    // If backend explicitly populated leftKbp/rightKbp, star is floor(kbp / 1000)
    if (kbpMetric !== undefined && kbpMetric !== null) {
      return Math.floor(Number(kbpMetric || 0) / 1000);
    }
    const val = Number(starMetric || 0);
    // If raw value is >= 1000, convert it to 1 Star = 1,000 KBP units
    if (val >= 1000) {
      return Math.floor(val / 1000);
    }
    return val;
  };

  // Compute Left and Right Stars dynamically
  const todayStars = useMemo(() => {
    const leftKbp =
      stats?.todayStar?.leftKbp ??
      (Number(stats?.todayStar?.left || 0) >= 1000
        ? stats?.todayStar?.left
        : Number(stats?.todayStar?.left || 0) * 1000);
    const rightKbp =
      stats?.todayStar?.rightKbp ??
      (Number(stats?.todayStar?.right || 0) >= 1000
        ? stats?.todayStar?.right
        : Number(stats?.todayStar?.right || 0) * 1000);

    return {
      leftStars: resolveStarCount(
        stats?.todayStar?.left,
        stats?.todayStar?.leftKbp,
      ),
      rightStars: resolveStarCount(
        stats?.todayStar?.right,
        stats?.todayStar?.rightKbp,
      ),
      leftKbp: Number(leftKbp || 0),
      rightKbp: Number(rightKbp || 0),
    };
  }, [stats?.todayStar]);

  const totalStars = useMemo(() => {
    const leftKbp =
      stats?.totalStar?.leftKbp ??
      (Number(stats?.totalStar?.left || 0) >= 1000
        ? stats?.totalStar?.left
        : Number(stats?.totalStar?.left || 0) * 1000);
    const rightKbp =
      stats?.totalStar?.rightKbp ??
      (Number(stats?.totalStar?.right || 0) >= 1000
        ? stats?.totalStar?.right
        : Number(stats?.totalStar?.right || 0) * 1000);

    return {
      leftStars: resolveStarCount(
        stats?.totalStar?.left,
        stats?.totalStar?.leftKbp,
      ),
      rightStars: resolveStarCount(
        stats?.totalStar?.right,
        stats?.totalStar?.rightKbp,
      ),
      leftKbp: Number(leftKbp || 0),
      rightKbp: Number(rightKbp || 0),
    };
  }, [stats?.totalStar]);

  // --------------------------------------------------------------------------
  // 6. Direct Referral Link Generation (Permanent Production Domain)
  // --------------------------------------------------------------------------
  const LIVE_PRODUCTION_DOMAIN = "https://www.kuwifr.in";
  const sponsorId = user?.memberId || stats?.memberId || "KFR665384";

  const referralLinks = useMemo(() => {
    return {
      left: `${LIVE_PRODUCTION_DOMAIN}/register?ref=${sponsorId}&pos=L`,
      right: `${LIVE_PRODUCTION_DOMAIN}/register?ref=${sponsorId}&pos=R`,
    };
  }, [sponsorId]);

  // --------------------------------------------------------------------------
  // 7. Clipboard & Web Share API Handlers
  // --------------------------------------------------------------------------
  const handleCopyLink = async (side, url) => {
    if (!url) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const tempInput = document.createElement("textarea");
        tempInput.value = url;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
      }
      setCopiedSide(side);
      showNotification(
        `${side.toUpperCase()} team referral link copied to clipboard!`,
        "info",
      );
      setTimeout(() => setCopiedSide(null), 2200);
    } catch (err) {
      showNotification(
        "Failed to copy link. Please select and copy manually.",
        "error",
      );
    }
  };

  const handleNativeShare = (side, url) => {
    const teamLabel = side === "left" ? "LEFT" : "RIGHT";
    if (navigator.share) {
      navigator
        .share({
          title: `Join KUWIFR Network (${teamLabel} Team)`,
          text: `Register under my KUWIFR ${teamLabel} Team placement.\nSponsor ID: ${sponsorId}\nJoin Link:`,
          url: url,
        })
        .catch(() => {});
    } else {
      handleCopyLink(side, url);
    }
  };

  // --------------------------------------------------------------------------
  // 8. Error Fallback UI
  // --------------------------------------------------------------------------
  if (error && !stats) {
    return (
      <div className={styles.dashboardScene}>
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>⚠️</div>
          <h3>Unable to load dashboard</h3>
          <p>{error}</p>
          <button
            type="button"
            className={styles.retryBtn}
            onClick={fetchDashboardData}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 9. Main Render: 3D Scene + Metric Grid Layout
  // --------------------------------------------------------------------------
  return (
    <div className={styles.dashboardScene}>
      {/* 3D Decorative Floating Elements */}
      <div className={styles.ambientCanvas} aria-hidden="true">
        <div className={`${styles.glowBlob} ${styles.blobTopLeft}`}></div>
        <div className={`${styles.glowBlob} ${styles.blobTopRight}`}></div>
        <div className={`${styles.glowBlob} ${styles.blobCenterRight}`}></div>
        <div className={`${styles.glowBlob} ${styles.blobBottomLeft}`}></div>

        <div
          className={`${styles.floating3DObject} ${styles.sphereTopRight}`}
        ></div>
        <div
          className={`${styles.floating3DObject} ${styles.sphereMidLeft}`}
        ></div>
        <div
          className={`${styles.floating3DObject} ${styles.sphereBottomRight}`}
        ></div>

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

        <div
          className={`${styles.floating3DObject} ${styles.geoRingTop}`}
        ></div>
        <div
          className={`${styles.floating3DObject} ${styles.geoRingBottom}`}
        ></div>
      </div>

      {/* Foreground Content */}
      <div className={styles.contentLayer}>
        {/* Header Bar */}
        <header className={styles.dashboardHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.greetingBadge}>
              <span className={styles.greetingDot}></span>
              MEMBER DASHBOARD
            </div>
            <h1 className={styles.welcomeTitle}>
              Welcome back,{" "}
              <span className={styles.nameHighlight}>
                {user?.fullName || "Member"}
              </span>
            </h1>
            <p className={styles.welcomeSub}>
              Member ID: <strong className={styles.idCode}>{sponsorId}</strong>
              <span className={styles.subDivider}>•</span>
              Status:{" "}
              <span
                className={
                  user?.status === "ACTIVE"
                    ? styles.statusPillActive
                    : styles.statusPillInactive
                }
              >
                ● {user?.status || "INACTIVE"}
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
                className={loading ? styles.spinIcon : ""}
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
              <span>{loading ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>
        </header>

        {/* Inactive Member Activation Banner */}
        {user?.status !== "ACTIVE" && (
          <div className={styles.activationNoticeBanner}>
            <div className={styles.noticeIconBox}>⚡</div>
            <div className={styles.noticeTextBox}>
              <h4>Your Member ID is currently INACTIVE</h4>
              <p>
                Purchase any 1 of our activation packages to activate your
                account and start earning binary matching income.
              </p>
            </div>
            <Link to="/member/packages" className={styles.noticeActionBtn}>
              Activate Account →
            </Link>
          </div>
        )}

        {/* ===================================================================
            4-ROW DASHBOARD METRIC GRID
        =================================================================== */}
        <div className={styles.statsGridContainer}>
          {/* ----------------- ROW 1: FINANCIAL OVERVIEW ----------------- */}
          <div className={`${styles.statCard} ${styles.cardFinancial}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>TODAY INCOME</span>
              <div className={styles.cardIconBox}>💵</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetric}>
                  {formatINR(stats?.todayIncome)}
                </h2>
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
                <h2 className={styles.primaryMetric}>
                  {formatINR(stats?.totalIncome)}
                </h2>
              )}
              <span className={styles.metricSubtitle}>
                Lifetime Accumulated
              </span>
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
                <h2 className={styles.primaryMetric}>
                  {formatINR(stats?.totalWithdrawal)}
                </h2>
              )}
              <span className={styles.metricSubtitle}>Payouts Dispatched</span>
            </div>
          </div>

          {/* ----------------- ROW 2: MEMBER ACQUISITION ----------------- */}
          <div className={`${styles.statCard} ${styles.cardMember}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>TODAY ADD MEMBERS</span>
              <div className={styles.cardIconBox}>👥</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetric}>
                  {stats?.todayAddMembers || 0}
                </h2>
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
                <h2 className={styles.primaryMetric}>
                  {stats?.todayActiveMembers || 0}
                </h2>
              )}
              <span className={styles.metricSubtitle}>
                Activated Plans Today
              </span>
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
                <h2 className={styles.primaryMetric}>
                  {stats?.totalMembers || 0}
                </h2>
              )}
              <span className={styles.metricSubtitle}>
                Full Downline Network
              </span>
            </div>
          </div>

          {/* ----------------- ROW 3: ACTIVE & STAR METRICS ----------------- */}
          <div className={`${styles.statCard} ${styles.cardTeam}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>TOTAL ACTIVE MEMBERS</span>
              <div className={styles.cardIconBox}>✅</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetric}>
                  {stats?.totalActiveMembers || 0}
                </h2>
              )}
              <span className={styles.metricSubtitle}>Network Wide Active</span>
            </div>
          </div>

          {/* TODAY STAR CARD: Shows Star Points (1 Star = 1,000 KBP) */}
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
                      {todayStars.leftStars.toLocaleString()}
                    </strong>
                  </div>
                  <div className={styles.volumeDivider}></div>
                  <div className={styles.volumeColumn}>
                    <span className={styles.sideLabelRight}>Right Star</span>
                    <strong className={styles.sideValueRight}>
                      {todayStars.rightStars.toLocaleString()}
                    </strong>
                  </div>
                </div>
              )}
              <span className={styles.metricSubtitle}>
                {todayStars.leftKbp.toLocaleString()} L /{" "}
                {todayStars.rightKbp.toLocaleString()} R KBP (1 Star = 1,000
                KBP)
              </span>
            </div>
          </div>

          {/* TOTAL STAR CARD: Shows Star Points (e.g. 3 Left Star / 1 Right Star) */}
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
                      {totalStars.leftStars.toLocaleString()}
                    </strong>
                  </div>
                  <div className={styles.volumeDivider}></div>
                  <div className={styles.volumeColumn}>
                    <span className={styles.sideLabelRight}>Right Star</span>
                    <strong className={styles.sideValueRight}>
                      {totalStars.rightStars.toLocaleString()}
                    </strong>
                  </div>
                </div>
              )}
              <span className={styles.metricSubtitle}>
                {totalStars.leftKbp.toLocaleString()} L /{" "}
                {totalStars.rightKbp.toLocaleString()} R KBP (1 Star = 1,000
                KBP)
              </span>
            </div>
          </div>

          {/* ----------------- ROW 4: RANK, FUND & SPONSOR ----------------- */}
          <div className={`${styles.statCard} ${styles.cardMeta}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>CURRENT RANK</span>
              <div className={styles.cardIconBox}>🏆</div>
            </div>
            <div className={styles.cardBody}>
              {loading && !stats ? (
                <div className={styles.skeletonMetric}></div>
              ) : (
                <h2 className={styles.primaryMetaText}>
                  {stats?.currentRank?.name || "Not Achieved"}
                </h2>
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
                  <span className={styles.fundIcon}>
                    {stats?.currentFundAchieved?.icon || "🎯"}
                  </span>
                  <h2 className={styles.primaryMetaText}>
                    {stats?.currentFundAchieved?.name || "Not Achieved"}
                  </h2>
                </div>
              )}
              <span className={styles.metricSubtitle}>
                Life Tension Free Benefit
              </span>
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
                  <h2 className={styles.primaryMetaText}>
                    {stats?.directSponsor?.name || "Direct Sponsor"}
                  </h2>
                  <span className={styles.sponsorIdBadge}>
                    ID: {stats?.directSponsor?.memberId || "ROOT"}
                  </span>
                </div>
              )}
              <span className={styles.metricSubtitle}>Upline Guidance</span>
            </div>
          </div>
        </div>

        {/* Salary Wallet Progress */}
        <SalaryProgressCard />

        {/* ===================================================================
            🔗 DIRECT REFERRAL LINKS (PERMANENT PRODUCTION DOMAIN)
        =================================================================== */}
        <section className={styles.referralShareSection}>
          <div className={styles.referralHeader}>
            <div className={styles.referralHeaderIcon}>🔗</div>
            <div className={styles.referralHeaderDetails}>
              <h3>Your Direct Referral Links</h3>
              <p>
                Share your personalized link to place new registrations directly
                into your Left or Right team
              </p>
            </div>
          </div>

          <div className={styles.referralGrid}>
            {/* Left Team Referral Card */}
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
                    className={`${styles.copyButton} ${copiedSide === "left" ? styles.copyButtonActive : ""}`}
                    onClick={() => handleCopyLink("left", referralLinks.left)}
                    title="Copy Left Referral Link"
                  >
                    {copiedSide === "left" ? (
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
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          ></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className={styles.shareIconButton}
                    onClick={() =>
                      handleNativeShare("left", referralLinks.left)
                    }
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

            {/* Right Team Referral Card */}
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
                    className={`${styles.copyButton} ${copiedSide === "right" ? styles.copyButtonActive : ""}`}
                    onClick={() => handleCopyLink("right", referralLinks.right)}
                    title="Copy Right Referral Link"
                  >
                    {copiedSide === "right" ? (
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
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          ></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className={styles.shareIconButton}
                    onClick={() =>
                      handleNativeShare("right", referralLinks.right)
                    }
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
