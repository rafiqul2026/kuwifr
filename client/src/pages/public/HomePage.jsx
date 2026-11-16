// client/src/pages/public/HomePage.jsx
//
// Public homepage. Visual language follows the Customer Panel (teal
// #008080, orange #fd9911, warm #fdfaf5 canvas, Geist, hairline-bordered
// cards) via the --kw-* tokens in styles/variables.css. Copy lives in
// ./home/homeContent.js; company facts in seo/seoConfig.js.
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiCheck, FiPhone, FiMail, FiMapPin, FiClock, FiFileText, FiShield, FiTruck, FiGrid, FiUser } from 'react-icons/fi';
import styles from './HomePage.module.css';
import ProductShowcase from '../../components/public/ProductShowcase';
import ContactForm from '../../components/public/ContactForm';
import FaqAccordion from '../../components/public/FaqAccordion';
import Seo from '../../seo/Seo';
import { buildOrganizationSchema, buildWebsiteSchema } from '../../seo/schema';
import {
  COMPANY_LEGAL_NAME,
  COMPANY_EMAIL,
  COMPANY_PHONE,
  COMPANY_PHONE_TEL,
  COMPANY_ADDRESS,
  COMPANY_CIN,
  COMPANY_GSTIN
} from '../../seo/seoConfig';
import { cdnImage, cdnSrcSet } from '../../utils/imageUrl';
import { useShop } from '../../context/ShopContext';
import { useAuth } from '../../context/AuthContext';
import { SERVICES, WHY_CHOOSE, STEPS, PANEL_FEATURES, FAQS } from './home/homeContent';

const PANEL_MENU = ['Dashboard', 'Packages', 'My Orders', 'Repurchase', 'Income', 'Team', 'KYC & ID card', 'Support'];

const SectionHead = ({ eyebrow, title, text, id, center = false, light = false }) => (
  <div className={`${styles.sectionHead} ${center ? styles.sectionHeadCenter : ''} ${light ? styles.sectionHeadLight : ''}`}>
    {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
    <h2 id={id} className={styles.sectionTitle}>{title}</h2>
    {text && <p className={styles.sectionText}>{text}</p>}
  </div>
);

const HomePage = () => {
  const { products = [], categories: realCategories = [], productsLoading } = useShop();
  const { isAuthenticated, user } = useAuth();

  const role = (user?.role || '').toUpperCase();
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const panelPath = !isAuthenticated ? '/login' : isAdmin ? '/admin/dashboard' : '/member/dashboard';

  // Real catalog photos only (never stock images).
  const heroProducts = useMemo(() => products.filter((p) => p.image).slice(0, 3), [products]);

  // Categories that actually have products, most-stocked first, each with
  // one of its own product photos.
  const categories = useMemo(
    () =>
      realCategories
        .map((cat) => {
          const items = products.filter((p) => p.category === cat);
          return { name: cat, count: items.length, image: items.find((p) => p.image)?.image || '' };
        })
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
    [realCategories, products]
  );

  return (
    <div className={styles.page}>
      <Seo
        title="Health, Wellness & Lifestyle Products in India"
        description="KUWIFR Services Pvt Ltd — shop health & wellness products, alkaline water devices, fashion and everyday essentials with delivery across India, or join the KUWIFR member programme."
        path="/"
        type="website"
        jsonLd={[buildOrganizationSchema(), buildWebsiteSchema()]}
      />

      {/* ---------------- HERO ---------------- */}
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.heroEyebrow}>
                <span className={styles.dot} aria-hidden="true" /> {COMPANY_LEGAL_NAME} · Assam, India
              </p>
              <h1 id="hero-title" className={styles.heroTitle}>
                Wellness and lifestyle products, <span>from a company you can verify.</span>
              </h1>
              <p className={styles.heroText}>
                Shop health &amp; wellness products, alkaline water devices, fashion and everyday essentials, delivered
                across India. Or join as a member and build a business with products you use.
              </p>
              <div className={styles.heroActions}>
                <Link to="/shop" className={styles.btnPrimary}>
                  Shop products <FiArrowRight aria-hidden="true" />
                </Link>
                {isAuthenticated ? (
                  <Link to={panelPath} className={styles.btnSecondary}>
                    <FiGrid aria-hidden="true" /> Open my dashboard
                  </Link>
                ) : (
                  <Link to="/register" className={styles.btnSecondary}>Join KUWIFR</Link>
                )}
              </div>
              {!isAuthenticated && (
                <p className={styles.heroLogin}>
                  Already a member? <Link to="/login">Sign in to the Customer Panel</Link>
                </p>
              )}
            </div>

            <div className={styles.heroVisual}>
              <div className={styles.heroCard}>
                <div className={styles.heroTiles}>
                  {[0, 1, 2].map((i) => {
                    const p = heroProducts[i];
                    return (
                      <div key={i} className={`${styles.heroTile} ${i === 0 ? styles.heroTileLarge : ''}`}>
                        {p ? (
                          <img
                            src={cdnImage(p.image, i === 0 ? 480 : 300)}
                            srcSet={cdnSrcSet(p.image, i === 0 ? 480 : 300)}
                            alt={p.name}
                            loading={i === 0 ? 'eager' : 'lazy'}
                            // eslint-disable-next-line react/no-unknown-property -- React 18.2 only forwards the lowercase attribute
                            fetchpriority={i === 0 ? 'high' : undefined}
                            decoding={i === 0 ? undefined : "async"}
                          />
                        ) : (
                          <span className={productsLoading ? styles.skeleton : styles.tileFallback} aria-hidden="true" />
                        )}
                        {p && (
                          <span className={styles.heroTileLabel}>{p.name}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className={styles.verifyCard}>
                  <FiShield aria-hidden="true" className={styles.verifyIcon} />
                  <div>
                    <strong>Registered company</strong>
                    <span>CIN {COMPANY_CIN}</span>
                    <span>GSTIN {COMPANY_GSTIN}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- TRUST STRIP ---------------- */}
      <section className={styles.trust} aria-label="Company facts">
        <div className={styles.container}>
          <ul className={styles.trustGrid}>
            <li>
              <FiShield aria-hidden="true" />
              <div>
                <strong>Private limited company</strong>
                <span>Incorporated in Assam · CIN {COMPANY_CIN}</span>
              </div>
            </li>
            <li>
              <FiFileText aria-hidden="true" />
              <div>
                <strong>GST-registered invoices</strong>
                <span>GSTIN {COMPANY_GSTIN}</span>
              </div>
            </li>
            <li>
              <FiTruck aria-hidden="true" />
              <div>
                <strong>Free shipping from ₹999</strong>
                <span>On prepaid orders · <Link to="/shipping-policy">Policy</Link></span>
              </div>
            </li>
            <li>
              <FiClock aria-hidden="true" />
              <div>
                <strong>Support Mon – Sat</strong>
                <span>9:30 AM – 6:30 PM · <a href={`tel:${COMPANY_PHONE_TEL}`}>{COMPANY_PHONE}</a></span>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* ---------------- SERVICES ---------------- */}
      <section id="services" className={styles.section} aria-labelledby="services-title">
        <div className={styles.container}>
          <SectionHead
            id="services-title"
            eyebrow="What we offer"
            title="One company for your products, orders and member business"
            text="Whether you are buying for your family or building a business with KUWIFR, everything runs through one account."
          />
          <ul className={styles.serviceGrid}>
            {SERVICES.map(({ icon: Icon, title, text, cta, to }) => (
              <li key={title} className={styles.serviceCard}>
                <span className={styles.iconBox} aria-hidden="true"><Icon /></span>
                <h3>{title}</h3>
                <p>{text}</p>
                <Link to={to} className={styles.cardLink}>
                  {cta} <FiArrowRight aria-hidden="true" />
                  <span className={styles.srOnly}> — {title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------- CATEGORIES (live catalog) ---------------- */}
      {categories.length > 0 && (
        <section className={`${styles.section} ${styles.sectionAlt}`} aria-labelledby="categories-title">
          <div className={styles.container}>
            <div className={styles.headRow}>
              <SectionHead id="categories-title" eyebrow="Shop by category" title="Explore the catalog" />
              <Link to="/shop" className={styles.textLink}>
                View all products <FiArrowRight aria-hidden="true" />
              </Link>
            </div>
            <ul className={styles.categoryGrid}>
              {categories.map((c) => (
                <li key={c.name}>
                  <Link to={`/shop?category=${encodeURIComponent(c.name)}`} className={styles.categoryCard}>
                    <span className={styles.categoryImg}>
                      {c.image ? <img src={cdnImage(c.image, 320)} srcSet={cdnSrcSet(c.image, 320)} alt="" loading="lazy" decoding="async" /> : <span aria-hidden="true">🛍️</span>}
                    </span>
                    <span className={styles.categoryText}>
                      <strong>{c.name}</strong>
                      <small>{c.count} product{c.count === 1 ? '' : 's'}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ---------------- FEATURED PRODUCTS (existing shop component) ---------------- */}
      <section className={styles.section} aria-labelledby="products-title">
        <div className={styles.container}>
          <SectionHead
            id="products-title"
            eyebrow="Featured products"
            title="Popular in the KUWIFR store"
            text="Prices shown are KUWIFR selling prices. Add to your bag or buy now — your order is completed from your KUWIFR account."
          />
        </div>
        <ProductShowcase showHeader={false} showTrackOrder={false} limit={8} />
      </section>

      {/* ---------------- WHY KUWIFR ---------------- */}
      <section className={`${styles.section} ${styles.sectionAlt}`} aria-labelledby="why-title">
        <div className={styles.container}>
          <div className={styles.whyGrid}>
            <SectionHead
              id="why-title"
              eyebrow="Why KUWIFR"
              title="Built on things you can check"
              text="No vague promises: here is how we work, backed by our registration details and published policies."
            />
            <ul className={styles.whyList}>
              {WHY_CHOOSE.map(({ icon: Icon, title, text }) => (
                <li key={title} className={styles.whyItem}>
                  <span className={styles.iconBox} aria-hidden="true"><Icon /></span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section className={styles.section} aria-labelledby="steps-title">
        <div className={styles.container}>
          <SectionHead id="steps-title" eyebrow="How it works" title="From sign-up to delivery in four steps" center />
          <ol className={styles.steps}>
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className={styles.step}>
                <span className={styles.stepNum} aria-hidden="true">{i + 1}</span>
                <span className={styles.stepIcon} aria-hidden="true"><Icon /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
          <p className={styles.stepsMore}>
            <Link to="/how-it-works" className={styles.textLink}>
              Read the full guide, including the income plan <FiArrowRight aria-hidden="true" />
            </Link>
          </p>
        </div>
      </section>

      {/* ---------------- CUSTOMER PANEL ---------------- */}
      <section className={styles.panel} aria-labelledby="panel-title">
        <div className={styles.container}>
          <div className={styles.panelGrid}>
            <div>
              <SectionHead
                id="panel-title"
                light
                eyebrow="Customer Panel"
                title="Your orders, packages and income in one place"
                text="Sign in to the KUWIFR Customer Panel on any phone or computer — or install it as an app."
              />
              <ul className={styles.panelFeatures}>
                {PANEL_FEATURES.map((f) => (
                  <li key={f}><FiCheck aria-hidden="true" /> {f}</li>
                ))}
              </ul>
              <div className={styles.panelActions}>
                <Link to={panelPath} className={styles.btnAccent}>
                  {isAuthenticated ? <><FiGrid aria-hidden="true" /> {isAdmin ? 'Open Admin Panel' : 'Open my dashboard'}</> : <><FiUser aria-hidden="true" /> Customer Login</>}
                </Link>
                {!isAuthenticated && (
                  <Link to="/register" className={styles.btnGhostLight}>Create an account</Link>
                )}
              </div>
            </div>

            {/* Illustration of the panel's real navigation — no data shown. */}
            <div className={styles.panelMock} aria-hidden="true">
              <div className={styles.mockBar}>
                <span /><span /><span />
                <em>kuwifr.in/member/dashboard</em>
              </div>
              <div className={styles.mockBody}>
                <ul className={styles.mockNav}>
                  {PANEL_MENU.map((m, i) => (
                    <li key={m} className={i === 0 ? styles.mockNavActive : ''}>{m}</li>
                  ))}
                </ul>
                <div className={styles.mockMain}>
                  <div className={styles.mockLineWide} />
                  <div className={styles.mockCards}>
                    <div /><div /><div />
                  </div>
                  <div className={styles.mockChart}>
                    {[42, 64, 38, 72, 56, 80, 60].map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section className={styles.section} aria-labelledby="faq-title">
        <div className={styles.container}>
          <div className={styles.faqGrid}>
            <div>
              <SectionHead
                id="faq-title"
                eyebrow="FAQ"
                title="Common questions"
                text="Quick answers about ordering, delivery, returns and membership."
              />
              <Link to="/faq" className={styles.textLink}>
                See all FAQs <FiArrowRight aria-hidden="true" />
              </Link>
            </div>
            <FaqAccordion items={FAQS} />
          </div>
        </div>
      </section>

      {/* ---------------- CONTACT ---------------- */}
      <section id="contact" className={`${styles.section} ${styles.sectionAlt}`} aria-labelledby="contact-title">
        <div className={styles.container}>
          <div className={styles.contactGrid}>
            <div className={styles.contactInfo}>
              <SectionHead
                id="contact-title"
                eyebrow="Contact us"
                title="Talk to our support team"
                text="Questions about a product, an order or your account? Send a message and we will reply by email."
              />
              <ul className={styles.contactList}>
                <li>
                  <span className={styles.iconBox} aria-hidden="true"><FiPhone /></span>
                  <div>
                    <strong>Phone</strong>
                    <a href={`tel:${COMPANY_PHONE_TEL}`}>{COMPANY_PHONE}</a>
                    <small>Mon – Sat, 9:30 AM – 6:30 PM</small>
                  </div>
                </li>
                <li>
                  <span className={styles.iconBox} aria-hidden="true"><FiMail /></span>
                  <div>
                    <strong>Email</strong>
                    <a href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a>
                  </div>
                </li>
                <li>
                  <span className={styles.iconBox} aria-hidden="true"><FiMapPin /></span>
                  <div>
                    <strong>Registered office</strong>
                    <span>{COMPANY_LEGAL_NAME}<br />{COMPANY_ADDRESS}</span>
                  </div>
                </li>
              </ul>
            </div>
            <div className={styles.contactCard}>
              <ContactForm compact />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
