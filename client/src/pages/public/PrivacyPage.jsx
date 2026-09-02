// client/src/pages/public/PrivacyPage.jsx
import React from 'react';
import styles from './LegalPage.module.css';

const PrivacyPage = () => {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.badge}>Customer Privacy</span>
          <h1 className={styles.title}>Privacy & Data Protection Policy</h1>
          <p className={styles.updatedDate}>Effective Date: August 2026</p>
        </div>

        <div className={styles.contentCard}>
          <div className={styles.section}>
            <h2>1. Information We Collect</h2>
            <p>
              When you interact with the <strong>KUWIFR</strong> digital store, we collect only the necessary information to fulfill orders, facilitate deliveries, and provide customer support:
            </p>
            <ul>
              <li><strong>Checkout Information:</strong> Full name, delivery shipping address, billing address, email ID, and verified mobile contact number.</li>
              <li><strong>Payment Records:</strong> Encrypted transaction identification tokens received from our integrated gateways (we never store card CVVs, raw card numbers, or banking PINs).</li>
              <li><strong>Technical Metadata:</strong> IP address, device type, and session timestamps used to verify secure transactions and prevent duplicate fraud checkouts.</li>
            </ul>
          </div>

          <div className={styles.section}>
            <h2>2. How We Use Customer Information</h2>
            <p>
              Your personal information is strictly used for legitimate operational activities:
            </p>
            <ul>
              <li>Dispatching parcels with courier partners and providing live SMS/Email tracking numbers.</li>
              <li>Assisting with product inquiries, replacements, and customer service requests.</li>
              <li>Fulfilling legal tax invoices, GST regulatory filings, and warranty records.</li>
              <li>Providing opt-in notifications regarding special releases and promotional sales.</li>
            </ul>
          </div>

          <div className={styles.section}>
            <h2>3. Consent & Right to Opt-Out</h2>
            <p>
              When you submit your details to complete a purchase, verify a payment, or request a return, you consent to our collecting and using that data for that specific transaction only.
            </p>
            <p>
              If we ask for contact details for secondary communications (such as store newsletters), you have the right to opt out at any time by clicking the unsubscribe link or writing to <strong>support@kuwifr.com</strong>.
            </p>
          </div>

          <div className={styles.section}>
            <h2>4. Secure Payment Gateways & Card Data Security</h2>
            <p>
              All online payments on KUWIFR are processed through certified, PCI-DSS-compliant payment aggregators (including <strong>Razorpay, UPI, RuPay, Visa, MasterCard, and NetBanking</strong>).
            </p>
            <p>
              All transaction communication takes place across 256-bit TLS/SSL encrypted channels. Card information is encrypted directly by the payment networks and is never retained on our internal web servers.
            </p>
          </div>

          <div className={styles.section}>
            <h2>5. Third-Party Service Providers</h2>
            <p>
              We only share relevant customer data with trusted third-party partners essential for business fulfillment (e.g., surface logistics couriers and transactional SMS gateways). We do not sell, rent, lease, or monetize customer data to advertising brokers.
            </p>
          </div>

          <div className={styles.section}>
            <h2>6. Browser Cookies</h2>
            <p>
              We utilize essential browser session cookies to maintain your shopping cart items, preserve language preferences, and keep you logged in to your account. You can disable cookies via your browser settings, though some interactive cart features may be limited.
            </p>
          </div>

          <div className={styles.section}>
            <h2>7. Data Access & Deletion Requests</h2>
            <p>
              You have the right to request a summary of the personal information stored in your account profile, or request permanent deletion of your customer record by emailing our Data Support Officer at <strong>support@kuwifr.com</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;