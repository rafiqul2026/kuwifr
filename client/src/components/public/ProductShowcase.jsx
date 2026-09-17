// client/src/components/public/ProductShowcase.jsx
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import './ProductShowcase.css';
import { useShop } from '../../context/ShopContext';
import ProductModal from './ProductModal';
import OrderTrackingModal from './OrderTrackingModal';

// `showHeader` defaults to true (ShopPage, where this is the page's own
// primary heading). HomePage passes false: it already renders its own
// "Featured Products" section heading immediately above this component, so
// the two headings back-to-back were pure duplication — same message
// twice, plus the extra heading's own margin/padding compounded into a
// large empty gap on mobile between the two (see the mobile screenshot
// this was reported from).
const ProductShowcase = ({ showHeader = true }) => {
  const {
    activeCategoryFilter,
    setActiveCategoryFilter,
    addToCart,
    toggleWishlist,
    wishlist,
    products,
    productsLoading,
    categories
  } = useShop();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showTracker, setShowTracker] = useState(false);

  // Category tabs derived from the real catalog's actual categories —
  // replaces a hardcoded 5-category list (HEALTH_SUPPLEMENT,
  // WATER_PURIFIER, etc.) that no longer matches this catalog's real,
  // free-text category names, so a tab never silently filters to zero
  // results.
  const categoryTabs = useMemo(
    () => [{ id: 'ALL', label: 'All Products' }, ...categories.map((c) => ({ id: c, label: c }))],
    [categories]
  );

  const filteredProducts = products.filter((product) => {
    const matchesCategory = activeCategoryFilter === 'ALL' || product.category === activeCategoryFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      product.name.toLowerCase().includes(q) || (product.description || '').toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <section className="kuwifr-store-section" id="products">
      <div className="kuwifr-store-container">
        {/* Header */}
        <div className="kuwifr-store-header" style={!showHeader ? { justifyContent: 'flex-end' } : undefined}>
          {showHeader && (
            <div>
              <span className="kuwifr-badge-pill">Official Online Store</span>
              <h2 className="kuwifr-store-title">Explore Our Catalog</h2>
              <p className="kuwifr-store-subtitle">Handpicked premium wellness, lifestyle, and clean tech essentials.</p>
            </div>
          )}
          <button className="kuwifr-track-btn" onClick={() => setShowTracker(true)}>
            📦 Track Order
          </button>
        </div>

        {/* Controls */}
        <div className="kuwifr-controls-bar">
          <div className="kuwifr-category-tabs">
            {categoryTabs.map((cat) => (
              <button
                key={cat.id}
                className={`kuwifr-tab-btn ${activeCategoryFilter === cat.id ? 'kuwifr-tab-active' : ''}`}
                onClick={() => setActiveCategoryFilter(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="kuwifr-search-wrapper">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="kuwifr-search-input"
            />
            {searchQuery && (
              <button className="kuwifr-clear-search" onClick={() => setSearchQuery('')}>
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {productsLoading ? (
          <div className="kuwifr-empty-state">
            <span>⏳</span>
            <h3>Loading products...</h3>
          </div>
        ) : (
          <>
            {/* Product Grid */}
            <div className="kuwifr-products-grid">
              {filteredProducts.map((product) => {
                const isWishlisted = wishlist?.some((w) => w.id === product.id);
                const discountPercent =
                  product.mrp > 0 ? Math.round(((product.mrp - product.ksp) / product.mrp) * 100) : 0;

                return (
                  <div key={product.id} className="kuwifr-product-card">
                    <div className="kuwifr-card-img-wrap">
                      {product.tag && <span className="kuwifr-card-tag">{product.tag}</span>}
                      <button
                        className={`kuwifr-card-wishlist ${isWishlisted ? 'kuwifr-wishlist-active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWishlist(product);
                        }}
                        title="Save to wishlist"
                        aria-label="Wishlist"
                      >
                        {isWishlisted ? '♥' : '♡'}
                      </button>

                      <Link to={`/product/${product.id}`} aria-label={product.name}>
                        {product.image ? (
                          <img src={product.image} alt={product.name} loading="lazy" />
                        ) : (
                          <div className="kuwifr-card-img-placeholder" aria-hidden="true">
                            🛍️
                          </div>
                        )}
                      </Link>

                      <button className="kuwifr-quickview-btn" onClick={() => setSelectedProduct(product)}>
                        Quick View
                      </button>
                    </div>

                    <div className="kuwifr-card-info">
                      <span className="kuwifr-card-cat">{product.categoryLabel}</span>
                      <h3 className="kuwifr-card-name">
                        <Link to={`/product/${product.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {product.name}
                        </Link>
                      </h3>
                      {product.description && <p className="kuwifr-card-desc">{product.description}</p>}

                      <div className="kuwifr-price-row">
                        <div className="kuwifr-prices">
                          <span className="kuwifr-price-current">₹{product.ksp.toLocaleString()}</span>
                          {product.mrp > product.ksp && (
                            <span className="kuwifr-price-mrp">₹{product.mrp.toLocaleString()}</span>
                          )}
                        </div>
                        {discountPercent > 0 && <span className="kuwifr-discount-badge">{discountPercent}% OFF</span>}
                      </div>

                      <div className="kuwifr-card-actions">
                        <button className="kuwifr-btn-buy" onClick={() => setSelectedProduct(product)}>
                          Buy Now
                        </button>
                        <button className="kuwifr-btn-cart" onClick={() => addToCart(product)}>
                          Add to Bag
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty States */}
            {filteredProducts.length === 0 && products.length > 0 && (
              <div className="kuwifr-empty-state">
                <span>🔍</span>
                <h3>No products found</h3>
                <p>We couldn't find any items matching "{searchQuery}".</p>
                <button className="kuwifr-reset-btn" onClick={() => { setActiveCategoryFilter('ALL'); setSearchQuery(''); }}>
                  View All Products
                </button>
              </div>
            )}
            {products.length === 0 && (
              <div className="kuwifr-empty-state">
                <span>📦</span>
                <h3>No products available yet</h3>
                <p>Please check back soon.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Popups & Modals */}
      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}

      {showTracker && (
        <OrderTrackingModal onClose={() => setShowTracker(false)} />
      )}
    </section>
  );
};

export default ProductShowcase;
