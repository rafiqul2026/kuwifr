import React from 'react';
import styles from './LegalPages.module.css';

const HowItWorksPage = () => {
  return (
    <div className={styles.legalPage}>
      <div className={styles.container}>
        <h1>How It Works</h1>
        <p className={styles.lastUpdated}>Your Step-by-Step Guide to Success with KUWIFR</p>

        <section className={styles.section}>
          <h2>1. Join KUWIFR</h2>
          <p>
            Register as a member by providing your basic details. Choose a package 
            that suits your goals and start your journey with KUWIFR.
          </p>
        </section>

        <section className={styles.section}>
          <h2>2. Purchase Products</h2>
          <p>
            Browse our range of genuine products and make purchases. Each product 
            has a clear KBP (Kuwi Business Point) value that determines your income.
          </p>
        </section>

        <section className={styles.section}>
          <h2>3. Build Your Team</h2>
          <p>
            Refer others to join KUWIFR and build your network. Your team's 
            performance contributes to your income through multiple streams.
          </p>
        </section>

        <section className={styles.section}>
          <h2>4. Earn Income</h2>
          <p>
            Earn income through multiple streams:
          </p>
          <ul>
            <li><strong>Referral Income:</strong> 10% of KBP from direct referrals</li>
            <li><strong>Matching Income:</strong> 10% of KBP from binary pairs</li>
            <li><strong>Leadership Income:</strong> 50/30/20% from downline leaders</li>
            <li><strong>Repurchase Income:</strong> 30% self, 20% to 1% downline</li>
            <li><strong>Rank Salary:</strong> 1% to 0.15% on TTO</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>5. Achieve Ranks</h2>
          <p>
            Earn Kuwi Stars and achieve ranks. Each rank comes with rewards and 
            higher income potential.
          </p>
        </section>

        <section className={styles.section}>
          <h2>6. Enjoy Benefits</h2>
          <p>
            Qualify for funds, get rank salaries, and enjoy the rewards of your 
            hard work and dedication.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Important Note</h2>
          <div className={styles.disclaimerBox}>
            <p>
              KUWIFR is a legitimate product marketing and service-oriented 
              business. Income is based on product sales and team building. 
              This is NOT a pyramid scheme or money circulation scheme.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HowItWorksPage; // ← Make sure this line exists!