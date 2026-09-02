// client/src/pages/public/ContactPage.jsx
import React, { useState } from 'react';
import styles from './ContactPage.module.css';

const ContactPage = () => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', subject: '', message: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    }, 4000);
  };

  return (
    <div className={styles.contactPage}>
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.badge}>Customer Help Desk</span>
          <h1 className={styles.title}>Get in Touch with KUWIFR</h1>
          <p className={styles.subtitle}>Have questions regarding orders, deliveries, or products? We're here to assist you.</p>
        </div>

        <div className={styles.contactGrid}>
          {/* Direct Info */}
          <div className={styles.infoCard}>
            <h3>Contact Information</h3>
            <p>Feel free to reach out to our dedicated support channels.</p>

            <div className={styles.infoList}>
              <div className={styles.infoItem}>
                <span className={styles.infoIcon}>📍</span>
                <div>
                  <strong>Registered Office</strong>
                  <p>KUWIFR Services Pvt Ltd, Guwahati, Assam, India</p>
                </div>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoIcon}>📞</span>
                <div>
                  <strong>Phone Support</strong>
                  <p>+91-9876543210 (Mon - Sat, 9:30 AM - 6:30 PM)</p>
                </div>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoIcon}>✉️</span>
                <div>
                  <strong>Email Inquiries</strong>
                  <p>support@kuwifr.com</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className={styles.formCard}>
            {submitted ? (
              <div className={styles.successMessage}>
                <span>✅</span>
                <h3>Message Sent Successfully!</h3>
                <p>Thank you for contacting us. A support representative will respond within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Your Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Full Name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="Email Address"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      placeholder="10-digit Mobile"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Subject *</label>
                    <input
                      type="text"
                      required
                      placeholder="Order query, product question..."
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Your Message *</label>
                  <textarea
                    rows="5"
                    required
                    placeholder="Provide details about your query..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  ></textarea>
                </div>

                <button type="submit" className={styles.submitBtn}>Send Message</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;