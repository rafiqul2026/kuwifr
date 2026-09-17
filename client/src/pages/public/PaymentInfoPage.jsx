import React from 'react';
import styles from './LegalPage.module.css';
import Seo from '../../seo/Seo';
import Breadcrumbs from '../../seo/Breadcrumbs';

const PaymentInfoPage = () => {
  return (
    <div className={styles.pageWrapper}>
      <Seo
        title="Payment Information"
        description="Secure payment methods accepted on the KUWIFR online store, including UPI, cards, NetBanking, and Cash on Delivery."
        path="/payment-info"
      />
      <div className={styles.container}>
        <Breadcrumbs items={[{ name: 'Home', path: '/' }, { name: 'Payment Information', path: '/payment-info' }]} />
        <h1 className={styles.title}>Payment Information</h1>
        <p className={styles.updatedDate}>Secure and Transparent Payments</p>

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