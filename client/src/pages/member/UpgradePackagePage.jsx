// client/src/pages/member/UpgradePackagePage.jsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import styles from './UpgradePackagePage.module.css';

// 5 Standard Membership Packages
const ALL_5_PACKAGES = [
  {
    level: 1,
    id: 'starter',
    type: 'STARTER',
    name: 'Starter Package',
    price: 1500,
    kbp: 1000,
    dailyCap: 1500,
    weeklyCap: 10500,
    monthlyCap: 45000,
    color: '#22c55e',
    badge: 'Tier 1'
  },
  {
    level: 2,
    id: 'growth',
    type: 'GROWTH',
    name: 'Growth Package',
    price: 5000,
    kbp: 4000,
    dailyCap: 7000,
    weeklyCap: 49000,
    monthlyCap: 210000,
    color: '#2563eb',
    badge: 'Tier 2'
  },
  {
    level: 3,
    id: 'life_safe',
    type: 'LIFE_SAFE',
    name: 'Life Safe Package',
    price: 10000,
    kbp: 7500,
    dailyCap: 15000,
    weeklyCap: 105000,
    monthlyCap: 450000,
    color: '#8b5cf6',
    badge: 'Tier 3'
  },
  {
    level: 4,
    id: 'life_safe_elite',
    type: 'LIFE_SAFE_ELITE',
    name: 'Life Safe Elite Package',
    price: 15000,
    kbp: 10000,
    dailyCap: 20000,
    weeklyCap: 140000,
    monthlyCap: 600000,
    color: '#7c3aed',
    badge: 'Tier 4'
  },
  {
    level: 5,
    id: 'titanium',
    type: 'TITANIUM',
    name: 'Titanium Package',
    price: 110000,
    kbp: 50000,
    dailyCap: 50000,
    weeklyCap: 350000,
    monthlyCap: 1500000,
    color: '#f59e0b',
    badge: 'Tier 5'
  }
];

