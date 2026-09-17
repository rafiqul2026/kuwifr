// client/src/pages/public/ProductDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
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
 * page (see the SEO audit finding).
 *
 * Sourced from the real, admin-managed RepurchaseProduct catalog (fetched
 * once in ShopContext and shared across the whole storefront) — the same
 * catalog and original product photos already used by the Member
 * Repurchase Store and Buy Package. The public storefront previously
 * rendered a separate, hardcoded demo catalog with stock Unsplash photos;
 * that's been retired in favor of this single, real, photo-managed source.
 */
const ProductDetailPage = () => {
  const { id } = useParams();
  const { addToCart, toggleWishlist, wishlist, products, productsLoading } = useShop();
  const [showModal, setShowModal] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const product = products.find((p) => p.id === id);

  useEffect(() => {
    setActiveImageIdx(0);
  }, [id]);

  if (productsLoading) {
    return (
      <div className={styles.notFound}>
        <Seo title="Loading Product" path={`/product/${id}`} robots="noindex" />
        <p>Loading product...</p>
      </div>
    );
  }

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
  const discountPercent = product.mrp > 0 ? Math.round(((product.mrp - product.ksp) / product.mrp) * 100) : 0;
  const path = `/product/${product.id}`;
  const gallery = product.images?.length ? product.images : [];
  const activeImage = gallery[activeImageIdx]?.url || product.image;

  const related = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);

  return (
    <div className={styles.page}>
      <Seo
        title={product.name}
        description={product.description || `${product.name} — available on the KUWIFR store.`}
        path={path}
        type="product"
        image={activeImage}
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
        <div>
          <div className={styles.imageWrap}>
            {activeImage ? (
              <img src={activeImage} alt={product.name} className={styles.image} />
            ) : (
              <div className={styles.imagePlaceholder} aria-hidden="true">🛍️</div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className={styles.thumbRow}>
              {gallery.map((img, idx) => (
                <button
                  key={img.publicId || idx}
                  type="button"
                  className={`${styles.thumbBtn} ${idx === activeImageIdx ? styles.thumbBtnActive : ''}`}
                  onClick={() => setActiveImageIdx(idx)}
                  aria-label={`Show photo ${idx + 1}`}
                >
                  <img src={img.url} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.info}>
          <span className={styles.catBadge}>{product.categoryLabel}</span>
          <h1 className={styles.title}>{product.name}</h1>
          {product.description && <p className={styles.description}>{product.description}</p>}

          <div className={styles.priceRow}>
            <span className={styles.ksp}>₹{product.ksp.toLocaleString()}</span>
            {product.mrp > product.ksp && <span className={styles.mrp}>₹{product.mrp.toLocaleString()}</span>}
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
                {p.image ? (
                  <img src={p.image} alt={p.name} className={styles.relatedImage} loading="lazy" />
                ) : (
                  <div className={styles.relatedImagePlaceholder} aria-hidden="true">🛍️</div>
                )}
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
