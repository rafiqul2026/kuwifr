// client/src/pages/admin/AdminPackagesPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminPackagesPage.module.css';

const AdminPackagesPage = () => {
  const { showNotification } = useNotification ? useNotification() : {
    showNotification: (msg, type) => console.log(`[${type}] ${msg}`)
  };
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
  const [assignedIds, setAssignedIds] = useState([]); // working list
  const [productSearch, setProductSearch] = useState('');
  const [savingProducts, setSavingProducts] = useState(false);

  const openProductsModal = async (pkg) => {
    setProductsPkg(pkg);
    setProductSearch('');
    setCatalogLoading(true);
    try {
      const res = await api.get('/api/repurchase/admin/products');
      const products = res.data?.data?.products || [];
      setCatalog(products);
      // Start from the admin's saved list; if none was ever set, show the
      // automatic default (active products priced at this package's KSP) so
      // they can see and tweak what members currently get.
      setAssignedIds(
        Array.isArray(pkg.includedProductIds)
          ? pkg.includedProductIds
          : products.filter((p) => p.isActive !== false && Number(p.ksp) === Number(pkg.price)).map((p) => p.id)
      );
    } catch (err) {
      showNotification('Could not load the product catalog.', 'error');
      setProductsPkg(null);
    } finally {
      setCatalogLoading(false);
    }
  };

  const saveProducts = async ({ reset = false } = {}) => {
    if (!productsPkg) return;
    setSavingProducts(true);
    try {
      const res = await api.put(
        `/api/packages/${productsPkg._id}/products`,
        reset ? { reset: true } : { productIds: assignedIds }
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
      if (editingPkg) {
        let res;
        try {
          res = await api.put(`/api/admin/packages/${editingPkg._id}`, formData);
        } catch (e) {
          res = await api.put(`/api/packages/${editingPkg._id}`, formData);
        }
        if (res.data?.success) {
          fetchPackages();
          setModalOpen(false);
        }
      } else {
        let res;
        try {
          res = await api.post('/api/admin/packages', formData);
        } catch (e) {
          res = await api.post('/api/packages', formData);
        }
        if (res.data?.success) {
          fetchPackages();
          setModalOpen(false);
        }
      }
      showNotification(editingPkg ? 'Package updated successfully' : 'Package created successfully', 'success');
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

            <form onSubmit={handleSubmit}>
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

      {/* Products modal — pick which catalog products members can choose
          when buying / upgrading to this package. */}
      {productsPkg && (() => {
        const byId = new Map(catalog.map((p) => [p.id, p]));
        const assigned = assignedIds.map((id) => byId.get(id) || { id, name: id, missing: true });
        const q = productSearch.trim().toLowerCase();
        const available = catalog.filter(
          (p) =>
            !assignedIds.includes(p.id) &&
            (!q || [p.name, p.id, p.category].some((v) => String(v || '').toLowerCase().includes(q)))
        );
        const isCustom = Array.isArray(productsPkg.includedProductIds);

        return (
          <div className={styles.modalOverlay} onClick={() => !savingProducts && setProductsPkg(null)}>
            <div className={styles.modalContent} style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div>
                  <h2>Products in {productsPkg.name}</h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    Members choose one of these when they buy or upgrade to this package.{' '}
                    {isCustom
                      ? 'Currently a custom list.'
                      : `Currently automatic (products priced at ₹${(productsPkg.price || 0).toLocaleString('en-IN')}).`}
                  </p>
                </div>
                <button onClick={() => setProductsPkg(null)} className={styles.closeBtn}>✕</button>
              </div>

              <div className={styles.modalBody}>
                {catalogLoading ? (
                  <p>Loading products...</p>
                ) : (
                  <>
                    <h3 className={styles.prodSectionTitle}>
                      Included in this package ({assigned.length})
                    </h3>
                    {assigned.length === 0 ? (
                      <div className={styles.prodEmpty}>
                        No products — members won't be able to buy this package until you add at least one.
                      </div>
                    ) : (
                      <div className={styles.prodList}>
                        {assigned.map((p) => (
                          <div key={p.id} className={styles.prodRow}>
                            {p.images?.[0]?.url ? (
                              <img src={p.images[0].url} alt="" className={styles.prodThumb} />
                            ) : (
                              <div className={styles.prodThumb}>📦</div>
                            )}
                            <div className={styles.prodInfo}>
                              <strong>{p.name}</strong>
                              <small>
                                {p.missing ? 'No longer in the catalog' : `${p.category} · KSP ₹${Number(p.ksp).toLocaleString('en-IN')}`}
                                {p.isActive === false ? ' · inactive (hidden from members)' : ''}
                              </small>
                            </div>
                            <button
                              type="button"
                              className={styles.prodRemoveBtn}
                              onClick={() => setAssignedIds((prev) => prev.filter((x) => x !== p.id))}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <h3 className={styles.prodSectionTitle} style={{ marginTop: 18 }}>Add a product</h3>
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
                            {p.images?.[0]?.url ? (
                              <img src={p.images[0].url} alt="" className={styles.prodThumb} />
                            ) : (
                              <div className={styles.prodThumb}>📦</div>
                            )}
                            <div className={styles.prodInfo}>
                              <strong>{p.name}</strong>
                              <small>
                                {p.category} · KSP ₹{Number(p.ksp).toLocaleString('en-IN')}
                                {p.isActive === false ? ' · inactive' : ''}
                              </small>
                            </div>
                            <button
                              type="button"
                              className={styles.prodAddBtn}
                              onClick={() => setAssignedIds((prev) => [...prev, p.id])}
                            >
                              + Add
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