const UpgradePackagePage = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const [currentPackage, setCurrentPackage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedUpgrade, setSelectedUpgrade] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchCurrentPackageStatus();
  }, [user]);

  const fetchCurrentPackageStatus = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/users/profile').catch(() => ({ data: { data: {} } }));
      const userProfile = res.data?.data?.user || user;

      const activeType = userProfile?.activePackageId?.type || userProfile?.packageType || 'STARTER';
      const matchedCurrent = ALL_5_PACKAGES.find(p => p.type === activeType) || ALL_5_PACKAGES[0];

      setCurrentPackage(matchedCurrent);
    } catch {
      setCurrentPackage(ALL_5_PACKAGES[0]); // Default to Starter
    } finally {
      setLoading(false);
    }
  };

  // Open confirmation modal for any higher package
  const handleInitiateUpgrade = (targetPkg) => {
    if (targetPkg.level <= currentPackage.level) {
      showNotification(`You are already on or above ${targetPkg.name}. Lower tiers cannot be selected.`, 'warning');
      return;
    }
    setSelectedUpgrade(targetPkg);
  };

  // Process upgrade order and redirect directly to payment gateway
  const handleProceedToPayment = async () => {
    if (!selectedUpgrade) return;

    setProcessing(true);
    try {
      const upgradePriceDifference = selectedUpgrade.price - (currentPackage?.price || 0);

      const res = await api.post('/api/payment/create-order', {
        packageId: selectedUpgrade.id,
        packageType: selectedUpgrade.type,
        amount: upgradePriceDifference,
        kbp: selectedUpgrade.kbp - (currentPackage?.kbp || 0),
        isUpgrade: true
      });

      if (res.data?.success) {
        showNotification('Redirecting to payment gateway for upgrade checkout...', 'success');
        if (res.data.data?.paymentUrl) {
          window.location.href = res.data.data.paymentUrl;
          return;
        }
        if (res.data.data?.redirectUrl) {
          window.location.href = res.data.data.redirectUrl;
          return;
        }
        showNotification(`Upgrade order initialized for ₹${upgradePriceDifference.toLocaleString()}`, 'success');
        setSelectedUpgrade(null);
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Upgrade payment initialization failed', 'error');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.spinner}></div>
        <p>Loading Package Upgrade Ladder...</p>
      </div>
    );
  }

  const isMaxTierAchieved = currentPackage?.level >= 5;

  return (
    <div className={styles.upgradeContainer}>
      {/* Header */}
      <header className={styles.pageHeader}>
        <span className={styles.headerTag}>🚀 Flexible Tier Elevation</span>
        <h1 className={styles.pageTitle}>Upgrade Membership Package</h1>
        <p className={styles.pageSubtitle}>
          Upgrade directly from your current package to <strong>any higher tier</strong>. Pay only the difference amount.
        </p>
      </header>

      {/* Active Package Banner */}
      {currentPackage && (
        <section className={styles.activeBanner}>
          <div className={styles.bannerLeft}>
            <span className={styles.activeBadge}>CURRENT ACTIVE PACKAGE</span>
            <h2>{currentPackage.name}</h2>
            <div className={styles.activeMeta}>
              <span>Value: <strong>₹{currentPackage.price.toLocaleString()}</strong></span>
              <span>•</span>
              <span>Points: <strong>{currentPackage.kbp.toLocaleString()} KBP</strong></span>
              <span>•</span>
              <span>Daily Cap: <strong>₹{currentPackage.dailyCap.toLocaleString()} / Day</strong></span>
            </div>
          </div>
          <div className={styles.bannerRight}>
            {isMaxTierAchieved ? (
              <span className={styles.maxTierBadge}>👑 Pinnacle Tier Reached</span>
            ) : (
              <span className={styles.tierShield}>🛡️ {currentPackage.badge} Active</span>
            )}
          </div>
        </section>
      )}

      {/* 5 Upgrade Cards Grid */}
      <div className={styles.upgradeGrid}>
        {ALL_5_PACKAGES.map((pkg) => {
          const isCurrent = currentPackage?.type === pkg.type;
          const isPrevious = pkg.level < (currentPackage?.level || 1);
          const isEligibleUpgrade = pkg.level > (currentPackage?.level || 1);

          const priceDifference = Math.max(0, pkg.price - (currentPackage?.price || 0));
          const addedKBP = Math.max(0, pkg.kbp - (currentPackage?.kbp || 0));

          return (
            <article
              key={pkg.id}
              className={`
                ${styles.pkgUpgradeCard} 
                ${isCurrent ? styles.currentCard : ''} 
                ${isPrevious ? styles.previousLockedCard : ''} 
                ${isEligibleUpgrade ? styles.eligibleCard : ''}
              `}
              style={{ borderTopColor: isEligibleUpgrade ? pkg.color : (isCurrent ? '#10b981' : '#94a3b8') }}
            >
              <div className={styles.cardHeader}>
                <div className={styles.badgeRow}>
                  <span className={styles.tierTag} style={{ background: `${pkg.color}15`, color: pkg.color }}>
                    {pkg.badge}
                  </span>

                  {/* Status Indicator */}
                  {isCurrent && (
                    <span className={styles.currentChip}>● Current Plan</span>
                  )}
                  {isPrevious && (
                    <span className={styles.lockedChip}>🔒 Lower Tier (Locked)</span>
                  )}
                  {isEligibleUpgrade && (
                    <span className={styles.eligibleChip}>⚡ Upgrade Available</span>
                  )}
                </div>

                <h3 className={styles.pkgTitle}>{pkg.name}</h3>

                <div className={styles.pricingBox}>
                  {isEligibleUpgrade ? (
                    <div>
                      <small className={styles.diffLabel}>Upgrade Price Difference:</small>
                      <div className={styles.diffAmount}>
                        ₹{priceDifference.toLocaleString()}
                        <span className={styles.fullPrice}> (Total: ₹{pkg.price.toLocaleString()})</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <small className={styles.diffLabel}>Standard Package Cost:</small>
                      <div className={styles.staticPrice}>₹{pkg.price.toLocaleString()}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Specs */}
              <div className={styles.specsList}>
                <div className={styles.specItem}>
                  <span>Total KBP Valuation</span>
                  <strong>{pkg.kbp.toLocaleString()} KBP</strong>
                </div>

                {isEligibleUpgrade && (
                  <div className={styles.specItem}>
                    <span>Additional KBP Credited</span>
                    <strong style={{ color: '#2563eb' }}>+{addedKBP.toLocaleString()} KBP</strong>
                  </div>
                )}

                <div className={styles.specItem}>
                  <span>Daily Binary Cap</span>
                  <strong style={{ color: '#10b981' }}>₹{pkg.dailyCap.toLocaleString()} / Day</strong>
                </div>

                <div className={styles.specItem}>
                  <span>Weekly Binary Cap</span>
                  <strong>₹{pkg.weeklyCap.toLocaleString()}</strong>
                </div>

                <div className={styles.specItem}>
                  <span>Monthly Binary Cap</span>
                  <strong>₹{pkg.monthlyCap.toLocaleString()}</strong>
                </div>
              </div>

              {/* Action Button */}
              <div className={styles.cardAction}>
                {isCurrent && (
                  <button type="button" className={styles.currentBtn} disabled>
                    ✓ Currently Active
                  </button>
                )}

                {isPrevious && (
                  <button type="button" className={styles.lockedBtn} disabled>
                    🔒 Lower Tier (Cannot Downgrade)
                  </button>
                )}

                {isEligibleUpgrade && (
                  <button
                    type="button"
                    className={styles.upgradeBtn}
                    onClick={() => handleInitiateUpgrade(pkg)}
                    style={{ background: pkg.color }}
                  >
                    Upgrade to {pkg.name} (Pay ₹{priceDifference.toLocaleString()}) →
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* ================= CONFIRM UPGRADE MODAL ================= */}
      {selectedUpgrade && (
        <div className={styles.modalOverlay} onClick={() => !processing && setSelectedUpgrade(null)}>
          <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.modalTag}>Tier Elevation</span>
                <h2>Confirm Package Upgrade</h2>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setSelectedUpgrade(null)}
                disabled={processing}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.upgradeVisual}>
                <div className={styles.visualNode}>
                  <small>From Current</small>
                  <strong>{currentPackage?.name}</strong>
                  <span>₹{currentPackage?.price.toLocaleString()}</span>
                </div>
                <span className={styles.visualArrow}>➔</span>
                <div className={styles.visualNode} style={{ borderColor: selectedUpgrade.color, background: '#eff6ff' }}>
                  <small>Upgrading To</small>
                  <strong style={{ color: selectedUpgrade.color }}>{selectedUpgrade.name}</strong>
                  <span>₹{selectedUpgrade.price.toLocaleString()}</span>
                </div>
              </div>

              <div className={styles.summaryTable}>
                <div className={styles.summaryRow}>
                  <span>Upgrade Amount Payable</span>
                  <strong className={styles.payableAmount}>
                    ₹{(selectedUpgrade.price - (currentPackage?.price || 0)).toLocaleString()}
                  </strong>
                </div>
                <div className={styles.summaryRow}>
                  <span>Additional KBP Points</span>
                  <strong style={{ color: '#2563eb' }}>
                    +{(selectedUpgrade.kbp - (currentPackage?.kbp || 0)).toLocaleString()} KBP
                  </strong>
                </div>
                <div className={styles.summaryRow}>
                  <span>New Daily Binary Cap</span>
                  <strong style={{ color: '#10b981' }}>
                    ₹{selectedUpgrade.dailyCap.toLocaleString()} / Day
                  </strong>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setSelectedUpgrade(null)}
                disabled={processing}
              >
                Cancel
              </button>

              <button
                type="button"
                className={styles.confirmBtn}
                onClick={handleProceedToPayment}
                disabled={processing}
              >
                {processing ? 'Connecting Gateway...' : `Proceed to Payment (₹${(selectedUpgrade.price - (currentPackage?.price || 0)).toLocaleString()}) →`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpgradePackagePage;