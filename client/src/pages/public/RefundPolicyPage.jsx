// client/src/pages/public/RefundPolicyPage.jsx
import React from 'react';
import styles from './LegalPage.module.css';

const RefundPolicyPage = () => {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.badge}>Customer Protection</span>
          <h1 className={styles.title}>Returns, Replacement & Refund Policy</h1>
          <p className={styles.updatedDate}>Effective Date: August 2026</p>
        </div>

        <div className={styles.contentCard}>
          <div className={styles.section}>
            <h2>1. Valid Reasons for Returns & Replacements</h2>
            <p>
              At <strong>KUWIFR</strong>, we maintain stringent multi-point quality checks. We readily approve returns and replacements under the following verified conditions:
            </p>
            <ul>
              <li><strong>Transit Damage:</strong> The item arrives broken, leaking, cracked, or severely damaged in shipment.</li>
              <li><strong>Manufacturing Defect:</strong> An electronic or alkaline device is non-functional or displays a factory defect.</li>
              <li><strong>Wrong Item Shipped:</strong> The product received differs in SKU, size, or variant from your confirmed order invoice.</li>
            </ul>
          </div>

          <div className={styles.section}>
            <h2>2. Return Exclusions & Ineligible Conditions</h2>
            <p>
              To maintain health, safety, and hygiene standards, returns will not be accepted under the following scenarios:
            </p>
            <ul>
              <li>Consumable health products, juices, supplements, or shampoos with opened safety seals or missing tamper-evident caps.</li>
              <li>Apparel, garments, or sarees that have been worn, washed, altered, or have tags removed.</li>
              <li>Minor outer carton scuffs or minor box corner dents where the inner product container is completely intact.</li>
              <li>Promotional free gifts, ₹0 items, or clearance stock items.</li>
              <li>Requests submitted after the mandatory 48-hour notification window.</li>
            </ul>
          </div>

          <div className={styles.section}>
            <h2>3. 48-Hour Reporting Protocol</h2>
            <p>
              To claim an eligible replacement or refund, you must notify our team within <strong>48 hours of parcel delivery</strong>:
            </p>
            <ul>
              <li>Email our desk at <strong>support@kuwifr.com</strong> with your <strong>Order Number (e.g. ORD123456)</strong>.</li>
              <li>Attach clear, unedited photographs or a short video showing the outer shipping label and the specific damage or incorrect item.</li>
              <li>Upon review, our quality assurance team will authorize a doorstep reverse courier pickup at zero extra cost to you.</li>
            </ul>
          </div>

          <div className={styles.section}>
            <h2>4. Resolution Process: Replacement or Refund</h2>
            <p>
              <strong>Direct Replacement:</strong> Once the affected item is received and inspected at our hub, a fresh factory-sealed replacement unit is dispatched within 48 business hours.
            </p>
            <p>
              <strong>Refund:</strong> If an exact replacement unit is unavailable in stock, a 100% full refund will be processed immediately.
            </p>
          </div>

          <div className={styles.section}>
            <h2>5. Refund Payout Timelines</h2>
            <ul>
              <li><strong>Prepaid Orders (UPI, Cards, NetBanking, Razorpay):</strong> The refund is credited back to your original payment source within <strong>5 to 7 business days</strong>.</li>
              <li><strong>Cash on Delivery (COD) Orders:</strong> The refund is remitted via NEFT / IMPS bank transfer within <strong>7 to 10 business days</strong> after receiving verified account details.</li>
            </ul>
          </div>

          <div className={styles.section}>
            <h2>6. Customer Care Support</h2>
            <p>
              For return tracking updates or questions regarding usage instructions, contact us at <strong>support@kuwifr.com</strong> or call <strong>+91-9876543210</strong> (Mon - Sat, 9:30 AM to 6:30 PM).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicyPage;