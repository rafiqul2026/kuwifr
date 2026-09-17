// client/src/pages/public/ShopPage.jsx
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useShop } from '../../context/ShopContext';
import ProductShowcase from '../../components/public/ProductShowcase';
import Seo from '../../seo/Seo';
import Breadcrumbs from '../../seo/Breadcrumbs';
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
      {/* `?category=`/`?search=` query params only ever filter a fixed,
          already-indexable client-side list (no server-rendered pagination
          or infinite unique combinations), so this page always
          self-canonicalizes to the bare /shop URL — filtered query-string
          variants are intentionally NOT distinct canonical/indexable pages
          (see SEO report §25, search/filter/sort SEO strategy). */}
      <Seo
        title="Shop All Products"
        description="Browse KUWIFR's full catalog of health & wellness supplements, alkaline water devices, fashion, and smart EV mobility — 100% genuine, nationwide delivery."
        path="/shop"
      />
      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 20px' }}>
        <Breadcrumbs items={[{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }]} />
      </div>
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