import React from 'react';
import styles from './LegalPages.module.css';

const SellerVerificationPage = () => {
  return (
    <div className={styles.legalPage}>
      <div className={styles.container}>
        <h1>Direct Seller Information</h1>
        <p className={styles.lastUpdated}>Verification & Information</p>

        <section className={styles.section}>
          <h2>About Direct Sellers</h2>
          <p>
            KUWIFR direct sellers are independent distributors who promote and sell 
            our products. All sellers are registered and verified.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Seller Verification</h2>
          <p>
            You can verify a direct seller by checking their:
          </p>
          <ul>
            <li>Registration number</li>
            <li>Name and contact details</li>
            <li>Active status</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Verify a Seller</h2>
          <p>
            To verify a seller, please contact our support team with the seller's 
            name and registration number.
          </p>
          <p>
            <strong>Email:</strong> support@kuwifr.com
          </p>
        </section>

        <section className={styles.section}>
          <h2>Seller Responsibilities</h2>
          <ul>
            <li>Provide accurate product information</li>
            <li>Follow all applicable laws and regulations</li>
            <li>Maintain consumer transparency</li>
            <li>Uphold KUWIFR's values and standards</li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default SellerVerificationPage;