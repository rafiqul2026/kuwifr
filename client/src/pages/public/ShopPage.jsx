// client/src/pages/public/ShopPage.jsx
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useShop } from '../../context/ShopContext';
import ProductShowcase from '../../components/public/ProductShowcase';
import styles from './ShopPage.module.css';

const ShopPage = () => {
  const location = useLocation();
  const { setActiveCategoryFilter } = useShop ? useShop() : {};

  // Read query params from URL (e.g., ?category=Health%20%26%20Wellness)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const categoryParam = params.get('category');
    if (categoryParam && typeof setActiveCategoryFilter === 'function') {
      setActiveCategoryFilter(categoryParam);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.search, setActiveCategoryFilter]);

  return (
    <div className={styles.shopContainer}>
      {/* Full-Width Shop Header Banner */}
      <div className={styles.shopBanner}>
        <div className={styles.bannerContent}>
          <span className={styles.bannerTag}>100% GENUINE GUARANTEED</span>
          <h1 className={styles.bannerTitle}>KUWIFR Storefront</h1>
          <p className={styles.bannerSubtitle}>
            Certified herbal wellness supplements, antioxidant alkaline water devices,
            artisan sarees, and smart EV two-wheelers with nationwide express shipping.
          </p>
        </div>
      </div>

      {/* Main Interactive Product Showcase */}
      <div id="products" className={styles.showcaseWrapper}>
        <ProductShowcase />
      </div>
    </div>
  );
};

export default ShopPage;