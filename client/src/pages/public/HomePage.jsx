// client/src/pages/public/HomePage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import styles from './HomePage.module.css';
import ProductShowcase from '../../components/public/ProductShowcase';

const HomePage = () => {
  return (
    <div className={styles.homePage}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={styles.heroContent}>
              <div className={styles.trustBadge}>
                <span>🇮🇳 India's Premier Health & Lifestyle Store</span>
              </div>
              <h1 className={styles.heroTitle}>
                Discover Premium <br />
                <span className={styles.highlight}>Health & Lifestyle Essentials</span>
              </h1>
              <p className={styles.heroSubtitle}>
                Shop genuine wellness solutions, advanced alkaline water devices, 
                designer fashion, and smart EV mobility with nationwide fast shipping and verified quality.
              </p>
              
              <div className={styles.heroButtons}>
                <a href="#products" className={styles.primaryBtn}>
                  Shop Now 🛍️
                </a>
                <Link to="/about" className={styles.secondaryBtn}>
                  Learn More ℹ️
                </Link>
              </div>

              {/* Trust Stats Bar */}
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

            <div className={styles.heroVisual}>
              <div className={styles.imageCard}>
                <img 
                  src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80" 
                  alt="KUWIFR Premium Store" 
                  className={styles.heroImg}
                />
                <div className={styles.floatingCard}>
                  <span className={styles.floatingIcon}>⭐</span>
                  <div>
                    <strong>100% Quality Assured</strong>
                    <p>Lab Tested & Certified Products</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Guarantee Bar */}
      <section className={styles.trustBar}>
        <div className={styles.container}>
          <div className={styles.trustGrid}>
            <div className={styles.trustItem}>
              <span className={styles.trustIcon}>🚚</span>
              <div>
                <h4>All-India Fast Shipping</h4>
                <p>Safe delivery with live order tracking</p>
              </div>
            </div>
            <div className={styles.trustItem}>
              <span className={styles.trustIcon}>🛡️</span>
              <div>
                <h4>Genuine Quality</h4>
                <p>100% certified authentic brands</p>
              </div>
            </div>
            <div className={styles.trustItem}>
              <span className={styles.trustIcon}>💳</span>
              <div>
                <h4>Secure Payments</h4>
                <p>UPI, Cards, NetBanking & Wallet</p>
              </div>
            </div>
            <div className={styles.trustItem}>
              <span className={styles.trustIcon}>💬</span>
              <div>
                <h4>24/7 Dedicated Support</h4>
                <p>Instant help & order resolution</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Complete E-Commerce Store & Product Grid */}
      <ProductShowcase />

      {/* Features Section */}
      <section className={styles.features}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <span className={styles.subHeading}>Why Choose Us</span>
            <h2 className={styles.sectionTitle}>The KUWIFR Advantage</h2>
            <p className={styles.sectionDesc}>
              A modern, reliable online shopping platform delivering premium essentials directly to your home.
            </p>
          </div>

          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🛡️</div>
              <h3>Buyer Protection</h3>
              <p>Safe shopping with easy return policies and transparent order handling.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📦</div>
              <h3>Curated Quality Catalog</h3>
              <p>Pure Himalayan Shilajit, Alkaline Ionizers, EV Mobility, and Designer Apparel.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🏷️</div>
              <h3>Exclusive Member Offers</h3>
              <p>Special discounts, early festival deals, and loyalty rewards on every purchase.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📞</div>
              <h3>Customer Care Desk</h3>
              <p>Dedicated customer support team for quick assistance and package tracking.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className={styles.howItWorks}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <span className={styles.subHeading}>Easy Online Shopping</span>
            <h2 className={styles.sectionTitle}>How to Order from KUWIFR</h2>
          </div>

          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNumber}>01</div>
              <h3>Select Product</h3>
              <p>Browse our catalog and pick your favorite essentials.</p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNumber}>02</div>
              <h3>Quick Checkout</h3>
              <p>Fill in your address and pay securely via UPI, Card, or NetBanking.</p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNumber}>03</div>
              <h3>Track Order</h3>
              <p>Get live courier status with your unique Order ID.</p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNumber}>04</div>
              <h3>Fast Delivery</h3>
              <p>Receive authentic, quality-sealed products right at your doorstep.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className={styles.testimonials}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <span className={styles.subHeading}>Customer Reviews</span>
            <h2 className={styles.sectionTitle}>Trusted by Customers Nationwide</h2>
          </div>

          <div className={styles.testimonialsGrid}>
            <div className={styles.testimonialCard}>
              <div className={styles.stars}>★★★★★</div>
              <p className={styles.testimonialText}>
                "The Alkaline Water Device has made a huge difference in our daily drinking water quality. Delivery was fast and packing was solid."
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
                "I ordered the Modern Saree and Hair Color Shampoo. Both are authentic and high quality. The checkout process was super smooth."
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
                "The Kuwi Shilajit 99 and Seabuckthorn pack are best-in-class products. Excellent packaging and instant tracking updates."
              </p>
              <div className={styles.testimonialAuthor}>
                <div className={styles.authorAvatar}>BD</div>
                <div>
                  <h4>Bikas Das</h4>
                  <p className={styles.authorTitle}>Verified Customer • Chennai</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.cta}>
        <div className={styles.container}>
          <div className={styles.ctaBox}>
            <h2>Experience Premium Living with KUWIFR</h2>
            <p>Join thousands of satisfied shoppers across India and enjoy genuine lifestyle products today.</p>
            <div className={styles.ctaActions}>
              <a href="#products" className={styles.ctaBtnPrimary}>
                Start Shopping
              </a>
              <Link to="/contact" className={styles.ctaBtnSecondary}>
                Contact Support
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;