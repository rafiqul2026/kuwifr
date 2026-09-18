// client/src/pages/member/RepurchasePage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import styles from './RepurchasePage.module.css';
// Reuses the exact same manual-UPI QR / UTR / screenshot checkout modal
// already proven for Buy Package (PackagesPage.jsx) — same look, same
// verification flow, just fed from this page's cart instead of a package.
import checkoutStyles from './PackagesPage.module.css';

// Fallback only — real values come live from GET /api/settings (admin-
// editable on the Payment Gateway tab, see AdminSettingsPage.jsx), which
// overwrites this the moment it loads. Kept as a safety net for the brief
// window before that fetch resolves, or if it fails.
const DEFAULT_PAYMENT_INFO = {
  upiId: '7002458418.eazypay@icici',
  merchantName: 'A J ENTERPRISE',
  accountName: 'A J ENTERPRISE',
  bankName: 'ICICI Bank',
  accountNumber: '726505001743',
  ifscCode: 'ICIC0007265',
  branch: 'BARPETA BRANCH',
  qrCodeUrl: ''
};

// Mirrors server/src/services/settings.service.js DEFAULT_COMPENSATION.repurchase
// — used here only for the client-side cart/estimate preview shown before
// checkout; the actual credited amount is always computed server-side
// (RepurchaseService.processRepurchaseDistribution) against the live admin
// settings, so these constants being briefly out of sync with an admin's
// custom rate change would only affect the preview number, never the payout.
const SELF_REPURCHASE_RATE = 0.20;
const FULL_UNLOCK_DIRECTS = 8; // 8+ active directs unlocks all 15 levels
const TOTAL_REPURCHASE_LEVELS = 15;

// ============ FORMATTING & CALCULATION HELPERS ============

const formatKBPDisplay = (val) => {
  if (!val && val !== 0) return '0';
  if (val >= 1000) {
    const kVal = val / 1000;
    return `${Number.isInteger(kVal) ? kVal : kVal.toFixed(1)}K`;
  }
  return Number(val).toLocaleString();
};

const getProgressColor = (progress) => {
  if (progress >= 100) return '#16a34a';
  if (progress >= 50) return '#d97706';
  return '#008080';
};

