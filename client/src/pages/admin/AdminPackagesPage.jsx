// client/src/pages/admin/AdminPackagesPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminPackagesPage.module.css';
import { getPackageOptions } from '../member/packageProductCatalog';

const MAX_QTY = 99; // matches server/src/utils/packageOptions.js

const AdminPackagesPage = () => {
  const { showNotification } = useNotification();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // ---- "Products" modal: choose which catalog products members can pick
  // with a package (PUT /api/packages/:id/products). ----
  const [productsPkg, setProductsPkg] = useState(null); // package being edited
  const [catalog, setCatalog] = useState([]); // all Repurchase Store products
  const [catalogLoading, setCatalogLoading] = useState(false);
  // Working list of choices. Each is a single product or a product group:
  // { uid, key?, kind: 'PRODUCT'|'GROUP', name, items: [{ productId, quantity }] }
  const [options, setOptions] = useState([]);
  const [addTarget, setAddTarget] = useState(null); // null = add as single product, else a group's uid
  const [productSearch, setProductSearch] = useState('');
  const [savingProducts, setSavingProducts] = useState(false);

  const newUid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const clampQty = (n) => Math.min(MAX_QTY, Math.max(1, Math.round(Number(n) || 1)));

  const openProductsModal = async (pkg) => {
    setProductsPkg(pkg);
    setProductSearch('');
    setAddTarget(null);
    setCatalogLoading(true);
    try {
      const res = await api.get('/api/repurchase/admin/products');
      const products = res.data?.data?.products || [];
      setCatalog(products);
      // Start from the admin's saved choices; if none were ever set, show
      // the automatic default (active products priced at this package's
      // KSP) so they can see and tweak what members currently get.
      const saved = getPackageOptions(pkg);
      setOptions(
        saved
          ? saved.map((o) => ({ ...o, price: typeof o.price === 'number' ? String(o.price) : '', uid: newUid() }))
          : products
              .filter((p) => p.isActive !== false && Number(p.ksp) === Number(pkg.price))
              .map((p) => ({ uid: newUid(), kind: 'PRODUCT', name: '', items: [{ productId: p.id, quantity: 1 }] }))
      );
    } catch (err) {
      showNotification('Could not load the product catalog.', 'error');
      setProductsPkg(null);
    } finally {
      setCatalogLoading(false);
    }
  };

  const updateOption = (uid, fn) => setOptions((prev) => prev.map((o) => (o.uid === uid ? fn(o) : o)));

  const setItemQty = (uid, productId, qty) =>
    updateOption(uid, (o) => ({
      ...o,
      items: o.items.map((i) => (i.productId === productId ? { ...i, quantity: clampQty(qty) } : i))
    }));

  const removeOption = (uid) => {
    setOptions((prev) => prev.filter((o) => o.uid !== uid));
    if (addTarget === uid) setAddTarget(null);
  };

  const removeGroupItem = (uid, productId) =>
    updateOption(uid, (o) => ({ ...o, items: o.items.filter((i) => i.productId !== productId) }));

  const addProduct = (productId) => {
    if (addTarget) {
      updateOption(addTarget, (o) => (o.items.some((i) => i.productId === productId)
        ? o
        : { ...o, items: [...o.items, { productId, quantity: 1 }] }));
    } else {
      setOptions((prev) => [...prev, { uid: newUid(), kind: 'PRODUCT', name: '', items: [{ productId, quantity: 1 }] }]);
    }
  };

  const addGroup = () => {
    const uid = newUid();
    const groupCount = options.filter((o) => o.kind === 'GROUP').length;
    setOptions((prev) => [...prev, { uid, kind: 'GROUP', name: `Combo ${groupCount + 1}`, price: '', items: [] }]);
    setAddTarget(uid);
    setProductSearch('');
  };

  // Up / down arrows: the order here is the order members see.
  const moveOption = (uid, dir) =>
    setOptions((prev) => {
      const i = prev.findIndex((o) => o.uid === uid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const saveProducts = async ({ reset = false } = {}) => {
    if (!productsPkg) return;
    if (!reset) {
      const badGroup = options.find((o) => o.kind === 'GROUP' && o.items.length < 2);
      if (badGroup) {
        showNotification(`"${badGroup.name || 'Product group'}" needs at least 2 products. Add more or remove the group.`, 'warning');
        setAddTarget(badGroup.uid);
        return;
      }
      const badPrice = options.find(
        (o) => o.kind === 'GROUP' && o.price !== '' && o.price !== undefined && !(Number.isInteger(Number(o.price)) && Number(o.price) >= 1)
      );
      if (badPrice) {
        showNotification(`Combo price for "${badPrice.name || 'Product group'}" must be a whole number of rupees (1 or more), or left empty.`, 'warning');
        return;
      }
    }
    setSavingProducts(true);
    try {
      const res = await api.put(
        `/api/packages/${productsPkg._id}/products`,
        reset
          ? { reset: true }
          : {
              options: options.map((o) => ({
                kind: o.kind,
                ...(o.kind === 'GROUP'
                  ? { name: o.name.trim(), key: o.key, price: o.price === '' || o.price === undefined ? null : Number(o.price) }
                  : {}),
                items: o.items.map((i) => ({ productId: i.productId, quantity: clampQty(i.quantity) }))
              }))
            }
      );
      showNotification(res.data?.message || 'Package products updated.', 'success');
      setProductsPkg(null);
      fetchPackages();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to update package products.', 'error');
    } finally {
      setSavingProducts(false);
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    type: '',
    price: '',
    kbp: '',
    dailyCap: '',
    directBonus: '',
    weeklyCap: '',
    monthlyCap: '',
    description: '',
    isActive: true,
    isPopular: false
  });

  const fetchPackages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let response;
      try {
        response = await api.get('/api/admin/packages/admin/all');
      } catch (err) {
        try {
          response = await api.get('/api/admin/packages');
        } catch (e2) {
          response = await api.get('/api/packages');
        }
      }

      const resData = response.data?.data || response.data || {};
      const list = resData.packages || (Array.isArray(resData) ? resData : []);
      setPackages(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load packages:', err);
      setError('Unable to fetch packages. Please check API connectivity.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const handleOpenModal = (pkg = null) => {
    if (pkg) {
      setEditingPkg(pkg);
      setFormData({
        name: pkg.name || '',
        type: pkg.type || '',
        price: pkg.price ?? '',
        kbp: pkg.kbp ?? '',
        dailyCap: pkg.dailyCap ?? '',
        directBonus: pkg.directBonus ?? '',
        weeklyCap: pkg.weeklyCap ?? '',
        monthlyCap: pkg.monthlyCap ?? '',
        description: pkg.description || '',
        isActive: pkg.isActive !== undefined ? pkg.isActive : true,
        isPopular: Boolean(pkg.isPopular)
      });
    } else {
      setEditingPkg(null);
      setFormData({
        name: '',
        type: '',
        price: '',
        kbp: '',
        dailyCap: '',
        directBonus: '',
        weeklyCap: '',
        monthlyCap: '',
        description: '',
        isActive: true,
        isPopular: false
      });
    }
    setModalOpen(true);
  };

  const handleToggleStatus = async (pkgId) => {
    try {
      let res;
      try {
        res = await api.put(`/api/admin/packages/${pkgId}/toggle`);
      } catch (e) {
        res = await api.put(`/api/packages/${pkgId}/toggle`);
      }

      if (res.data?.success) {
        setPackages((prev) =>
          prev.map((p) => (p._id === pkgId ? { ...p, isActive: !p.isActive } : p))
        );
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to toggle package status', 'error');
    }
  };

  const handleDelete = async (pkgId) => {
    if (!window.confirm('Are you sure you want to delete this package?')) return;
    try {
      let res;
      try {
        res = await api.delete(`/api/admin/packages/${pkgId}`);
      } catch (e) {
        res = await api.delete(`/api/packages/${pkgId}`);
      }

      if (res.data?.success) {
        setPackages((prev) => prev.filter((p) => p._id !== pkgId));
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to delete package', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      // One request (/api/packages and /api/admin/packages are the same
      // router). It used to retry on the other URL after ANY error — a real
      // validation error was simply re-submitted — and showed "success"
      // even when the server didn't confirm it.
      const res = editingPkg
        ? await api.put(`/api/packages/${editingPkg._id}`, formData)
        : await api.post('/api/packages', formData);

      if (!res.data?.success) {
        showNotification(res.data?.message || 'Failed to save package settings', 'error');
        return;
      }
      fetchPackages();
      setModalOpen(false);
      showNotification(res.data.message || (editingPkg ? 'Package updated successfully' : 'Package created successfully'), 'success');
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to save package settings', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.breadcrumb}>ADMINISTRATION / PLAN ARCHITECTURE</div>
          <h1 className={styles.pageTitle}>Package Management</h1>
          <p className={styles.pageSubtitle}>
            Configure distributor activation tiers, KBP volume points, binary caps, and direct sponsor referral bonuses.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button onClick={fetchPackages} className={styles.syncBtn}>
            🔄 Refresh
          </button>
          <button onClick={() => handleOpenModal()} className={styles.createBtn}>
            + Create Package
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.errorBox}>
          <span>⚠️ {error}</span>
          <button onClick={fetchPackages} className={styles.retryBtn}>
            Retry Connection
          </button>
        </div>
      )}

      {/* Main Card */}
      <div className={styles.card}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Loading package specifications from database...</p>
          </div>
        ) : packages.length === 0 ? (
          <div className={styles.emptyState}>
            <span style={{ fontSize: '42px' }}>📦</span>
            <h3>No Packages Configured</h3>
            <p>Click "Create Package" above to launch your first distributor plan.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Package Plan</th>
                    <th>Plan Type</th>
                    <th>Price</th>
                    <th>KBP Points</th>
                    <th>Daily Binary Cap</th>
                    <th>Direct Bonus</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map((pkg) => (
                    <tr key={pkg._id} className={styles.tableRow}>
                      <td>
                        <div className={styles.pkgTitleBlock}>
                          <div className={styles.pkgIcon}>📦</div>
                          <div>
                            <div className={styles.pkgName}>
                              {pkg.name}
                              {pkg.isPopular && <span className={styles.popularBadge}>POPULAR</span>}
                            </div>
                            <small className={styles.pkgDesc}>
                              {pkg.description || 'Standard distributor entry plan'}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={styles.typeBadge}>{pkg.type || 'STARTER'}</span>
                      </td>
                      <td className={styles.priceCell}>₹{(pkg.price || 0).toLocaleString()}</td>
                      <td className={styles.kbpCell}>{(pkg.kbp || 0).toLocaleString()} KBP</td>
                      <td className={styles.cappingCell}>₹{(pkg.dailyCap || 0).toLocaleString()} / day</td>
                      <td className={styles.bonusCell}>₹{(pkg.directBonus || 0).toLocaleString()}</td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            pkg.isActive ? styles.badgeActive : styles.badgeInactive
                          }`}
                        >
                          {pkg.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className={styles.actionGroup}>
                          <button onClick={() => handleOpenModal(pkg)} className={styles.editBtn}>
                            Edit
                          </button>
                          <button onClick={() => openProductsModal(pkg)} className={styles.editBtn}>
                            Products
                          </button>
                          <button
                            onClick={() => handleToggleStatus(pkg._id)}
                            className={pkg.isActive ? styles.btnDeactivate : styles.btnActivate}
                          >
                            {pkg.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button onClick={() => handleDelete(pkg._id)} className={styles.deleteBtn}>
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Stack View (No slider, fits 100% width) */}
            <div className={styles.mobileCardStack}>
              {packages.map((pkg) => (
                <div key={pkg._id} className={styles.mobileCard}>
                  <div className={styles.mobileCardTop}>
                    <div>
                      <div className={styles.pkgName}>
                        {pkg.name}
                        {pkg.isPopular && <span className={styles.popularBadge}>POPULAR</span>}
                      </div>
                      <span className={styles.typeBadge}>{pkg.type}</span>
                    </div>
                    <span
                      className={`${styles.badge} ${
                        pkg.isActive ? styles.badgeActive : styles.badgeInactive
                      }`}
                    >
                      {pkg.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>

                  <div className={styles.mobileDetailsGrid}>
                    <div>
                      <small className={styles.mobileLabel}>Joining Price</small>
                      <div className={styles.priceCell}>₹{(pkg.price || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <small className={styles.mobileLabel}>Volume Points</small>
                      <div className={styles.kbpCell}>{pkg.kbp} KBP</div>
                    </div>
                    <div>
                      <small className={styles.mobileLabel}>Daily Capping</small>
                      <div className={styles.cappingCell}>₹{(pkg.dailyCap || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <small className={styles.mobileLabel}>Direct Bonus</small>
                      <div className={styles.bonusCell}>₹{(pkg.directBonus || 0).toLocaleString()}</div>
                    </div>
                  </div>

                  <div className={styles.mobileActions}>
                    <button
                      onClick={() => handleOpenModal(pkg)}
                      className={styles.editBtn}
                      style={{ flex: 1 }}
                    >
                      Edit Plan
                    </button>
                    <button
                      onClick={() => openProductsModal(pkg)}
                      className={styles.editBtn}
                      style={{ flex: 1 }}
                    >
                      Products
                    </button>
                    <button
                      onClick={() => handleToggleStatus(pkg._id)}
                      className={pkg.isActive ? styles.btnDeactivate : styles.btnActivate}
                      style={{ flex: 1 }}
                    >
                      {pkg.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Package Form Modal */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{editingPkg ? 'Edit Package Plan' : 'Create New Package'}</h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Define pricing, binary volumes, caps, and referral bonuses.
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className={styles.closeBtn}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.modalForm}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Package Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Life Safe Elite"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Package Type Code</label>
                    <input
                      type="text"
                      placeholder="e.g. LIFE_SAFE_ELITE"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value.toUpperCase() })}
                      className={styles.input}
                    />
                    <small className={styles.fieldHint}>
                      Optional — letters, numbers and _ only. Left empty, it&apos;s made from the name.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Price (₹) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="15000"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>KBP Points *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="10000"
                      value={formData.kbp}
                      onChange={(e) => setFormData({ ...formData, kbp: e.target.value })}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Daily Binary Cap (₹)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="20000"
                      value={formData.dailyCap}
                      onChange={(e) => setFormData({ ...formData, dailyCap: e.target.value })}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Direct Sponsor Bonus (₹)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="1800"
                      value={formData.directBonus}
                      onChange={(e) => setFormData({ ...formData, directBonus: e.target.value })}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Weekly Cap (₹)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="140000"
                      value={formData.weeklyCap}
                      onChange={(e) => setFormData({ ...formData, weeklyCap: e.target.value })}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Monthly Cap (₹)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="600000"
                      value={formData.monthlyCap}
                      onChange={(e) => setFormData({ ...formData, monthlyCap: e.target.value })}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Status</label>
                    <select
                      value={formData.isActive ? 'true' : 'false'}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}
                      className={styles.input}
                    >
                      <option value="true">Active (Visible)</option>
                      <option value="false">Inactive (Hidden)</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Display Badge</label>
                    <select
                      value={formData.isPopular ? 'true' : 'false'}
                      onChange={(e) => setFormData({ ...formData, isPopular: e.target.value === 'true' })}
                      className={styles.input}
                    >
                      <option value="false">Standard Tier</option>
                      <option value="true">Mark as Popular</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginTop: '12px' }}>
                  <label>Entitlements & Plan Description</label>
                  <textarea
                    rows="3"
                    placeholder="Describe included products, warranties, or kit benefits..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className={styles.textarea}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className={styles.saveBtn}>
                  {submitting ? 'Saving...' : editingPkg ? 'Update Package' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Products modal — choose what members can pick when buying /
          upgrading to this package: single products (with a quantity) and
          product groups (several products, each with a quantity, picked
          as one choice). */}
      {productsPkg && (() => {
        const byId = new Map(catalog.map((p) => [p.id, p]));
        const lookup = (id) => byId.get(id) || { id, name: id, missing: true };
        const target = addTarget ? options.find((o) => o.uid === addTarget) : null;
        const takenIds = new Set(
          target
            ? target.items.map((i) => i.productId)
            : options.filter((o) => o.kind === 'PRODUCT').map((o) => o.items[0]?.productId)
        );
        const q = productSearch.trim().toLowerCase();
        const available = catalog.filter(
          (p) =>
            !takenIds.has(p.id) &&
            (!q || [p.name, p.id, p.category].some((v) => String(v || '').toLowerCase().includes(q)))
        );
        const isCustom = Array.isArray(productsPkg.productOptions) || Array.isArray(productsPkg.includedProductIds);
        const singlesCount = options.filter((o) => o.kind === 'PRODUCT').length;
        const groupsCount = options.length - singlesCount;
        const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

        const thumb = (p) => (p.images?.[0]?.url
          ? <img src={p.images[0].url} alt="" className={styles.prodThumb} />
          : <div className={styles.prodThumb}>📦</div>);

        const stepper = (uid, item, label) => (
          <div className={styles.qtyStepper} role="group" aria-label={`Quantity of ${label}`}>
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={item.quantity <= 1}
              onClick={() => setItemQty(uid, item.productId, item.quantity - 1)}
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_QTY}
              value={item.quantity}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setItemQty(uid, item.productId, e.target.value)}
              aria-label="Quantity"
            />
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={item.quantity >= MAX_QTY}
              onClick={() => setItemQty(uid, item.productId, item.quantity + 1)}
            >
              +
            </button>
          </div>
        );

        const orderButtons = (uid, idx) => (
          <div className={styles.orderBtns}>
            <button type="button" aria-label="Move up" disabled={idx === 0} onClick={() => moveOption(uid, -1)}>▲</button>
            <button type="button" aria-label="Move down" disabled={idx === options.length - 1} onClick={() => moveOption(uid, 1)}>▼</button>
          </div>
        );

        return (
          <div className={styles.modalOverlay} onClick={() => !savingProducts && setProductsPkg(null)}>
            <div className={styles.modalContent} style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div>
                  <h2>Products in {productsPkg.name}</h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    Members choose one of these when they buy or upgrade to this package. A product group counts as one choice.{' '}
                    {isCustom
                      ? 'Currently a custom list.'
                      : `Currently automatic (products priced at ${inr(productsPkg.price)}).`}
                  </p>
                </div>
                <button onClick={() => setProductsPkg(null)} className={styles.closeBtn}>✕</button>
              </div>

              <div className={styles.modalBody}>
                {catalogLoading ? (
                  <p>Loading products...</p>
                ) : (
                  <>
                    <div className={styles.prodSectionHead}>
                      <h3 className={styles.prodSectionTitle}>
                        Included in this package ({singlesCount} product{singlesCount === 1 ? '' : 's'}
                        {groupsCount ? `, ${groupsCount} group${groupsCount === 1 ? '' : 's'}` : ''})
                      </h3>
                      <button type="button" className={styles.prodGroupNewBtn} onClick={addGroup}>
                        + New product group
                      </button>
                    </div>

                    {options.length === 0 ? (
                      <div className={styles.prodEmpty}>
                        No products — members won't be able to buy this package until you add at least one product or group.
                      </div>
                    ) : (
                      <div className={`${styles.prodList} ${styles.prodListTall}`}>
                        {options.map((o, idx) => {
                          if (o.kind === 'PRODUCT') {
                            const item = o.items[0];
                            const p = lookup(item.productId);
                            return (
                              <div key={o.uid} className={`${styles.prodRow} ${styles.prodRowWrap}`}>
                                {orderButtons(o.uid, idx)}
                                {thumb(p)}
                                <div className={styles.prodInfo}>
                                  <strong>{p.name}</strong>
                                  <small>
                                    {p.missing ? 'No longer in the catalog' : `${p.category} · KSP ${inr(p.ksp)}`}
                                    {!p.missing && item.quantity > 1 ? ` · total ${inr(p.ksp * item.quantity)}` : ''}
                                    {p.isActive === false ? ' · inactive (hidden from members)' : ''}
                                  </small>
                                </div>
                                <div className={styles.prodRowActions}>
                                  {stepper(o.uid, item, p.name)}
                                  <button type="button" className={styles.prodRemoveBtn} onClick={() => removeOption(o.uid)}>
                                    Remove
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          const total = o.items.reduce((s, i) => s + Number(lookup(i.productId).ksp || 0) * i.quantity, 0);
                          const units = o.items.reduce((s, i) => s + i.quantity, 0);
                          const isTarget = addTarget === o.uid;
                          return (
                            <div key={o.uid} className={`${styles.groupCard} ${isTarget ? styles.groupCardActive : ''}`}>
                              <div className={styles.groupHead}>
                                {orderButtons(o.uid, idx)}
                                <span className={styles.groupBadge}>Group</span>
                                <input
                                  type="text"
                                  className={styles.groupNameInput}
                                  value={o.name}
                                  maxLength={80}
                                  placeholder="Group name, e.g. Hair Care Combo"
                                  onChange={(e) => updateOption(o.uid, (g) => ({ ...g, name: e.target.value }))}
                                  aria-label="Product group name"
                                />
                                <button type="button" className={styles.prodRemoveBtn} onClick={() => removeOption(o.uid)}>
                                  Remove group
                                </button>
                              </div>

                              {o.items.length === 0 ? (
                                <div className={styles.groupHint}>Add at least 2 products to this group from the list below.</div>
                              ) : (
                                <div className={styles.groupItems}>
                                  {o.items.map((item) => {
                                    const p = lookup(item.productId);
                                    return (
                                      <div key={item.productId} className={`${styles.groupItem} ${styles.prodRowWrap}`}>
                                        {thumb(p)}
                                        <div className={styles.prodInfo}>
                                          <strong>{p.name}</strong>
                                          <small>
                                            {p.missing ? 'No longer in the catalog' : `KSP ${inr(p.ksp)}`}
                                            {p.isActive === false ? ' · inactive' : ''}
                                          </small>
                                        </div>
                                        <div className={styles.prodRowActions}>
                                          {stepper(o.uid, item, p.name)}
                                          <button
                                            type="button"
                                            className={styles.groupItemRemove}
                                            aria-label={`Remove ${p.name} from group`}
                                            onClick={() => removeGroupItem(o.uid, item.productId)}
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Optional combo price — what members see for this group
                                  instead of the products' total KSP. */}
                              {(() => {
                                const priceNum = o.price === '' || o.price === undefined ? null : Number(o.price);
                                const priceId = `combo-price-${o.uid}`;
                                const saving = priceNum !== null ? total - priceNum : 0;
                                return (
                                  <div className={styles.comboPriceRow}>
                                    <label htmlFor={priceId} className={styles.comboPriceLabel}>
                                      Combo price
                                      <span>Optional — members see this instead of the total</span>
                                    </label>
                                    <div className={styles.comboPriceInput}>
                                      <span aria-hidden="true">₹</span>
                                      <input
                                        id={priceId}
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="off"
                                        placeholder={total ? String(total) : 'e.g. 3000'}
                                        value={o.price ?? ''}
                                        onChange={(e) => {
                                          const digits = e.target.value.replace(/[^\d]/g, '').replace(/^0+/, '').slice(0, 8);
                                          updateOption(o.uid, (g) => ({ ...g, price: digits }));
                                        }}
                                        aria-describedby={`${priceId}-note`}
                                      />
                                      {priceNum !== null && (
                                        <button
                                          type="button"
                                          className={styles.comboPriceClear}
                                          onClick={() => updateOption(o.uid, (g) => ({ ...g, price: '' }))}
                                          aria-label="Clear combo price"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </div>
                                    <span id={`${priceId}-note`} className={styles.comboPriceNote}>
                                      {priceNum === null
                                        ? `Uses the total KSP ${inr(total)}`
                                        : saving > 0
                                          ? <span className={styles.comboSave}>Members save {inr(saving)} ({Math.round((saving / total) * 100)}% off {inr(total)})</span>
                                          : saving === 0
                                            ? 'Same as the total KSP'
                                            : <span className={styles.comboWarn}>{inr(-saving)} more than buying these separately</span>}
                                    </span>
                                  </div>
                                );
                              })()}

                              <div className={styles.groupFoot}>
                                <span>
                                  {o.items.length} product{o.items.length === 1 ? '' : 's'} · {units} unit{units === 1 ? '' : 's'} · total KSP {inr(total)}
                                  {o.price !== '' && o.price !== undefined && (
                                    <> · <strong className={styles.comboFinal}>combo {inr(Number(o.price))}</strong></>
                                  )}
                                  {o.items.length === 1 && <em className={styles.groupWarn}> · add 1 more product</em>}
                                </span>
                                <button
                                  type="button"
                                  className={styles.groupAddBtn}
                                  onClick={() => { setAddTarget(isTarget ? null : o.uid); setProductSearch(''); }}
                                >
                                  {isTarget ? 'Done adding' : '+ Add products'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className={styles.prodSectionHead} style={{ marginTop: 18 }}>
                      <h3 className={styles.prodSectionTitle}>
                        {target ? `Add products to "${target.name || 'Product group'}"` : 'Add a product'}
                      </h3>
                      {target && (
                        <button type="button" className={styles.prodLinkBtn} onClick={() => setAddTarget(null)}>
                          Add single products instead
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Search by name, ID, or category..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className={styles.prodSearch}
                    />
                    <div className={styles.prodList}>
                      {available.length === 0 ? (
                        <div className={styles.prodEmpty}>No more products match.</div>
                      ) : (
                        available.map((p) => (
                          <div key={p.id} className={styles.prodRow}>
                            {thumb(p)}
                            <div className={styles.prodInfo}>
                              <strong>{p.name}</strong>
                              <small>
                                {p.category} · KSP {inr(p.ksp)}
                                {p.isActive === false ? ' · inactive' : ''}
                              </small>
                            </div>
                            <button type="button" className={styles.prodAddBtn} onClick={() => addProduct(p.id)}>
                              {target ? '+ Add to group' : '+ Add'}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className={styles.modalFooter}>
                {isCustom && (
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    style={{ marginRight: 'auto' }}
                    disabled={savingProducts}
                    onClick={() => saveProducts({ reset: true })}
                  >
                    Reset to automatic
                  </button>
                )}
                <button type="button" className={styles.cancelBtn} onClick={() => setProductsPkg(null)} disabled={savingProducts}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.saveBtn}
                  disabled={savingProducts || catalogLoading}
                  onClick={() => saveProducts()}
                >
                  {savingProducts ? 'Saving...' : 'Save Products'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default AdminPackagesPage;