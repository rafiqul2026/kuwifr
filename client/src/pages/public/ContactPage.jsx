// client/src/pages/public/ContactPage.jsx
import React from 'react';
import styles from './ContactPage.module.css';
import Seo from '../../seo/Seo';
import Breadcrumbs from '../../seo/Breadcrumbs';
import ContactForm from '../../components/public/ContactForm';
import { COMPANY_LEGAL_NAME, COMPANY_EMAIL, COMPANY_PHONE, COMPANY_PHONE_TEL, COMPANY_ADDRESS } from '../../seo/seoConfig';

const ContactPage = () => {
  return (
    <div className={styles.contactPage}>
      <Seo
        title="Contact Us"
        description="Contact KUWIFR customer support about orders, deliveries, products or your member account — by phone, email, or the online contact form."
        path="/contact"
      />
      <div className={styles.container}>
        <Breadcrumbs items={[{ name: 'Home', path: '/' }, { name: 'Contact Us', path: '/contact' }]} />
        <div className={styles.header}>
          <span className={styles.badge}>Customer Help Desk</span>
          <h1 className={styles.title}>Get in Touch with KUWIFR</h1>
          <p className={styles.subtitle}>Have questions about orders, deliveries, products or your member account? We're here to help.</p>
        </div>

        <div className={styles.contactGrid}>
          {/* Direct Info */}
          <div className={styles.infoCard}>
            <h2>Contact Information</h2>
            <p>Reach our support team directly.</p>

            <div className={styles.infoList}>
              <div className={styles.infoItem}>
                <span className={styles.infoIcon} aria-hidden="true">📍</span>
                <div>
                  <strong>Registered Office</strong>
                  <p>{COMPANY_LEGAL_NAME}, {COMPANY_ADDRESS}</p>
                </div>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoIcon} aria-hidden="true">📞</span>
                <div>
                  <strong>Phone Support</strong>
                  <p><a href={`tel:${COMPANY_PHONE_TEL}`}>{COMPANY_PHONE}</a> (Mon – Sat, 9:30 AM – 6:30 PM)</p>
                </div>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoIcon} aria-hidden="true">✉️</span>
                <div>
                  <strong>Email Inquiries</strong>
                  <p><a href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a></p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form — submits to /api/contact */}
          <div className={styles.formCard}>
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
