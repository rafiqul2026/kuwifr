// client/src/pages/member/BusinessPage.jsx
//
// New "My Business" sidebar page (docx: "Make the new page in the member
// Sidebar after that add these cards") — the binary business volume & KBP
// matching production cards that used to live in the Member Dashboard's
// "My Business" card group now live on their own dedicated page.
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './BusinessPage.module.css';

const formatKBP = (val) => `${(Number(val) || 0).toLocaleString()} KBP`;

const BusinessPage = () => {
  const { showNotification } = useNotification();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchBusinessData = async () => {
    try {
      setLoading(true);
      // Same dashboard-stats endpoint the Member Dashboard uses — these
      // cards used to render straight off this payload there, and now
      // render straight off it here instead.
      const res = await api.get('/api/users/dashboard-stats');
      if (res.data?.success && res.data?.data) {
        setStats(res.data.data);
      } else {
        throw new Error('Invalid business data');
      }
    } catch (err) {
      showNotification('Failed to load business data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessData();
  }, []);

  const todayBusiness = {
    left: Number(stats?.todayLeftBusiness || 0),
    right: Number(stats?.todayRightBusiness || 0)
  };
  const carryForwardBusiness = {
    left: Number(stats?.carryForwardBusiness?.left || 0),
    right: Number(stats?.carryForwardBusiness?.right || 0)
  };

  return (
    <div className={styles.businessPage}>
      <header className={styles.pageHeader}>
        <div className={styles.headerTitleWrap}>
          <span className={styles.pillBadge}>📊 Network Business</span>
          <h1 className={styles.pageTitle}>My Business</h1>
          <p className={styles.pageSubtitle}>
            Your binary business volume and KBP matching production, live from your Left and Right teams.
          </p>
        </div>
        <button type="button" className={styles.refreshBtn} onClick={fetchBusinessData} disabled={loading}>
          <svg
            className={loading ? styles.spinIcon : ''}
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </header>

      <div className={styles.businessGrid}>
        <div className={styles.businessCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>TODAY BUSINESS</span>
            <div className={styles.cardIconBox}>📊</div>
          </div>
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

        <div className={styles.businessCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>CARRY FORWARD BUSINESS</span>
            <div className={styles.cardIconBox}>🔁</div>
          </div>
          {loading && !stats ? (
            <div className={styles.skeletonSplit}></div>
          ) : (
            <div className={styles.dualVolumeBox}>
              <div className={styles.volumeColumn}>
                <span className={styles.sideLabelLeft}>Left:</span>
                <strong className={styles.sideValueLeft}>{carryForwardBusiness.left.toLocaleString()}</strong>
              </div>
              <div className={styles.volumeDivider}></div>
              <div className={styles.volumeColumn}>
                <span className={styles.sideLabelRight}>Right:</span>
                <strong className={styles.sideValueRight}>{carryForwardBusiness.right.toLocaleString()}</strong>
              </div>
            </div>
          )}
          <span className={styles.metricSubtitle}>Unmatched Volume Carried Forward (KBP)</span>
        </div>

        <div className={styles.businessCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>WEEKLY KBP</span>
            <div className={styles.cardIconBox}>⚡</div>
          </div>
          {loading && !stats ? (
            <div className={styles.skeletonMetric}></div>
          ) : (
            <h2 className={styles.primaryMetric}>{formatKBP(stats?.weeklyKbp?.total)}</h2>
          )}
          <span className={styles.metricSubtitle}>
            L: {(stats?.weeklyKbp?.left || 0).toLocaleString()} / R: {(stats?.weeklyKbp?.right || 0).toLocaleString()} KBP
          </span>
        </div>

        <div className={styles.businessCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>WEEKLY KBP MATCH</span>
            <div className={styles.cardIconBox}>⚖️</div>
          </div>
          {loading && !stats ? (
            <div className={styles.skeletonMetric}></div>
          ) : (
            <h2 className={styles.primaryMetric}>{formatKBP(stats?.weeklyKbpMatch)}</h2>
          )}
          <span className={styles.metricSubtitle}>Current Cycle Match</span>
        </div>

        <div className={styles.businessCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>TOTAL KBP MATCH</span>
            <div className={styles.cardIconBox}>🎯</div>
          </div>
          {loading && !stats ? (
            <div className={styles.skeletonMetric}></div>
          ) : (
            <h2 className={styles.primaryMetric}>{formatKBP(stats?.totalKbpMatch)}</h2>
          )}
          <span className={styles.metricSubtitle}>Lifetime Binary Match</span>
        </div>
      </div>
    </div>
  );
};

export default BusinessPage;
