// client/src/pages/public/TermsPage.jsx
import React from 'react';
import styles from './LegalPage.module.css';

const TermsPage = () => {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.badge}>Customer Terms</span>
          <h1 className={styles.title}>Terms & Conditions of Sale</h1>
          <p className={styles.updatedDate}>Effective Date: August 2026</p>
        </div>

        <div className={styles.contentCard}>
          <div className={styles.section}>
            <h2>1. Platform Ownership & Agreement Overview</h2>
            <p>
              This digital store is owned and operated by <strong>KUWIFR SERVICES PVT LTD</strong>. Throughout the website, the terms "we", "us", and "our" refer exclusively to KUWIFR SERVICES PVT LTD. By accessing this store, browsing our wellness, apparel, alkaline water tech, or mobility catalogs, or completing a transaction, you engage with our digital services and agree to be bound by these Terms and Conditions.
            </p>
            <p>
              Please read these terms carefully prior to purchasing. If you do not agree with any part of these operational guidelines, you should refrain from accessing our store.
            </p>
          </div>

          <div className={styles.section}>
            <h2>2. Customer Eligibility & Account Security</h2>
            <p>
              By shopping on this platform, you affirm that you have attained the age of legal majority in your jurisdiction, or have permission from a legal guardian to transact on this site.
            </p>
            <ul>
              <li>You agree to provide accurate, up-to-date recipient and contact details during checkout.</li>
              <li>You may not use our products or digital assets for unauthorized, illicit, or counterfeit purposes.</li>
              <li>You agree not to transmit code of a destructive nature, malicious scripts, or attempt unauthorized database injections.</li>
            </ul>
          </div>

          <div className={styles.section}>
            <h2>3. Product Representation, Pricing & Modifications</h2>
            <p>
              All prices listed on the KUWIFR online storefront are in Indian Rupees (INR) and include applicable taxes unless explicitly indicated.
            </p>
            <ul>
              <li>We make every reasonable effort to display product dimensions, fabric textures, device capacities, and container details as accurately as possible.</li>
              <li>Prices, active promotional codes, and catalog listings are subject to modification without prior notice.</li>
              <li>We reserve the right to limit the sale of any item per customer, per household, or across geographic delivery zones.</li>
            </ul>
          </div>

          <div className={styles.section}>
            <h2>4. Promotional Codes, ₹0 Items & Free Gifts</h2>
            <p>
              Any complimentary gift or item marked at ₹0 is provided purely as an automated promotional add-on under defined campaign thresholds.
            </p>
            <ul>
              <li>Items listed at ₹0 are strictly not standalone retail products.</li>
              <li>In the event of a website glitch, automated cart bug, or unauthorized coupon manipulation, KUWIFR reserves the right to cancel the order or dispatch only the legitimately paid items.</li>
              <li>All promotional free gifts are final sale, non-transferable, and non-refundable.</li>
            </ul>
          </div>

          <div className={styles.section}>
            <h2>5. Order Verification & Processing</h2>
            <p>
              We reserve the right to decline or cancel any order if payment authorization fails, stock is exhausted, or if automated fraud security triggers are flagged. In the event of a cancellation initiated by KUWIFR, the complete transaction amount will be refunded directly to your original payment mode.
            </p>
          </div>

          <div className={styles.section}>
            <h2>6. Limitation of Liability & Warranties</h2>
            <p>
              Except as expressly warranted under specific manufacturer guarantees, all items are supplied on an "as available" and "as described" basis. KUWIFR SERVICES PVT LTD and its directors, executives, and logistics partners shall not be held liable for indirect, incidental, or consequential damages arising from improper product usage.
            </p>
          </div>

          <div className={styles.section}>
            <h2>7. Legal Jurisdiction & Dispute Redressal</h2>
            <p>
              These Terms and any individual transaction agreements shall be governed by and construed under the laws of India. Any unresolved dispute or claim shall fall under the exclusive jurisdiction of the competent civil courts in <strong>Guwahati, Assam, India</strong>.
            </p>
          </div>

          <div className={styles.section}>
            <h2>8. Contact & Legal Inquiries</h2>
            <p>
              For questions regarding our terms of service, reach out to our legal and customer compliance desk at <strong>support@kuwifr.com</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;