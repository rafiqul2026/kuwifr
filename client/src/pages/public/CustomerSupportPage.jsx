import React from 'react';
import styles from './LegalPages.module.css';

const CustomerSupportPage = () => {
  return (
    <div className={styles.legalPage}>
      <div className={styles.container}>
        <h1>Customer Support</h1>
        <p className={styles.lastUpdated}>We're Here to Help</p>

        <section className={styles.section}>
          <h2>Contact Us</h2>
          <p>
            Our customer support team is available to assist you with any questions 
            or concerns you may have.
          </p>
          <ul>
            <li><strong>Email:</strong> support@kuwifr.com</li>
            <li><strong>Phone:</strong> +91-XXXXXXXXXX</li>
            <li><strong>Working Hours:</strong> Monday - Friday, 9:00 AM - 6:00 PM</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Support Channels</h2>
          <ul>
            <li><strong>Email Support:</strong> For detailed inquiries and documentation</li>
            <li><strong>Phone Support:</strong> For urgent issues and immediate assistance</li>
            <li><strong>Live Chat:</strong> Available on our website during business hours</li>
            <li><strong>FAQ:</strong> Check our FAQ page for quick answers</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Response Times</h2>
          <ul>
            <li><strong>Email:</strong> Within 24 hours</li>
            <li><strong>Phone:</strong> Immediate during business hours</li>
            <li><strong>Live Chat:</strong> Immediate during business hours</li>
            <li><strong>Grievance:</strong> Within 48 hours</li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default CustomerSupportPage;