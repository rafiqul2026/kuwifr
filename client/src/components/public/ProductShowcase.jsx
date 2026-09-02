// client/src/components/public/ProductShowcase.jsx
import React, { useState } from 'react';
import './ProductShowcase.css';
import { KUWIFR_PRODUCTS } from '../../constants/productsData';
import { useShop } from '../../context/ShopContext';
import ProductModal from './ProductModal';
import OrderTrackingModal from './OrderTrackingModal';

const CATEGORIES = [
  { id: 'ALL', label: 'All Products' },
  { id: 'HEALTH_SUPPLEMENT', label: 'Health & Wellness' },
  { id: 'WATER_PURIFIER', label: 'Alkaline Tech' },
  { id: 'CLOTHING', label: 'Fashion & Apparel' },
  { id: 'HAIR_CARE', label: 'Personal Care' },
  { id: 'VEHICLE', label: 'EV Mobility' },
];

const ProductShowcase = () => {
  const { activeCategoryFilter, setActiveCategoryFilter, addToCart, toggleWishlist, wishlist } = useShop();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showTracker, setShowTracker] = useState(false);

  const filteredProducts = KUWIFR_PRODUCTS.filter((product) => {
    const matchesCategory = activeCategoryFilter === 'ALL' || product.category === activeCategoryFilter;
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <section className="kuwifr-store-section" id="products">
      <div className="kuwifr-store-container">
        {/* Header */}
        <div className="kuwifr-store-header">
          <div>
            <span className="kuwifr-badge-pill">Official Online Store</span>
            <h2 className="kuwifr-store-title">Explore Our Catalog</h2>
            <p className="kuwifr-store-subtitle">Handpicked premium wellness, lifestyle, and clean tech essentials.</p>
          </div>
          <button className="kuwifr-track-btn" onClick={() => setShowTracker(true)}>
            📦 Track Order
          </button>
        </div>

        {/* Controls */}
        <div className="kuwifr-controls-bar">
          <div className="kuwifr-category-tabs">
            {CATEGORIES.map((cat) => (
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

        {/* Product Grid */}
        <div className="kuwifr-products-grid">
          {filteredProducts.map((product) => {
            const isWishlisted = wishlist?.some((w) => w.id === product.id);
            const discountPercent = Math.round(((product.mrp - product.ksp) / product.mrp) * 100);

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

                  <img src={product.image} alt={product.name} loading="lazy" />

                  <button className="kuwifr-quickview-btn" onClick={() => setSelectedProduct(product)}>
                    Quick View
                  </button>
                </div>

                <div className="kuwifr-card-info">
                  <span className="kuwifr-card-cat">{product.categoryLabel}</span>
                  <h3 className="kuwifr-card-name">{product.name}</h3>
                  <p className="kuwifr-card-desc">{product.description}</p>

                  <div className="kuwifr-price-row">
                    <div className="kuwifr-prices">
                      <span className="kuwifr-price-current">₹{product.ksp.toLocaleString()}</span>
                      <span className="kuwifr-price-mrp">₹{product.mrp.toLocaleString()}</span>
                    </div>
                    <span className="kuwifr-discount-badge">{discountPercent}% OFF</span>
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

        {/* Empty State */}
        {filteredProducts.length === 0 && (
          <div className="kuwifr-empty-state">
            <span>🔍</span>
            <h3>No products found</h3>
            <p>We couldn't find any items matching "{searchQuery}".</p>
            <button className="kuwifr-reset-btn" onClick={() => { setActiveCategoryFilter('ALL'); setSearchQuery(''); }}>
              View All Products
            </button>
          </div>
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