// client/src/pages/admin/AdminProductsPage.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminProductsPage.module.css';

const STORE_CATEGORIES = [
  'HAIR_CARE',
  'HEALTH_SUPPLEMENT',
  'WATER_PURIFIER',
  'CLOTHING',
  'VEHICLE',
  'ELECTRONICS',
  'OTHER'
];

const CATEGORY_DISPLAY = {
  'HAIR_CARE': 'Hair Care & Serums',
  'HEALTH_SUPPLEMENT': 'Health & Wellness',
  'WATER_PURIFIER': 'Alkaline Water Devices',
  'CLOTHING': 'Designer Sarees & Apparel',
  'VEHICLE': 'Smart EV Mobility',
  'ELECTRONICS': 'Electronics & Hardware',
  'OTHER': 'Accessories & General'
};

const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80';

const INITIAL_FORM = {
  name: '',
  sku: '',
  description: '',
  mrp: '',
  ksp: '',
  kbp: '',
  category: 'HAIR_CARE',
  stock: '25',
  isActive: true,
  image: ''
};

const AdminProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState('');

  const fileInputRef = useRef(null);
  const { showNotification } = useNotification();

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      let res;
      try {
        res = await api.get('/api/admin/products');
      } catch {
        res = await api.get('/api/products');
      }

      const list = res.data?.data?.products || res.data?.products || res.data || [];
      setProducts(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Fetch products error:', error);
      showNotification('Unable to fetch live catalog.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Catalog filtering
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q);
      const matchesCategory =
        categoryFilter === 'ALL' || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, categoryFilter]);

  // Accurate Inventory Valuation Calculation
  const valuationStats = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.isActive).length;
    const lowStock = products.filter((p) => Number(p.stock || 0) < 15).length;
    
    // Total Asset Value = sum of (ksp * stock)
    const totalAssetValuation = products.reduce((acc, p) => {
      const unitPrice = Number(p.ksp || p.price || 0);
      const qty = Number(p.stock || 0);
      return acc + (unitPrice * qty);
    }, 0);

    // Total Inventory Units
    const totalUnits = products.reduce((acc, p) => acc + Number(p.stock || 0), 0);

    return { total, active, lowStock, totalAssetValuation, totalUnits };
  }, [products]);

  // Handle local image file upload & base64 conversion
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      showNotification('Image size should be under 3MB', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      setImagePreview(base64String);
      setFormData((prev) => ({ ...prev, image: base64String }));
      showNotification('Image selected for upload', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleChangeImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleDeleteImage = () => {
    setImagePreview('');
    setFormData((prev) => ({ ...prev, image: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    showNotification('Product image cleared', 'info');
  };

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFormData({
      ...INITIAL_FORM,
      sku: `KWF-${Math.floor(1000 + Math.random() * 9000)}`
    });
    setShowModal(true);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    const resolvedImg = product.image || product.images?.[0] || '';
    setImagePreview(resolvedImg);
    if (fileInputRef.current) fileInputRef.current.value = '';

    setFormData({
      name: product.name || '',
      sku: product.sku || '',
      description: product.description || '',
      mrp: product.mrp !== undefined ? String(product.mrp) : '',
      ksp: (product.ksp || product.price) !== undefined ? String(product.ksp || product.price) : '',
      kbp: product.kbp !== undefined ? String(product.kbp) : '',
      category: product.category || 'HAIR_CARE',
      stock: product.stock !== undefined ? String(product.stock) : '25',
      isActive: product.isActive !== undefined ? product.isActive : true,
      image: resolvedImg
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.ksp) {
      showNotification('Product Name and Selling Price (KSP) are required.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const resolvedImg = formData.image || DEFAULT_FALLBACK_IMAGE;
      const payload = {
        ...formData,
        mrp: parseFloat(formData.mrp || formData.ksp),
        ksp: parseFloat(formData.ksp),
        price: parseFloat(formData.ksp),
        kbp: parseFloat(formData.kbp || 0),
        stock: parseInt(formData.stock || 0, 10),
        isInStock: parseInt(formData.stock || 0, 10) > 0,
        image: resolvedImg,
        images: [resolvedImg] // Sets both fields for UI compatibility
      };

      if (editingProduct) {
        const id = editingProduct._id || editingProduct.id;
        try {
          await api.put(`/api/products/${id}`, payload);
        } catch {
          await api.put(`/api/admin/products/${id}`, payload);
        }

        // Optimistically update table state
        setProducts((prev) =>
          prev.map((p) => ((p._id || p.id) === id ? { ...p, ...payload } : p))
        );
        showNotification('Product and image updated successfully!', 'success');
      } else {
        let created;
        try {
          created = await api.post('/api/products', payload);
        } catch {
          created = await api.post('/api/admin/products', payload);
        }
        showNotification('New product added to inventory!', 'success');
        fetchProducts();
      }

      setShowModal(false);
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to update product.';
      showNotification(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (product) => {
    const id = product._id || product.id;
    const newStatus = !product.isActive;
    try {
      await api.put(`/api/products/${id}`, { isActive: newStatus });
      setProducts((prev) =>
        prev.map((p) => ((p._id || p.id) === id ? { ...p, isActive: newStatus } : p))
      );
      showNotification(`Product marked as ${newStatus ? 'ACTIVE' : 'INACTIVE'}`, 'success');
    } catch (err) {
      showNotification('Failed to toggle status', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/api/products/${id}`);
      showNotification('Product deleted permanently', 'success');
      setProducts((prev) => prev.filter((p) => (p._id || p.id) !== id));
    } catch (error) {
      showNotification('Failed to delete product', 'error');
    }
  };

  return (
    <div className={styles.productsPage}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.statusPill}>
            <span className={styles.pulseDot}></span>
            <span>Cluster Production Database</span>
          </div>
          <h1 className={styles.title}>Product Management</h1>
          <p className={styles.subtitle}>
            Live catalog sync for user storefront, KBP allocation, and warehouse inventory.
          </p>
        </div>

        <div className={styles.topActions}>
          <button onClick={fetchProducts} className={styles.refreshBtn} title="Sync catalog">
            ↻ Refresh Catalog
          </button>
          <button onClick={handleOpenCreate} className={styles.createBtn}>
            + Add Product
          </button>
        </div>
      </div>

      {/* KPI Metrics with Accurate Asset Valuation */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Products</span>
          <strong className={styles.statValue}>{valuationStats.total}</strong>
          <span className={styles.statHelp}>Target: 30 Catalog Items</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Live on Storefront</span>
          <strong className={`${styles.statValue} ${styles.greenText}`}>
            {valuationStats.active}
          </strong>
          <span className={styles.statHelp}>Active for buyers</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Low Stock Alert</span>
          <strong className={`${styles.statValue} ${valuationStats.lowStock > 0 ? styles.amberText : ''}`}>
            {valuationStats.lowStock}
          </strong>
          <span className={styles.statHelp}>Under 15 units remaining</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Asset Valuation</span>
          <strong className={styles.statValue}>
            ₹{valuationStats.totalAssetValuation.toLocaleString('en-IN')}
          </strong>
          <span className={styles.statHelp}>
            {valuationStats.totalUnits.toLocaleString('en-IN')} total units in warehouse
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className={styles.filterStrip}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search by name, SKU, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className={styles.clearSearch}>✕</button>
          )}
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={styles.categoryDropdown}
        >
          <option value="ALL">All Categories ({products.length})</option>
          {STORE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_DISPLAY[cat] || cat}
            </option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Syncing product database...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📦</span>
            <h3>No products found</h3>
            <p>Try searching another keyword or reload.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>SKU</th>
                <th>MRP</th>
                <th>KSP (SELLING)</th>
                <th>KBP POINTS</th>
                <th>STOCK</th>
                <th>STATUS</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const id = product._id || product.id;
                const displayImg = product.image || product.images?.[0] || DEFAULT_FALLBACK_IMAGE;

                return (
                  <tr key={id}>
                    <td>
                      <div className={styles.productCell}>
                        <img
                          src={displayImg}
                          alt={product.name}
                          className={styles.productThumb}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = DEFAULT_FALLBACK_IMAGE;
                          }}
                        />
                        <div className={styles.productMeta}>
                          <span className={styles.productCatBadge}>
                            {CATEGORY_DISPLAY[product.category] || product.category || 'General'}
                          </span>
                          <span className={styles.productTitle}>{product.name}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code className={styles.skuCode}>{product.sku || 'N/A'}</code>
                    </td>
                    <td className={styles.mrpText}>
                      ₹{(product.mrp || product.ksp || 0).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <strong className={styles.kspText}>
                        ₹{(product.ksp || product.price || 0).toLocaleString('en-IN')}
                      </strong>
                    </td>
                    <td>
                      <span className={styles.kbpBadge}>
                        ⭐ {(product.kbp || 0).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`${styles.stockBadge} ${
                          Number(product.stock || 0) < 15 ? styles.stockLow : styles.stockOk
                        }`}
                      >
                        {product.stock || 0} in stock
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(product)}
                        className={`${styles.statusToggle} ${
                          product.isActive ? styles.statusActive : styles.statusInactive
                        }`}
                      >
                        {product.isActive ? '● Active' : '○ Inactive'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className={styles.actionBtns}>
                        <button
                          className={styles.editBtn}
                          onClick={() => handleEdit(product)}
                          title="Edit Product"
                        >
                          Edit
                        </button>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDelete(id)}
                          title="Delete Product"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => !isSubmitting && setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{editingProduct ? 'Edit Store Product' : 'Add New Product'}</h2>
                <p className={styles.modalSub}>
                  Updated prices and stock will immediately synchronize across the user shop.
                </p>
              </div>
              <button
                className={styles.closeModalBtn}
                onClick={() => setShowModal(false)}
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className={styles.formGrid}>
                <div className={`${styles.formGroup} ${styles.spanFull}`}>
                  <label>Product Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g. Instant Magic Hair Colour Shampoo"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>SKU Code *</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    required
                    placeholder="e.g. KWF-HC-001"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {STORE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_DISPLAY[cat] || cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>MRP (Sticker Price ₹) *</label>
                  <input
                    type="number"
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>KSP (Member Selling Price ₹) *</label>
                  <input
                    type="number"
                    value={formData.ksp}
                    onChange={(e) => setFormData({ ...formData, ksp: e.target.value })}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>KBP (Binary Points) *</label>
                  <input
                    type="number"
                    value={formData.kbp}
                    onChange={(e) => setFormData({ ...formData, kbp: e.target.value })}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Warehouse Stock Inventory *</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    required
                  />
                </div>

                {/* Upload Image Section with Change & Delete Image Buttons */}
                <div className={`${styles.formGroup} ${styles.spanFull}`}>
                  <label>Product Image</label>
                  
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className={styles.fileInput}
                    id="productImageUpload"
                  />

                  {!imagePreview ? (
                    <div className={styles.imageUploadWrapper}>
                      <label htmlFor="productImageUpload" className={styles.uploadBtnLabel}>
                        📁 Select Image File from Computer
                      </label>
                      <span className={styles.uploadHelpText}>Supports PNG, JPG, WebP (Max 3MB)</span>
                    </div>
                  ) : (
                    <div className={styles.previewContainer}>
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className={styles.imagePreviewThumb} 
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = DEFAULT_FALLBACK_IMAGE;
                        }}
                      />
                      <div className={styles.previewActions}>
                        <button
                          type="button"
                          onClick={handleChangeImage}
                          className={styles.changeImageBtn}
                        >
                          🔄 Change Image
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteImage}
                          className={styles.deleteImageBtn}
                        >
                          🗑️ Delete Image
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Manual URL Input */}
                  <div style={{ marginTop: '8px' }}>
                    <input
                      type="text"
                      value={formData.image}
                      onChange={(e) => {
                        setFormData({ ...formData, image: e.target.value });
                        setImagePreview(e.target.value);
                      }}
                      placeholder="Or paste Product Image CDN URL directly..."
                      style={{ fontSize: '12px' }}
                    />
                  </div>
                </div>

                <div className={`${styles.formGroup} ${styles.spanFull}`}>
                  <label>Full Description & Ingredients</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="3"
                    placeholder="Enter details on certifications, ingredients, usage..."
                  />
                </div>

                <div className={styles.checkboxRow}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <span>Active (Display product in Public & Member Store)</span>
                  </label>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn} disabled={isSubmitting}>
                  {isSubmitting
                    ? 'Saving to Database...'
                    : editingProduct
                    ? 'Update Product'
                    : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProductsPage;