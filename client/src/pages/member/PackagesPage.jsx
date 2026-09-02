// client/src/pages/member/PackagesPage.jsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './PackagesPage.module.css';

const DEFAULT_5_PACKAGES = [
  {
    id: 'starter',
    _id: '1',
    name: 'Starter Package',
    type: 'STARTER',
    price: 1500,
    kbp: 1000,
    dailyCap: 1500,
    weeklyCap: 10500,
    monthlyCap: 45000,
    description: 'Perfect entry package for beginners to start earning in KUWIFR.',
    badge: 'Popular Choice',
    isPopular: true,
    color: '#22c55e',
    productNote: 'Select any 1 product included with this package.',
    availableProducts: [
      {
        id: 'sp-1',
        name: 'Instant Magic Hair Color Shampoo',
        mrp: 1999,
        ksp: 1500,
        kbp: 1000,
        category: 'Hair Care',
        image: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500&auto=format&fit=crop&q=80'
      },
      {
        id: 'sp-2',
        name: 'Kuwi Gold Magic Black Hair Oil',
        mrp: 2100,
        ksp: 1500,
        kbp: 1000,
        category: 'Hair Care',
        image: 'https://images.unsplash.com/photo-1608248597359-3221946894c2?w=500&auto=format&fit=crop&q=80'
      },
      {
        id: 'sp-3',
        name: 'Modern Saree (Ready Made Wear)',
        mrp: 2499,
        ksp: 1500,
        kbp: 1000,
        category: 'Apparel',
        image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&auto=format&fit=crop&q=80'
      },
      {
        id: 'sp-4',
        name: 'Kuwi Pro+ Protein Powder (500gm)',
        mrp: 3130,
        ksp: 1500,
        kbp: 1000,
        category: 'Health & Nutrition',
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80'
      },
      {
        id: 'sp-5',
        name: 'Kuwimul 77 Multi Vitamin',
        mrp: 1860,
        ksp: 1500,
        kbp: 1000,
        category: 'Health & Nutrition',
        image: 'https://images.unsplash.com/photo-1550572017-ed200f5e5a43?w=500&auto=format&fit=crop&q=80'
      }
    ]
  },
  {
    id: 'growth',
    _id: '2',
    name: 'Growth Package',
    type: 'GROWTH',
    price: 5000,
    kbp: 4000,
    dailyCap: 7000,
    weeklyCap: 49000,
    monthlyCap: 210000,
    description: 'Designed for ambitious members scaling their binary team network.',
    badge: 'Growth Plan',
    isPopular: false,
    color: '#2563eb',
    productNote: 'Select any 1 product included with this package.',
    availableProducts: [
      {
        id: 'gp-1',
        name: 'Kuwi Shilajit 99 (Pure Himalayan Extract)',
        mrp: 5910,
        ksp: 5000,
        kbp: 4000,
        category: 'Wellness',
        image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&auto=format&fit=crop&q=80'
      },
      {
        id: 'gp-2',
        name: 'Kuwi Living Sea Buckthorn Juice (Pack of 3)',
        mrp: 5997,
        ksp: 5000,
        kbp: 4000,
        category: 'Health & Beverages',
        image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500&auto=format&fit=crop&q=80'
      },
      {
        id: 'gp-3',
        name: 'Festival Wear Premium Modern Saree',
        mrp: 7250,
        ksp: 5000,
        kbp: 4000,
        category: 'Apparel',
        image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=500&auto=format&fit=crop&q=80'
      },
      {
        id: 'gp-4',
        name: 'Kuwi Pro+ Protein Powder (1KG)',
        mrp: 5750,
        ksp: 5000,
        kbp: 4000,
        category: 'Health & Nutrition',
        image: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=500&auto=format&fit=crop&q=80'
      },
      {
        id: 'gp-5',
        name: 'Gents Premium Clothes Combo',
        mrp: 6500,
        ksp: 5000,
        kbp: 4000,
        category: 'Apparel',
        image: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=500&auto=format&fit=crop&q=80'
      },
      {
        id: 'gp-6',
        name: 'Alkaline Jug Filter Care Device',
        mrp: 5450,
        ksp: 5000,
        kbp: 4000,
        category: 'Home & Kitchen',
        image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80'
      },
      {
        id: 'gp-7',
        name: 'Alkaline Mineral Health Drops',
        mrp: 5550,
        ksp: 5000,
        kbp: 4000,
        category: 'Health & Wellness',
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80'
      }
    ]
  },
  {
    id: 'life_safe',
    _id: '3',
    name: 'Life Safe Package',
    type: 'LIFE_SAFE',
    price: 10000,
    kbp: 7500,
    dailyCap: 15000,
    weeklyCap: 105000,
    monthlyCap: 450000,
    description: 'Comprehensive health & alkaline water purification solutions.',
    badge: 'Health Choice',
    isPopular: false,
    color: '#8b5cf6',
    productNote: 'Select any 1 device included with this package.',
    availableProducts: [
      {
        id: 'ls-1',
        name: 'Alkaline Water Device (15k Ltr Capacity)',
        mrp: 13000,
        ksp: 10000,
        kbp: 7500,
        category: 'Appliances',
        image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80'
      },
      {
        id: 'ls-2',
        name: 'Alkaline Mobile Water Device',
        mrp: 13300,
        ksp: 10000,
        kbp: 7500,
        category: 'Appliances',
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80'
      }
    ]
  },
  {
    id: 'life_safe_elite',
    _id: '4',
    name: 'Life Safe Elite Package',
    type: 'LIFE_SAFE_ELITE',
    price: 15000,
    kbp: 10000,
    dailyCap: 20000,
    weeklyCap: 140000,
    monthlyCap: 600000,
    description: 'Premium alkaline filtration with high daily earning caps for elite performers.',
    badge: 'High Earner',
    isPopular: false,
    color: '#7c3aed',
    productNote: 'Select any 1 device included with this package.',
    availableProducts: [
      {
        id: 'lse-1',
        name: 'Alkaline Water Device Premium (30k Ltr Capacity)',
        mrp: 18000,
        ksp: 15000,
        kbp: 10000,
        category: 'Appliances',
        image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80'
      },
      {
        id: 'lse-2',
        name: 'Alkaline Water Device with Copper Jar Container',
        mrp: 18500,
        ksp: 15000,
        kbp: 10000,
        category: 'Appliances',
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80'
      }
    ]
  },
  {
    id: 'titanium',
    _id: '5',
    name: 'Titanium Package',
    type: 'TITANIUM',
    price: 110000,
    kbp: 50000,
    dailyCap: 50000,
    weeklyCap: 350000,
    monthlyCap: 1500000,
    description: 'The ultimate pinnacle tier for top business leaders and high-volume matching.',
    badge: 'Executive VIP',
    isPopular: false,
    color: '#f59e0b',
    productNote: 'Includes high-efficiency eco mobility package.',
    availableProducts: [
      {
        id: 'tit-1',
        name: 'KUWIFR Electric Scooty (Executive Mobility Edition)',
        mrp: 120500,
        ksp: 110000,
        kbp: 50000,
        category: 'Automotive / EV',
        image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&auto=format&fit=crop&q=80'
      }
    ]
  }
];

