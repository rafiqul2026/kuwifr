// client/src/pages/public/DisclaimerPage.jsx
import React from 'react';
import styles from './LegalPage.module.css';

const DisclaimerPage = () => {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.badge}>Transparency & Notices</span>
          <h1 className={styles.title}>Product & Performance Disclaimer</h1>
          <p className={styles.updatedDate}>Effective Date: August 2026</p>
        </div>

        <div className={styles.contentCard}>
          <div className={styles.section}>
            <h2>1. Health & Dietary Supplement Disclaimers</h2>
            <p>
              Information and products offered on KUWIFR (such as <em>Kuwi Shilajit 99</em>, <em>Protein Powder</em>, <em>Seabuckthorn Juice</em>, and <em>Multi-Vitamin Daily Shield</em>) are formulated for general nutritional and wellness support.
            </p>
            <ul>
              <li>These products are not intended to substitute professional medical diagnosis, prescription pharmaceuticals, or clinical medical treatments.</li>
              <li>Individual physical outcomes and energy benefits may vary depending on diet, lifestyle, age, and metabolic health.</li>
              <li>Always consult a qualified healthcare professional before introducing new dietary supplements, particularly if pregnant, lactating, or taking regular medications.</li>
            </ul>
          </div>

          <div className={styles.section}>
            <h2>2. Ingredient Sensitivities & Patch Testing</h2>
            <p>
              Full ingredient compositions are listed on our product packaging. Customers with known skin allergies, herbal sensitivities, or chronic sensitivities must review ingredients thoroughly before use.
            </p>
            <p>
              For topical formulations such as our <em>Instant Magic Hair Color Shampoo</em>, we mandate performing a 48-hour preliminary patch test on a small skin area. Discontinue usage immediately if redness, itching, or irritation develops.
            </p>
          </div>

          <div className={styles.section}>
            <h2>3. Water Device Filtration & Capacity Benchmarks</h2>
            <p>
              Water generation capacities (such as 15,000L and 30,000L specifications on our Alkaline Water Devices) represent standard testing performance under controlled laboratory baseline conditions.
            </p>
            <p>
              Actual cartridge longevity, pH ionization rates, and mineral enrichment depend on the Total Dissolved Solids (TDS), input pressure, and mineral composition of your local water supply.
            </p>
          </div>

          <div className={styles.section}>
            <h2>4. EV Mobility Specifications & Range</h2>
            <p>
              Top speed, battery duration, and total single-charge range metrics for our <em>Smart Electric Scooty</em> represent certified testing standard benchmarks. Actual real-world range will vary depending on rider payload, road elevation, tire inflation, and driving modes.
            </p>
          </div>

          <div className={styles.section}>
            <h2>5. Color & Photography Variations</h2>
            <p>
              We strive to display apparel, fabrics (such as our Modern Saree collections), and product finishes with high visual precision. Slight differences in hue may occur due to photographic lighting and varying monitor calibrations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerPage;