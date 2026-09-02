// client/src/pages/member/RepurchasePage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './RepurchasePage.module.css';

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
  if (progress >= 100) return '#10b981';
  if (progress >= 50) return '#f59e0b';
  return '#2563eb';
};

const getFundMeta = (code) => {
  const meta = {
    SCHOOL: { icon: '🏫', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    FAMILY: { icon: '👨‍👩‍👦', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
    TRAVELLING: { icon: '✈️', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' },
    LIFESTYLE: { icon: '🌟', color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899, #be185d)' },
    FOREIGN_TRIP: { icon: '🌍', color: '#14b8a6', gradient: 'linear-gradient(135deg, #14b8a6, #0f766e)' },
    PENSION: { icon: '🏦', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)' }
  };
  return meta[code] || { icon: '🏦', color: '#64748b', gradient: 'linear-gradient(135deg, #64748b, #334155)' };
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

  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [prodRes, statsRes, fundRes] = await Promise.all([
        api.get('/api/repurchase/products').catch(() => ({ data: { success: false } })),
        api.get('/api/repurchase/10-level-stats').catch(() => ({ data: { success: false } })),
        api.get('/api/funds/status').catch(() => ({ data: { success: false } }))
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
      selfIncome: Math.round(totalKBP * 0.25 * 100) / 100
    };
  }, [cart, products]);

  const handleCheckout = async () => {
    const items = Object.keys(cart).map((id) => ({ productId: id, quantity: cart[id] }));
    if (items.length === 0) {
      showNotification('Your cart is empty. Please select products to buy.', 'warning');
      return;
    }

    setPurchasing(true);
    try {
      const res = await api.post('/api/repurchase/purchase', { items });
      if (res.data?.success) {
        showNotification(res.data.message, 'success');
        setCart({});
        fetchInitialData();
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Purchase transaction failed', 'error');
    } finally {
      setPurchasing(false);
    }
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
          <span className={styles.pillBadge}>✨ 10-Level Matrix & Target Fund Engine</span>
          <h1 className={styles.pageTitle}>Repurchase Income & Store</h1>
          <p className={styles.pageSubtitle}>
            Self Repurchase = <strong>25% Cashback</strong> • 10-Level Overrides (Requires Direct Sponsors) • Life Tension Free Funds
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
            <span className={styles.walletChip}>25% of KBP</span>
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
            <span className={styles.walletChip}>10 Levels</span>
          </div>
          <div className={styles.walletAmount}>
            <small>₹</small>
            {Number(wallets.downlineRepurchaseIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={styles.walletFooter}>
            <span>Downline Repurchase</span>
            <strong>{directCount >= 5 ? '👑 All 10 Levels Open' : `🔓 Level 1 - ${maxUnlockedLevel} Open`}</strong>
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
            <h4>10-Level Downline Matrix</h4>
            <p>Direct sponsor unlock tracking</p>
          </div>
          <span className={styles.featureBadgeCount}>
            {directCount >= 5 ? '10/10 Open' : `${maxUnlockedLevel}/10 Open`}
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
                const selfCashback = prod.kbp * 0.25;
                const discountPercentage = Math.round(((prod.mrp - prod.ksp) / prod.mrp) * 100);

                return (
                  <article key={prod.id} className={styles.modernCard}>
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
                        <span className={styles.cashbackLabel}>Self 25%</span>
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
              <p className={styles.unlimitedNotice}>Unlimited repurchase • 25% instant KBP credit</p>

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
                    <span>🎁 Self Repurchase Cashback (25%)</span>
                    <strong className={styles.cashbackAmount}>+ ₹{calculateCartTotals.selfIncome.toLocaleString()}</strong>
                  </div>
                  <small>Credited directly to your Repurchase Wallet upon checkout</small>
                </div>
              </div>

              <button
                type="button"
                className={styles.checkoutButton}
                onClick={handleCheckout}
                disabled={purchasing || calculateCartTotals.totalKSP === 0}
              >
                {purchasing ? (
                  <span className={styles.btnLoader}>Processing Order...</span>
                ) : (
                  <span>Pay ₹{calculateCartTotals.totalKSP.toLocaleString()}</span>
                )}
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
                <h4>10-Level Downline Repurchase Matrix (Direct Sponsor Rules)</h4>
                <p>
                  Current Active Directs: <strong>{directCount} Direct Sponsor(s)</strong> • 
                  {directCount >= 5 ? (
                    <span style={{ color: '#16a34a', fontWeight: '800' }}> 👑 All 10 Levels Fully Open</span>
                  ) : (
                    <span> Open Levels: <strong>Levels 1 to {maxUnlockedLevel || 0}</strong> ({5 - directCount} more directs needed for all levels)</span>
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
                    border: l.isUnlocked ? '1.5px solid #22c55e' : '1px dashed #cbd5e1'
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
                    borderTop: lvl.isUnlocked ? '4px solid #2563eb' : '4px solid #94a3b8'
                  }}
                  onClick={() => setSelectedLevel(isSelected ? null : lvl.level)}
                >
                  <div className={styles.lvlCardTop}>
                    <span className={styles.lvlTitleBadge}>Level {lvl.level}</span>
                    {lvl.isUnlocked ? (
                      <span className={styles.lvlRateBadge}>{lvl.percentage}% Override</span>
                    ) : (
                      <span className={styles.lvlLockedTag} style={{ fontSize: '10px', background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '4px' }}>
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
                      <strong style={{ color: '#2563eb' }}>{lvl.totalLevelKBP.toLocaleString()} KBP</strong>
                    </div>
                    <div className={styles.metricBox}>
                      <small>Earned</small>
                      <strong style={{ color: lvl.isUnlocked ? '#10b981' : '#94a3b8' }}>
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
                              background: leftProgress >= 100 ? '#10b981' : '#3b82f6'
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
                              background: rightProgress >= 100 ? '#10b981' : '#ec4899'
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
                              <strong style={{ color: '#10b981' }}>🎯 Target Achieved!</strong>
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
    </div>
  );
};

export default RepurchasePage;