const PackagesPage = () => {
  const [packages, setPackages] = useState(DEFAULT_5_PACKAGES);
  const [selectedProductMap, setSelectedProductMap] = useState({}); // { [packageKey]: productObj }
  const [confirmModalData, setConfirmModalData] = useState(null); // { pkg, product }
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const pkgRes = await api.get('/api/packages').catch(() => ({ data: { success: false } }));

      if (pkgRes.data?.success && Array.isArray(pkgRes.data.data?.packages) && pkgRes.data.data.packages.length > 0) {
        const remotePkgs = pkgRes.data.data.packages;
        const merged = DEFAULT_5_PACKAGES.map((local) => {
          const match = remotePkgs.find((r) => r.type === local.type || r.name?.toLowerCase() === local.name?.toLowerCase());
          return match
            ? { ...local, ...match, availableProducts: local.availableProducts }
            : local;
        });
        setPackages(merged);
      } else {
        setPackages(DEFAULT_5_PACKAGES);
      }
    } catch (error) {
      console.error('Failed to load packages:', error);
      setPackages(DEFAULT_5_PACKAGES);
    } finally {
      setLoading(false);
    }
  };

  // Select strictly ONE product per package
  const handleSelectProduct = (pkgKey, product) => {
    setSelectedProductMap((prev) => ({
      ...prev,
      [pkgKey]: product
    }));
  };

  // Open confirmation modal
  const handleInitiatePurchase = (pkg) => {
    const key = pkg._id || pkg.id;
    const chosenProduct = selectedProductMap[key];

    if (!chosenProduct) {
      showNotification(`Please select 1 product for ${pkg.name} before purchasing.`, 'warning');
      return;
    }

    setConfirmModalData({
      pkg,
      product: chosenProduct
    });
  };

  // Process purchase and redirect directly to payment gateway
  const handleProceedToPaymentGateway = async () => {
    if (!confirmModalData) return;
    const { pkg, product } = confirmModalData;

    setProcessingPayment(true);
    try {
      // Call backend to initialize payment gateway order (e.g., Razorpay, Cashfree, PhonePe, Stripe)
      const res = await api.post('/api/payment/create-order', {
        packageId: pkg._id || pkg.id,
        packageType: pkg.type,
        productId: product.id,
        productName: product.name,
        amount: pkg.price,
        kbp: pkg.kbp
      });

      if (res.data?.success) {
        showNotification('Redirecting to secure payment gateway...', 'success');
        
        // If the gateway provides a direct checkout URL:
        if (res.data.data?.paymentUrl) {
          window.location.href = res.data.data.paymentUrl;
          return;
        }

        // If using SDK modal (like Razorpay standard checkout):
        if (res.data.data?.orderId && window.Razorpay) {
          const options = {
            key: res.data.data.keyId || 'YOUR_KEY_ID',
            amount: res.data.data.amount,
            currency: 'INR',
            name: 'KUWIFR Global',
            description: `${pkg.name} Activation with ${product.name}`,
            order_id: res.data.data.orderId,
            handler: function (response) {
              showNotification('Payment successful! Package activated.', 'success');
              window.location.href = '/member/orders';
            },
            theme: { color: '#2563eb' }
          };
          const rzp = new window.Razorpay(options);
          rzp.open();
          setConfirmModalData(null);
          return;
        }

        // Fallback standard redirection
        if (res.data.data?.redirectUrl) {
          window.location.href = res.data.data.redirectUrl;
          return;
        }

        // Default direct success fallback
        showNotification('Payment initiated successfully!', 'success');
        setConfirmModalData(null);
      } else {
        showNotification(res.data?.message || 'Unable to initialize payment gateway.', 'error');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to connect to payment gateway. Please try again.';
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
      {/* Header Banner */}
      <header className={styles.pageHeader}>
        <div className={styles.headerTitleWrap}>
          <span className={styles.headerTag}>🚀 Activation & Upgrades</span>
          <h1 className={styles.pageTitle}>Membership Packages</h1>
          <p className={styles.pageSubtitle}>
            Choose an activation package, select <strong>strictly one product option</strong>, and proceed to checkout.
          </p>
        </div>
      </header>

      {/* 5 Packages Grid */}
      <div className={styles.packagesGrid}>
        {packages.map((pkg) => {
          const pkgKey = pkg._id || pkg.id;
          const selectedProduct = selectedProductMap[pkgKey];

          return (
            <article key={pkgKey} className={styles.packageCard} style={{ borderTopColor: pkg.color }}>
              {/* Header */}
              <div className={styles.cardHeader}>
                <div className={styles.badgeRow}>
                  <span className={styles.typeBadge} style={{ background: `${pkg.color}15`, color: pkg.color }}>
                    {pkg.badge || pkg.type}
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

              {/* Product Selection Section */}
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
                            <span className={styles.mrpPrice}>MRP: ₹{product.mrp?.toLocaleString()}</span>
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

      {/* ================= CONFIRM PURCHASE MODAL (DIRECT GATEWAY REDIRECT) ================= */}
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
              {/* 1. Chosen Product Shown BEFORE Financials */}
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
                      <span className={styles.chosenMrp}>(MRP: ₹{confirmModalData.product.mrp?.toLocaleString()})</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Package Financial Metrics (Price, KBP, Daily Cap) */}
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

            {/* Modal Actions with Gateway Direct Trigger */}
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
                {processingPayment ? 'Connecting Gateway...' : `Proceed to Payment (₹${confirmModalData.pkg.price?.toLocaleString()}) →`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackagesPage;