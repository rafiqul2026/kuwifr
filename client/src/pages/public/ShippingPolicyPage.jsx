// client/src/pages/public/ShippingPolicyPage.jsx
import React from 'react';
import styles from './LegalPage.module.css';

const ShippingPolicyPage = () => {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.badge}>Order Fulfillment</span>
          <h1 className={styles.title}>Shipping & Delivery Policy</h1>
          <p className={styles.updatedDate}>Effective Date: August 2026</p>
        </div>

        <div className={styles.contentCard}>
          <div className={styles.section}>
            <h2>1. Order Processing & Dispatch Timelines</h2>
            <p>
              All confirmed orders are processed, quality-inspected, and handed over to our verified national courier partners within <strong>24 to 48 business hours</strong> of purchase verification.
            </p>
            <p>
              Orders are dispatched from our centralized distribution hubs in India. Dispatches and deliveries operate Monday through Saturday (excluding national holidays).
            </p>
          </div>

          <div className={styles.section}>
            <h2>2. Standard Delivery Timeframes</h2>
            <ul>
              <li><strong>Metro Cities (Tier 1):</strong> 3 to 6 business days from dispatch.</li>
              <li><strong>Rest of India (Tier 2 & Tier 3):</strong> 5 to 9 business days from dispatch.</li>
              <li><strong>Heavy Cargo & Mobility Equipment (EV Scooty, Large Devices):</strong> 7 to 14 business days via specialized surface transport.</li>
            </ul>
          </div>

          <div className={styles.section}>
            <h2>3. Shipping Charges & Free Delivery Threshold</h2>
            <ul>
              <li><strong>Free Express Shipping:</strong> Available on all prepaid orders valued at <strong>₹999 and above</strong>.</li>
              <li><strong>Standard Shipping:</strong> A flat handling fee of <strong>₹50</strong> applies to domestic orders below ₹999.</li>
              <li><strong>Bulk Cargo:</strong> For single shipments exceeding 6 kg or involving specialized vehicle freight, applicable cargo tariffs are clearly calculated and displayed at checkout prior to final payment.</li>
            </ul>
          </div>

          <div className={styles.section}>
            <h2>4. Cash on Delivery (COD) Guidelines</h2>
            <p>
              Cash on Delivery is available for select domestic Indian pin codes up to a maximum order value of <strong>₹5,000</strong>. A standard COD convenience and cash-handling fee of <strong>₹50</strong> applies to all COD shipments.
            </p>
            <p>
              To maintain dispatch integrity, COD orders may require automated SMS/call verification before release from our warehouse.
            </p>
          </div>

          <div className={styles.section}>
            <h2>5. Real-Time Order Tracking</h2>
            <p>
              Once your package leaves our facility, an automated SMS and email containing your Courier AWB Docket Tracking Number is sent to you. You can also track your shipment live at any time by entering your Order ID on our homepage tracking modal.
            </p>
          </div>

          <div className={styles.section}>
            <h2>6. Delivery Address & Receipt Verification</h2>
            <p>
              Deliveries require an authorized signature or OTP confirmation upon receipt. If you are unavailable during the delivery window, please arrange for an authorized representative (family member or neighbor) to accept the package. KUWIFR cannot be held liable for parcels signed for by authorized third-party recipients.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShippingPolicyPage;