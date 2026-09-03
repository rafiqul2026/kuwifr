// client/src/components/layout/Footer.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import OrderTrackingModal from '../public/OrderTrackingModal';
import styles from './Footer.module.css';

const Footer = () => {
  const navigate = useNavigate();

  // Mobile Accordion state
  const [openSections, setOpenSections] = useState({
    quick: false,
    categories: false,
    policies: false
  });

  // State for Order Tracking Modal
  const [showTracker, setShowTracker] = useState(false);

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleScrollToProducts = (e) => {
    e.preventDefault();
    if (window.location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const el = document.getElementById('products');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 120);
    } else {
      const el = document.getElementById('products');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenTracker = (e) => {
    e.preventDefault();
    setShowTracker(true);
  };

  return (
    <>
      <footer className={styles.footerEdgeToEdge}>
        {/* 1. Main Navigation Block (Full Viewport) */}
        <div className={styles.footerMain}>
          <div className={styles.footerFluidGrid}>
            {/* Brand Column */}
            <div className={styles.brandCol}>
              <Link to="/" className={styles.brandLogo}>
                <span className={styles.logoRocket}>🚀</span>
                <span className={styles.logoText}>KUWIFR</span>
              </Link>
              <p className={styles.brandDescription}>
                India's premier digital storefront providing certified wellness essentials,
                antioxidant alkaline water devices, designer fashion, and sustainable clean mobility.
              </p>

              {/* Social Media Rounded Buttons */}
              <div className={styles.socialRow}>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noreferrer"
                  className={styles.socialBtn}
                  aria-label="Facebook"
                >
                  FB
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  className={styles.socialBtn}
                  aria-label="Instagram"
                >
                  IG
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noreferrer"
                  className={styles.socialBtn}
                  aria-label="Twitter"
                >
                  X
                </a>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noreferrer"
                  className={styles.socialBtn}
                  aria-label="YouTube"
                >
                  YT
                </a>
              </div>
            </div>

            {/* Quick Links Column */}
            <div className={styles.navCol}>
              <div
                className={styles.colHeaderMobile}
                onClick={() => toggleSection('quick')}
                role="button"
                tabIndex={0}
              >
                <h4 className={styles.colHeading}>Quick Links</h4>
                <span className={styles.accordionIcon}>
                  {openSections.quick ? '−' : '+'}
                </span>
              </div>
              <ul
                className={`${styles.navLinksList} ${
                  openSections.quick ? styles.navLinksListOpen : ''
                }`}
              >
                <li>
                  <Link to="/">
                    <span className={styles.dot}></span>Home
                  </Link>
                </li>
                <li>
                  <Link to="/about">
                    <span className={styles.dot}></span>About Us
                  </Link>
                </li>
                <li>
                  <Link to="/contact">
                    <span className={styles.dot}></span>Contact Us
                  </Link>
                </li>
                <li>
                  <a href="#products" onClick={handleScrollToProducts}>
                    <span className={styles.dot}></span>All Products
                  </a>
                </li>
                <li>
                  <Link to="/blog">
                    <span className={styles.dot}></span>Blogs
                  </Link>
                </li>
                <li>
                  <Link to="/faq">
                    <span className={styles.dot}></span>Shopping FAQs
                  </Link>
                </li>
              </ul>
            </div>

            {/* Categories Column */}
            <div className={styles.navCol}>
              <div
                className={styles.colHeaderMobile}
                onClick={() => toggleSection('categories')}
                role="button"
                tabIndex={0}
              >
                <h4 className={styles.colHeading}>Categories</h4>
                <span className={styles.accordionIcon}>
                  {openSections.categories ? '−' : '+'}
                </span>
              </div>
              <ul
                className={`${styles.navLinksList} ${
                  openSections.categories ? styles.navLinksListOpen : ''
                }`}
              >
                <li>
                  <Link to="/shop?category=Health+%26+Wellness">
                    <span className={styles.dot}></span>Health & Wellness
                  </Link>
                </li>
                <li>
                  <Link to="/shop?category=Alkaline+Water+Devices">
                    <span className={styles.dot}></span>Alkaline Water Devices
                  </Link>
                </li>
                <li>
                  <Link to="/shop?category=Designer+Modern+Sarees">
                    <span className={styles.dot}></span>Designer Modern Sarees
                  </Link>
                </li>
                <li>
                  <Link to="/shop?category=Gents+Premium+Wear">
                    <span className={styles.dot}></span>Gents Premium Wear
                  </Link>
                </li>
                <li>
                  <Link to="/shop?category=Smart+EV+Scooty">
                    <span className={styles.dot}></span>Smart EV Scooty
                  </Link>
                </li>
                <li>
                  <Link to="/shop?category=Hair+Care+%26+Serums">
                    <span className={styles.dot}></span>Hair Care & Serums
                  </Link>
                </li>
              </ul>
            </div>

            {/* Help & Policies Column */}
            <div className={styles.navCol}>
              <div
                className={styles.colHeaderMobile}
                onClick={() => toggleSection('policies')}
                role="button"
                tabIndex={0}
              >
                <h4 className={styles.colHeading}>Help & Policies</h4>
                <span className={styles.accordionIcon}>
                  {openSections.policies ? '−' : '+'}
                </span>
              </div>
              <ul
                className={`${styles.navLinksList} ${
                  openSections.policies ? styles.navLinksListOpen : ''
                }`}
              >
                <li>
                  <Link to="/terms">
                    <span className={styles.dot}></span>Terms & Conditions
                  </Link>
                </li>
                <li>
                  <Link to="/privacy">
                    <span className={styles.dot}></span>Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/disclaimer">
                    <span className={styles.dot}></span>Disclaimer
                  </Link>
                </li>
                <li>
                  <Link to="/shipping-policy">
                    <span className={styles.dot}></span>Shipping Policy
                  </Link>
                </li>
                <li>
                  <Link to="/refund-policy">
                    <span className={styles.dot}></span>Refund Policy
                  </Link>
                </li>
                <li>
                  {/* Opens OrderTrackingModal directly */}
                  <button
                    type="button"
                    onClick={handleOpenTracker}
                    className={styles.trackerBtnLink}
                  >
                    <span className={styles.dot}></span>Track Order
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 2. Middle Contact & Verified Payment Strip */}
        <div className={styles.contactPaymentStrip}>
          <div className={styles.contactPaymentFluid}>
            <div className={styles.contactGroup}>
              <span className={styles.contactItem}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <a href="tel:+919876543210">+91-9876543210</a>
              </span>

              <span className={styles.contactItem}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <a href="mailto:support@kuwifr.com">support@kuwifr.com</a>
              </span>

              <span className={styles.contactItem}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>Guwahati, Assam, India</span>
              </span>
            </div>

            {/* Official Payment Representations */}
            <div className={styles.paymentMethods}>
              <div className={styles.payBadge} title="UPI">
                <svg width="42" height="20" viewBox="0 0 120 50" fill="none">
                  <path d="M15 10L35 25L15 40V10Z" fill="#097939" />
                  <path d="M35 10L55 25L35 40V10Z" fill="#ED7524" />
                  <text x="60" y="32" fill="#000000" fontFamily="sans-serif" fontWeight="900" fontSize="24">UPI</text>
                </svg>
              </div>

              <div className={styles.payBadge} title="Razorpay">
                <svg width="64" height="20" viewBox="0 0 140 40" fill="none">
                  <path d="M25 5L10 35H20L30 15L25 5Z" fill="#0C2340" />
                  <path d="M32 5L20 28H28L38 8L32 5Z" fill="#3395FF" />
                  <text x="42" y="27" fill="#0C2340" fontFamily="sans-serif" fontWeight="800" fontSize="20">Razorpay</text>
                </svg>
              </div>

              <div className={styles.payBadge} title="RuPay">
                <svg width="54" height="20" viewBox="0 0 120 40" fill="none">
                  <text x="5" y="28" fill="#1A365D" fontFamily="sans-serif" fontWeight="900" fontSize="22" fontStyle="italic">RuPay</text>
                  <path d="M85 8L105 20L95 32H85L95 20L85 8Z" fill="#F37021" />
                  <path d="M98 8L118 20L108 32H98L108 20L98 8Z" fill="#0072BC" />
                </svg>
              </div>

              <div className={styles.payBadge} title="VISA">
                <svg width="42" height="20" viewBox="0 0 100 40" fill="none">
                  <text x="5" y="30" fill="#1A1F71" fontFamily="sans-serif" fontWeight="900" fontSize="28" fontStyle="italic">VISA</text>
                </svg>
              </div>

              <div className={styles.payBadge} title="MasterCard">
                <svg width="38" height="20" viewBox="0 0 80 50" fill="none">
                  <circle cx="28" cy="25" r="22" fill="#EB001B" />
                  <circle cx="52" cy="25" r="22" fill="#F79E1B" fillOpacity="0.85" />
                </svg>
              </div>

              <div className={styles.payBadge} title="Net Banking">
                <svg width="78" height="20" viewBox="0 0 150 40" fill="none">
                  <rect x="5" y="8" width="22" height="24" rx="4" fill="#0F172A" />
                  <path d="M10 14h12M10 20h12M10 26h8" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
                  <text x="34" y="26" fill="#0F172A" fontFamily="sans-serif" fontWeight="700" fontSize="16">NetBanking</text>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Bottom Legal Copyright Strip */}
        <div className={styles.copyrightStrip}>
          <p>© {new Date().getFullYear()} KUWIFR Services Pvt Ltd. All rights reserved.</p>
        </div>
      </footer>

      {/* Render the modal when user clicks Track Order */}
      {showTracker && <OrderTrackingModal onClose={() => setShowTracker(false)} />}
    </>
  );
};

export default Footer;