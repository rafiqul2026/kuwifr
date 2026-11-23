// client/src/pages/admin/AdminFranchiseInventoryPage.jsx
// Franchise stock: what each franchise lifted from the company, which
// products (by product ID) it dispatched to which members, and the remaining
// balance in units and KBP. Backed by /api/admin/franchise-inventory.
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminInsights.module.css';
import { formatINR, formatNum, formatDate, statusBadgeClass } from './adminInsightsUtils';

const ENTRY_TYPES = [
  { value: 'LIFT', label: 'Lift', hint: 'Franchise takes stock from the company' },
  { value: 'DISPATCH', label: 'Dispatch', hint: 'Franchise gives a product to a member' },
  { value: 'RETURN', label: 'Return', hint: 'Franchise sends unsold stock back' }
];

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({ type: 'LIFT', productId: '', qty: '1', memberId: '', reference: '', note: '', entryDate: today() });

const StockEntryModal = ({ franchise, products, balances, onClose, onSaved }) => {
  const { showNotification } = useNotification();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const product = products.find((p) => p.id === form.productId);
  const balance = balances.find((b) => b._id.productId === form.productId)?.balanceQty || 0;
  const qty = parseInt(form.qty, 10) || 0;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post(`/api/admin/franchise-inventory/${franchise._id}/entries`, { ...form, qty });
      showNotification(res.data?.message || 'Entry recorded.', 'success');
      onSaved();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Could not record this entry.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className={styles.panelTitle}>New stock entry · {franchise.member?.fullName}</h2>

        <div className={styles.segmented} style={{ marginBottom: 6 }}>
          {ENTRY_TYPES.map((t) => (
            <button key={t.value} type="button" className={form.type === t.value ? styles.segmentedActive : ''} onClick={() => setForm((f) => ({ ...f, type: t.value }))}>
              {t.label}
            </button>
          ))}
        </div>
        <p className={styles.resultsMeta}>{ENTRY_TYPES.find((t) => t.value === form.type)?.hint}</p>

        <div className={styles.formGrid}>
          <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="se-product">Product</label>
            <select id="se-product" className={styles.select} value={form.productId} onChange={set('productId')} required>
              <option value="">Choose a product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} — {p.name} ({formatNum(p.kbp)} KBP{p.stock !== null && p.stock !== undefined ? ` · company stock ${p.stock}` : ''})
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="se-qty">Quantity</label>
            <input id="se-qty" className={styles.input} type="number" min="1" step="1" value={form.qty} onChange={set('qty')} required />
          </div>
          <div className={styles.field}>
            <label htmlFor="se-date">Date</label>
            <input id="se-date" className={styles.input} type="date" max={today()} value={form.entryDate} onChange={set('entryDate')} required />
          </div>
          {form.type === 'DISPATCH' && (
            <div className={styles.field}>
              <label htmlFor="se-member">Dispatched to (Member ID)</label>
              <input id="se-member" className={styles.input} placeholder="KFR123456" value={form.memberId} onChange={set('memberId')} required />
            </div>
          )}
          <div className={styles.field}>
            <label htmlFor="se-ref">Reference / invoice no.</label>
            <input id="se-ref" className={styles.input} maxLength={120} value={form.reference} onChange={set('reference')} />
          </div>
          <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="se-note">Note</label>
            <textarea id="se-note" className={styles.textarea} maxLength={500} value={form.note} onChange={set('note')} />
          </div>
        </div>

        {product && (
          <div className={styles.notice} style={{ marginTop: 12, marginBottom: 0 }}>
            {qty} × {product.name} = <strong>{formatNum(product.kbp * qty)} KBP</strong> · {formatINR(product.ksp * qty)}.
            {' '}This franchise currently holds <strong>{balance}</strong> unit(s) of this product.
            {form.type !== 'LIFT' && qty > balance && <span className={styles.negative}> More than the franchise holds.</span>}
          </div>
        )}

        <div className={styles.formActions}>
          <button type="button" className={styles.btn} onClick={onClose}>Cancel</button>
          <button type="submit" className={styles.btnPrimary} disabled={saving || !form.productId || qty < 1}>
            {saving ? 'Saving…' : 'Record entry'}
          </button>
        </div>
      </form>
    </div>
  );
};

