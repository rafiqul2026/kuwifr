// client/src/pages/member/PackagesPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './PackagesPage.module.css';

// Catalog of products allocated per price tier
const PRODUCT_TIERS = {
  STARTER: [
    {
      id: 'sp-1',
      name: 'Instant Magic Hair Color Shampoo',
      mrp: 1999,
      ksp: 1500,
      category: 'Hair Care',
      image: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'sp-2',
      name: 'Kuwi Gold Magic Black Hair Oil',
      mrp: 2100,
      ksp: 1500,
      category: 'Hair Care',
      image: 'https://images.unsplash.com/photo-1608248597359-3221946894c2?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'sp-3',
      name: 'Modern Saree (Ready Made Wear)',
      mrp: 2499,
      ksp: 1500,
      category: 'Apparel',
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'sp-4',
      name: 'Kuwi Pro+ Protein Powder (500gm)',
      mrp: 3130,
      ksp: 1500,
      category: 'Health & Nutrition',
      image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'sp-5',
      name: 'Kuwimul 77 Multi Vitamin',
      mrp: 1860,
      ksp: 1500,
      category: 'Health & Nutrition',
      image: 'https://images.unsplash.com/photo-1550572017-ed200f5e5a43?w=500&auto=format&fit=crop&q=80'
    }
  ],
  GROWTH: [
    {
      id: 'gp-1',
      name: 'Kuwi Shilajit 99 (Pure Himalayan Extract)',
      mrp: 5910,
      ksp: 5000,
      category: 'Wellness',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'gp-2',
      name: 'Kuwi Living Sea Buckthorn Juice (Pack of 3)',
      mrp: 5997,
      ksp: 5000,
      category: 'Health & Beverages',
      image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'gp-3',
      name: 'Festival Wear Premium Modern Saree',
      mrp: 7250,
      ksp: 5000,
      category: 'Apparel',
      image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'gp-4',
      name: 'Kuwi Pro+ Protein Powder (1KG)',
      mrp: 5750,
      ksp: 5000,
      category: 'Health & Nutrition',
      image: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'gp-5',
      name: 'Gents Premium Clothes Combo',
      mrp: 6500,
      ksp: 5000,
      category: 'Apparel',
      image: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'gp-6',
      name: 'Alkaline Jug Filter Care Device',
      mrp: 5450,
      ksp: 5000,
      category: 'Home & Kitchen',
      image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80'
    }
  ],
  LIFE_SAFE: [
    {
      id: 'ls-1',
      name: 'Alkaline Water Device (15k Ltr Capacity)',
      mrp: 13000,
      ksp: 10000,
      category: 'Appliances',
      image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'ls-2',
      name: 'Alkaline Mobile Water Device',
      mrp: 13300,
      ksp: 10000,
      category: 'Appliances',
      image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80'
    }
  ],
  LIFE_SAFE_ELITE: [
    {
      id: 'lse-1',
      name: 'Alkaline Water Device Premium (30k Ltr Capacity)',
      mrp: 18000,
      ksp: 15000,
      category: 'Appliances',
      image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'lse-2',
      name: 'Alkaline Water Device with Copper Jar Container',
      mrp: 18500,
      ksp: 15000,
      category: 'Appliances',
      image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80'
    }
  ],
  TITANIUM: [
    {
      id: 'tit-1',
      name: 'KUWIFR Electric Scooty (Executive Mobility Edition)',
      mrp: 120500,
      ksp: 110000,
      category: 'Automotive / EV',
      image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&auto=format&fit=crop&q=80'
    }
  ]
};

const THEME_COLORS = {
  STARTER: '#22c55e',
  GROWTH: '#2563eb',
  LIFE_SAFE: '#8b5cf6',
  LIFE_SAFE_ELITE: '#7c3aed',
  TITANIUM: '#f59e0b'
};

