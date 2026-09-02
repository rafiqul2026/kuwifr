import React from 'react';
import styles from './LegalPages.module.css';

const PaymentInfoPage = () => {
  return (
    <div className={styles.legalPage}>
      <div className={styles.container}>
        <h1>Payment Information</h1>
        <p className={styles.lastUpdated}>Secure and Transparent Payments</p>

        <section className={styles.section}>
          <h2>Payment Methods</h2>
          <p>
            We offer multiple payment methods for your convenience:
          </p>
          <ul>
            <li><strong>Online Payment:</strong> Credit/Debit Card, UPI, NetBanking via Razorpay</li>
            <li><strong>Offline Payment:</strong> UPI/QR Code with manual verification</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Security</h2>
          <p>
            All online payments are processed through Razorpay, a PCI-DSS compliant 
            payment gateway. Your payment information is secure and encrypted.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Payment Verification</h2>
          <p>
            For offline payments, please upload a screenshot of your payment 
            transaction. Our team will verify and process your order within 48 hours.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Refund Process</h2>
          <p>
            Refunds are processed through the original payment method within 
            7-10 business days after approval.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PaymentInfoPage;