const AdminFranchiseInventoryPage = () => {
  const { showNotification } = useNotification();
  const [overview, setOverview] = useState({ franchises: [], totals: {} });
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [showVoided, setShowVoided] = useState(false);
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/franchise-inventory');
      const data = res.data?.data || { franchises: [], totals: {} };
      setOverview(data);
      setSelectedId((cur) => cur || data.franchises[0]?._id || null);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to load franchises.', 'error');
    } finally {
      setLoadingOverview(false);
    }
  }, [showNotification]);

  const fetchDetail = useCallback(async () => {
    if (!selectedId) return;
    setLoadingDetail(true);
    try {
      const res = await api.get(`/api/admin/franchise-inventory/${selectedId}`, {
        params: { type: typeFilter || undefined, includeVoided: showVoided ? 'true' : undefined, page, limit: 50 }
      });
      setDetail(res.data?.data || null);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to load inventory.', 'error');
    } finally {
      setLoadingDetail(false);
    }
  }, [selectedId, typeFilter, showVoided, page, showNotification]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  useEffect(() => { fetchDetail(); }, [fetchDetail]);
  useEffect(() => {
    api.get('/api/repurchase/admin/products')
      .then((res) => setProducts((res.data?.data?.products || []).filter((p) => p.isActive !== false)))
      .catch(() => {});
  }, []);

  const handleVoid = async (entry) => {
    const reason = window.prompt(`Void this ${entry.type.toLowerCase()} of ${entry.qty} × ${entry.productName}?\n\nEnter a reason:`);
    if (reason === null) return;
    try {
      await api.post(`/api/admin/franchise-inventory/entries/${entry._id}/void`, { reason });
      showNotification('Entry voided.', 'success');
      fetchDetail();
      fetchOverview();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Could not void this entry.', 'error');
    }
  };

  const selected = overview.franchises.find((f) => f._id === selectedId);
  const t = detail?.totals || {};
  const totalPages = Math.max(1, Math.ceil((detail?.total || 0) / 50));

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Franchise Inventory</h1>
          <p className={styles.pageSubtitle}>
            Stock each franchise has lifted from the company, the products it has dispatched to members (by product
            ID), and what it still holds — in units and KBP.
          </p>
        </div>
      </div>

      <div className={styles.cardGrid}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>All franchises · lifted</span>
          <span className={styles.cardValue}>{formatNum(overview.totals.liftedKBP)} KBP</span>
          <span className={styles.cardHint}>{formatNum(overview.totals.liftedQty)} unit(s)</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Dispatched to members</span>
          <span className={styles.cardValue}>{formatNum(overview.totals.dispatchedKBP)} KBP</span>
          <span className={styles.cardHint}>{formatNum(overview.totals.dispatchedQty)} unit(s)</span>
        </div>
        <div className={`${styles.card} ${styles.cardAccent}`}>
          <span className={styles.cardLabel}>Balance with franchises</span>
          <span className={styles.cardValue}>{formatNum(overview.totals.balanceKBP)} KBP</span>
          <span className={styles.cardHint}>{formatNum(overview.totals.balanceQty)} unit(s) · {formatINR(overview.totals.balanceKSP)}</span>
        </div>
      </div>

      {loadingOverview ? (
        <div className={styles.loading}>Loading franchises…</div>
      ) : overview.franchises.length === 0 ? (
        <div className={styles.empty}>No approved franchises yet. Approve one under Franchise first.</div>
      ) : (
        <div className={styles.split}>
          <div className={styles.listPanel}>
            {overview.franchises.map((f) => (
              <button
                key={f._id}
                type="button"
                className={`${styles.listItem} ${f._id === selectedId ? styles.listItemActive : ''}`}
                onClick={() => { setSelectedId(f._id); setPage(1); }}
              >
                <span className={styles.listItemTitle}>{f.member?.fullName || 'Unknown'}</span>
                <span className={styles.listItemMeta}>
                  {f.member?.memberId} · {f.status === 'APPROVED' ? 'Active' : 'Revoked'}
                </span>
                <span className={styles.listItemMeta}>
                  Balance {formatNum(f.totals.balanceQty)} unit(s) · {formatNum(f.totals.balanceKBP)} KBP
                </span>
              </button>
            ))}
          </div>

          <div>
            {selected && (
              <div className={styles.headerRow} style={{ marginBottom: 12 }}>
                <div>
                  <h2 className={styles.panelTitle} style={{ marginBottom: 2 }}>{selected.member?.fullName}</h2>
                  <span className={styles.muted} style={{ fontSize: 13 }}>{selected.member?.memberId} · {selected.member?.phoneNumber || ''}</span>
                </div>
                <button type="button" className={styles.btnPrimary} onClick={() => setModalOpen(true)}>+ New entry</button>
              </div>
            )}

            {loadingDetail && !detail ? (
              <div className={styles.loading}>Loading inventory…</div>
            ) : detail && (
              <>
                <div className={styles.cardGrid}>
                  <div className={styles.card}>
                    <span className={styles.cardLabel}>Lifted</span>
                    <span className={styles.cardValue}>{formatNum(t.liftedKBP)} KBP</span>
                    <span className={styles.cardHint}>{formatNum(t.liftedQty)} unit(s)</span>
                  </div>
                  <div className={styles.card}>
                    <span className={styles.cardLabel}>Dispatched</span>
                    <span className={styles.cardValue}>{formatNum(t.dispatchedKBP)} KBP</span>
                    <span className={styles.cardHint}>{formatNum(t.dispatchedQty)} unit(s)</span>
                  </div>
                  <div className={styles.card}>
                    <span className={styles.cardLabel}>Returned</span>
                    <span className={styles.cardValue}>{formatNum(t.returnedKBP)} KBP</span>
                    <span className={styles.cardHint}>{formatNum(t.returnedQty)} unit(s)</span>
                  </div>
                  <div className={`${styles.card} ${styles.cardAccent}`}>
                    <span className={styles.cardLabel}>Remaining balance</span>
                    <span className={styles.cardValue}>{formatNum(t.balanceKBP)} KBP</span>
                    <span className={styles.cardHint}>{formatNum(t.balanceQty)} unit(s) · {formatINR(t.balanceKSP)}</span>
                  </div>
                </div>

                <h3 className={styles.sectionTitle}>Product-wise balance</h3>
                {detail.products.length === 0 ? (
                  <div className={styles.empty}>No stock recorded for this franchise yet.</div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Product ID</th><th>Product</th>
                          <th className={styles.num}>Lifted</th><th className={styles.num}>Dispatched</th><th className={styles.num}>Returned</th>
                          <th className={styles.num}>Balance</th><th className={styles.num}>Balance KBP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.products.map((p) => (
                          <tr key={p._id.productId}>
                            <td className={styles.strong}>{p._id.productId}</td>
                            <td>{p.productName}</td>
                            <td className={styles.num}>{formatNum(p.liftedQty)}</td>
                            <td className={styles.num}>{formatNum(p.dispatchedQty)}</td>
                            <td className={styles.num}>{formatNum(p.returnedQty)}</td>
                            <td className={`${styles.num} ${styles.strong}`}>{formatNum(p.balanceQty)}</td>
                            <td className={styles.num}>{formatNum(p.balanceKBP)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <h3 className={styles.sectionTitle}>Stock ledger</h3>
                <div className={styles.filterBar}>
                  <div className={styles.segmented}>
                    {[{ value: '', label: 'All' }, ...ENTRY_TYPES].map((ty) => (
                      <button key={ty.value} type="button" className={typeFilter === ty.value ? styles.segmentedActive : ''} onClick={() => { setTypeFilter(ty.value); setPage(1); }}>
                        {ty.label}
                      </button>
                    ))}
                  </div>
                  <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={showVoided} onChange={(e) => { setShowVoided(e.target.checked); setPage(1); }} />
                    Show voided
                  </label>
                </div>

                {detail.entries.length === 0 ? (
                  <div className={styles.empty}>No entries.</div>
                ) : (
                  <>
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Date</th><th>Type</th><th>Product ID</th><th>Product</th><th className={styles.num}>Qty</th>
                            <th className={styles.num}>KBP</th><th>Member</th><th>Reference</th><th />
                          </tr>
                        </thead>
                        <tbody>
                          {detail.entries.map((en) => (
                            <tr key={en._id} className={en.voided ? styles.rowVoided : ''} title={en.voided ? `Voided: ${en.voidReason}` : en.note || ''}>
                              <td>{formatDate(en.entryDate)}</td>
                              <td><span className={en.type === 'RETURN' ? styles.badgeTeal : statusBadgeClass(styles, en.type)}>{en.type}</span></td>
                              <td className={styles.strong}>{en.productId}</td>
                              <td>{en.productName}</td>
                              <td className={styles.num}>{formatNum(en.qty)}</td>
                              <td className={styles.num}>{formatNum(en.totalKBP)}</td>
                              <td>{en.memberId ? <span className={styles.memberCell}><strong>{en.memberName}</strong><span>{en.memberId}</span></span> : <span className={styles.muted}>—</span>}</td>
                              <td className={styles.muted}>{en.reference || '—'}</td>
                              <td>{!en.voided && <button type="button" className={styles.linkDanger} onClick={() => handleVoid(en)}>Void</button>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className={styles.pagination}>
                      <button type="button" className={styles.btn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Previous</button>
                      <span>Page {page} of {totalPages}</span>
                      <button type="button" className={styles.btn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {modalOpen && selected && detail && (
        <StockEntryModal
          franchise={selected}
          products={products}
          balances={detail.products}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); fetchDetail(); fetchOverview(); }}
        />
      )}
    </div>
  );
};

export default AdminFranchiseInventoryPage;
