// client/src/pages/member/PackagesPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import { getProductsForPackage, getSelectionMode } from './packageProductCatalog';
import styles from './PackagesPage.module.css';

// PBW Foundation token palette — teal primary, orange accent, plus the
// documented chart hues (green/blue/indigo) used elsewhere in the redesign
// to keep each tier visually distinct without reaching for a foreign palette.
const THEME_COLORS = {
  STARTER: '#16a34a',
  GROWTH: '#3b82f6',
  LIFE_SAFE: '#6366f1',
  LIFE_SAFE_ELITE: '#008080',
  TITANIUM: '#fd9911'
};

// Official Company Receiving Accounts verified from SBI Payments Merchant standee
const COMPANY_PAYMENT_INFO = {
  upiId: 'SBIBHIM.INSTANT13112874693574880@sbipay',
  merchantName: 'SB214110 (KUWIFR SERVICES PVT LTD)',
  accountName: 'KUWIFR SERVICES PRIVATE LIMITED',
  bankName: 'State Bank of India',
  accountNumber: '44708235535',
  ifscCode: 'SBIN0011617',
  branch: 'BARPETA BAZAR, ASSAM'
};

const PackagesPage = () => {
  const [packages, setPackages] = useState([]);
  const [selectedProductMap, setSelectedProductMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [memberStatus, setMemberStatus] = useState(null);
  const [activePackageInfo, setActivePackageInfo] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // 3-Step Modal State: 'REVIEW' | 'PAYMENT' | 'SUCCESS' | null
  const [modalStep, setModalStep] = useState(null);
  const [activePkg, setActivePkg] = useState(null);
  const [activeProducts, setActiveProducts] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('UPI_GATEWAY');
  const [qrViewMode, setQrViewMode] = useState('DYNAMIC'); // 'DYNAMIC' | 'STANDEE'
  const [utrNumber, setUtrNumber] = useState('');
  const [proofPreview, setProofPreview] = useState('');
  const [successReceipt, setSuccessReceipt] = useState(null);

  const { user } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();

  const fetchLivePackages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/packages');
      const remotePkgs = res.data?.data?.packages || res.data?.packages || [];

      if (Array.isArray(remotePkgs) && remotePkgs.length > 0) {
        const formatted = remotePkgs.map((dbPkg) => {
          const typeUpper = (dbPkg.type || '').toUpperCase();

          let products = dbPkg.availableProducts || dbPkg.products;
          if (!products || products.length === 0) {
            products = getProductsForPackage(dbPkg);
          }

          const isPopular = !!dbPkg.isPopular;
          // Recommended/popular packages get the teal "current/recommended"
          // accent (PBW convention), overriding the per-tier chart color.
          const color = isPopular
            ? '#008080'
            : THEME_COLORS[typeUpper] || (dbPkg.price >= 50000 ? '#fd9911' : '#3b82f6');

          return {
            ...dbPkg,
            _id: dbPkg._id || dbPkg.id,
            name: dbPkg.name || dbPkg.packageName,
            price: Number(dbPkg.price || 0),
            kbp: Number(dbPkg.kbp !== undefined ? dbPkg.kbp : (dbPkg.kbpPoints || 0)),
            dailyCap: Number(dbPkg.dailyCap !== undefined ? dbPkg.dailyCap : (dbPkg.dailyBinaryCap || dbPkg.price || 0)),
            weeklyCap: Number(dbPkg.weeklyCap !== undefined ? dbPkg.weeklyCap : ((dbPkg.dailyCap || dbPkg.price || 0) * 7)),
            monthlyCap: Number(dbPkg.monthlyCap !== undefined ? dbPkg.monthlyCap : ((dbPkg.dailyCap || dbPkg.price || 0) * 30)),
            description: dbPkg.description || dbPkg.entitlements || 'Package plan for KUWIFR members.',
            badge: dbPkg.badge || dbPkg.displayBadge || (isPopular ? 'Popular Choice' : (typeUpper || 'Active Plan')),
            color,
            isPopular,
            availableProducts: products
          };
        });

        setPackages(formatted);
      }
    } catch (error) {
      console.error('Failed to load packages:', error);
      showNotification('Unable to fetch live package data. Please refresh.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchLivePackages();
  }, [fetchLivePackages]);

  // Life Safe Elite bundles BOTH of its products automatically (its spec has
  // no "choose 1" note, unlike every other tier) — pre-fill the selection
  // map for any such package as soon as the live catalog loads, so its card
  // renders as "already selected" with no click needed.
  useEffect(() => {
    if (packages.length === 0) return;
    setSelectedProductMap((prev) => {
      const next = { ...prev };
      let changed = false;
      packages.forEach((pkg) => {
        const key = pkg._id || pkg.id;
        if (getSelectionMode(pkg.type) === 'ALL' && !next[key]) {
          next[key] = pkg.availableProducts || [];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [packages]);

  // A member who already holds an active package must go through
  // "Upgrade Package" to move to a higher tier — this page previously let
  // anyone submit a brand-new activation purchase regardless of their
  // current status, so an already-ACTIVE member could "buy" the Starter
  // Package again with no indication that Buy Package was the wrong place.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatusLoading(true);
        const res = await api.get('/api/users/profile');
        if (cancelled) return;
        const profile = res.data?.data?.user;
        setMemberStatus(profile?.status || 'INACTIVE');
        setActivePackageInfo(profile?.activePackageId || null);
      } catch {
        if (!cancelled) setMemberStatus('INACTIVE');
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSelectProduct = (pkgKey, pkgType, product) => {
    if (getSelectionMode(pkgType) === 'ALL') return; // not user-selectable, both are bundled
    setSelectedProductMap((prev) => ({
      ...prev,
      [pkgKey]: [product]
    }));
  };

  // Step 1: Open Review Modal
  const handleInitiatePurchase = (pkg) => {
    const key = pkg._id || pkg.id;
    const chosenProducts = selectedProductMap[key];

    if ((!chosenProducts || chosenProducts.length === 0) && pkg.availableProducts?.length > 0) {
      showNotification(`Please select 1 product for ${pkg.name} before purchasing.`, 'warning');
      return;
    }

    setActivePkg(pkg);
    setActiveProducts(chosenProducts?.length > 0 ? chosenProducts : [{ name: 'Direct Activation', ksp: pkg.price, mrp: pkg.price, category: 'Membership' }]);
    setUtrNumber('');
    setProofPreview('');
    setQrViewMode('DYNAMIC');
    setModalStep('REVIEW');
  };

  // Step 2: Transition to Payment Selection
  const handleProceedToPayment = () => {
    setModalStep('PAYMENT');
  };

  // Clipboard utility
  const handleCopyToClipboard = (text, label) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      showNotification(`${label} copied to clipboard!`, 'info');
    }
  };

  // Convert uploaded image file to Base64
  const handleProofUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showNotification('Payment screenshot must be smaller than 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProofPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Step 3: Submit Verification Request to Admin
  const handleCompleteActivation = async () => {
    if (!activePkg || activeProducts.length === 0) return;

    if (!utrNumber.trim()) {
      showNotification('Please enter the 12-digit UTR / Reference ID from your UPI payment.', 'warning');
      return;
    }

    if (!proofPreview && paymentMethod === 'UPI_GATEWAY') {
      showNotification('Please upload your payment confirmation screenshot.', 'warning');
      return;
    }

    setProcessingPayment(true);
    try {
      const payload = {
        packageId: activePkg._id || activePkg.id,
        packageName: activePkg.name,
        packagePrice: activePkg.price,
        kbpPoints: activePkg.kbp,
        dailyBinaryCap: activePkg.dailyCap,
        selectedProducts: activeProducts.map((p) => ({
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

      const res = await api.post('/api/package-purchases/activate', payload);

      if (res.data?.success) {
        showNotification(res.data.message || 'Payment submitted for admin approval!', 'info');
        setSuccessReceipt(res.data.data);
        setModalStep('SUCCESS');
      } else {
        showNotification(res.data?.message || 'Unable to submit payment request.', 'error');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to submit payment details. Please try again.';
      showNotification(errMsg, 'error');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleCloseModal = () => {
    if (modalStep === 'SUCCESS') {
      navigate('/member/dashboard');
    }
    setModalStep(null);
    setActivePkg(null);
    setActiveProducts([]);
    setUtrNumber('');
    setProofPreview('');
  };

  // Dynamic UPI URI targeting official SBI Merchant account with exact package price
  const upiUri = activePkg
    ? `upi://pay?pa=${COMPANY_PAYMENT_INFO.upiId}&pn=${encodeURIComponent(COMPANY_PAYMENT_INFO.merchantName)}&am=${activePkg.price}&cu=INR&tn=${encodeURIComponent(`KUWIFR-${activePkg.name}-${user?.memberId || 'MEMBER'}`)}`
    : '';

  const dynamicQrUrl = activePkg
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiUri)}`
    : '';

  if (loading || statusLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading Membership Packages...</p>
      </div>
    );
  }

  // Already-active members can't re-buy a starter/base package from here —
  // send them to Upgrade Package instead, which handles moving to a higher
  // tier and paying only the difference.
  if (memberStatus === 'ACTIVE') {
    return (
      <div className={styles.packagesContainer}>
        <header className={styles.pageHeader}>
          <div className={styles.headerTitleWrap}>
            <span className={styles.headerTag}>🚀 Activation & Upgrades</span>
            <h1 className={styles.pageTitle}>Membership Packages</h1>
          </div>
        </header>

        <div className={styles.alreadyActiveCard}>
          <div className={styles.alreadyActiveIcon}>✅</div>
          <h2>You're Already an Active Member</h2>
          <p>
            Your ID is currently active on <strong>{activePackageInfo?.name || 'your current package'}</strong>.
            The Buy Package flow is only for first-time activation — to move to a higher-value package,
            use Upgrade Package and pay just the difference.
          </p>
          <button
            type="button"
            className={styles.goToUpgradeBtn}
            onClick={() => navigate('/member/packages/upgrade')}
          >
            Go to Upgrade Package →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.packagesContainer}>
      <header className={styles.pageHeader}>
        <div className={styles.headerTitleWrap}>
          <span className={styles.headerTag}>🚀 Activation & Upgrades</span>
          <h1 className={styles.pageTitle}>Membership Packages</h1>
          <p className={styles.pageSubtitle}>
            Choose an activation package, select <strong>strictly one product option</strong>, and proceed to checkout.
          </p>
        </div>
      </header>

      <div className={styles.packagesGrid}>
        {packages.map((pkg) => {
          const pkgKey = pkg._id || pkg.id;
          const selectionMode = getSelectionMode(pkg.type);
          const selectedProducts = selectedProductMap[pkgKey] || [];
          const hasSelection = selectedProducts.length > 0;

          return (
            <article
              key={pkgKey}
              className={`${styles.packageCard} ${pkg.isPopular ? styles.packageCardPopular : ''}`}
              style={{ borderTopColor: pkg.color }}
            >
              <div className={styles.cardHeader}>
                <div className={styles.badgeRow}>
                  <span className={styles.typeBadge} style={{ background: `${pkg.color}15`, color: pkg.color }}>
                    {pkg.badge}
                  </span>
                  <span className={styles.kbpBadge}>⭐ {pkg.kbp?.toLocaleString()} KBP</span>
                </div>

                <h2 className={styles.packageName}>{pkg.name}</h2>
                <p className={styles.packageDescription}>{pkg.description}</p>

                <div className={styles.pricingBar}>
                  <div className={styles.priceWrap}>
                    <small>₹</small>{pkg.price?.toLocaleString()}
                  </div>
                  <div className={styles.dailyCapWrap}>
                    <span>Daily Cap</span>
                    <strong>₹{pkg.dailyCap?.toLocaleString()} / Day</strong>
                  </div>
                </div>
              </div>

              {/* Product Selection */}
              <div className={styles.productSelectionSection}>
                <div className={styles.selectionPromptRow}>
                  <label className={styles.selectionPromptLabel}>
                    {selectionMode === 'ALL'
                      ? 'Both Products Included (No Selection Needed):'
                      : 'Select 1 Product (Included in Package):'}
                  </label>
                  {selectionMode === 'ALL' ? (
                    <span className={styles.selectedOk}>✓ Both Included</span>
                  ) : hasSelection ? (
                    <span className={styles.selectedOk}>✓ 1 Selected</span>
                  ) : (
                    <span className={styles.selectedRequired}>* Choose 1</span>
                  )}
                </div>

                <div className={styles.productList}>
                  {pkg.availableProducts?.map((product) => {
                    const isChecked = selectionMode === 'ALL' || selectedProducts.some((p) => p.id === product.id);

                    return (
                      <div
                        key={product.id}
                        className={`${styles.productItemCard} ${isChecked ? styles.productItemChecked : ''} ${selectionMode === 'ALL' ? styles.productItemStatic : ''}`}
                        onClick={() => handleSelectProduct(pkgKey, pkg.type, product)}
                      >
                        <input
                          type={selectionMode === 'ALL' ? 'checkbox' : 'radio'}
                          name={`package-product-${pkgKey}`}
                          checked={isChecked}
                          readOnly={selectionMode === 'ALL'}
                          onChange={() => handleSelectProduct(pkgKey, pkg.type, product)}
                          className={styles.radioBtn}
                        />

                        <div className={styles.productThumbnail}>
                          <img src={product.image} alt={product.name} />
                        </div>

                        <div className={styles.productItemInfo}>
                          <span className={styles.itemCat}>{product.category}</span>
                          <h4 className={styles.itemTitle}>{product.name}</h4>
                          <div className={styles.itemPrices}>
                            <span className={styles.kspPrice}>KSP: ₹{product.ksp?.toLocaleString()}</span>
                            {product.mrp && <span className={styles.mrpPrice}>MRP: ₹{product.mrp?.toLocaleString()}</span>}
                          </div>
                        </div>

                        <div className={styles.selectionCircle}>
                          {isChecked ? '✓' : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {pkg.productNote && <p className={styles.noteText}>💡 <strong>Note:</strong> {pkg.productNote}</p>}
              </div>

              {/* Income Capping Breakdown */}
              <div className={styles.capsFooter}>
                <div className={styles.capMetric}>
                  <small>Weekly Cap</small>
                  <span>₹{pkg.weeklyCap?.toLocaleString()}</span>
                </div>
                <div className={styles.capMetric}>
                  <small>Monthly Cap</small>
                  <span>₹{pkg.monthlyCap?.toLocaleString()}</span>
                </div>
              </div>

              {/* Action Button */}
              <div className={styles.cardActionWrap}>
                <button
                  type="button"
                  className={`${styles.purchaseBtn} ${hasSelection ? styles.purchaseBtnActive : styles.purchaseBtnDisabled}`}
                  onClick={() => handleInitiatePurchase(pkg)}
                >
                  {hasSelection ? (
                    <span>Purchase {pkg.name} (₹{pkg.price?.toLocaleString()}) →</span>
                  ) : (
                    <span>Select 1 Product to Purchase</span>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* ================= MULTI-STEP CHECKOUT & PAYMENT MODAL ================= */}
      {modalStep && activePkg && (
        <div className={styles.modalOverlay} onClick={() => !processingPayment && handleCloseModal()}>
          <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            
            {/* 1. STEP 1: CHECKOUT REVIEW */}
            {modalStep === 'REVIEW' && (
              <>
                <div className={styles.modalHeader}>
                  <div>
                    <span className={styles.modalTag}>Step 1 of 3 · Checkout Review</span>
                    <h2>Confirm Package Purchase</h2>
                  </div>
                  <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={handleCloseModal}
                  >
                    ✕
                  </button>
                </div>

                <div className={styles.modalBody}>
                  <div className={styles.chosenProductCard}>
                    <span className={styles.chosenCardBadge}>
                      📦 {activeProducts.length > 1 ? 'Both Products Included in Package' : 'Selected Product Included in Package'}
                    </span>
                    {activeProducts.map((product, idx) => (
                      <div
                        className={styles.chosenProductContent}
                        style={idx > 0 ? { marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e5e5e5' } : undefined}
                        key={product.id || idx}
                      >
                        <img
                          src={product.image}
                          alt={product.name}
                          className={styles.chosenProductImg}
                        />
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

                  <div className={styles.metricsGrid}>
                    <div className={styles.metricBox}>
                      <small>Package Price</small>
                      <strong className={styles.priceColor}>₹{activePkg.price?.toLocaleString()}</strong>
                    </div>

                    <div className={styles.metricBox}>
                      <small>KBP Points</small>
                      <strong className={styles.kbpColor}>⭐ {activePkg.kbp?.toLocaleString()} KBP</strong>
                    </div>

                    <div className={styles.metricBox}>
                      <small>Daily Binary Cap</small>
                      <strong className={styles.capColor}>🛡️ ₹{activePkg.dailyCap?.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={handleCloseModal}
                  >
                    Cancel & Change Product
                  </button>

                  <button
                    type="button"
                    className={styles.confirmBtn}
                    onClick={handleProceedToPayment}
                  >
                    Confirm & Proceed to Pay (₹{activePkg.price?.toLocaleString()}) →
                  </button>
                </div>
              </>
            )}

            {/* 2. STEP 2: PAYMENT METHOD & SBI QR CODE SCAN / UTR / PROOF UPLOAD */}
            {modalStep === 'PAYMENT' && (
              <>
                <div className={styles.modalHeader}>
                  <div>
                    <span className={styles.modalTag}>Step 2 of 3 · SBI Payments QR</span>
                    <h2>Scan & Pay to Activate</h2>
                  </div>
                  <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={handleCloseModal}
                    disabled={processingPayment}
                  >
                    ✕
                  </button>
                </div>

                <div className={styles.modalBody}>
                  {/* Payment Method Selector */}
                  <div className={styles.paymentMethodList}>
                    <label className={`${styles.paymentOption} ${paymentMethod === 'UPI_GATEWAY' ? styles.paySelected : ''}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === 'UPI_GATEWAY'}
                        onChange={() => setPaymentMethod('UPI_GATEWAY')}
                      />
                      <div className={styles.paymentOptionDetails}>
                        <strong>SBI Payments UPI QR (PhonePe / GPay / Paytm)</strong>
                        <span>Instant scan with pre-filled package amount</span>
                      </div>
                      <span className={styles.payIcon}>📱</span>
                    </label>

                    <label className={`${styles.paymentOption} ${paymentMethod === 'BANK_TRANSFER' ? styles.paySelected : ''}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
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

                  {/* UPI QR Display Interface */}
                  {paymentMethod === 'UPI_GATEWAY' && (
                    <div className={styles.qrPaymentContainer}>
                      <div className={styles.qrBox}>
                        <img
                          src={
                            qrViewMode === 'DYNAMIC'
                              ? dynamicQrUrl
                              : '/images/kuwifr-upi-standee.jpeg'
                          }
                          alt="KUWIFR SBI Dynamic UPI QR"
                          className={styles.qrImage}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = dynamicQrUrl;
                          }}
                        />
                        <span className={styles.qrScanHint}>
                          Scan with PhonePe, GPay or Paytm
                        </span>
                        <button
                          type="button"
                          onClick={() => setQrViewMode(qrViewMode === 'DYNAMIC' ? 'STANDEE' : 'DYNAMIC')}
                          style={{
                            marginTop: '8px',
                            fontSize: '11px',
                            padding: '3px 10px',
                            borderRadius: '6px',
                            background: 'rgba(0, 128, 128, 0.08)',
                            border: '1px solid rgba(0, 128, 128, 0.25)',
                            color: '#008080',
                            cursor: 'pointer',
                            fontWeight: 700
                          }}
                        >
                          {qrViewMode === 'DYNAMIC' ? '📷 View Standee Photo' : '⚡ Auto-Amount QR'}
                        </button>
                      </div>

                      <div className={styles.upiInfoCard}>
                        <div className={styles.infoRow}>
                          <span>Merchant UPI ID</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                            <strong className={styles.monoFont} style={{ fontSize: '11px', wordBreak: 'break-all' }}>
                              {COMPANY_PAYMENT_INFO.upiId}
                            </strong>
                            <button
                              type="button"
                              onClick={() => handleCopyToClipboard(COMPANY_PAYMENT_INFO.upiId, 'UPI ID')}
                              style={{
                                padding: '2px 8px',
                                fontSize: '10px',
                                fontWeight: 800,
                                background: 'rgba(0, 128, 128, 0.08)',
                                border: '1px solid rgba(0, 128, 128, 0.25)',
                                color: '#008080',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                            >
                              Copy
                            </button>
                          </div>
                        </div>

                        <div className={styles.infoRow} style={{ marginTop: '6px' }}>
                          <span>Merchant Name</span>
                          <strong>{COMPANY_PAYMENT_INFO.merchantName}</strong>
                        </div>

                        <div className={styles.infoRow} style={{ marginTop: '6px' }}>
                          <span>Exact Payable Amount</span>
                          <strong className={styles.highlightAmount}>
                            ₹{activePkg.price?.toLocaleString('en-IN')}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bank Deposit Interface */}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong className={styles.monoFont}>{COMPANY_PAYMENT_INFO.accountNumber}</strong>
                          <button
                            type="button"
                            onClick={() => handleCopyToClipboard(COMPANY_PAYMENT_INFO.accountNumber, 'Account Number')}
                            style={{
                              padding: '2px 6px',
                              fontSize: '10px',
                              fontWeight: 700,
                              background: 'rgba(0, 128, 128, 0.08)',
                              border: '1px solid rgba(0, 128, 128, 0.25)',
                              color: '#008080',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <div className={styles.bankDetailRow}>
                        <span>IFSC Code:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong className={styles.monoFont}>{COMPANY_PAYMENT_INFO.ifscCode}</strong>
                          <button
                            type="button"
                            onClick={() => handleCopyToClipboard(COMPANY_PAYMENT_INFO.ifscCode, 'IFSC Code')}
                            style={{
                              padding: '2px 6px',
                              fontSize: '10px',
                              fontWeight: 700,
                              background: 'rgba(0, 128, 128, 0.08)',
                              border: '1px solid rgba(0, 128, 128, 0.25)',
                              color: '#008080',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <div className={styles.bankDetailRow}>
                        <span>Branch:</span>
                        <strong>{COMPANY_PAYMENT_INFO.branch}</strong>
                      </div>
                    </div>
                  )}

                  {/* Mandatory Verification Proof Inputs */}
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
                        id="proofUpload"
                        className={styles.fileInputHidden}
                      />
                      <label htmlFor="proofUpload" className={styles.uploadTriggerBtn}>
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
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => setModalStep('REVIEW')}
                    disabled={processingPayment}
                  >
                    ← Back
                  </button>

                  <button
                    type="button"
                    className={styles.confirmBtn}
                    onClick={handleCompleteActivation}
                    disabled={processingPayment}
                  >
                    {processingPayment ? 'Submitting Payment Proof...' : `Submit Payment Proof (₹${activePkg.price?.toLocaleString()})`}
                  </button>
                </div>
              </>
            )}

            {/* 3. STEP 3: TRANSACTION PENDING VERIFICATION RECEIPT */}
            {modalStep === 'SUCCESS' && (
              <div className={styles.successScreenWrapper}>
                <div className={styles.pendingHourglassIcon}>⏳</div>
                <h2 className={styles.successTitle}>Payment Submitted for Verification</h2>
                <p className={styles.successSubtitle}>
                  Thank you <strong>{user?.fullName || 'Member'}</strong>! Your payment transaction details and screenshot proof have been successfully forwarded to our accounts team.
                  Your account status will automatically switch to <span className={styles.activeTag}>● ACTIVE</span> once verified by admin.
                </p>

                <div className={styles.receiptBox}>
                  <div className={styles.receiptRow}>
                    <span>Package Plan:</span>
                    <strong>{successReceipt?.packageName}</strong>
                  </div>
                  <div className={styles.receiptRow}>
                    <span>Bundled Product{successReceipt?.selectedProducts?.length > 1 ? 's' : ''}:</span>
                    <strong>{successReceipt?.selectedProducts?.map((p) => p.name).join(' + ') || successReceipt?.selectedProduct?.name}</strong>
                  </div>
                  <div className={styles.receiptRow}>
                    <span>Submitted UTR / Ref:</span>
                    <strong className={styles.monoFont}>{successReceipt?.transactionId}</strong>
                  </div>
                  <div className={styles.receiptRow}>
                    <span>Amount Payable:</span>
                    <strong>₹{successReceipt?.packagePrice?.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className={styles.receiptRow}>
                    <span>Account Status:</span>
                    <strong className={styles.pendingStatusText}>● PENDING ADMIN APPROVAL</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.dashboardRedirectBtn}
                  onClick={handleCloseModal}
                >
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

export default PackagesPage;