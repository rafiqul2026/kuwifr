// client/src/pages/member/UpgradePackagePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import { getProductsForPackage, getSelectionMode } from './packageProductCatalog';
import styles from './UpgradePackagePage.module.css';

// Per-tier accent colors, matches the palette used on the Buy Package page.
const THEME_COLORS = {
  STARTER: '#16a34a',
  GROWTH: '#3b82f6',
  LIFE_SAFE: '#6366f1',
  LIFE_SAFE_ELITE: '#008080',
  TITANIUM: '#fd9911'
};

const TIER_BADGES = ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5'];

// Official Company Receiving Accounts — same account used on the Buy Package
// checkout, kept in sync manually since there is no shared config module.
const COMPANY_PAYMENT_INFO = {
  upiId: 'SBIBHIM.INSTANT13112874693574880@sbipay',
  merchantName: 'SB214110 (KUWIFR SERVICES PVT LTD)',
  accountName: 'KUWIFR SERVICES PRIVATE LIMITED',
  bankName: 'State Bank of India',
  accountNumber: '44708235535',
  ifscCode: 'SBIN0011617',
  branch: 'BARPETA BAZAR, ASSAM'
};

const UpgradePackagePage = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();

  const [packages, setPackages] = useState([]);
  const [currentPackage, setCurrentPackage] = useState(null);
  const [memberStatus, setMemberStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Product selection now happens directly on each ladder card (mirrors Buy
  // Package) — keyed by package id, one entry per card. "Upgrade Package"
  // only becomes clickable-to-checkout once a product is chosen.
  const [selectedProductMap, setSelectedProductMap] = useState({});

  // Multi-step modal: 'CONFIRM' | 'PAYMENT' | 'SUCCESS' | null
  const [modalStep, setModalStep] = useState(null);
  const [selectedUpgrade, setSelectedUpgrade] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('UPI_GATEWAY');
  const [qrViewMode, setQrViewMode] = useState('DYNAMIC');
  const [utrNumber, setUtrNumber] = useState('');
  const [proofPreview, setProofPreview] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState(null);

  // Live package catalog + the member's real current package/status — both
  // previously came from a hardcoded 5-package array with guessed prices and
  // a fake payment-gateway stub, so an admin changing a package's price
  // would silently desync this page and members could never actually pay.
  const fetchUpgradeData = useCallback(async () => {
    try {
      setLoading(true);
      const [pkgRes, profileRes] = await Promise.all([
        api.get('/api/packages'),
        api.get('/api/users/profile').catch(() => ({ data: { data: {} } }))
      ]);

      const remotePkgs = pkgRes.data?.data?.packages || pkgRes.data?.packages || [];
      const sorted = [...remotePkgs]
        .map((p) => ({
          ...p,
          _id: p._id || p.id,
          name: p.name || p.packageName,
          type: (p.type || '').toUpperCase(),
          price: Number(p.price || 0),
          kbp: Number(p.kbp !== undefined ? p.kbp : (p.kbpPoints || 0)),
          dailyCap: Number(p.dailyCap !== undefined ? p.dailyCap : (p.dailyBinaryCap || p.price || 0)),
          weeklyCap: Number(p.weeklyCap !== undefined ? p.weeklyCap : ((p.dailyCap || p.price || 0) * 7)),
          monthlyCap: Number(p.monthlyCap !== undefined ? p.monthlyCap : ((p.dailyCap || p.price || 0) * 30))
        }))
        .sort((a, b) => a.price - b.price)
        .map((p, idx) => ({
          ...p,
          level: idx + 1,
          color: THEME_COLORS[p.type] || '#3b82f6',
          badge: TIER_BADGES[idx] || `Tier ${idx + 1}`
        }));

      setPackages(sorted);

      const profile = profileRes.data?.data?.user;
      const status = profile?.status || 'INACTIVE';
      setMemberStatus(status);

      if (status === 'ACTIVE' && profile?.activePackageId) {
        const activeId = String(profile.activePackageId._id || profile.activePackageId);
        const matched = sorted.find((p) => String(p._id) === activeId)
          || sorted.find((p) => p.type === (profile.activePackageId?.type || '').toUpperCase());
        setCurrentPackage(matched || null);
      } else {
        setCurrentPackage(null);
      }
    } catch (error) {
      console.error('Failed to load upgrade data:', error);
      showNotification('Unable to load package catalog. Please refresh.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchUpgradeData();
  }, [fetchUpgradeData]);

  // Life Safe Elite bundles BOTH of its products automatically (no "choose
  // 1" note in its spec) — pre-fill the selection map for it as soon as the
  // live catalog loads, so its card renders as "already selected".
  useEffect(() => {
    if (packages.length === 0) return;
    setSelectedProductMap((prev) => {
      const next = { ...prev };
      let changed = false;
      packages.forEach((pkg) => {
        if (getSelectionMode(pkg.type) === 'ALL' && !next[pkg._id]) {
          next[pkg._id] = getProductsForPackage(pkg);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [packages]);

  const handleSelectProductOnCard = (pkgId, pkgType, product) => {
    if (getSelectionMode(pkgType) === 'ALL') return; // not user-selectable, both are bundled
    setSelectedProductMap((prev) => ({ ...prev, [pkgId]: [product] }));
  };

  // Member selects a product on the card first, then clicks "Upgrade
  // Package" — mirrors Buy Package's flow exactly, rather than asking for
  // the product choice inside a separate modal step after the fact.
  const handleInitiateUpgrade = (targetPkg) => {
    if (!currentPackage || targetPkg.level <= currentPackage.level) {
      showNotification(`You are already on or above ${targetPkg.name}. Lower tiers cannot be selected.`, 'warning');
      return;
    }

    const chosenProducts = selectedProductMap[targetPkg._id] || [];
    if (chosenProducts.length === 0) {
      showNotification(`Please select 1 product for ${targetPkg.name} before upgrading.`, 'warning');
      return;
    }

    setSelectedUpgrade(targetPkg);
    setSelectedProducts(chosenProducts);
    setUtrNumber('');
    setProofPreview('');
    setQrViewMode('DYNAMIC');
    setModalStep('CONFIRM');
  };

  const handleProceedToPayment = () => {
    setModalStep('PAYMENT');
  };

  const handleCopyToClipboard = (text, label) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      showNotification(`${label} copied to clipboard!`, 'info');
    }
  };

  const handleProofUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showNotification('Payment screenshot must be smaller than 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setProofPreview(reader.result);
    reader.readAsDataURL(file);
  };

  // Business rule: an upgrade costs the FULL price of the target package —
  // there is no "pay just the difference" discount — and credits 0 KBP.
  // The member only receives the higher capping ceiling and the target
  // tier's bundled product(s); no fresh referral/binary income is generated.
  const amountPayable = selectedUpgrade?.price || 0;

  const handleCompleteUpgrade = async () => {
    if (!selectedUpgrade) return;

    if (!utrNumber.trim()) {
      showNotification('Please enter the 12-digit UTR / Reference ID from your UPI payment.', 'warning');
      return;
    }

    if (!proofPreview && paymentMethod === 'UPI_GATEWAY') {
      showNotification('Please upload your payment confirmation screenshot.', 'warning');
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        packageId: selectedUpgrade._id,
        selectedProducts: selectedProducts.map((p) => ({
          productId: p.id,
          name: p.name,
          category: p.category,
          price: p.ksp,
          image: p.image
        })),
        paymentMethod,
        transactionId: utrNumber.trim(),
        paymentProof: proofPreview
      };

      const res = await api.post('/api/package-purchases/upgrade', payload);

      if (res.data?.success) {
        showNotification(res.data.message || 'Upgrade request submitted for admin approval!', 'info');
        setSuccessReceipt({
          ...res.data.data,
          amountPayable,
          targetName: selectedUpgrade.name,
          productNames: selectedProducts.map((p) => p.name).join(' + ')
        });
        setModalStep('SUCCESS');
      } else {
        showNotification(res.data?.message || 'Unable to submit upgrade request.', 'error');
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to submit upgrade payment details. Please try again.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleCloseModal = () => {
    if (modalStep === 'SUCCESS') {
      navigate('/member/dashboard');
    }
    setModalStep(null);
    setSelectedUpgrade(null);
    setSelectedProducts([]);
    setUtrNumber('');
    setProofPreview('');
  };

  const upiUri = selectedUpgrade
    ? `upi://pay?pa=${COMPANY_PAYMENT_INFO.upiId}&pn=${encodeURIComponent(COMPANY_PAYMENT_INFO.merchantName)}&am=${amountPayable}&cu=INR&tn=${encodeURIComponent(`KUWIFR-UPGRADE-${selectedUpgrade.name}-${user?.memberId || 'MEMBER'}`)}`
    : '';

  const dynamicQrUrl = selectedUpgrade
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiUri)}`
    : '';

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.spinner}></div>
        <p>Loading Package Upgrade Ladder...</p>
      </div>
    );
  }

  // Only an already-ACTIVE member has a "current package" to upgrade from —
  // send anyone else to Buy Package to activate for the first time.
  if (memberStatus !== 'ACTIVE' || !currentPackage) {
    return (
      <div className={styles.upgradeContainer}>
        <header className={styles.pageHeader}>
          <span className={styles.headerTag}>🚀 Flexible Tier Elevation</span>
          <h1 className={styles.pageTitle}>Upgrade Membership Package</h1>
        </header>

        <div className={styles.notActiveCard}>
          <div className={styles.notActiveIcon}>📦</div>
          <h2>No Active Package Yet</h2>
          <p>
            Upgrades are only available to members who already hold an active package.
            Activate your first package from Buy Package to get started.
          </p>
          <button
            type="button"
            className={styles.goToBuyBtn}
            onClick={() => navigate('/member/packages')}
          >
            Go to Buy Package →
          </button>
        </div>
      </div>
    );
  }

  const isMaxTierAchieved = currentPackage.level >= packages.length;

  return (
    <div className={styles.upgradeContainer}>
      {/* Header */}
      <header className={styles.pageHeader}>
        <span className={styles.headerTag}>🚀 Flexible Tier Elevation</span>
        <h1 className={styles.pageTitle}>Upgrade Membership Package</h1>
        <p className={styles.pageSubtitle}>
          Upgrade from your current package to <strong>any higher tier</strong> by paying that tier's full package price.
          Upgrades raise your capping ceiling and hand over the new tier's product(s) — no extra KBP or income is generated.
        </p>
      </header>

      {/* Active Package Banner */}
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

      {/* Upgrade Ladder Grid */}
      <div className={styles.upgradeGrid}>
        {packages.map((pkg) => {
          const isCurrent = currentPackage.type === pkg.type;
          const isPrevious = pkg.level < currentPackage.level;
          const isEligibleUpgrade = pkg.level > currentPackage.level;
          const selectionMode = getSelectionMode(pkg.type);
          const cardSelectedProducts = selectedProductMap[pkg._id] || [];
          const hasSelection = cardSelectedProducts.length > 0;

          return (
            <article
              key={pkg._id}
              className={`
                ${styles.pkgUpgradeCard}
                ${isCurrent ? styles.currentCard : ''}
                ${isPrevious ? styles.previousLockedCard : ''}
                ${isEligibleUpgrade ? styles.eligibleCard : ''}
              `}
              style={{ borderTopColor: isEligibleUpgrade ? pkg.color : (isCurrent ? '#008080' : '#d4d4d4') }}
            >
              <div className={styles.cardHeader}>
                <div className={styles.badgeRow}>
                  <span className={styles.tierTag} style={{ background: `${pkg.color}15`, color: pkg.color }}>
                    {pkg.badge}
                  </span>

                  {isCurrent && <span className={styles.currentChip}>● Current Plan</span>}
                  {isPrevious && <span className={styles.lockedChip}>🔒 Lower Tier (Locked)</span>}
                  {isEligibleUpgrade && <span className={styles.eligibleChip}>⚡ Upgrade Available</span>}
                </div>

                <h3 className={styles.pkgTitle}>{pkg.name}</h3>

                <div className={styles.pricingBox}>
                  <small className={styles.diffLabel}>
                    {isEligibleUpgrade ? 'Upgrade Package Price (Full Amount):' : 'Standard Package Cost:'}
                  </small>
                  <div className={isEligibleUpgrade ? styles.diffAmount : styles.staticPrice}>
                    ₹{pkg.price.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className={styles.specsList}>
                {isEligibleUpgrade ? (
                  <div className={styles.specItem}>
                    <span>KBP Credited on Upgrade</span>
                    <strong style={{ color: '#a3a3a3' }}>0 KBP (capping only)</strong>
                  </div>
                ) : (
                  <div className={styles.specItem}>
                    <span>Total KBP Valuation</span>
                    <strong>{pkg.kbp.toLocaleString()} KBP</strong>
                  </div>
                )}

                <div className={styles.specItem}>
                  <span>Daily Binary Cap</span>
                  <strong style={{ color: '#16a34a' }}>₹{pkg.dailyCap.toLocaleString()} / Day</strong>
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

              <div className={styles.productsPreviewSection}>
                <div className={styles.productsPreviewHeader}>
                  <span>📦 Products Included</span>
                  {selectionMode === 'ALL' ? (
                    <span className={styles.selectedOk}>✓ Both Included</span>
                  ) : hasSelection ? (
                    <span className={styles.selectedOk}>✓ 1 Selected</span>
                  ) : (
                    <span className={styles.selectedRequired}>* Choose 1</span>
                  )}
                </div>

                <div className={styles.productList}>
                  {getProductsForPackage(pkg).map((product) => {
                    const isChecked = selectionMode === 'ALL' || cardSelectedProducts.some((p) => p.id === product.id);
                    return (
                      <div
                        key={product.id}
                        className={`${styles.productItemCard} ${isChecked ? styles.productItemChecked : ''} ${selectionMode === 'ALL' ? styles.productItemStatic : ''}`}
                        onClick={() => handleSelectProductOnCard(pkg._id, pkg.type, product)}
                      >
                        <input
                          type={selectionMode === 'ALL' ? 'checkbox' : 'radio'}
                          name={`upgrade-product-${pkg._id}`}
                          checked={isChecked}
                          readOnly={selectionMode === 'ALL'}
                          onChange={() => handleSelectProductOnCard(pkg._id, pkg.type, product)}
                          className={styles.radioBtn}
                        />
                        <div className={styles.productItemInfo}>
                          <span className={styles.itemCat}>{product.category}</span>
                          <h4 className={styles.itemTitle}>{product.name}</h4>
                        </div>
                        <div className={styles.selectionCircle}>{isChecked ? '✓' : ''}</div>
                      </div>
                    );
                  })}
                </div>

                <p className={styles.productsPreviewFootnote}>
                  {selectionMode === 'ALL'
                    ? 'Both products above are bundled automatically with this package.'
                    : 'Select 1 product first, then click Upgrade Package below.'}
                </p>
              </div>

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
                    className={`${styles.upgradeBtn} ${!hasSelection ? styles.upgradeBtnDisabled : ''}`}
                    onClick={() => handleInitiateUpgrade(pkg)}
                  >
                    {hasSelection ? (
                      <span>Upgrade to {pkg.name} (Pay ₹{pkg.price.toLocaleString()}) →</span>
                    ) : (
                      <span>Select 1 Product to Upgrade</span>
                    )}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* ================= MULTI-STEP UPGRADE CHECKOUT MODAL ================= */}
      {modalStep && selectedUpgrade && (
        <div className={styles.modalOverlay} onClick={() => !processing && handleCloseModal()}>
          <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>

            {/* STEP 1: CONFIRM UPGRADE (product was already chosen on the card) */}
            {modalStep === 'CONFIRM' && (
              <>
                <div className={styles.modalHeader}>
                  <div>
                    <span className={styles.modalTag}>Step 1 of 3 · Tier Elevation</span>
                    <h2>Confirm Package Upgrade</h2>
                  </div>
                  <button type="button" className={styles.closeBtn} onClick={handleCloseModal}>✕</button>
                </div>

                <div className={styles.modalBody}>
                  <div className={styles.upgradeVisual}>
                    <div className={styles.visualNode}>
                      <small>From Current</small>
                      <strong>{currentPackage.name}</strong>
                      <span>₹{currentPackage.price.toLocaleString()}</span>
                    </div>
                    <span className={styles.visualArrow}>➔</span>
                    <div className={styles.visualNode} style={{ borderColor: selectedUpgrade.color, background: 'rgba(0, 128, 128, 0.05)' }}>
                      <small>Upgrading To</small>
                      <strong style={{ color: selectedUpgrade.color }}>{selectedUpgrade.name}</strong>
                      <span>₹{selectedUpgrade.price.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className={styles.chosenProductCard}>
                    <span className={styles.chosenCardBadge}>
                      📦 {selectedProducts.length > 1 ? 'Products Included in Package' : 'Selected Product Included in Package'}
                    </span>
                    {selectedProducts.map((product, idx) => (
                      <div
                        className={styles.chosenProductContent}
                        style={idx > 0 ? { marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e5e5e5' } : undefined}
                        key={product.id || idx}
                      >
                        <img src={product.image} alt={product.name} className={styles.chosenProductImg} />
                        <div className={styles.chosenProductDetails}>
                          <span className={styles.chosenCat}>{product.category}</span>
                          <h3 className={styles.chosenTitle}>{product.name}</h3>
                          <div className={styles.chosenPrices}>
                            <span><strong>KSP Price:</strong> ₹{product.ksp?.toLocaleString()}</span>
                            {product.mrp && <span className={styles.chosenMrp}>(MRP: ₹{product.mrp?.toLocaleString()})</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={styles.summaryTable}>
                    <div className={styles.summaryRow}>
                      <span>Upgrade Amount Payable (Full Package Price)</span>
                      <strong className={styles.payableAmount}>₹{amountPayable.toLocaleString()}</strong>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>KBP Credited</span>
                      <strong style={{ color: '#a3a3a3' }}>0 KBP</strong>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>New Daily Binary Cap</span>
                      <strong style={{ color: '#16a34a' }}>₹{selectedUpgrade.dailyCap.toLocaleString()} / Day</strong>
                    </div>
                  </div>

                  <p className={styles.upgradeNote}>
                    ℹ️ Upgrades raise your capping ceiling and hand over {selectedUpgrade.name}'s product(s) only.
                    No referral or binary income is generated by an upgrade — that only happens on a fresh package activation.
                  </p>
                </div>

                <div className={styles.modalFooter}>
                  <button type="button" className={styles.cancelBtn} onClick={handleCloseModal}>Cancel & Change Product</button>
                  <button type="button" className={styles.confirmBtn} onClick={handleProceedToPayment}>
                    Confirm & Proceed to Pay (₹{amountPayable.toLocaleString()}) →
                  </button>
                </div>
              </>
            )}

            {/* STEP 2: PAYMENT METHOD & QR / UTR / PROOF UPLOAD */}
            {modalStep === 'PAYMENT' && (
              <>
                <div className={styles.modalHeader}>
                  <div>
                    <span className={styles.modalTag}>Step 2 of 3 · SBI Payments QR</span>
                    <h2>Scan & Pay to Upgrade</h2>
                  </div>
                  <button type="button" className={styles.closeBtn} onClick={handleCloseModal} disabled={processing}>✕</button>
                </div>

                <div className={styles.modalBody}>
                  <div className={styles.paymentMethodList}>
                    <label className={`${styles.paymentOption} ${paymentMethod === 'UPI_GATEWAY' ? styles.paySelected : ''}`}>
                      <input
                        type="radio"
                        name="upgradePaymentMethod"
                        checked={paymentMethod === 'UPI_GATEWAY'}
                        onChange={() => setPaymentMethod('UPI_GATEWAY')}
                      />
                      <div className={styles.paymentOptionDetails}>
                        <strong>SBI Payments UPI QR (PhonePe / GPay / Paytm)</strong>
                        <span>Instant scan with pre-filled upgrade amount</span>
                      </div>
                      <span className={styles.payIcon}>📱</span>
                    </label>

                    <label className={`${styles.paymentOption} ${paymentMethod === 'BANK_TRANSFER' ? styles.paySelected : ''}`}>
                      <input
                        type="radio"
                        name="upgradePaymentMethod"
                        checked={paymentMethod === 'BANK_TRANSFER'}
                        onChange={() => setPaymentMethod('BANK_TRANSFER')}
                      />
                      <div className={styles.paymentOptionDetails}>
                        <strong>Direct Bank Transfer (IMPS / NEFT / RTGS)</strong>
                        <span>Company State Bank of India Current Account</span>
                      </div>
                      <span className={styles.payIcon}>🏦</span>
                    </label>
                  </div>

                  {paymentMethod === 'UPI_GATEWAY' && (
                    <div className={styles.qrPaymentContainer}>
                      <div className={styles.qrBox}>
                        <img
                          src={qrViewMode === 'DYNAMIC' ? dynamicQrUrl : '/images/kuwifr-upi-standee.jpeg'}
                          alt="KUWIFR SBI Dynamic UPI QR"
                          className={styles.qrImage}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = dynamicQrUrl;
                          }}
                        />
                        <span className={styles.qrScanHint}>Scan with PhonePe, GPay or Paytm</span>
                        <button
                          type="button"
                          onClick={() => setQrViewMode(qrViewMode === 'DYNAMIC' ? 'STANDEE' : 'DYNAMIC')}
                          className={styles.qrToggleBtn}
                        >
                          {qrViewMode === 'DYNAMIC' ? '📷 View Standee Photo' : '⚡ Auto-Amount QR'}
                        </button>
                      </div>

                      <div className={styles.upiInfoCard}>
                        <div className={styles.infoRow}>
                          <span>Merchant UPI ID</span>
                          <div className={styles.copyRow}>
                            <strong className={styles.monoFont}>{COMPANY_PAYMENT_INFO.upiId}</strong>
                            <button type="button" onClick={() => handleCopyToClipboard(COMPANY_PAYMENT_INFO.upiId, 'UPI ID')} className={styles.copyBtn}>
                              Copy
                            </button>
                          </div>
                        </div>

                        <div className={styles.infoRow}>
                          <span>Merchant Name</span>
                          <strong>{COMPANY_PAYMENT_INFO.merchantName}</strong>
                        </div>

                        <div className={styles.infoRow}>
                          <span>Exact Payable Amount</span>
                          <strong className={styles.highlightAmount}>₹{amountPayable.toLocaleString('en-IN')}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'BANK_TRANSFER' && (
                    <div className={styles.bankDetailsContainer}>
                      <div className={styles.bankDetailRow}>
                        <span>Bank Name:</span>
                        <strong>{COMPANY_PAYMENT_INFO.bankName}</strong>
                      </div>
                      <div className={styles.bankDetailRow}>
                        <span>Account Name:</span>
                        <strong>{COMPANY_PAYMENT_INFO.accountName}</strong>
                      </div>
                      <div className={styles.bankDetailRow}>
                        <span>Account Number:</span>
                        <div className={styles.copyRow}>
                          <strong className={styles.monoFont}>{COMPANY_PAYMENT_INFO.accountNumber}</strong>
                          <button type="button" onClick={() => handleCopyToClipboard(COMPANY_PAYMENT_INFO.accountNumber, 'Account Number')} className={styles.copyBtn}>
                            Copy
                          </button>
                        </div>
                      </div>
                      <div className={styles.bankDetailRow}>
                        <span>IFSC Code:</span>
                        <div className={styles.copyRow}>
                          <strong className={styles.monoFont}>{COMPANY_PAYMENT_INFO.ifscCode}</strong>
                          <button type="button" onClick={() => handleCopyToClipboard(COMPANY_PAYMENT_INFO.ifscCode, 'IFSC Code')} className={styles.copyBtn}>
                            Copy
                          </button>
                        </div>
                      </div>
                      <div className={styles.bankDetailRow}>
                        <span>Branch:</span>
                        <strong>{COMPANY_PAYMENT_INFO.branch}</strong>
                      </div>
                      <div className={styles.bankDetailRow}>
                        <span>Exact Payable Amount:</span>
                        <strong className={styles.highlightAmount}>₹{amountPayable.toLocaleString('en-IN')}</strong>
                      </div>
                    </div>
                  )}

                  <div className={styles.verificationInputBlock}>
                    <label className={styles.inputLabel}>
                      Enter 12-Digit UPI Reference / UTR Number <span className={styles.requiredStar}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 423589123456"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      className={styles.utrInputField}
                      maxLength={30}
                    />

                    <label className={styles.inputLabel} style={{ marginTop: '10px' }}>
                      Upload Payment Screenshot <span className={styles.requiredStar}>*</span>
                    </label>
                    <div className={styles.uploadZone}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProofUpload}
                        id="upgradeProofUpload"
                        className={styles.fileInputHidden}
                      />
                      <label htmlFor="upgradeProofUpload" className={styles.uploadTriggerBtn}>
                        📷 Choose Screenshot
                      </label>
                      {proofPreview ? (
                        <div className={styles.proofPreviewWrap}>
                          <img src={proofPreview} alt="Payment Proof Preview" className={styles.proofThumb} />
                          <span className={styles.proofAttachedLabel}>✓ Proof Attached</span>
                        </div>
                      ) : (
                        <span className={styles.uploadHint}>Attach screenshot showing UTR and paid amount</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setModalStep('CONFIRM')} disabled={processing}>
                    ← Back
                  </button>
                  <button type="button" className={styles.confirmBtn} onClick={handleCompleteUpgrade} disabled={processing}>
                    {processing ? 'Submitting Payment Proof...' : `Submit Payment Proof (₹${amountPayable.toLocaleString()})`}
                  </button>
                </div>
              </>
            )}

            {/* STEP 3: PENDING VERIFICATION RECEIPT */}
            {modalStep === 'SUCCESS' && (
              <div className={styles.successScreenWrapper}>
                <div className={styles.pendingHourglassIcon}>⏳</div>
                <h2 className={styles.successTitle}>Upgrade Payment Submitted</h2>
                <p className={styles.successSubtitle}>
                  Thank you <strong>{user?.fullName || 'Member'}</strong>! Your upgrade payment details and screenshot proof have been forwarded to our accounts team.
                  Your package will switch to <span className={styles.activeTag}>{successReceipt?.targetName}</span> once verified by admin.
                </p>

                <div className={styles.receiptBox}>
                  <div className={styles.receiptRow}>
                    <span>Upgrading To:</span>
                    <strong>{successReceipt?.targetName}</strong>
                  </div>
                  <div className={styles.receiptRow}>
                    <span>Bundled Product{successReceipt?.productNames?.includes('+') ? 's' : ''}:</span>
                    <strong>{successReceipt?.productNames}</strong>
                  </div>
                  <div className={styles.receiptRow}>
                    <span>Submitted UTR / Ref:</span>
                    <strong className={styles.monoFont}>{successReceipt?.transactionId}</strong>
                  </div>
                  <div className={styles.receiptRow}>
                    <span>Amount Payable:</span>
                    <strong>₹{(successReceipt?.amountPayable || 0).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className={styles.receiptRow}>
                    <span>KBP Credited:</span>
                    <strong style={{ color: '#a3a3a3' }}>0 KBP</strong>
                  </div>
                  <div className={styles.receiptRow}>
                    <span>Status:</span>
                    <strong className={styles.pendingStatusText}>● PENDING ADMIN APPROVAL</strong>
                  </div>
                </div>

                <button type="button" className={styles.dashboardRedirectBtn} onClick={handleCloseModal}>
                  Return to Member Dashboard →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UpgradePackagePage;