const getFundMeta = (code) => {
  const meta = {
    SCHOOL: { icon: '🏫', color: '#c2660a', gradient: 'linear-gradient(135deg, #fd9911, #c2660a)' },
    FAMILY: { icon: '👨‍👩‍👦', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)' },
    TRAVELLING: { icon: '✈️', color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
    LIFESTYLE: { icon: '🌟', color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899, #be185d)' },
    FOREIGN_TRIP: { icon: '🌍', color: '#008080', gradient: 'linear-gradient(135deg, #14b8a6, #008080)' },
    PENSION: { icon: '🏦', color: '#d97706', gradient: 'linear-gradient(135deg, #d97706, #b45309)' }
  };
  return meta[code] || { icon: '🏦', color: '#737373', gradient: 'linear-gradient(135deg, #737373, #525252)' };
};

const getFundDescription = (fundObj) => {
  if (!fundObj) return '';
  const code = fundObj.code || fundObj.fund?.code;
  switch (code) {
    case 'SCHOOL':
      return '25K : 25K KBP Matching = 2% on TTO Monthly';
    case 'FAMILY':
      return '100K : 100K KBP Matching = 2% on TTO Monthly';
    case 'TRAVELLING':
      return '250K : 250K KBP Matching = 2% on TTO Monthly';
    case 'LIFESTYLE':
      return '500K : 500K KBP Matching = 2% on TTO Monthly';
    case 'FOREIGN_TRIP':
      return '1000K : 1000K KBP Matching = 2% on TTO Monthly';
    case 'PENSION':
      return '1% Lifetime on TTO (Team Turn Over) after achieving all targeted funds';
    default:
      return `${formatKBPDisplay(fundObj.requiredLeftKBP || 0)} : ${formatKBPDisplay(fundObj.requiredRightKBP || 0)} KBP Matching`;
  }
};

const getMaintenanceText = (fundObj) => {
  if (!fundObj) return '';
  const code = fundObj.code || fundObj.fund?.code;
  switch (code) {
    case 'SCHOOL':
      return 'Maintain: 2.5K : 2.5K New Business Matching monthly';
    case 'FAMILY':
      return 'Maintain: 10K : 10K New Business Matching monthly';
    case 'TRAVELLING':
      return 'Maintain: 25K : 25K New Business Matching monthly';
    case 'LIFESTYLE':
      return 'Maintain: 50K : 50K New Business Matching monthly';
    case 'FOREIGN_TRIP':
      return 'Maintain: 100K : 100K New Business Matching monthly';
    case 'PENSION':
      return 'No Business Matching required. Lifetime benefit.';
    default:
      return `Maintain: ${formatKBPDisplay(fundObj.maintenanceLeftKBP || 0)} : ${formatKBPDisplay(fundObj.maintenanceRightKBP || 0)} monthly`;
  }
};

const getBenefitText = (fundObj) => {
  if (!fundObj) return '2% on TTO Monthly';
  const code = fundObj.code || fundObj.fund?.code;
  if (code === 'PENSION') return '1% Lifetime on TTO Monthly';
  const percentage = fundObj.benefitPercentage || fundObj.fund?.benefitPercentage || 0.02;
  return `${(percentage * 100).toFixed(0)}% on TTO Monthly`;
};

// ============ MAIN COMPONENT ============

const RepurchasePage = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState('funds'); // 'store' | 'levels' | 'funds'
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [levelStats, setLevelStats] = useState([]);
  const [directCount, setDirectCount] = useState(0);
  const [maxUnlockedLevel, setMaxUnlockedLevel] = useState(0);

  const [wallets, setWallets] = useState({
    totalRepurchaseWallet: 0,
    selfRepurchaseIncome: 0,
    downlineRepurchaseIncome: 0
  });

  const [funds, setFunds] = useState([]);
  const [processingFund, setProcessingFund] = useState(false);
  const [allFundsAchieved, setAllFundsAchieved] = useState(false);
  const [pensionActive, setPensionActive] = useState(false);
  const [kbpSummary, setKbpSummary] = useState({
    today: { left: 0, right: 0 },
    week: { left: 0, right: 0 },
    total: { left: 0, right: 0 }
  });
  const [paymentInfo, setPaymentInfo] = useState(DEFAULT_PAYMENT_INFO);

  // Live bank/UPI/QR details from the admin-editable Payment Gateway
  // settings — was previously hardcoded here and out of sync with whatever
  // the admin configured. accountHolder (the Setting model's field name)
  // maps to this component's `accountName` for display.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/settings');
        const p = res.data?.data?.payment;
        if (!cancelled && p) {
          setPaymentInfo((prev) => ({
            ...prev,
            upiId: p.upiId || prev.upiId,
            merchantName: p.merchantName || prev.merchantName,
            accountName: p.accountHolder || prev.accountName,
            bankName: p.bankName || prev.bankName,
            accountNumber: p.accountNumber || prev.accountNumber,
            ifscCode: p.ifscCode || prev.ifscCode,
            branch: p.branch || prev.branch,
            qrCodeUrl: p.qrCodeUrl || ''
          }));
        }
      } catch {
        // Keep DEFAULT_PAYMENT_INFO fallback on failure.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Checkout modal: 'PAYMENT' | 'SUCCESS' | null — mirrors Buy Package's
  // manual-UPI verification flow (member pays via QR/bank transfer, submits
  // UTR + screenshot, admin verifies before anything is credited).
  const [checkoutStep, setCheckoutStep] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('UPI_GATEWAY');
  const [qrViewMode, setQrViewMode] = useState('DYNAMIC');
  const [utrNumber, setUtrNumber] = useState('');
  const [proofPreview, setProofPreview] = useState('');
  const [successReceipt, setSuccessReceipt] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [prodRes, statsRes, fundRes, kbpSummaryRes] = await Promise.all([
        api.get('/api/repurchase/products').catch(() => ({ data: { success: false } })),
        api.get('/api/repurchase/10-level-stats').catch(() => ({ data: { success: false } })),
        api.get('/api/funds/status').catch(() => ({ data: { success: false } })),
        api.get('/api/funds/repurchase-kbp-summary').catch(() => ({ data: { success: false } }))
      ]);

      if (prodRes.data?.success) setProducts(prodRes.data.data.products || []);
      if (statsRes.data?.success) {
        setLevelStats(statsRes.data.data.levels || []);
        setDirectCount(statsRes.data.data.directCount || 0);
        setMaxUnlockedLevel(statsRes.data.data.maxUnlockedLevel || 0);
        setWallets(statsRes.data.data.wallets || {
          totalRepurchaseWallet: 0,
          selfRepurchaseIncome: 0,
          downlineRepurchaseIncome: 0
        });
      }
      if (fundRes.data?.success) {
        const data = fundRes.data.data;
        setFunds(data.funds || []);
        setAllFundsAchieved(data.allFundsAchieved || false);
        setPensionActive(data.pensionActive || false);
      }
      if (kbpSummaryRes.data?.success) {
        setKbpSummary(kbpSummaryRes.data.data);
      }
    } catch {
      showNotification('Failed to load Repurchase data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (prodId, delta) => {
    setCart((prev) => {
      const current = prev[prodId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[prodId];
        return copy;
      }
      return { ...prev, [prodId]: next };
    });
  };

  const calculateCartTotals = useMemo(() => {
    let totalKSP = 0;
    let totalKBP = 0;
    let itemCount = 0;
    Object.keys(cart).forEach((id) => {
      const p = products.find((prod) => prod.id === id);
      if (p) {
        const qty = cart[id];
        totalKSP += p.ksp * qty;
        totalKBP += p.kbp * qty;
        itemCount += qty;
      }
    });
    return {
      itemCount,
      totalKSP,
      totalKBP,
      selfIncome: Math.round(totalKBP * SELF_REPURCHASE_RATE * 100) / 100
    };
  }, [cart, products]);

  // Step 1: open the manual-UPI checkout modal (was previously an instant,
  // no-payment-step API call — see submitRepurchasePurchase's doc comment
  // server-side for why that changed: no QR, no UTR, no admin review at all).
  const handleOpenCheckout = () => {
    const items = Object.keys(cart).map((id) => ({ productId: id, quantity: cart[id] }));
    if (items.length === 0) {
      showNotification('Your cart is empty. Please select products to buy.', 'warning');
      return;
    }
    setUtrNumber('');
    setProofPreview('');
    setQrViewMode('DYNAMIC');
    setCheckoutStep('PAYMENT');
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
    reader.onloadend = () => {
      setProofPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Step 2: submit the transaction reference + screenshot for admin
  // verification. Self Cashback / downline commissions / the actual Order
  // are only created once an admin approves this (approveRepurchasePurchase).
  const handleSubmitPayment = async () => {
    if (!utrNumber.trim()) {
      showNotification('Please enter the 12-digit UTR / Reference ID from your UPI payment.', 'warning');
      return;
    }
    if (!proofPreview && paymentMethod === 'UPI_GATEWAY') {
      showNotification('Please upload your payment confirmation screenshot.', 'warning');
      return;
    }

    const items = Object.keys(cart).map((id) => ({ productId: id, quantity: cart[id] }));

    setPurchasing(true);
    try {
      const res = await api.post('/api/repurchase/submit', {
        items,
        paymentMethod,
        transactionId: utrNumber.trim(),
        paymentProof: proofPreview
      });
      if (res.data?.success) {
        showNotification(res.data.message || 'Payment submitted for admin approval!', 'info');
        setSuccessReceipt(res.data.data);
        setCheckoutStep('SUCCESS');
        setCart({});
      } else {
        showNotification(res.data?.message || 'Unable to submit payment request.', 'error');
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to submit payment details. Please try again.', 'error');
    } finally {
      setPurchasing(false);
    }
  };

  const handleCloseCheckoutModal = () => {
    setCheckoutStep(null);
    setUtrNumber('');
    setProofPreview('');
    setSuccessReceipt(null);
    if (successReceipt) fetchInitialData();
  };

  const handleProcessQualification = async () => {
    try {
      setProcessingFund(true);
      const response = await api.post('/api/funds/process-qualification');
      if (response.data?.success) {
        showNotification('Fund qualification verified successfully!', 'success');
        fetchInitialData();
      }
    } catch {
      showNotification('Failed to process fund qualification', 'error');
    } finally {
      setProcessingFund(false);
    }
  };

  const categories = useMemo(() => {
    const unique = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    return ['ALL', ...unique];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchesSearch =
        p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.category.toLowerCase().includes(searchFilter.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchFilter]);

  // Dynamic UPI URI targeting the admin-configured merchant account with the
  // exact cart total — same pattern as PackagesPage.jsx.
  const upiUri = checkoutStep
    ? `upi://pay?pa=${paymentInfo.upiId}&pn=${encodeURIComponent(paymentInfo.merchantName)}&am=${calculateCartTotals.totalKSP}&cu=INR&tn=${encodeURIComponent(`KUWIFR-REPURCHASE-${user?.memberId || 'MEMBER'}`)}`
    : '';
  const dynamicQrUrl = checkoutStep
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiUri)}`
    : '';

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.modernSpinner}></div>
        <p>Loading Repurchase Hub & Live Wallets...</p>
      </div>
    );
  }

  return (
    <div className={styles.repurchaseContainer}>
      {/* Header Banner */}
      <header className={styles.pageHeader}>
        <div className={styles.headerTitleWrap}>
          <span className={styles.pillBadge}>✨ {TOTAL_REPURCHASE_LEVELS}-Level Matrix & Target Fund Engine</span>
          <h1 className={styles.pageTitle}>Repurchase Income & Store</h1>
          <p className={styles.pageSubtitle}>
            Self Repurchase = <strong>{Math.round(SELF_REPURCHASE_RATE * 100)}% Cashback</strong> • {TOTAL_REPURCHASE_LEVELS}-Level Overrides (Requires Direct Sponsors) • Life Tension Free Funds
          </p>
        </div>
      </header>

      {/* 3 Dedicated Wallet Cards + Direct Sponsor Counter */}
      <section className={styles.walletGrid}>
        <div className={`${styles.walletCard} ${styles.totalWallet}`}>
          <div className={styles.walletTop}>
            <span className={styles.walletIcon}>💎</span>
            <span className={styles.walletChip}>Total Wallet</span>
          </div>
          <div className={styles.walletAmount}>
            <small>₹</small>
            {Number(wallets.totalRepurchaseWallet || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={styles.walletFooter}>
            <span>Repurchase Total</span>
            <strong>Self + Downline</strong>
          </div>
        </div>

        <div className={`${styles.walletCard} ${styles.selfWallet}`}>
          <div className={styles.walletTop}>
            <span className={styles.walletIcon}>🛍️</span>
            <span className={styles.walletChip}>{Math.round(SELF_REPURCHASE_RATE * 100)}% of KBP</span>
          </div>
          <div className={styles.walletAmount}>
            <small>₹</small>
            {Number(wallets.selfRepurchaseIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={styles.walletFooter}>
            <span>Self Repurchase</span>
            <strong>Direct Cashback</strong>
          </div>
        </div>

        <div className={`${styles.walletCard} ${styles.downlineWallet}`}>
          <div className={styles.walletTop}>
            <span className={styles.walletIcon}>👥</span>
            <span className={styles.walletChip}>{TOTAL_REPURCHASE_LEVELS} Levels</span>
          </div>
          <div className={styles.walletAmount}>
            <small>₹</small>
            {Number(wallets.downlineRepurchaseIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={styles.walletFooter}>
            <span>Downline Repurchase</span>
            <strong>{directCount >= FULL_UNLOCK_DIRECTS ? `👑 All ${TOTAL_REPURCHASE_LEVELS} Levels Open` : `🔓 Level 1 - ${maxUnlockedLevel} Open`}</strong>
          </div>
        </div>
      </section>

      {/* Feature Navigation Cards */}
      <section className={styles.featureCardsGrid}>
        <div
          role="button"
          tabIndex={0}
          className={`${styles.featureCard} ${activeTab === 'store' ? styles.featureCardActive : ''}`}
          onClick={() => setActiveTab('store')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab('store'); }}
        >
          <div className={styles.featureCardIcon}>🛒</div>
          <div className={styles.featureCardInfo}>
            <h4>Products Store</h4>
            <p>Browse & purchase products</p>
          </div>
          <span className={styles.featureBadgeCount}>{products.length} Items</span>
        </div>

        <div
          role="button"
          tabIndex={0}
          className={`${styles.featureCard} ${activeTab === 'levels' ? styles.featureCardActive : ''}`}
          onClick={() => setActiveTab('levels')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab('levels'); }}
        >
          <div className={styles.featureCardIcon}>📊</div>
          <div className={styles.featureCardInfo}>
            <h4>{TOTAL_REPURCHASE_LEVELS}-Level Downline Matrix</h4>
            <p>Direct sponsor unlock tracking</p>
          </div>
          <span className={styles.featureBadgeCount}>
            {directCount >= FULL_UNLOCK_DIRECTS ? `${TOTAL_REPURCHASE_LEVELS}/${TOTAL_REPURCHASE_LEVELS} Open` : `${maxUnlockedLevel}/${TOTAL_REPURCHASE_LEVELS} Open`}
          </span>
        </div>

        <div
          role="button"
          tabIndex={0}
          className={`${styles.featureCard} ${activeTab === 'funds' ? styles.featureCardActive : ''}`}
          onClick={() => setActiveTab('funds')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab('funds'); }}
        >
          <div className={styles.featureCardIcon}>🏦</div>
          <div className={styles.featureCardInfo}>
            <h4>Life Tension Free Funds</h4>
            <p>Matching volume targets & pension</p>
          </div>
          <span className={`${styles.featureBadgeCount} ${pensionActive ? styles.pensionActiveBadge : ''}`}>
            {funds.filter((f) => f.qualified).length}/{funds.length || 6} Achieved
          </span>
        </div>
      </section>

      {/* ================= TAB 1: PRODUCT STORE ================= */}
      {activeTab === 'store' && (
        <section className={styles.storeContainer}>
          <div className={styles.storeMain}>
            <div className={styles.filterToolbar}>
              <div className={styles.searchBox}>
                <span className={styles.searchIcon}>🔍</span>
                <input
                  type="text"
                  placeholder="Search products by name or category..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
                {searchFilter && (
                  <button type="button" className={styles.clearBtn} onClick={() => setSearchFilter('')}>✕</button>
                )}
              </div>

              <div className={styles.categoryWrap}>
                {categories.map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    className={`${styles.categoryChip} ${selectedCategory === cat ? styles.categoryActive : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.productGrid3}>
              {filteredProducts.map((prod) => {
                const selfCashback = prod.kbp * SELF_REPURCHASE_RATE;
                const discountPercentage = Math.round(((prod.mrp - prod.ksp) / prod.mrp) * 100);

                return (
                  <article key={prod.id} className={styles.modernCard}>
                    <div className={styles.prodImageWrap}>
                      {prod.images?.[0] ? (
                        <img
                          src={prod.images[0].url}
                          alt={prod.name}
                          className={styles.prodImage}
                          loading="lazy"
                        />
                      ) : (
                        <div className={styles.prodImagePlaceholder}>🛍️</div>
                      )}
                    </div>

                    <div className={styles.cardHeader}>
                      <span className={styles.prodCat}>{prod.category}</span>
                      <span className={styles.kbpPointBadge}>⭐ {prod.kbp.toLocaleString()} KBP</span>
                    </div>

                    <h3 className={styles.prodTitle} title={prod.name}>
                      {prod.name}
                    </h3>

                    <div className={styles.pricingRow}>
                      <div className={styles.priceLeft}>
                        <div className={styles.kspPrice}>
                          <span className={styles.kspLabel}>KSP:</span> ₹{prod.ksp.toLocaleString()}
                        </div>
                        <div className={styles.mrpPrice}>
                          <span>MRP: ₹{prod.mrp.toLocaleString()}</span>
                          <span className={styles.discountTag}>{discountPercentage}% OFF</span>
                        </div>
                      </div>

                      <div className={styles.cashbackPill}>
                        <span className={styles.cashbackLabel}>Self {Math.round(SELF_REPURCHASE_RATE * 100)}%</span>
                        <strong className={styles.cashbackVal}>+₹{selfCashback.toLocaleString()}</strong>
                      </div>
                    </div>

                    <div className={styles.cardAction}>
                      {cart[prod.id] ? (
                        <div className={styles.qtyControl}>
                          <button type="button" onClick={() => handleQuantityChange(prod.id, -1)} aria-label="Decrease quantity">−</button>
                          <span className={styles.qtyNumber}>{cart[prod.id]}</span>
                          <button type="button" onClick={() => handleQuantityChange(prod.id, 1)} aria-label="Increase quantity">+</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={styles.addCartBtn}
                          onClick={() => handleQuantityChange(prod.id, 1)}
                        >
                          <span>+</span> Add to Cart
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className={styles.checkoutSidebar}>
            <div className={styles.checkoutCard}>
              <div className={styles.checkoutHead}>
                <h3>🛒 Order Summary</h3>
                <span className={styles.cartCountPill}>{calculateCartTotals.itemCount} items</span>
              </div>
              <p className={styles.unlimitedNotice}>Unlimited repurchase • {Math.round(SELF_REPURCHASE_RATE * 100)}% Self Cashback after payment verification</p>

              <div className={styles.summaryBreakdown}>
                <div className={styles.summaryItem}>
                  <span>Total KSP Amount</span>
                  <strong>₹{calculateCartTotals.totalKSP.toLocaleString()}</strong>
                </div>

                <div className={styles.summaryItem}>
                  <span>Total KBP Volume</span>
                  <span className={styles.highlightKBP}>{calculateCartTotals.totalKBP.toLocaleString()} KBP</span>
                </div>

                <div className={styles.cashbackHighlight}>
                  <div className={styles.cashbackHeader}>
                    <span>🎁 Self Repurchase Cashback ({Math.round(SELF_REPURCHASE_RATE * 100)}%)</span>
                    <strong className={styles.cashbackAmount}>+ ₹{calculateCartTotals.selfIncome.toLocaleString()}</strong>
                  </div>
                  <small>Credited to your Repurchase Wallet once admin verifies your payment</small>
                </div>
              </div>

              <button
                type="button"
                className={styles.checkoutButton}
                onClick={handleOpenCheckout}
                disabled={purchasing || calculateCartTotals.totalKSP === 0}
              >
                <span>Pay ₹{calculateCartTotals.totalKSP.toLocaleString()}</span>
              </button>
            </div>
          </aside>
        </section>
      )}

      {/* ================= TAB 2: 10-LEVEL DOWNLINE TREE (DIRECT UNLOCK ENFORCED) ================= */}
      {activeTab === 'levels' && (
        <section className={styles.levelsContainer}>
          {/* Direct Sponsor Unlock Rule Banner */}
          <div className={styles.matrixRibbon}>
            <div className={styles.ribbonHeader}>
              <span className={styles.ribbonIcon}>👥</span>
              <div>
                <h4>{TOTAL_REPURCHASE_LEVELS}-Level Downline Repurchase Matrix (Direct Sponsor Rules)</h4>
                <p>
                  Current Active Directs: <strong>{directCount} Direct Sponsor(s)</strong> •
                  {directCount >= FULL_UNLOCK_DIRECTS ? (
                    <span style={{ color: '#16a34a', fontWeight: '800' }}> 👑 All {TOTAL_REPURCHASE_LEVELS} Levels Fully Open</span>
                  ) : (
                    <span> Open Levels: <strong>Levels 1 to {maxUnlockedLevel || 0}</strong> ({Math.max(0, FULL_UNLOCK_DIRECTS - directCount)} more directs needed for all levels)</span>
                  )}
                </p>
              </div>
            </div>

            <div className={styles.ribbonBadges}>
              {levelStats.map((l) => (
                <div
                  key={l.level}
                  className={styles.matrixPill}
                  style={{
                    opacity: l.isUnlocked ? 1 : 0.45,
                    border: l.isUnlocked ? '1.5px solid #16a34a' : '1px dashed #e5e5e5'
                  }}
                >
                  <span>L{l.level} {l.isUnlocked ? '✓' : '🔒'}</span>
                  <strong>{l.percentage}%</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Level Cards Grid */}
          <div className={styles.levelCardGrid}>
            {levelStats.map((lvl) => {
              const isSelected = selectedLevel === lvl.level;
              return (
                <div
                  key={lvl.level}
                  className={`${styles.levelCardModern} ${isSelected ? styles.levelCardActive : ''}`}
                  style={{
                    opacity: lvl.isUnlocked ? 1 : 0.65,
                    borderTop: lvl.isUnlocked ? '4px solid #008080' : '4px solid #d4d4d4'
                  }}
                  onClick={() => setSelectedLevel(isSelected ? null : lvl.level)}
                >
                  <div className={styles.lvlCardTop}>
                    <span className={styles.lvlTitleBadge}>Level {lvl.level}</span>
                    {lvl.isUnlocked ? (
                      <span className={styles.lvlRateBadge}>{lvl.percentage}% Override</span>
                    ) : (
                      <span className={styles.lvlLockedTag} style={{ fontSize: '10px', background: '#f3f3f3', color: '#737373', padding: '2px 6px', borderRadius: '4px' }}>
                        🔒 Needs {lvl.requiredDirects} Directs
                      </span>
                    )}
                  </div>

                  <div className={styles.lvlMetrics}>
                    <div className={styles.metricBox}>
                      <small>Team Size</small>
                      <strong>{lvl.memberCount} Members</strong>
                    </div>
                    <div className={styles.metricBox}>
                      <small>Total KBP</small>
                      <strong style={{ color: '#008080' }}>{lvl.totalLevelKBP.toLocaleString()} KBP</strong>
                    </div>
                    <div className={styles.metricBox}>
                      <small>Earned</small>
                      <strong style={{ color: lvl.isUnlocked ? '#16a34a' : '#a3a3a3' }}>
                        ₹{lvl.estimatedIncome.toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  <div className={styles.lvlExpandPrompt}>
                    {lvl.isUnlocked ? (
                      isSelected ? '▲ Collapse Member List' : '▼ View Downline Members'
                    ) : (
                      `🔒 Locked (Refer ${lvl.directsNeeded} more direct sponsors)`
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expanded Downline Members Table */}
          {selectedLevel && (
            <div className={styles.tableCard}>
              <div className={styles.tableHeadWrap}>
                <h3>Members in Level {selectedLevel}</h3>
                <span className={styles.tableRateInfo}>
                  Commission Override: <strong>{levelStats.find((l) => l.level === selectedLevel)?.percentage}% of KBP</strong>
                </span>
              </div>

              {levelStats.find((l) => l.level === selectedLevel)?.members?.length === 0 ? (
                <div className={styles.emptyTable}>
                  <span>👥</span>
                  <p>No downline members currently placed under Level {selectedLevel}.</p>
                </div>
              ) : (
                <div className={styles.tableResponsive}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>User ID</th>
                        <th>Member Name</th>
                        <th>Contact / Email</th>
                        <th>Joined Date</th>
                        <th>Repurchase KBP</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {levelStats
                        .find((l) => l.level === selectedLevel)
                        ?.members.map((m) => (
                          <tr key={m._id || m.memberId}>
                            <td><strong className={styles.memberIdBadge}>{m.memberId || 'KFR------'}</strong></td>
                            <td className={styles.memberName}>{m.fullName}</td>
                            <td>
                              <div className={styles.contactCell}>
                                <span>{m.email}</span>
                                <small>{m.phoneNumber}</small>
                              </div>
                            </td>
                            <td>{new Date(m.joinedDate || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                            <td><span className={styles.kbpPointChip}>{m.totalKBP?.toLocaleString() || 0} KBP</span></td>
                            <td>
                              <span className={`${styles.statusChip} ${m.status === 'ACTIVE' ? styles.statusActive : styles.statusInactive}`}>
                                {m.status || 'ACTIVE'}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ================= TAB 3: LIFE TENSION FREE FUNDS ================= */}
      {activeTab === 'funds' && (
        <section className={styles.fundsContainer}>
          <div className={styles.fundsHero}>
            <div className={styles.fundsHeroContent}>
              <h3>Life Tension Free Income / Fund Plan</h3>
              <p>
                Achieve team repurchase volume targets to unlock <strong>2% monthly on TTO</strong> and <strong>1% lifetime Pension</strong>.
              </p>
            </div>
            <button
              type="button"
              className={styles.recheckBtn}
              onClick={handleProcessQualification}
              disabled={processingFund}
            >
              {processingFund ? '🔄 Auditing Targets...' : '🔄 Check Qualification Status'}
            </button>
          </div>

          {/* Repurchase KBP at a glance — Today/This Week/Total, split by
              binary leg. "Total" mirrors the same leftRepurchaseKBP/
              rightRepurchaseKBP the fund cards below check against each
              tier's threshold, so it always matches what's shown there.
              "Today"/"This Week" are new: no per-day history existed before
              (see server/src/models/RepurchaseKbpLedger.js), so they'll
              read 0 for any KBP credited before this feature shipped —
              that's expected, not a bug. */}
          <div className={styles.kbpSummaryGrid}>
            {[
              { key: 'today', label: 'Today Repurchase KBP', icon: '📅' },
              { key: 'week', label: 'Weekly Repurchase KBP', icon: '🗓️' },
              { key: 'total', label: 'Total Repurchase KBP', icon: '📊' }
            ].map((tile) => (
              <div key={tile.key} className={styles.kbpSummaryCard}>
                <div className={styles.kbpSummaryHeader}>
                  <span className={styles.kbpSummaryIcon}>{tile.icon}</span>
                  <h4>{tile.label}</h4>
                </div>
                <div className={styles.kbpSummarySides}>
                  <div className={styles.kbpSummarySide}>
                    <span className={styles.kbpSummarySideLabel}>Left</span>
                    <strong>{formatKBPDisplay(kbpSummary[tile.key]?.left || 0)}</strong>
                  </div>
                  <div className={styles.kbpSummaryDivider} />
                  <div className={styles.kbpSummarySide}>
                    <span className={styles.kbpSummarySideLabel}>Right</span>
                    <strong>{formatKBPDisplay(kbpSummary[tile.key]?.right || 0)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {allFundsAchieved && (
            <div className={styles.trophyBanner}>
              <div className={styles.trophyIcon}>🏆</div>
              <div className={styles.trophyBody}>
                <h4>Grand Target Achieved!</h4>
                <p>You have qualified for all 5 foundation funds and unlocked the 1% Lifetime Pension Fund on Team Turn Over.</p>
              </div>
            </div>
          )}

          {pensionActive && (
            <div className={styles.pensionCardModern}>
              <div className={styles.pensionIconWrap}>🏦</div>
              <div className={styles.pensionText}>
                <h4>Lifetime Pension Active</h4>
                <p>Receiving <strong>1% lifetime on TTO</strong> monthly. No maintenance volume required.</p>
              </div>
              <span className={styles.pensionLiveBadge}>● LIVE BENEFIT</span>
            </div>
          )}

          <div className={styles.fundsCardGrid3}>
            {funds.map((fund, index) => {
              const isQualified = fund.qualified;
              const fundData = fund.fund || fund;
              const leftKBP = fund.current?.leftKBP || 0;
              const rightKBP = fund.current?.rightKBP || 0;
              const reqLeft = fundData?.requiredLeftKBP || 1;
              const reqRight = fundData?.requiredRightKBP || 1;

              const leftProgress = Math.min(100, (leftKBP / reqLeft) * 100);
              const rightProgress = Math.min(100, (rightKBP / reqRight) * 100);
              const overallProgress = Math.min(100, Math.round((leftProgress + rightProgress) / 2));
              const remainingPercentage = Math.max(0, 100 - overallProgress);

              const isPension = fundData?.code === 'PENSION';
              const meta = getFundMeta(fundData?.code);

              return (
                <div
                  key={fundData?._id || index}
                  className={`${styles.fundModernCard} ${isQualified ? styles.fundQualified : ''}`}
                >
                  <div className={styles.fundCardHeader}>
                    <div className={styles.fundAvatar} style={{ background: meta.gradient }}>
                      {meta.icon}
                    </div>
                    <div className={styles.fundHeaderInfo}>
                      <h4>{fundData?.name || 'Fund Plan'}</h4>
                      <span className={styles.fundCodeTag}>{fundData?.code}</span>
                    </div>
                    <span className={`${styles.fundStateBadge} ${isQualified ? styles.stateQualified : styles.stateLocked}`}>
                      {isQualified ? '✅ Qualified' : '🔒 Locked'}
                    </span>
                  </div>

                  <div className={styles.fundCardBody}>
                    <div className={styles.formulaBox}>
                      {getFundDescription(fundData)}
                    </div>

                    <div className={styles.matchingTrackers}>
                      {/* Left Volume Tracker */}
                      <div className={styles.trackerGroup}>
                        <div className={styles.trackerLabel}>
                          <span>Left Volume (KBP)</span>
                          <strong>{formatKBPDisplay(leftKBP)} / {formatKBPDisplay(reqLeft)}</strong>
                        </div>
                        <div className={styles.trackerTrack}>
                          <div
                            className={styles.trackerFill}
                            style={{
                              width: `${leftProgress}%`,
                              background: leftProgress >= 100 ? '#16a34a' : '#008080'
                            }}
                          />
                        </div>
                        <div className={styles.volumeStatusText}>
                          <span>{leftProgress >= 100 ? '✅ Matched' : `${(100 - leftProgress).toFixed(0)}% Left to target`}</span>
                          <span>{leftProgress.toFixed(0)}% Done</span>
                        </div>
                      </div>

                      {/* Right Volume Tracker */}
                      <div className={styles.trackerGroup}>
                        <div className={styles.trackerLabel}>
                          <span>Right Volume (KBP)</span>
                          <strong>{formatKBPDisplay(rightKBP)} / {formatKBPDisplay(reqRight)}</strong>
                        </div>
                        <div className={styles.trackerTrack}>
                          <div
                            className={styles.trackerFill}
                            style={{
                              width: `${rightProgress}%`,
                              background: rightProgress >= 100 ? '#16a34a' : '#fd9911'
                            }}
                          />
                        </div>
                        <div className={styles.volumeStatusText}>
                          <span>{rightProgress >= 100 ? '✅ Matched' : `${(100 - rightProgress).toFixed(0)}% Left to target`}</span>
                          <span>{rightProgress.toFixed(0)}% Done</span>
                        </div>
                      </div>
                    </div>

                    {/* Overall Summary Bar */}
                    {!isPension && (
                      <div className={styles.totalCompletionWrap}>
                        <div className={styles.completionBar}>
                          <div
                            className={styles.completionFill}
                            style={{
                              width: `${overallProgress}%`,
                              background: getProgressColor(overallProgress)
                            }}
                          />
                        </div>
                        <div className={styles.completionText}>
                          <span>
                            {isQualified ? (
                              <strong style={{ color: '#16a34a' }}>🎯 Target Achieved!</strong>
                            ) : (
                              <strong style={{ color: '#d97706' }}>⏳ {remainingPercentage}% Remaining</strong>
                            )}
                          </span>
                          <strong>{overallProgress}% Completed</strong>
                        </div>
                      </div>
                    )}

                    <div className={styles.fundCriteriaGrid}>
                      <div className={styles.criteriaItem}>
                        <small>Monthly Benefit</small>
                        <span>{getBenefitText(fundData)}</span>
                      </div>
                      <div className={styles.criteriaItem}>
                        <small>Maintenance Condition</small>
                        <span className={styles.maintainRule}>{getMaintenanceText(fundData)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ================= MANUAL-UPI CHECKOUT MODAL ================= */}
      {checkoutStep && (
        <div className={checkoutStyles.modalOverlay} onClick={() => !purchasing && handleCloseCheckoutModal()}>
          <div className={checkoutStyles.modalContainer} onClick={(e) => e.stopPropagation()}>

            {checkoutStep === 'PAYMENT' && (
              <>
                <div className={checkoutStyles.modalHeader}>
                  <div>
                    <span className={checkoutStyles.modalTag}>{paymentInfo.merchantName} Payments QR</span>
                    <h2>Scan & Pay to Confirm Order</h2>
                  </div>
                  <button
                    type="button"
                    className={checkoutStyles.closeBtn}
                    onClick={handleCloseCheckoutModal}
                    disabled={purchasing}
                  >
                    ✕
                  </button>
                </div>

                <div className={checkoutStyles.modalBody}>
                  <div className={checkoutStyles.paymentMethodList}>
                    <label className={`${checkoutStyles.paymentOption} ${paymentMethod === 'UPI_GATEWAY' ? checkoutStyles.paySelected : ''}`}>
                      <input
                        type="radio"
                        name="repurchasePaymentMethod"
                        checked={paymentMethod === 'UPI_GATEWAY'}
                        onChange={() => setPaymentMethod('UPI_GATEWAY')}
                      />
                      <div className={checkoutStyles.paymentOptionDetails}>
                        <strong>UPI QR (PhonePe / GPay / Paytm)</strong>
                        <span>Instant scan with pre-filled cart amount</span>
                      </div>
                      <span className={checkoutStyles.payIcon}>📱</span>
                    </label>

                    <label className={`${checkoutStyles.paymentOption} ${paymentMethod === 'BANK_TRANSFER' ? checkoutStyles.paySelected : ''}`}>
                      <input
                        type="radio"
                        name="repurchasePaymentMethod"
                        checked={paymentMethod === 'BANK_TRANSFER'}
                        onChange={() => setPaymentMethod('BANK_TRANSFER')}
                      />
                      <div className={checkoutStyles.paymentOptionDetails}>
                        <strong>Direct Bank Transfer (IMPS / NEFT / RTGS)</strong>
                        <span>Company {paymentInfo.bankName} Current Account</span>
                      </div>
                      <span className={checkoutStyles.payIcon}>🏦</span>
                    </label>
                  </div>

                  {paymentMethod === 'UPI_GATEWAY' && (
                    <div className={checkoutStyles.qrPaymentContainer}>
                      <div className={checkoutStyles.qrBox}>
                        <img
                          src={qrViewMode === 'STANDEE' && paymentInfo.qrCodeUrl ? paymentInfo.qrCodeUrl : dynamicQrUrl}
                          alt="KUWIFR UPI QR"
                          className={checkoutStyles.qrImage}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = dynamicQrUrl;
                          }}
                        />
                        <span className={checkoutStyles.qrScanHint}>Scan with PhonePe, GPay or Paytm</span>
                        {paymentInfo.qrCodeUrl && (
                          <button
                            type="button"
                            onClick={() => setQrViewMode(qrViewMode === 'DYNAMIC' ? 'STANDEE' : 'DYNAMIC')}
                            style={{
                              marginTop: '8px', fontSize: '11px', padding: '3px 10px', borderRadius: '6px',
                              background: 'rgba(0, 128, 128, 0.08)', border: '1px solid rgba(0, 128, 128, 0.25)',
                              color: '#008080', cursor: 'pointer', fontWeight: 700
                            }}
                          >
                            {qrViewMode === 'DYNAMIC' ? '📷 View Standee Photo' : '⚡ Auto-Amount QR'}
                          </button>
                        )}
                      </div>

                      <div className={checkoutStyles.upiInfoCard}>
                        <div className={checkoutStyles.infoRow}>
                          <span>Merchant UPI ID</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                            <strong className={checkoutStyles.monoFont} style={{ fontSize: '11px', wordBreak: 'break-all' }}>
                              {paymentInfo.upiId}
                            </strong>
                            <button
                              type="button"
                              onClick={() => handleCopyToClipboard(paymentInfo.upiId, 'UPI ID')}
                              style={{
                                padding: '2px 8px', fontSize: '10px', fontWeight: 800,
                                background: 'rgba(0, 128, 128, 0.08)', border: '1px solid rgba(0, 128, 128, 0.25)',
                                color: '#008080', borderRadius: '5px', cursor: 'pointer', flexShrink: 0
                              }}
                            >
                              Copy
                            </button>
                          </div>
                        </div>

                        <div className={checkoutStyles.infoRow} style={{ marginTop: '6px' }}>
                          <span>Merchant Name</span>
                          <strong>{paymentInfo.merchantName}</strong>
                        </div>

                        <div className={checkoutStyles.infoRow} style={{ marginTop: '6px' }}>
                          <span>Exact Payable Amount</span>
                          <strong className={checkoutStyles.highlightAmount}>
                            ₹{calculateCartTotals.totalKSP.toLocaleString('en-IN')}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'BANK_TRANSFER' && (
                    <div className={checkoutStyles.bankDetailsContainer}>
                      <div className={checkoutStyles.bankDetailRow}>
                        <span>Bank Name:</span>
                        <strong>{paymentInfo.bankName}</strong>
                      </div>
                      <div className={checkoutStyles.bankDetailRow}>
                        <span>Account Name:</span>
                        <strong>{paymentInfo.accountName}</strong>
                      </div>
                      <div className={checkoutStyles.bankDetailRow}>
                        <span>Account Number:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong className={checkoutStyles.monoFont}>{paymentInfo.accountNumber}</strong>
                          <button
                            type="button"
                            onClick={() => handleCopyToClipboard(paymentInfo.accountNumber, 'Account Number')}
                            style={{
                              padding: '2px 6px', fontSize: '10px', fontWeight: 700,
                              background: 'rgba(0, 128, 128, 0.08)', border: '1px solid rgba(0, 128, 128, 0.25)',
                              color: '#008080', borderRadius: '4px', cursor: 'pointer'
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <div className={checkoutStyles.bankDetailRow}>
                        <span>IFSC Code:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong className={checkoutStyles.monoFont}>{paymentInfo.ifscCode}</strong>
                          <button
                            type="button"
                            onClick={() => handleCopyToClipboard(paymentInfo.ifscCode, 'IFSC Code')}
                            style={{
                              padding: '2px 6px', fontSize: '10px', fontWeight: 700,
                              background: 'rgba(0, 128, 128, 0.08)', border: '1px solid rgba(0, 128, 128, 0.25)',
                              color: '#008080', borderRadius: '4px', cursor: 'pointer'
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <div className={checkoutStyles.bankDetailRow}>
                        <span>Branch:</span>
                        <strong>{paymentInfo.branch}</strong>
                      </div>
                    </div>
                  )}

                  <div className={checkoutStyles.verificationInputBlock}>
                    <label className={checkoutStyles.inputLabel}>
                      Enter 12-Digit UPI Reference / UTR Number <span className={checkoutStyles.requiredStar}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 423589123456"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      className={checkoutStyles.utrInputField}
                      maxLength={30}
                    />

                    <label className={checkoutStyles.inputLabel} style={{ marginTop: '10px' }}>
                      Upload Payment Screenshot <span className={checkoutStyles.requiredStar}>*</span>
                    </label>
                    <div className={checkoutStyles.uploadZone}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProofUpload}
                        id="repurchaseProofUpload"
                        className={checkoutStyles.fileInputHidden}
                      />
                      <label htmlFor="repurchaseProofUpload" className={checkoutStyles.uploadTriggerBtn}>
                        📷 Choose Screenshot
                      </label>
                      {proofPreview ? (
                        <div className={checkoutStyles.proofPreviewWrap}>
                          <img src={proofPreview} alt="Payment Proof Preview" className={checkoutStyles.proofThumb} />
                          <span className={checkoutStyles.proofAttachedLabel}>✓ Proof Attached</span>
                        </div>
                      ) : (
                        <span className={checkoutStyles.uploadHint}>Attach screenshot showing UTR and paid amount</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className={checkoutStyles.modalFooter}>
                  <button
                    type="button"
                    className={checkoutStyles.cancelBtn}
                    onClick={handleCloseCheckoutModal}
                    disabled={purchasing}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className={checkoutStyles.confirmBtn}
                    onClick={handleSubmitPayment}
                    disabled={purchasing}
                  >
                    {purchasing ? 'Submitting Payment Proof...' : `Submit Payment Proof (₹${calculateCartTotals.totalKSP.toLocaleString()})`}
                  </button>
                </div>
              </>
            )}

            {checkoutStep === 'SUCCESS' && (
              <div className={checkoutStyles.successScreenWrapper}>
                <div className={checkoutStyles.pendingHourglassIcon}>⏳</div>
                <h2 className={checkoutStyles.successTitle}>Payment Submitted for Verification</h2>
                <p className={checkoutStyles.successSubtitle}>
                  Thank you <strong>{user?.fullName || 'Member'}</strong>! Your payment transaction details and screenshot proof have been forwarded to our accounts team.
                  Your order will be processed and Self Cashback credited to your <span className={checkoutStyles.activeTag}>Repurchase Wallet</span> once verified by admin.
                </p>

                <div className={checkoutStyles.receiptBox}>
                  <div className={checkoutStyles.receiptRow}>
                    <span>Items:</span>
                    <strong>{successReceipt?.items?.length || 0} product(s)</strong>
                  </div>
                  <div className={checkoutStyles.receiptRow}>
                    <span>Submitted UTR / Ref:</span>
                    <strong className={checkoutStyles.monoFont}>{successReceipt?.transactionId}</strong>
                  </div>
                  <div className={checkoutStyles.receiptRow}>
                    <span>Amount Payable:</span>
                    <strong>₹{successReceipt?.totalKSP?.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className={checkoutStyles.receiptRow}>
                    <span>Order Status:</span>
                    <strong className={checkoutStyles.pendingStatusText}>● PENDING ADMIN APPROVAL</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className={checkoutStyles.dashboardRedirectBtn}
                  onClick={handleCloseCheckoutModal}
                >
                  Back to Repurchase Store →
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default RepurchasePage;