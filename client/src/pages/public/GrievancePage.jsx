import React, { useState } from 'react';
import styles from './LegalPages.module.css';

const GrievancePage = () => {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className={styles.legalPage}>
        <div className={styles.container}>
          <h1>Grievance Redressal</h1>
          <div className={styles.section}>
            <h2>✅ Complaint Submitted</h2>
            <p>
              Your complaint has been submitted successfully. We will review it 
              and get back to you within 48 hours.
            </p>
            <p>
              <strong>Tracking ID:</strong> GR-2026-{Math.floor(1000 + Math.random() * 9000)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.legalPage}>
      <div className={styles.container}>
        <h1>Grievance Redressal</h1>
        <p className={styles.lastUpdated}>
          We are committed to resolving your concerns promptly and fairly.
        </p>

        <section className={styles.section}>
          <h2>Submit a Complaint</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Full Name *</label>
              <input type="text" required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Email *</label>
              <input type="email" required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Complaint Category *</label>
              <select required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <option value="">Select Category</option>
                <option value="PRODUCT">Product Issue</option>
                <option value="DELIVERY">Delivery Issue</option>
                <option value="PAYMENT">Payment Issue</option>
                <option value="SERVICE">Service Issue</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Description *</label>
              <textarea required rows={5} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
            </div>
            <button type="submit" style={{ padding: '12px 30px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              Submit Complaint
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

export default GrievancePage;