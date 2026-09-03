// client/src/pages/public/HomePage.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './HomePage.module.css';
import ProductShowcase from '../../components/public/ProductShowcase';

const HomePage = () => {
  const navigate = useNavigate();

  const categories = [
    {
      id: 'health-wellness',
      title: 'Health & Wellness',
      desc: 'Certified herbal, organic vitality supplements & Shilajit.',
      query: 'Health & Wellness',
      icon: '🌿',
      image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'alkaline-tech',
      title: 'Alkaline Water Devices',
      desc: 'Antioxidant active hydrogen filtration & water ionizers.',
      query: 'Alkaline Water Devices',
      icon: '💧',
      image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'designer-sarees',
      title: 'Designer Modern Sarees',
      desc: 'Handcrafted artisan silk, banarasi & contemporary ethnic wear.',
      query: 'Designer Modern Sarees',
      icon: '✨',
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'gents-wear',
      title: 'Gents Premium Wear',
      desc: 'Tailored luxury fabrics, modern shirts & formal ensembles.',
      query: 'Gents Premium Wear',
      icon: '👔',
      image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'smart-ev',
      title: 'Smart EV Scooty',
      desc: 'Eco-conscious electric two-wheelers for modern mobility.',
      query: 'Smart EV Scooty',
      icon: '⚡',
      image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'hair-serums',
      title: 'Hair Care & Serums',
      desc: 'Clinically verified follicle nutrition & regenerative oils.',
      query: 'Hair Care & Serums',
      icon: '🧴',
      image: 'https://images.unsplash.com/photo-1608248597359-bb51da77d7ea?auto=format&fit=crop&w=600&q=80',
    },
  ];

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

  return (
    <div className={styles.homePage}>
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
                <img
                  src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=900&auto=format&fit=crop&q=80"
                  alt="KUWIFR Health & Lifestyle Store"
                  className={styles.heroImg}
                  loading="eager"
                />
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
                  <img
                    src={cat.image}
                    alt={cat.title}
                    className={styles.categoryImage}
                    loading="lazy"
                  />
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
        {/* Preserves your existing component & connected shopping cart logic */}
        <ProductShowcase />
      </section>

      {/* 5. PROMOTIONAL LIFESTYLE BANNER */}
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
              <img
                src="https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80"
                alt="KUWIFR EV Mobility and Wellness"
                className={styles.promoImage}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 6. WHY CHOOSE KUWIFR */}
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

      {/* 7. ABOUT / BRAND STORY */}
      <section className={styles.brandSection}>
        <div className={styles.container}>
          <div className={styles.brandGrid}>
            <div className={styles.brandVisualCol}>
              <div className={styles.brandImageStack}>
                <img
                  src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80"
                  alt="Quality Laboratory Standards"
                  className={styles.brandImage}
                  loading="lazy"
                />
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

      {/* 8. CUSTOMER TRUST REVIEWS */}
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

      {/* 9. CALL TO ACTION SECTION */}
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
    </div>
  );
};

export default HomePage;