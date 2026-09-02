import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import styles from './ProductsPage.module.css';

const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [categories, setCategories] = useState(['ALL']);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/products');
      if (response.data.success) {
        setProducts(response.data.data.products || []);
        // Extract unique categories
        const uniqueCategories = ['ALL', ...new Set(response.data.data.products.map(p => p.category).filter(Boolean))];
        setCategories(uniqueCategories);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      setError('Failed to load products. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = selectedCategory === 'ALL'
    ? products
    : products.filter(p => p.category === selectedCategory);

  const handleProductClick = (productId) => {
    navigate(`/products/${productId}`);
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading products...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <span>⚠️</span>
        <p>{error}</p>
        <button onClick={fetchProducts} className={styles.retryBtn}>Retry</button>
      </div>
    );
  }

  return (
    <div className={styles.productsPage}>
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>Our Products</h1>
        <p className={styles.pageSubtitle}>
          Discover our range of quality products designed to enhance your lifestyle.
        </p>

        <div className={styles.categoryFilter}>
          {categories.map((category) => (
            <button
              key={category}
              className={`${styles.categoryBtn} ${selectedCategory === category ? styles.active : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className={styles.productsGrid}>
          {filteredProducts.length === 0 ? (
            <div className={styles.noProducts}>
              <span>📦</span>
              <p>No products found in this category.</p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <div key={product._id} className={styles.productCard} onClick={() => handleProductClick(product._id)}>
                <div className={styles.productImage}>
                  {product.images && product.images.length > 0 ? (
                    <img src={product.images[0].url} alt={product.name} />
                  ) : (
                    <div className={styles.imagePlaceholder}>📦</div>
                  )}
                  {product.isFeatured && (
                    <span className={styles.featuredBadge}>Featured</span>
                  )}
                </div>
                <div className={styles.productInfo}>
                  <h3 className={styles.productName}>{product.name}</h3>
                  <p className={styles.productDescription}>{product.shortDescription || product.description?.substring(0, 100)}</p>
                  <div className={styles.productDetails}>
                    <span className={styles.productPrice}>₹{product.ksp || product.mrp}</span>
                    <span className={styles.productKBP}>KBP: {product.kbp}</span>
                  </div>
                  <button className={styles.viewDetailsBtn}>View Details</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;