const PackagesPage = () => {
  const [packages, setPackages] = useState([]);
  const [selectedProductMap, setSelectedProductMap] = useState({});
  const [confirmModalData, setConfirmModalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const { showNotification } = useNotification();

  const fetchLivePackages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/packages');
      const remotePkgs = res.data?.data?.packages || res.data?.packages || [];

      if (Array.isArray(remotePkgs) && remotePkgs.length > 0) {
        // Build the package list directly from the database
        const formatted = remotePkgs.map((dbPkg) => {
          const typeUpper = (dbPkg.type || '').toUpperCase();
          
          // Match products based on type or closest price tier
          let products = dbPkg.availableProducts || dbPkg.products;
          if (!products || products.length === 0) {
            if (typeUpper.includes('STARTER') || dbPkg.price <= 3000) {
              products = PRODUCT_TIERS.STARTER;
            } else if (typeUpper.includes('GROWTH') || dbPkg.price <= 8000) {
              products = PRODUCT_TIERS.GROWTH;
            } else if (typeUpper.includes('ELITE') || dbPkg.price === 15000) {
              products = PRODUCT_TIERS.LIFE_SAFE_ELITE;
            } else if (typeUpper.includes('TITANIUM') || dbPkg.price >= 50000) {
              products = PRODUCT_TIERS.TITANIUM;
            } else {
              products = PRODUCT_TIERS.LIFE_SAFE;
            }
          }

          const color = THEME_COLORS[typeUpper] || (dbPkg.price >= 50000 ? '#f59e0b' : '#2563eb');

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
            badge: dbPkg.badge || dbPkg.displayBadge || (dbPkg.isPopular ? 'Popular Choice' : (typeUpper || 'Active Plan')),
            color,
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

  const handleSelectProduct = (pkgKey, product) => {
    setSelectedProductMap((prev) => ({
      ...prev,
      [pkgKey]: product
    }));
  };

  const handleInitiatePurchase = (pkg) => {
    const key = pkg._id || pkg.id;
    const chosenProduct = selectedProductMap[key];

    if (!chosenProduct && pkg.availableProducts?.length > 0) {
      showNotification(`Please select 1 product for ${pkg.name} before purchasing.`, 'warning');
      return;
    }

    setConfirmModalData({
      pkg,
      product: chosenProduct || { name: 'Direct Activation', ksp: pkg.price, mrp: pkg.price, category: 'Membership' }
    });
  };

  const handleProceedToPaymentGateway = async () => {
    if (!confirmModalData) return;
    const { pkg, product } = confirmModalData;

    setProcessingPayment(true);
    try {
      const res = await api.post('/api/packages/purchase', {
        packageId: pkg._id || pkg.id,
        packageType: pkg.type,
        productId: product.id,
        productName: product.name,
        price: pkg.price,
        kbp: pkg.kbp
      });

      if (res.data?.success) {
        showNotification(res.data.message || 'Package activated successfully!', 'success');
        setConfirmModalData(null);
        setTimeout(() => {
          window.location.href = '/member/dashboard';
        }, 1200);
      } else {
        showNotification(res.data?.message || 'Unable to complete activation.', 'error');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to complete transaction. Please try again.';
      showNotification(errMsg, 'error');
    } finally {
      setProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading Membership Packages...</p>
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
          const selectedProduct = selectedProductMap[pkgKey];

          return (
            <article key={pkgKey} className={styles.packageCard} style={{ borderTopColor: pkg.color }}>
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
                    Select 1 Product (Included in Package):
                  </label>
                  {selectedProduct ? (
                    <span className={styles.selectedOk}>✓ 1 Selected</span>
                  ) : (
                    <span className={styles.selectedRequired}>* Choose 1</span>
                  )}
                </div>

                <div className={styles.productList}>
                  {pkg.availableProducts?.map((product) => {
                    const isChecked = selectedProduct?.id === product.id;

                    return (
                      <div
                        key={product.id}
                        className={`${styles.productItemCard} ${isChecked ? styles.productItemChecked : ''}`}
                        onClick={() => handleSelectProduct(pkgKey, product)}
                      >
                        <input
                          type="radio"
                          name={`package-product-${pkgKey}`}
                          checked={isChecked}
                          onChange={() => handleSelectProduct(pkgKey, product)}
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
                  className={styles.purchaseBtn}
                  onClick={() => handleInitiatePurchase(pkg)}
                  style={{ background: selectedProduct ? pkg.color : '#94a3b8' }}
                >
                  {selectedProduct ? (
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

      {/* Confirmation Modal */}
      {confirmModalData && (
        <div className={styles.modalOverlay} onClick={() => !processingPayment && setConfirmModalData(null)}>
          <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.modalTag}>Checkout Review</span>
                <h2>Confirm Package Purchase</h2>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setConfirmModalData(null)}
                disabled={processingPayment}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.chosenProductCard}>
                <span className={styles.chosenCardBadge}>📦 Selected Product Included in Package</span>
                <div className={styles.chosenProductContent}>
                  <img
                    src={confirmModalData.product.image}
                    alt={confirmModalData.product.name}
                    className={styles.chosenProductImg}
                  />
                  <div className={styles.chosenProductDetails}>
                    <span className={styles.chosenCat}>{confirmModalData.product.category}</span>
                    <h3 className={styles.chosenTitle}>{confirmModalData.product.name}</h3>
                    <div className={styles.chosenPrices}>
                      <span><strong>KSP Price:</strong> ₹{confirmModalData.product.ksp?.toLocaleString()}</span>
                      {confirmModalData.product.mrp && <span className={styles.chosenMrp}>(MRP: ₹{confirmModalData.product.mrp?.toLocaleString()})</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.metricsGrid}>
                <div className={styles.metricBox}>
                  <small>Package Price</small>
                  <strong className={styles.priceColor}>₹{confirmModalData.pkg.price?.toLocaleString()}</strong>
                </div>

                <div className={styles.metricBox}>
                  <small>KBP Points</small>
                  <strong className={styles.kbpColor}>⭐ {confirmModalData.pkg.kbp?.toLocaleString()} KBP</strong>
                </div>

                <div className={styles.metricBox}>
                  <small>Daily Binary Cap</small>
                  <strong className={styles.capColor}>🛡️ ₹{confirmModalData.pkg.dailyCap?.toLocaleString()}</strong>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setConfirmModalData(null)}
                disabled={processingPayment}
              >
                Cancel & Change Product
              </button>

              <button
                type="button"
                className={styles.confirmBtn}
                onClick={handleProceedToPaymentGateway}
                disabled={processingPayment}
              >
                {processingPayment ? 'Activating Package...' : `Confirm & Activate (₹${confirmModalData.pkg.price?.toLocaleString()}) →`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackagesPage;