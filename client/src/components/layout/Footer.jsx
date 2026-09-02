// client/src/components/layout/Footer.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import styles from "./Footer.module.css";

const Footer = () => {
  const navigate = useNavigate();

  const handleScrollToProducts = (e) => {
    e.preventDefault();
    if (window.location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        const el = document.getElementById("products");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      const el = document.getElementById("products");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer className={styles.footer}>
      {/* Main Footer Links */}
      <div className={styles.mainFooter}>
        <div className={styles.container}>
          <div className={styles.footerGrid}>
            {/* Brand Column */}
            <div className={styles.brandCol}>
              <Link to="/" className={styles.logo}>
                <span className={styles.logoIcon}>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
                  </svg>
                </span>
                <span className={styles.logoText}>KUWIFR</span>
              </Link>
              <p className={styles.brandDesc}>
                India's premier digital storefront providing certified wellness
                essentials, antioxidant alkaline water devices, designer
                fashion, and sustainable clean mobility.
              </p>

              {/* Social Icons */}
              <div className={styles.socialIcons}>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Facebook"
                >
                  <svg
                    width="18"
                    height="18"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                >
                  <svg
                    width="18"
                    height="18"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Twitter"
                >
                  <svg
                    width="18"
                    height="18"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="YouTube"
                >
                  <svg
                    width="18"
                    height="18"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Quick Links Column */}
            <div className={styles.linksCol}>
              <h4>Quick Links</h4>
              <ul>
                <li>
                  <Link to="/">
                    <span className={styles.dotIcon}></span>
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/about">
                    <span className={styles.dotIcon}></span>
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="/contact">
                    <span className={styles.dotIcon}></span>
                    Contact Us
                  </Link>
                </li>
                <li>
                  <a href="/#products" onClick={handleScrollToProducts}>
                    <span className={styles.dotIcon}></span>
                    All Products
                  </a>
                </li>
                <li>
                  <Link to="/blog">
                    <span className={styles.dotIcon}></span>
                    Blogs
                  </Link>
                </li>
                <li>
                  <Link to="/faq">
                    <span className={styles.dotIcon}></span>
                    Shopping FAQs
                  </Link>
                </li>
              </ul>
            </div>

            {/* Shop Categories */}
            <div className={styles.linksCol}>
              <h4>Categories</h4>
              <ul>
                <li>
                  <a href="/#products" onClick={handleScrollToProducts}>
                    <span className={styles.dotIcon}></span>
                    Health & Wellness
                  </a>
                </li>
                <li>
                  <a href="/#products" onClick={handleScrollToProducts}>
                    <span className={styles.dotIcon}></span>
                    Alkaline Water Devices
                  </a>
                </li>
                <li>
                  <a href="/#products" onClick={handleScrollToProducts}>
                    <span className={styles.dotIcon}></span>
                    Designer Modern Sarees
                  </a>
                </li>
                <li>
                  <a href="/#products" onClick={handleScrollToProducts}>
                    <span className={styles.dotIcon}></span>
                    Gents Premium Wear
                  </a>
                </li>
                <li>
                  <a href="/#products" onClick={handleScrollToProducts}>
                    <span className={styles.dotIcon}></span>
                    Smart EV Scooty
                  </a>
                </li>
                <li>
                  <a href="/#products" onClick={handleScrollToProducts}>
                    <span className={styles.dotIcon}></span>
                    Hair Care & Serums
                  </a>
                </li>
              </ul>
            </div>

            {/* Help & Policies Column */}
            <div className={styles.linksCol}>
              <h4>Help & Policies</h4>
              <ul>
                <li>
                  <Link to="/terms">
                    <span className={styles.dotIcon}></span>
                    Terms & Conditions
                  </Link>
                </li>
                <li>
                  <Link to="/privacy">
                    <span className={styles.dotIcon}></span>
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/disclaimer">
                    <span className={styles.dotIcon}></span>
                    Disclaimer
                  </Link>
                </li>
                <li>
                  <Link to="/shipping-policy">
                    <span className={styles.dotIcon}></span>
                    Shipping Policy
                  </Link>
                </li>
                <li>
                  <Link to="/refund-policy">
                    <span className={styles.dotIcon}></span>
                    Refund Policy
                  </Link>
                </li>
                <li>
                  <a href="/#products" onClick={handleScrollToProducts}>
                    <span className={styles.dotIcon}></span>
                    Track Order
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Contact Details & Payment Logos */}
          <div className={styles.middleStrip}>
            <div className={styles.contactDetails}>
              <span>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                +91-9876543210
              </span>
              <span>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                support@kuwifr.com
              </span>
              <span>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                Guwahati, Assam, India
              </span>
            </div>

            {/* Official Payment Logos */}
            <div className={styles.paymentMethods}>
              <div className={styles.payCard} title="UPI">
                <svg width="42" height="22" viewBox="0 0 120 50" fill="none">
                  <path d="M15 10L35 25L15 40V10Z" fill="#097939" />
                  <path d="M35 10L55 25L35 40V10Z" fill="#ED7524" />
                  <text
                    x="60"
                    y="32"
                    fill="#000000"
                    fontFamily="sans-serif"
                    fontWeight="900"
                    fontSize="24"
                    letterSpacing="1"
                  >
                    UPI
                  </text>
                </svg>
              </div>

              <div className={styles.payCard} title="Razorpay">
                <svg width="68" height="22" viewBox="0 0 140 40" fill="none">
                  <path d="M25 5L10 35H20L30 15L25 5Z" fill="#0C2340" />
                  <path d="M32 5L20 28H28L38 8L32 5Z" fill="#3395FF" />
                  <text
                    x="42"
                    y="27"
                    fill="#0C2340"
                    fontFamily="sans-serif"
                    fontWeight="800"
                    fontSize="20"
                  >
                    Razorpay
                  </text>
                </svg>
              </div>

              <div className={styles.payCard} title="RuPay">
                <svg width="56" height="22" viewBox="0 0 120 40" fill="none">
                  <text
                    x="5"
                    y="28"
                    fill="#1A365D"
                    fontFamily="sans-serif"
                    fontWeight="900"
                    fontSize="22"
                    fontStyle="italic"
                  >
                    RuPay
                  </text>
                  <path d="M85 8L105 20L95 32H85L95 20L85 8Z" fill="#F37021" />
                  <path
                    d="M98 8L118 20L108 32H98L108 20L98 8Z"
                    fill="#0072BC"
                  />
                </svg>
              </div>

              <div className={styles.payCard} title="Visa">
                <svg width="44" height="22" viewBox="0 0 100 40" fill="none">
                  <text
                    x="5"
                    y="30"
                    fill="#1A1F71"
                    fontFamily="sans-serif"
                    fontWeight="900"
                    fontSize="30"
                    fontStyle="italic"
                    letterSpacing="2"
                  >
                    VISA
                  </text>
                </svg>
              </div>

              <div className={styles.payCard} title="MasterCard">
                <svg width="40" height="22" viewBox="0 0 80 50" fill="none">
                  <circle cx="28" cy="25" r="22" fill="#EB001B" />
                  <circle
                    cx="52"
                    cy="25"
                    r="22"
                    fill="#F79E1B"
                    fillOpacity="0.85"
                  />
                </svg>
              </div>

              <div className={styles.payCard} title="Net Banking">
                <svg width="78" height="22" viewBox="0 0 150 40" fill="none">
                  <rect
                    x="5"
                    y="8"
                    width="22"
                    height="24"
                    rx="4"
                    fill="#0F172A"
                  />
                  <path
                    d="M10 14h12M10 20h12M10 26h8"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <text
                    x="34"
                    y="26"
                    fill="#0F172A"
                    fontFamily="sans-serif"
                    fontWeight="700"
                    fontSize="16"
                  >
                    NetBanking
                  </text>
                </svg>
              </div>
            </div>
          </div>

          {/* Bottom Copyright Strip */}
          <div className={styles.bottomStrip}>
            <p>
              © {new Date().getFullYear()} KUWIFR Services Pvt Ltd. All rights
              reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
