// client/src/pages/member/BuyPackagePage.jsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import styles from './BuyPackagePage.module.css';

const BuyPackagePage = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState(null);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/packages');
      if (res.data?.success) {
        setPackages(res.data.data.packages || []);
      }
    } catch {
      showNotification('Failed to load packages', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleActivatePackage = async (pkg) => {
    const isActivating = user?.status !== 'ACTIVE';
    const confirmMessage = isActivating
      ? `Activate your Member ID (${user?.memberId}) with ${pkg.name} for ₹${pkg.price.toLocaleString()}?`
      : `Upgrade to ${pkg.name} for ₹${pkg.price.toLocaleString()}?`;

    if (!window.confirm(confirmMessage)) return;

    setActivatingId(pkg._id || pkg.name);
    try {
      const res = await api.post('/api/packages/purchase', {
        packageId: pkg._id,
        price: pkg.price,
        kbp: pkg.kbp,
        productName: pkg.name
      });

      if (res.data?.success) {
        showNotification(res.data.message, 'success');
        // Refresh page state to reflect ACTIVE status
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Activation failed', 'error');
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <div className={styles.packageContainer}>
      {/* Account Status Hero Banner */}
      <div
        className={`${styles.statusBanner} ${
          user?.status === 'ACTIVE'
            ? styles.statusBannerActive
            : styles.statusBannerInactive
        }`}
      >
        <div className={styles.statusBannerLeft}>
          <span className={styles.statusDot}></span>
          <div>
            <h4>
              Account Status:{' '}
              <strong>{user?.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'}</strong>
            </h4>
            <p>
              {user?.status === 'ACTIVE'
                ? `✅ Your Member ID (${user?.memberId}) is Verified and Active. You are fully eligible for binary pair matching & repurchase overrides.`
                : `⚠️ Your Member ID (${user?.memberId}) is currently INACTIVE. Purchase any 1 of the 5 packages below to activate your ID and unlock earnings.`}
            </p>
          </div>
        </div>
      </div>

      <header className={styles.pageHeader}>
        <span className={styles.headerPill}>⚡ Member ID Activation & Packages</span>
        <h1>Choose Your Joining Package</h1>
        <p>Activate your ID, unlock 2:1 & 1:1 binary matching income, and start your business journey</p>
      </header>

      {loading ? (
        <div className={styles.loadingBox}>
          <div className={styles.spinner}></div>
          <p>Loading available joining packages...</p>
        </div>
      ) : (
        <div className={styles.packageGrid}>
          {packages.map((pkg) => {
            const isTopTier = pkg.price >= 10000;
            const isCurrentActive =
              user?.activePackageId &&
              (user.activePackageId === pkg._id || user.activePackageId?._id === pkg._id);

            return (
              <div
                key={pkg._id || pkg.name}
                className={`${styles.packageCard} ${isTopTier ? styles.packageCardFeatured : ''}`}
              >
                {isTopTier && <span className={styles.featuredBadge}>⭐ POPULAR</span>}

                <div className={styles.cardTop}>
                  <h3>{pkg.name}</h3>
                  <div className={styles.priceRow}>
                    <span className={styles.currency}>₹</span>
                    <span className={styles.priceAmount}>{pkg.price.toLocaleString()}</span>
                  </div>
                  <p className={styles.packageDesc}>{pkg.description}</p>
                </div>

                <div className={styles.featureList}>
                  <div className={styles.featureItem}>
                    <span>⭐ Business Volume:</span>
                    <strong>{pkg.kbp?.toLocaleString()} KBP</strong>
                  </div>
                  <div className={styles.featureItem}>
                    <span>🚀 Daily Capping Limit:</span>
                    <strong>₹{pkg.dailyCap?.toLocaleString()} / Day</strong>
                  </div>
                  <div className={styles.featureItem}>
                    <span>🎁 Sponsor Direct Bonus:</span>
                    <strong style={{ color: '#10b981' }}>+₹{pkg.directBonus?.toLocaleString()}</strong>
                  </div>
                  <div className={styles.featureItem}>
                    <span>🔓 ID Activation:</span>
                    <strong style={{ color: '#2563eb' }}>Instant ACTIVE Status</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.activateBtn}
                  onClick={() => handleActivatePackage(pkg)}
                  disabled={activatingId === (pkg._id || pkg.name) || isCurrentActive}
                >
                  {activatingId === (pkg._id || pkg.name)
                    ? 'Activating Account...'
                    : isCurrentActive
                    ? '✓ Current Active Plan'
                    : user?.status === 'ACTIVE'
                    ? `Upgrade to ${pkg.name}`
                    : `Activate ID (Pay ₹${pkg.price.toLocaleString()}) →`}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BuyPackagePage;