// client/src/pages/admin/AdminRepurchaseProductsPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminRepurchaseProductsPage.module.css';

const MAX_IMAGES = 4;

const INITIAL_FORM = {
  id: '',
  name: '',
  category: '',
  mrp: '',
  ksp: '',
  kbp: '',
  sortOrder: '0',
  isActive: true
};

const suggestProductId = () => `kfr-p${Date.now().toString().slice(-6)}`;

const AdminRepurchaseProductsPage = () => {
  const { showNotification } = useNotification();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Existing (already-uploaded) images vs newly-selected files pending
  // upload — kept separate so we know which publicIds to send back for
  // removal vs which raw files to attach as new `images` uploads.
  const [existingImages, setExistingImages] = useState([]);
  const [removedImageIds, setRemovedImageIds] = useState([]);
  const [newImageFiles, setNewImageFiles] = useState([]);
  const [newImagePreviews, setNewImagePreviews] = useState([]);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/repurchase/admin/products');
      setProducts(res.data?.data?.products || []);
    } catch (error) {
      showNotification('Unable to fetch the Repurchase Store catalog.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.id?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const remainingSlots = MAX_IMAGES - (existingImages.length - removedImageIds.length + newImageFiles.length);

  const resetForm = () => {
    setEditingProduct(null);
    setFormData(INITIAL_FORM);
    setExistingImages([]);
    setRemovedImageIds([]);
    setNewImageFiles([]);
    setNewImagePreviews([]);
  };

  const handleOpenCreate = () => {
    resetForm();
    setFormData({ ...INITIAL_FORM, id: suggestProductId() });
    setShowModal(true);
  };

  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      id: product.id || '',
      name: product.name || '',
      category: product.category || '',
      mrp: String(product.mrp ?? ''),
      ksp: String(product.ksp ?? ''),
      kbp: String(product.kbp ?? ''),
      sortOrder: String(product.sortOrder ?? 0),
      isActive: product.isActive !== false
    });
    setExistingImages(product.images || []);
    setRemovedImageIds([]);
    setNewImageFiles([]);
    setNewImagePreviews([]);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setShowModal(false);
    resetForm();
  };

  const handleAddImages = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const allowed = files.slice(0, remainingSlots);
    if (files.length > allowed.length) {
      showNotification(`Only ${MAX_IMAGES} images are allowed per product — extra file(s) skipped.`, 'warning');
    }

    setNewImageFiles((prev) => [...prev, ...allowed]);
    setNewImagePreviews((prev) => [...prev, ...allowed.map((f) => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const handleRemoveExistingImage = (publicId) => {
    setRemovedImageIds((prev) => [...prev, publicId]);
  };

  const handleRemoveNewImage = (index) => {
    setNewImageFiles((prev) => prev.filter((_, i) => i !== index));
    setNewImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const buildFormData = () => {
    const fd = new FormData();
    if (!editingProduct) fd.append('id', formData.id.trim());
    fd.append('name', formData.name.trim());
    fd.append('category', formData.category.trim());
    fd.append('mrp', formData.mrp);
    fd.append('ksp', formData.ksp);
    fd.append('kbp', formData.kbp);
    fd.append('sortOrder', formData.sortOrder || '0');
    fd.append('isActive', String(formData.isActive));
    if (removedImageIds.length) fd.append('removeImageIds', JSON.stringify(removedImageIds));
    newImageFiles.forEach((file) => fd.append('images', file));
    return fd;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingProduct && !formData.id.trim()) {
      showNotification('Product ID is required.', 'warning');
      return;
    }
    if (!formData.name.trim() || !formData.category.trim()) {
      showNotification('Product name and category are required.', 'warning');
      return;
    }
    if (!formData.mrp || !formData.ksp || !formData.kbp) {
      showNotification('MRP, KSP, and KBP are all required.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const fd = buildFormData();
      if (editingProduct) {
        await api.put(`/api/repurchase/admin/products/${editingProduct._id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        showNotification('Product updated.', 'success');
      } else {
        await api.post('/api/repurchase/admin/products', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        showNotification('Product added to the Repurchase Store!', 'success');
      }
      setShowModal(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      showNotification(error.response?.data?.message || 'Failed to save product.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (product) => {
    const nextActive = !product.isActive;
    setProducts((prev) => prev.map((p) => (p._id === product._id ? { ...p, isActive: nextActive } : p)));
    try {
      const fd = new FormData();
      fd.append('isActive', String(nextActive));
      await api.put(`/api/repurchase/admin/products/${product._id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    } catch (error) {
      showNotification('Failed to update product status.', 'error');
      fetchProducts();
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${product.name}" from the Repurchase Store? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/repurchase/admin/products/${product._id}`);
      showNotification('Product deleted.', 'success');
      setProducts((prev) => prev.filter((p) => p._id !== product._id));
    } catch (error) {
      showNotification('Failed to delete product.', 'error');
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Repurchase Store Products</h1>
          <p className={styles.subtitle}>
            Manage the Repurchase Store catalog — pricing, KBP, and up to {MAX_IMAGES} original photos per
            product. Changes go live on the Member Repurchase Store instantly.
          </p>
        </div>
        <div className={styles.topActions}>
          <button onClick={fetchProducts} className={styles.refreshBtn}>↻ Refresh</button>
          <button onClick={handleOpenCreate} className={styles.createBtn}>+ Add Product</button>
        </div>
      </header>

      <div className={styles.filterStrip}>
        <input
          type="text"
          placeholder="Search by name, ID, or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading catalog...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No products found.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredProducts.map((product) => (
            <div key={product._id} className={styles.card}>
              <div className={styles.cardImageWrap}>
                <span className={`${styles.statusBadge} ${product.isActive ? styles.statusActive : styles.statusInactive}`}>
                  {product.isActive ? 'Active' : 'Inactive'}
                </span>
                {product.images?.[0] ? (
                  <img src={product.images[0].url} alt={product.name} className={styles.cardImage} />
                ) : (
                  <div className={styles.cardImagePlaceholder}>
                    <span>🖼️</span>
                    <span>No photo yet</span>
                  </div>
                )}
                {product.images?.length > 0 && (
                  <span className={styles.imageCountBadge}>{product.images.length}/{MAX_IMAGES} photos</span>
                )}
              </div>

              <div className={styles.cardBody}>
                <span className={styles.cardCat}>{product.category}</span>
                <h3 className={styles.cardName} title={product.name}>{product.name}</h3>
                <span className={styles.cardIdTag}>{product.id}</span>
                <div className={styles.priceRow}>
                  <span className={styles.ksp}>₹{Number(product.ksp).toLocaleString('en-IN')}</span>
                  <span className={styles.mrp}>₹{Number(product.mrp).toLocaleString('en-IN')}</span>
                </div>
                <span className={styles.kbpBadge}>⭐ {Number(product.kbp).toLocaleString('en-IN')} KBP</span>
              </div>

              <div className={styles.cardActions}>
                <button className={styles.editBtn} onClick={() => handleOpenEdit(product)}>Edit</button>
                <button className={styles.toggleBtn} onClick={() => handleToggleActive(product)}>
                  {product.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button className={styles.deleteBtn} onClick={() => handleDelete(product)} title="Delete">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
                <p className={styles.modalSub}>Updates sync to the Member Repurchase Store immediately.</p>
              </div>
              <button className={styles.closeModalBtn} onClick={handleCloseModal} disabled={isSubmitting}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className={styles.formGrid}>
                <div className={`${styles.formGroup} ${styles.spanFull}`}>
                  <label>Product ID {editingProduct ? '' : '*'}</label>
                  <input
                    type="text"
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    disabled={!!editingProduct}
                    placeholder="e.g. kfr-p31"
                  />
                  {!editingProduct && (
                    <p className={styles.hint}>A unique, permanent ID — cannot be changed after creation.</p>
                  )}
                </div>

                <div className={`${styles.formGroup} ${styles.spanFull}`}>
                  <label>Product Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Instant Magic Hair Color Shampoo"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Category *</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g. Hair Care"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Display Order</label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>MRP (₹) *</label>
                  <input
                    type="number"
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>KSP — Selling Price (₹) *</label>
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
                  <div className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      id="repProdActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <label htmlFor="repProdActive">Active (visible on Member Repurchase Store)</label>
                  </div>
                </div>

                <div className={`${styles.formGroup} ${styles.spanFull}`}>
                  <label>Product Photos ({MAX_IMAGES - remainingSlots}/{MAX_IMAGES})</label>
                  <div className={styles.imageGallery}>
                    {existingImages
                      .filter((img) => !removedImageIds.includes(img.publicId))
                      .map((img) => (
                        <div key={img.publicId} className={styles.imageSlot}>
                          <img src={img.url} alt="Product" />
                          <button
                            type="button"
                            className={styles.imageSlotRemove}
                            onClick={() => handleRemoveExistingImage(img.publicId)}
                            title="Remove photo"
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                    {newImagePreviews.map((src, idx) => (
                      <div key={src} className={styles.imageSlot}>
                        <img src={src} alt="New upload preview" />
                        <span className={styles.imageSlotNew}>New</span>
                        <button
                          type="button"
                          className={styles.imageSlotRemove}
                          onClick={() => handleRemoveNewImage(idx)}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    {remainingSlots > 0 && (
                      <label className={styles.addImageSlot}>
                        <span>+</span>
                        <span>Add Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className={styles.fileInput}
                          onChange={handleAddImages}
                        />
                      </label>
                    )}
                  </div>
                  <p className={styles.hint}>Upload real product photos — JPG/PNG/WebP, up to 3MB each, {MAX_IMAGES} max.</p>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={handleCloseModal} disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRepurchaseProductsPage;
