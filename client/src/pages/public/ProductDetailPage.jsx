// client/src/pages/public/ProductDetailPage.jsx
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { KUWIFR_PRODUCTS } from '../../constants/productsData';
import { useShop } from '../../context/ShopContext';
import ProductModal from '../../components/public/ProductModal';
import Seo from '../../seo/Seo';
import Breadcrumbs from '../../seo/Breadcrumbs';
import { buildProductSchema } from '../../seo/schema';
import styles from './ProductDetailPage.module.css';

/**
 * The real, crawlable, per-product detail page — previously products only
 * existed inside a client-side "Quick View" modal (ProductModal.jsx) that
 * never changed the URL, so no individual SKU had a shareable/indexable
 * page (see the SEO audit finding). Sourced from the same static
 * KUWIFR_PRODUCTS catalog the live Home/Shop pages and cart/wishlist
 * already use (client/src/constants/productsData.js) — this is the actual
 * product data shown to shoppers today, not a separate/duplicated catalog.
 *
 * NOTE: a second, database-backed product catalog also exists
 * (server/src/models/Product.js via /api/products, managed from Admin >
 * Products) but is not wired into any live storefront page — see the SEO
 * report for why this page intentionally uses the static catalog instead.
 */
const ProductDetailPage = () => {
  const { id } = useParams();
  const { addToCart, toggleWishlist, wishlist } = useShop();
  const [showModal, setShowModal] = useState(false);

  const product = KUWIFR_PRODUCTS.find((p) => p.id === id);

  if (!product) {
    return (
      <div className={styles.notFound}>
        <Seo title="Product Not Found" description="This product could not be found." path={`/product/${id}`} robots="noindex" />
        <h1>Product Not Found</h1>
        <p>This product may have been removed or is no longer available.</p>
        <Link to="/shop">Browse all products →</Link>
      </div>
    );
  }

  const isWishlisted = wishlist?.some((w) => w.id === product.id);
  const discountPercent = Math.round(((product.mrp - product.ksp) / product.mrp) * 100);
  const path = `/product/${product.id}`;

  const related = KUWIFR_PRODUCTS.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);

  return (
    <div className={styles.page}>
      <Seo
        title={product.name}
        description={product.description}
        path={path}
        type="product"
        image={product.image}
        jsonLd={[buildProductSchema(product, path)]}
      />

      <Breadcrumbs
        items={[
          { name: 'Home', path: '/' },
          { name: 'Shop', path: '/shop' },
          { name: product.categoryLabel, path: `/shop?category=${encodeURIComponent(product.category)}` },
          { name: product.name, path }
        ]}
      />

      <div className={styles.grid}>
        <div className={styles.imageWrap}>
          <img src={product.image} alt={product.name} className={styles.image} />
        </div>

        <div className={styles.info}>
          <span className={styles.catBadge}>{product.categoryLabel}</span>
          <h1 className={styles.title}>{product.name}</h1>
          <p className={styles.description}>{product.description}</p>

          <div className={styles.priceRow}>
            <span className={styles.ksp}>₹{product.ksp.toLocaleString()}</span>
            <span className={styles.mrp}>₹{product.mrp.toLocaleString()}</span>
            {discountPercent > 0 && <span className={styles.discount}>{discountPercent}% OFF</span>}
          </div>

          {product.kbp ? <p className={styles.kbpNote}>Earns {product.kbp.toLocaleString()} KBP for eligible members</p> : null}

          <p className={styles.stockRow}>
            {product.inStock !== false ? (
              <span className={styles.inStock}>● In Stock</span>
            ) : (
              <span className={styles.outStock}>● Out of Stock</span>
            )}
          </p>

          <div className={styles.actions}>
            <button type="button" className={styles.buyBtn} onClick={() => setShowModal(true)} disabled={product.inStock === false}>
              Buy Now
            </button>
            <button type="button" className={styles.cartBtn} onClick={() => addToCart(product)} disabled={product.inStock === false}>
              Add to Bag
            </button>
            <button type="button" className={styles.wishBtn} onClick={() => toggleWishlist(product)}>
              {isWishlisted ? '♥ Wishlisted' : '♡ Wishlist'}
            </button>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className={styles.relatedSection}>
          <h2 className={styles.relatedTitle}>Related Products</h2>
          <div className={styles.relatedGrid}>
            {related.map((p) => (
              <Link key={p.id} to={`/product/${p.id}`} className={styles.relatedCard}>
                <img src={p.image} alt={p.name} className={styles.relatedImage} loading="lazy" />
                <div className={styles.relatedBody}>
                  <p className={styles.relatedName}>{p.name}</p>
                  <span className={styles.relatedPrice}>₹{p.ksp.toLocaleString()}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {showModal && <ProductModal product={product} onClose={() => setShowModal(false)} />}
    </div>
  );
};

export default ProductDetailPage;
