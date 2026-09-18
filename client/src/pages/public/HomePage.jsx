// client/src/pages/public/HomePage.jsx
import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './HomePage.module.css';
import ProductShowcase from '../../components/public/ProductShowcase';
import Seo from '../../seo/Seo';
import { buildOrganizationSchema, buildWebsiteSchema } from '../../seo/schema';
import { useShop } from '../../context/ShopContext';
import api from '../../services/api';

// Purely decorative — a nicer icon than the generic fallback for common
// category names. Never affects filtering/matching, which is always by the
// real category string.
const CATEGORY_ICONS = {
  'Hair Care': '🧴',
  Apparel: '👗',
  'Health & Nutrition': '💊',
  Wellness: '🌿',
  Beverages: '🥤',
  'Home & Kitchen': '🏠',
  'Health & Wellness': '🌿',
  Appliances: '💧',
  'Automotive / Package': '⚡',
  'Personal Care': '🧴',
  Grocery: '🛒',
  'Oral Care': '🦷'
};

const HomePage = () => {
  const navigate = useNavigate();
  const { products, categories: realCategories } = useShop();
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState('idle'); // idle | loading | success | error
  const [newsletterMessage, setNewsletterMessage] = useState('');

  // Real category cards — previously a hardcoded list of 6 curated
  // categories with stock Unsplash photos that didn't match any real
  // product's actual category. Derived from the live catalog instead: each
  // card uses a real uploaded product photo as its thumbnail and only ever
  // links to a category that genuinely has products in it.
  const categories = useMemo(() => {
    return realCategories
      .map((cat) => {
        const catProducts = products.filter((p) => p.category === cat);
        return {
          id: cat,
          title: cat,
          count: catProducts.length,
          desc: `${catProducts.length} product${catProducts.length === 1 ? '' : 's'} available`,
          query: cat,
          icon: CATEGORY_ICONS[cat] || '🛍️',
          image: catProducts.find((p) => p.image)?.image || ''
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [realCategories, products]);

  // Real, original product photos for the hero/promo/brand visuals —
  // previously generic Unsplash stock photos unrelated to anything KUWIFR
  // actually sells. Picks distinct real products so the three spots don't
  // all show the same photo; each gracefully falls back to a plain
  // placeholder (never another stock photo) if no product has a photo
  // uploaded yet.
  const productsWithPhotos = useMemo(() => products.filter((p) => p.image), [products]);
  const heroImage = productsWithPhotos[0];
  const promoImage =
    productsWithPhotos.find((p) => p.category === 'Automotive / Package' && p !== heroImage) ||
    productsWithPhotos.find((p) => p !== heroImage) ||
    heroImage;
  const brandImage = productsWithPhotos.find((p) => p !== heroImage && p !== promoImage) || heroImage;

  const trustValues = [
    { label: '100% Authentic', sub: 'Genuine Items Verified', icon: '🛡️' },
    { label: 'Best Price', sub: 'Guaranteed Value', icon: '🏷️' },
    { label: 'Fast & Free', sub: 'Express Shipping ₹999+', icon: '🚚' },
    { label: '100% Genuine', sub: 'Quality Assured Testing', icon: '⭐' },
    { label: 'Secure Payments', sub: 'Encrypted Checkout', icon: '🔒' },
  ];

  const handleScrollToProducts = (e) => {
    e.preventDefault();
    const el = document.getElementById('products');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/shop');
    }
  };

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    if (newsletterStatus === 'loading') return;
    setNewsletterStatus('loading');
    setNewsletterMessage('');
    try {
      const res = await api.post('/api/newsletter/subscribe', { email: newsletterEmail.trim() });
      setNewsletterStatus('success');
      setNewsletterMessage(res.data?.message || 'Subscribed successfully!');
      setNewsletterEmail('');
    } catch (err) {
      setNewsletterStatus('error');
      setNewsletterMessage(err.response?.data?.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className={styles.homePage}>
      <Seo
        title="KUWIFR — Health, Wellness & Lifestyle Essentials"
        description="Shop genuine health & wellness supplements, alkaline water devices, designer sarees, gents wear, and smart EV mobility at KUWIFR. Nationwide express shipping, secure payments, 100% authentic products."
        path="/"
        type="website"
        jsonLd={[buildOrganizationSchema(), buildWebsiteSchema()]}
      />
      {/* 1. HERO SECTION */}
      <section className={styles.hero}>
        <div className={styles.heroBackgroundMesh} aria-hidden="true" />
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            {/* Left Content Column */}
            <div className={styles.heroContent}>
              <div className={styles.trustBadge}>
                <span className={styles.badgeSpark}>✨</span>
                <span>In India's Premier Health & Lifestyle Store</span>
              </div>

              <h1 className={styles.heroTitle}>
                Discover Premium <br />
                <span className={styles.highlight}>Health & Lifestyle Essentials</span>
              </h1>

              <p className={styles.heroSubtitle}>
                Shop genuine wellness solutions, advanced alkaline water devices,
                designer fashion, and smart EV mobility with nationwide fast shipping
                and verified quality.
              </p>

              <div className={styles.heroButtons}>
                <a
                  href="#products"
                  onClick={handleScrollToProducts}
                  className={styles.primaryBtn}
                >
                  <span>Shop Now</span>
                  <span className={styles.btnArrow}>→</span>
                </a>
                <a href="#categories" className={styles.secondaryBtn}>
                  Explore Categories
                </a>
              </div>

              {/* In-Hero Mini Value Strip */}
              <div className={styles.heroHighlights}>
                <div className={styles.highlightItem}>
                  <strong>100%</strong>
                  <span>Authentic Items</span>
                </div>
                <div className={styles.highlightDivider}></div>
                <div className={styles.highlightItem}>
                  <strong>Best Price</strong>
                  <span>Guaranteed</span>
                </div>
                <div className={styles.highlightDivider}></div>
                <div className={styles.highlightItem}>
                  <strong>Fast & Free</strong>
                  <span>Express Delivery</span>
                </div>
              </div>
            </div>

            {/* Right Visual Card with 3D Depth */}
            <div className={styles.heroVisual}>
              <div className={styles.imageCard}>
                {heroImage ? (
                  <img
                    src={heroImage.image}
                    alt={heroImage.name}
                    className={styles.heroImg}
                    loading="eager"
                  />
                ) : (
                  <div className={styles.heroImgPlaceholder} aria-hidden="true">🛍️</div>
                )}
                <div className={styles.floatingCard}>
                  <div className={styles.floatingIcon}>⭐</div>
                  <div>
                    <strong>100% Quality Assured</strong>
                    <p>Lab Tested & Certified Products</p>
                  </div>
                </div>

                <div className={styles.floatingPillBadge}>
                  <span>⚡ Nationwide Fast Express</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. TRUST / VALUE STRIP */}
      <section className={styles.trustStrip}>
        <div className={styles.container}>
          <div className={styles.trustGrid}>
            {trustValues.map((item, index) => (
              <div key={index} className={styles.trustItem}>
                <div className={styles.trustIcon}>{item.icon}</div>
                <div className={styles.trustText}>
                  <h4>{item.label}</h4>
                  <p>{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. EXPLORE CATEGORIES SECTION */}
      <section id="categories" className={styles.categorySection}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <span className={styles.subHeading}>CURATED COLLECTIONS</span>
            <h2 className={styles.sectionTitle}>Explore Our Categories</h2>
            <p className={styles.sectionDesc}>
              Engineered for natural vitality, modern grace, and high-performance daily living.
            </p>
          </div>

          <div className={styles.categoryGrid}>
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={styles.categoryCard}
                onClick={() => navigate(`/shop?category=${encodeURIComponent(cat.query)}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/shop?category=${encodeURIComponent(cat.query)}`);
                }}
              >
                <div className={styles.categoryImageWrapper}>
                  {cat.image ? (
                    <img
                      src={cat.image}
                      alt={cat.title}
                      className={styles.categoryImage}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.categoryImagePlaceholder} aria-hidden="true">{cat.icon}</div>
                  )}
                  <div className={styles.categoryOverlay}></div>
                  <div className={styles.categoryBadgeIcon}>{cat.icon}</div>
                </div>

                <div className={styles.categoryContent}>
                  <h3 className={styles.categoryTitle}>{cat.title}</h3>
                  <p className={styles.categoryDesc}>{cat.desc}</p>
                  <div className={styles.categoryAction}>
                    <span>Shop Collection</span>
                    <span className={styles.categoryArrow}>→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. DYNAMIC PRODUCTS CATALOG */}
      <section id="products" className={styles.productsSectionWrapper}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <span className={styles.subHeading}>TOP CATALOG PICKS</span>
            <h2 className={styles.sectionTitle}>Featured Products</h2>
            <p className={styles.sectionDesc}>
              Explore our active inventory of alkaline hydration devices, organic supplements, and daily essentials.
            </p>
          </div>
        </div>
        {/* Preserves your existing component & connected shopping cart logic.
            showHeader=false: this section already has its own "Featured
            Products" heading above — see ProductShowcase.jsx's comment. */}
        <ProductShowcase showHeader={false} />
      </section>

      {/* 5. TWIN PROMOTIONS STRIP */}
      <section className={styles.twinPromoSection}>
        <div className={styles.container}>
          <div className={styles.twinPromoGrid}>
            <div className={`${styles.twinPromoCard} ${styles.twinPromoCardSale}`}>
              <div className={styles.twinPromoText}>
                <h3>Repurchase Sale</h3>
                <p>Up to 50% OFF on select wellness essentials</p>
                <a
                  href="#products"
                  onClick={handleScrollToProducts}
                  className={styles.twinPromoBtn}
                >
                  Shop Now
                </a>
              </div>
              <span className={styles.twinPromoIcon} aria-hidden="true">🌿</span>
            </div>

            <div className={`${styles.twinPromoCard} ${styles.twinPromoCardDeals}`}>
              <div className={styles.twinPromoText}>
                <h3>Top Brands, Best Deals</h3>
                <p>Verified quality across every category</p>
                <a
                  href="#products"
                  onClick={handleScrollToProducts}
                  className={styles.twinPromoBtn}
                >
                  Shop Now
                </a>
              </div>
              <span className={styles.twinPromoIcon} aria-hidden="true">🛍️</span>
            </div>
          </div>
        </div>
      </section>

      {/* 6. PROMOTIONAL LIFESTYLE BANNER */}
      <section className={styles.promoBannerSection}>
        <div className={styles.container}>
          <div className={styles.promoCard}>
            <div className={styles.promoContent}>
              <span className={styles.promoSubhead}>UPGRADE YOUR LIFESTYLE</span>
              <h2 className={styles.promoTitle}>
                Discover Carefully Selected Wellness, Tech, Fashion & Mobility
              </h2>
              <p className={styles.promoParagraph}>
                From antioxidant-rich alkaline hydration systems to zero-emission smart urban EV travel,
                experience products rigorously verified for modern Indian households.
              </p>
              <div className={styles.promoActions}>
                <a
                  href="#products"
                  onClick={handleScrollToProducts}
                  className={styles.promoPrimaryBtn}
                >
                  Explore Collection →
                </a>
                <Link to="/about" className={styles.promoGhostBtn}>
                  Learn More
                </Link>
              </div>
            </div>

            <div className={styles.promoVisual}>
              {promoImage ? (
                <img
                  src={promoImage.image}
                  alt={promoImage.name}
                  className={styles.promoImage}
                  loading="lazy"
                />
              ) : (
                <div className={styles.promoImagePlaceholder} aria-hidden="true">🛍️</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 7. WHY CHOOSE KUWIFR */}
      <section className={styles.features}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <span className={styles.subHeading}>THE KUWIFR STANDARD</span>
            <h2 className={styles.sectionTitle}>Why Choose KUWIFR?</h2>
            <p className={styles.sectionDesc}>
              A modern, reliable online shopping platform delivering premium essentials directly to your home.
            </p>
          </div>

          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🛡️</div>
              <h3>100% Genuine Products</h3>
              <p>Direct sourcing from certified manufacturers with rigorous quality batch checks.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>💧</div>
              <h3>Quality Assured Tech</h3>
              <p>Specialized active hydrogen ionization and alkaline devices for clean living.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🚚</div>
              <h3>Fast Express Delivery</h3>
              <p>Prompt dispatch with dependable end-to-end courier tracking nationwide.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🔒</div>
              <h3>Secure Payments</h3>
              <p>Bank-grade encryption for all UPI, RuPay, Visa, Mastercard, and NetBanking checkouts.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🤝</div>
              <h3>Trusted Support</h3>
              <p>Dedicated customer support team ready to assist with product guidance and order fulfillment.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>💎</div>
              <h3>Premium Product Selection</h3>
              <p>Carefully curated wellness solutions, ethnic fashion, and smart mobility devices.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. ABOUT / BRAND STORY */}
      <section className={styles.brandSection}>
        <div className={styles.container}>
          <div className={styles.brandGrid}>
            <div className={styles.brandVisualCol}>
              <div className={styles.brandImageStack}>
                {brandImage ? (
                  <img
                    src={brandImage.image}
                    alt={brandImage.name}
                    className={styles.brandImage}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.brandImagePlaceholder} aria-hidden="true">🛍️</div>
                )}
                <div className={styles.brandBadge}>
                  <span className={styles.brandBadgeNumber}>100%</span>
                  <span className={styles.brandBadgeLabel}>Verified Standards</span>
                </div>
              </div>
            </div>

            <div className={styles.brandTextCol}>
              <span className={styles.subHeading}>OUR PROMISE</span>
              <h2 className={styles.brandTitle}>Better Products. Better Lifestyle.</h2>
              <p className={styles.brandParagraph}>
                Headquartered in Guwahati, Assam, KUWIFR Services Private Limited bridges authentic
                wellness formulations, cutting-edge alkaline water purifiers, designer Indian attire,
                and sustainable electric mobility under one trusted digital platform.
              </p>
              <p className={styles.brandParagraph}>
                We prioritize transparent quality validation and direct value, providing verified
                solutions designed to elevate health, style, and everyday lifestyle.
              </p>
              <div className={styles.brandActions}>
                <Link to="/about" className={styles.brandLinkBtn}>
                  Learn More About KUWIFR →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. CUSTOMER TRUST REVIEWS */}
      <section className={styles.testimonials}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <span className={styles.subHeading}>VERIFIED EXPERIENCES</span>
            <h2 className={styles.sectionTitle}>Trusted by Customers Nationwide</h2>
          </div>

          <div className={styles.testimonialsGrid}>
            <div className={styles.testimonialCard}>
              <div className={styles.stars}>★★★★★</div>
              <p className={styles.testimonialText}>
                "The Alkaline Water Device has made a noticeable improvement in our daily drinking water quality.
                Delivery was fast, and the unit was exceptionally well-packaged."
              </p>
              <div className={styles.testimonialAuthor}>
                <div className={styles.authorAvatar}>RK</div>
                <div>
                  <h4>Rajesh Kumar</h4>
                  <p className={styles.authorTitle}>Verified Customer • Delhi</p>
                </div>
              </div>
            </div>

            <div className={styles.testimonialCard}>
              <div className={styles.stars}>★★★★★</div>
              <p className={styles.testimonialText}>
                "Ordered both the Modern Saree and personal wellness serums. Authenticity is unmistakable
                and the digital checkout was seamless and transparent."
              </p>
              <div className={styles.testimonialAuthor}>
                <div className={styles.authorAvatar}>AS</div>
                <div>
                  <h4>Ananya Sharma</h4>
                  <p className={styles.authorTitle}>Verified Customer • Mumbai</p>
                </div>
              </div>
            </div>

            <div className={styles.testimonialCard}>
              <div className={styles.stars}>★★★★★</div>
              <p className={styles.testimonialText}>
                "The Shilajit formulations and Seabuckthorn packs are authentic and dependable.
                Appreciated the prompt SMS shipping notifications and prompt customer support."
              </p>
              <div className={styles.testimonialAuthor}>
                <div className={styles.authorAvatar}>BD</div>
                <div>
                  <h4>Bikas Das</h4>
                  <p className={styles.authorTitle}>Verified Customer • Guwahati</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 10. CALL TO ACTION SECTION */}
      <section className={styles.cta}>
        <div className={styles.container}>
          <div className={styles.ctaBox}>
            <h2 className={styles.ctaHeading}>Ready to Upgrade Your Lifestyle?</h2>
            <p className={styles.ctaDesc}>
              Explore premium products selected for wellness, technology, fashion, and modern living.
            </p>
            <div className={styles.ctaActions}>
              <a
                href="#products"
                onClick={handleScrollToProducts}
                className={styles.ctaBtnPrimary}
              >
                Shop Now →
              </a>
              <Link to="/contact" className={styles.ctaBtnSecondary}>
                Contact Support
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 11. NEWSLETTER */}
      <section className={styles.newsletterSection}>
        <div className={styles.container}>
          <div className={styles.newsletterCard}>
            <div className={styles.newsletterIcon} aria-hidden="true">✉️</div>
            <div className={styles.newsletterText}>
              <h3>Stay Updated</h3>
              <p>Get the latest offers, new arrivals and exclusive deals.</p>
            </div>
            <form className={styles.newsletterForm} onSubmit={handleNewsletterSubmit}>
              <input
                type="email"
                required
                placeholder="Enter your email"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                className={styles.newsletterInput}
                aria-label="Email address"
              />
              <button
                type="submit"
                className={styles.newsletterBtn}
                disabled={newsletterStatus === 'loading'}
              >
                {newsletterStatus === 'loading' ? 'Subscribing…' : 'Subscribe'}
              </button>
            </form>
          </div>
          {newsletterMessage && (
            <p
              className={`${styles.newsletterFeedback} ${
                newsletterStatus === 'error' ? styles.newsletterFeedbackError : styles.newsletterFeedbackSuccess
              }`}
              role="status"
            >
              {newsletterStatus === 'error' ? '⚠️' : '✅'} {newsletterMessage}
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default HomePage;