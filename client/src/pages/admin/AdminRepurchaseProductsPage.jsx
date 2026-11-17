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
  description: '',
  tag: '',
  mrp: '',
  ksp: '',
  kbp: '',
  sortOrder: '0',
  isActive: true,
  // Stock: off = not tracked (unlimited). stockBase = stock when the form
  // opened, so the server applies the edit as a +/- adjustment.
  trackStock: false,
  stock: '0',
  stockBase: '',
  lowStockThreshold: '5'
};

const MAX_STOCK = 1000000;

// 'untracked' | 'out' | 'low' | 'in'
const stockStatus = (stock, threshold = 5) => {
  if (typeof stock !== 'number') return 'untracked';
  if (stock <= 0) return 'out';
  if (stock <= threshold) return 'low';
  return 'in';
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
  // Category field is a dropdown of categories already in use, plus an
  // "Add New Category" option that reveals a free-text input — keeps entry
  // consistent (no near-duplicate categories from typos/casing) while still
  // letting admin introduce a brand-new one whenever needed.
  const [useCustomCategory, setUseCustomCategory] = useState(false);

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

  const existingCategories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const remainingSlots = MAX_IMAGES - (existingImages.length - removedImageIds.length + newImageFiles.length);

  const resetForm = () => {
    setEditingProduct(null);
    setFormData(INITIAL_FORM);
    setExistingImages([]);
    setRemovedImageIds([]);
    setNewImageFiles([]);
    setNewImagePreviews([]);
    setUseCustomCategory(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    setFormData({ ...INITIAL_FORM, id: suggestProductId() });
    setShowModal(true);
  };

  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setUseCustomCategory(false);
    setFormData({
      id: product.id || '',
      name: product.name || '',
      category: product.category || '',
      description: product.description || '',
      tag: product.tag || '',
      mrp: String(product.mrp ?? ''),
      ksp: String(product.ksp ?? ''),
      kbp: String(product.kbp ?? ''),
      sortOrder: String(product.sortOrder ?? 0),
      isActive: product.isActive !== false,
      trackStock: typeof product.stock === 'number',
      stock: String(typeof product.stock === 'number' ? product.stock : 0),
      stockBase: typeof product.stock === 'number' ? String(product.stock) : '',
      lowStockThreshold: String(product.lowStockThreshold ?? 5)
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

  // ---- Stock quantity controls ----
  const clampStock = (n) => Math.min(MAX_STOCK, Math.max(0, Math.round(Number(n) || 0)));

  const adjustStock = (delta) =>
    setFormData((prev) => ({ ...prev, stock: String(clampStock((parseInt(prev.stock, 10) || 0) + delta)) }));

  const handleStockInput = (e) => {
    // Digits only; empty is allowed while typing (validated on save).
    const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 7);
    setFormData((prev) => ({ ...prev, stock: raw === '' ? '' : String(clampStock(raw)) }));
  };

  const handleStockKeyDown = (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); adjustStock(e.shiftKey ? 10 : 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); adjustStock(e.shiftKey ? -10 : -1); }
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
    fd.append('description', formData.description.trim());
    fd.append('tag', formData.tag.trim());
    fd.append('mrp', formData.mrp);
    fd.append('ksp', formData.ksp);
    fd.append('kbp', formData.kbp);
    fd.append('sortOrder', formData.sortOrder || '0');
    fd.append('isActive', String(formData.isActive));
    fd.append('trackStock', String(formData.trackStock));
    if (formData.trackStock) {
      fd.append('stock', String(parseInt(formData.stock, 10) || 0));
      if (editingProduct && formData.stockBase !== '') fd.append('stockBase', formData.stockBase);
    }
    fd.append('lowStockThreshold', String(parseInt(formData.lowStockThreshold, 10) || 0));
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
    if (formData.trackStock) {
      const qty = Number(formData.stock);
      if (formData.stock === '' || !Number.isInteger(qty) || qty < 0 || qty > MAX_STOCK) {
        showNotification('Stock quantity must be a whole number from 0 to 1,000,000.', 'warning');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const fd = buildFormData();
      if (editingProduct) {
        const res = await api.put(`/api/repurchase/admin/products/${editingProduct._id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        showNotification(res.data?.message || 'Product updated.', 'success');
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
          <h1 className={styles.title}>Products</h1>
          <p className={styles.subtitle}>
            The single universal product catalog — pricing, KBP, and up to {MAX_IMAGES} original photos per
            product. Powers both the Member Repurchase Store and the "included product" choices on
            Buy Package / Upgrade Package cards (a package's price is matched to real products of the
            same KSP value). Changes go live everywhere instantly.
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
                <div className={styles.badgeRow}>
                  <span className={styles.kbpBadge}>⭐ {Number(product.kbp).toLocaleString('en-IN')} KBP</span>
                  {(() => {
                    const st = stockStatus(product.stock, product.lowStockThreshold ?? 5);
                    if (st === 'untracked') return <span className={`${styles.stockChip} ${styles.stock_untracked}`}>Stock not tracked</span>;
                    return (
                      <span className={`${styles.stockChip} ${styles[`stock_${st}`]}`}>
                        {st === 'out' ? 'Out of stock' : `${Number(product.stock).toLocaleString('en-IN')} in stock${st === 'low' ? ' · Low' : ''}`}
                      </span>
                    );
                  })()}
                </div>
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
                  <select
                    value={useCustomCategory ? '__new__' : formData.category}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setUseCustomCategory(true);
                        setFormData({ ...formData, category: '' });
                      } else {
                        setUseCustomCategory(false);
                        setFormData({ ...formData, category: e.target.value });
                      }
                    }}
                    required={!useCustomCategory}
                  >
                    <option value="" disabled>Select a category...</option>
                    {existingCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="__new__">+ Add New Category</option>
                  </select>
                  {useCustomCategory && (
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="Type new category name"
                      required
                      style={{ marginTop: '8px' }}
                      autoFocus
                    />
                  )}
                </div>

                <div className={`${styles.formGroup} ${styles.spanFull}`}>
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Real product description — shown on the storefront product card and detail page"
                    rows={3}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Badge / Tag</label>
                  <input
                    type="text"
                    value={formData.tag}
                    onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                    placeholder="e.g. Best Seller (optional)"
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
                  <p className={styles.hint}>
                    Set KSP to a package price (1,500 / 5,000 / 10,000 / 15,000 / 110,000) to also
                    offer this product as an "included product" choice on that Buy Package card.
                  </p>
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

                {/* ---- Stock quantity ---- */}
                {(() => {
                  const qty = parseInt(formData.stock, 10) || 0;
                  const threshold = parseInt(formData.lowStockThreshold, 10) || 0;
                  const status = formData.trackStock ? stockStatus(qty, threshold) : 'untracked';
                  const base = formData.stockBase === '' ? null : Number(formData.stockBase);
                  const change = base === null || formData.stock === '' ? 0 : qty - base;
                  return (
                    <div className={`${styles.formGroup} ${styles.spanFull} ${styles.stockBox}`}>
                      <div className={styles.stockHead}>
                        <div>
                          <span className={styles.stockTitle} id="stockTitle">Stock Quantity</span>
                          <span className={styles.stockSub}>
                            Units available to sell. Deducted automatically when you approve an order.
                          </span>
                        </div>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            role="switch"
                            checked={formData.trackStock}
                            onChange={(e) => setFormData({ ...formData, trackStock: e.target.checked })}
                            aria-describedby="stockTitle"
                          />
                          <span className={styles.switchTrack} aria-hidden="true"><span /></span>
                          <span>Track stock</span>
                        </label>
                      </div>

                      {formData.trackStock ? (
                        <>
                          <div className={styles.stockRow}>
                            <div className={styles.stepper} role="group" aria-labelledby="stockTitle">
                              <button
                                type="button"
                                onClick={() => adjustStock(-1)}
                                disabled={qty <= 0}
                                aria-label="Decrease stock by 1"
                              >
                                −
                              </button>
                              <input
                                id="stockQty"
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                value={formData.stock}
                                onChange={handleStockInput}
                                onKeyDown={handleStockKeyDown}
                                onFocus={(e) => e.target.select()}
                                onBlur={() => formData.stock === '' && setFormData((p) => ({ ...p, stock: '0' }))}
                                aria-label="Stock quantity"
                                aria-describedby="stockHelp"
                              />
                              <button
                                type="button"
                                onClick={() => adjustStock(1)}
                                disabled={qty >= MAX_STOCK}
                                aria-label="Increase stock by 1"
                              >
                                +
                              </button>
                            </div>

                            <div className={styles.quickAdjust} aria-label="Quick adjust">
                              {[-10, 10, 50, 100].map((d) => (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => adjustStock(d)}
                                  disabled={d < 0 ? qty <= 0 : qty >= MAX_STOCK}
                                >
                                  {d > 0 ? `+${d}` : d}
                                </button>
                              ))}
                            </div>

                            <span className={`${styles.stockStatus} ${styles[`stock_${status}`]}`} aria-live="polite">
                              {status === 'out' ? 'Out of stock' : status === 'low' ? 'Low stock' : 'In stock'}
                            </span>
                          </div>

                          <div className={styles.stockFoot}>
                            <span id="stockHelp" className={styles.stockHint}>
                              {editingProduct && base !== null && change !== 0
                                ? `Currently ${base} → will be ${qty} (${change > 0 ? '+' : ''}${change}).`
                                : 'Use − / + or type a number. Arrow keys work too (Shift = ±10).'}
                            </span>
                            <label className={styles.thresholdField}>
                              Low-stock alert at
                              <input
                                type="text"
                                inputMode="numeric"
                                value={formData.lowStockThreshold}
                                onChange={(e) =>
                                  setFormData({ ...formData, lowStockThreshold: e.target.value.replace(/[^\d]/g, '').slice(0, 6) })
                                }
                                aria-label="Low-stock alert threshold"
                              />
                            </label>
                          </div>
                          {status === 'out' && (
                            <p className={styles.stockWarn}>
                              At 0, members will see this product as Out of Stock and can't order it.
                            </p>
                          )}
                        </>
                      ) : (
                        <p className={styles.stockHint}>
                          Not tracked — this product can always be ordered. Turn on “Track stock” to set a quantity.
                        </p>
                      )}
                    </div>
                  );
                })()}

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
