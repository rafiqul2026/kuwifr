// client/src/components/layout/Footer.jsx
//
// Public site footer. Company details come from seo/seoConfig.js (mirrors
// the configured company settings). No social links are shown until the
// business provides its real profile URLs (SOCIAL_PROFILES).
import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiDownload, FiMail, FiPhone, FiMapPin, FiChevronRight } from 'react-icons/fi';
import InstallAppHelpModal from '../common/InstallAppHelpModal';
import NewsletterForm from '../public/NewsletterForm';
import { useInstallApp } from '../../utils/pwaInstall';
import { useShop } from '../../context/ShopContext';
import {
  COMPANY_LEGAL_NAME,
  COMPANY_EMAIL,
  COMPANY_PHONE,
  COMPANY_PHONE_TEL,
  COMPANY_ADDRESS,
  COMPANY_CIN,
  COMPANY_GSTIN,
  SOCIAL_PROFILES
} from '../../seo/seoConfig';
import styles from './Footer.module.css';

const COMPANY_LINKS = [
  { label: 'About Us', to: '/about' },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'Shop', to: '/shop' },
  { label: 'Blog', to: '/blog' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Contact Us', to: '/contact' }
];

const HELP_LINKS = [
  { label: 'Customer Support', to: '/customer-support' },
  { label: 'Track my orders', to: '/member/orders' },
  { label: 'Shipping Policy', to: '/shipping-policy' },
  { label: 'Refund & Returns', to: '/refund-policy' },
  { label: 'Warranty', to: '/warranty' },
  { label: 'Payment Information', to: '/payment-info' },
  { label: 'Grievance Redressal', to: '/grievance' },
  { label: 'Seller Verification', to: '/seller-verification' }
];

const LEGAL_LINKS = [
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Terms & Conditions', to: '/terms' },
  { label: 'Disclaimer', to: '/disclaimer' }
];

const Footer = () => {
  const navigate = useNavigate();
  const { products = [], categories = [], setActiveCategoryFilter } = useShop() || {};

  // Same "Download the App" (PWA install) as the member panel.
  const { canPrompt, isInstalled, isIOS, promptInstall } = useInstallApp();
  const [installHelpOpen, setInstallHelpOpen] = useState(false);

  const handleInstallApp = async () => {
    if (canPrompt) {
      const outcome = await promptInstall();
      if (outcome !== 'unavailable') return;
    }
    setInstallHelpOpen(true);
  };

  const topCategories = useMemo(() => {
    const counts = {};
    products.forEach((p) => {
      if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return categories.filter((c) => counts[c]).sort((a, b) => counts[b] - counts[a]).slice(0, 6);
  }, [categories, products]);

  const goToCategory = (cat) => {
    if (typeof setActiveCategoryFilter === 'function') setActiveCategoryFilter(cat);
    navigate(`/shop?category=${encodeURIComponent(cat)}`);
  };

  const year = new Date().getFullYear();

  return (
    <>
      <footer className={styles.footer}>
        <div className={styles.inner}>
          <div className={styles.grid}>
            <div className={styles.brandCol}>
              <Link to="/" className={styles.brand} aria-label="KUWIFR home">
                <img src="/logo-96.webp" alt="KUWIFR" width="36" height="36" loading="lazy" />
              </Link>
              <p className={styles.about}>
                {COMPANY_LEGAL_NAME} brings health &amp; wellness products, alkaline water devices, fashion and
                everyday essentials to customers across India, with a member programme for those who want to
                build a business with us.
              </p>

              <ul className={styles.contactList}>
                <li>
                  <FiPhone aria-hidden="true" />
                  <a href={`tel:${COMPANY_PHONE_TEL}`}>{COMPANY_PHONE}</a>
                </li>
                <li>
                  <FiMail aria-hidden="true" />
                  <a href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a>
                </li>
                <li>
                  <FiMapPin aria-hidden="true" />
                  <span>{COMPANY_ADDRESS}</span>
                </li>
              </ul>

              <NewsletterForm />


              {SOCIAL_PROFILES.length > 0 && (
                <ul className={styles.social} aria-label="KUWIFR on social media">
                  {SOCIAL_PROFILES.map((url) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noopener noreferrer">{new URL(url).hostname.replace('www.', '')}</a>
                    </li>
                  ))}
                </ul>
              )}

              {!isInstalled && (
                <button type="button" className={styles.installBtn} onClick={handleInstallApp}>
                  <FiDownload aria-hidden="true" /> Install the KUWIFR app
                </button>
              )}
            </div>

            <nav className={styles.col} aria-labelledby="footer-company">
              <h2 id="footer-company" className={styles.colTitle}>Company</h2>
              <ul>
                {COMPANY_LINKS.map((l) => (
                  <li key={l.to}><Link to={l.to}>{l.label}</Link></li>
                ))}
              </ul>
            </nav>

            {topCategories.length > 0 && (
              <nav className={styles.col} aria-labelledby="footer-shop">
                <h2 id="footer-shop" className={styles.colTitle}>Shop</h2>
                <ul>
                  {topCategories.map((cat) => (
                    <li key={cat}>
                      <button type="button" className={styles.linkBtn} onClick={() => goToCategory(cat)}>{cat}</button>
                    </li>
                  ))}
                  <li><Link to="/shop" className={styles.allLink}>All products <FiChevronRight aria-hidden="true" /></Link></li>
                </ul>
              </nav>
            )}

            <nav className={styles.col} aria-labelledby="footer-help">
              <h2 id="footer-help" className={styles.colTitle}>Help</h2>
              <ul>
                {HELP_LINKS.map((l) => (
                  <li key={l.to}><Link to={l.to}>{l.label}</Link></li>
                ))}
              </ul>
            </nav>

            <div className={styles.col}>
              <h2 className={styles.colTitle}>Members</h2>
              <p className={styles.memberText}>Manage your orders, packages, income and KYC from the Customer Panel.</p>
              <div className={styles.memberActions}>
                <Link to="/login" className={styles.memberPrimary}>Customer Login</Link>
                <Link to="/register" className={styles.memberSecondary}>Join KUWIFR</Link>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.bottom}>
          <div className={styles.bottomInner}>
            <p className={styles.legalLine}>
              © {year} {COMPANY_LEGAL_NAME}. All rights reserved.
              <span className={styles.reg}>CIN: {COMPANY_CIN}</span>
              <span className={styles.reg}>GSTIN: {COMPANY_GSTIN}</span>
            </p>
            <ul className={styles.legalLinks}>
              {LEGAL_LINKS.map((l) => (
                <li key={l.to}><Link to={l.to}>{l.label}</Link></li>
              ))}
            </ul>
          </div>
        </div>
      </footer>

      {installHelpOpen && <InstallAppHelpModal isIOS={isIOS} onClose={() => setInstallHelpOpen(false)} />}
    </>
  );
};

export default Footer;
