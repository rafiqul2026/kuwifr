// client/src/pages/public/AboutPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import styles from './AboutPage.module.css';

const AboutPage = () => {
  return (
    <div className={styles.aboutPage}>
      {/* Hero */}
      <section className={styles.heroSection}>
        <div className={styles.container}>
          <span className={styles.badge}>Our Story & Vision</span>
          <h1 className={styles.title}>
            Redefining Everyday Living with <span className={styles.highlight}>Certified Quality</span>
          </h1>
          <p className={styles.subtitle}>
            KUWIFR is India's dedicated direct storefront built on absolute transparency, genuine health innovations, and consumer empowerment.
          </p>
        </div>
      </section>

      {/* Core Values */}
      <section className={styles.valuesSection}>
        <div className={styles.container}>
          <div className={styles.grid}>
            <div className={styles.valueCard}>
              <div className={styles.iconWrap}>🌿</div>
              <h3>Pure & Lab Tested</h3>
              <p>Every wellness formulation and natural supplement undergoes rigorous multi-stage purity certifications.</p>
            </div>
            <div className={styles.valueCard}>
              <div className={styles.iconWrap}>🔬</div>
              <h3>Pioneering Technology</h3>
              <p>From 30,000L antioxidant alkaline water devices to zero-emission EV scooties, we deliver tomorrow's standards today.</p>
            </div>
            <div className={styles.valueCard}>
              <div className={styles.iconWrap}>🤝</div>
              <h3>Customer First Promise</h3>
              <p>Safe digital checkout, door-to-door verified tracking, and guaranteed buyer protection on every package.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className={styles.missionSection}>
        <div className={styles.container}>
          <div className={styles.missionGrid}>
            <div className={styles.missionBox}>
              <span className={styles.boxTag}>Our Mission</span>
              <h2>Delivering Authentic Value</h2>
              <p>
                To provide households across India direct access to lab-tested lifestyle essentials, sustainable water technologies, and quality wellness products without intermediary markups.
              </p>
            </div>
            <div className={styles.missionBox}>
              <span className={styles.boxTag}>Our Vision</span>
              <h2>Empowering Communities</h2>
              <p>
                To build India's most trusted direct consumer commerce platform, promoting holistic wellness, green mobility, and digital business opportunities.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;