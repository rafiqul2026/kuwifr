// client/src/pages/admin/AdminFranchiseInventoryPage.jsx
// Franchise stock: what each franchise lifted from the company, which
// products (by product ID) it dispatched to which members, and the remaining
// balance in units and KBP. Backed by /api/admin/franchise-inventory.
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminInsights.module.css';
import { formatINR, formatNum, formatDate } from './adminInsightsUtils';

const ENTRY_TYPES = [
  { value: 'LIFT', label: 'Assign stock', hint: 'Give products from company stock to this franchise to sell.' },
  { value: 'SALE', label: 'Sale', hint: 'Record a sale on the franchise\'s behalf. The franchise earns its sale commission.' },
  { value: 'DISPATCH', label: 'Dispatch', hint: 'Franchise hands a product to a member without a sale (no commission).' },
  { value: 'RETURN', label: 'Return', hint: 'Franchise sends unsold stock back to the company.' }
];

const TYPE_LABEL = { LIFT: 'ASSIGNED', SALE: 'SALE', DISPATCH: 'DISPATCH', RETURN: 'RETURN' };

const typeBadge = (type) => (type === 'LIFT' ? styles.badgeGreen : type === 'SALE' ? styles.badgeTeal : type === 'RETURN' ? styles.badge : styles.badgeAmber);

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({ type: 'LIFT', productId: '', qty: '1', memberId: '', customerName: '', customerPhone: '', reference: '', note: '', entryDate: today() });

const StockEntryModal = ({ franchise, products, balances, commissionRate, initialType = 'LIFT', onClose, onSaved }) => {
  const { showNotification } = useNotification();
  const [form, setForm] = useState(() => ({ ...emptyForm(), type: initialType }));
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
          {form.type === 'SALE' && (
            <>
              <div className={styles.field}>
                <label htmlFor="se-buyer">Buyer Member ID (if a member)</label>
                <input id="se-buyer" className={styles.input} placeholder="KFR123456" value={form.memberId} onChange={set('memberId')} />
              </div>
              <div className={styles.field}>
                <label htmlFor="se-cname">Or customer name</label>
                <input id="se-cname" className={styles.input} maxLength={120} value={form.customerName} onChange={set('customerName')} required={!form.memberId.trim()} />
              </div>
              <div className={styles.field}>
                <label htmlFor="se-cphone">Customer phone</label>
                <input id="se-cphone" className={styles.input} maxLength={20} inputMode="tel" value={form.customerPhone} onChange={set('customerPhone')} />
              </div>
            </>
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
            {form.type === 'SALE' && (
              <> Commission to franchise: <strong>{formatINR(product.ksp * qty * commissionRate)}</strong> ({(commissionRate * 100).toFixed(2).replace(/\.00$/, '')}%).</>
            )}
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
  const [modalType, setModalType] = useState('LIFT');
  const navigate = useNavigate();

  const openModal = (type) => {
    setModalType(type);
    setModalOpen(true);
  };

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
    const label = (TYPE_LABEL[entry.type] || entry.type).toLowerCase();
    const commissionNote = entry.type === 'SALE' && entry.commissionStatus === 'CREDITED'
      ? `\n\nThe ₹${entry.commissionAmount} commission paid for this sale will be taken back from the franchise's Income wallet.`
      : '';
    const reason = window.prompt(`Void this ${label} entry: ${entry.qty} × ${entry.productName}?${commissionNote}\n\nEnter a reason:`);
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
            Assign products to a franchise, then track what it sells (it earns a commission on every sale), what it
            hands out to members, and what it still holds — by product ID, in units and KBP.
          </p>
        </div>
      </div>

      <div className={styles.notice}>
        Franchise sale commission is currently <strong>{((overview.saleCommissionRate || 0) * 100).toFixed(2).replace(/\.00$/, '')}%</strong> of
        the sale value (KSP × quantity), credited to the franchise's Income wallet when a sale is recorded.
        {' '}<button type="button" className={styles.linkBtn} onClick={() => navigate('/admin/settings')}>Change in Settings → Franchise Commissions</button>
      </div>

      <div className={styles.cardGrid}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Assigned to franchises</span>
          <span className={styles.cardValue}>{formatNum(overview.totals.liftedKBP)} KBP</span>
          <span className={styles.cardHint}>{formatNum(overview.totals.liftedQty)} unit(s)</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Sold by franchises</span>
          <span className={styles.cardValue}>{formatINR(overview.totals.soldKSP)}</span>
          <span className={styles.cardHint}>{formatNum(overview.totals.soldQty)} unit(s) · {formatNum(overview.totals.soldKBP)} KBP</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Sale commission paid</span>
          <span className={`${styles.cardValue} ${styles.positive}`}>{formatINR(overview.totals.commission)}</span>
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
                <div className={styles.headerActions}>
                  <button type="button" className={styles.btn} onClick={() => openModal('SALE')}>Record sale</button>
                  <button type="button" className={styles.btnPrimary} onClick={() => openModal('LIFT')}>+ Assign products</button>
                </div>
              </div>
            )}

            {loadingDetail && !detail ? (
              <div className={styles.loading}>Loading inventory…</div>
            ) : detail && (
              <>
                <div className={styles.cardGrid}>
                  <div className={styles.card}>
                    <span className={styles.cardLabel}>Assigned</span>
                    <span className={styles.cardValue}>{formatNum(t.liftedKBP)} KBP</span>
                    <span className={styles.cardHint}>{formatNum(t.liftedQty)} unit(s)</span>
                  </div>
                  <div className={styles.card}>
                    <span className={styles.cardLabel}>Sold</span>
                    <span className={styles.cardValue}>{formatINR(t.soldKSP)}</span>
                    <span className={styles.cardHint}>{formatNum(t.soldQty)} unit(s) · {formatNum(t.soldKBP)} KBP</span>
                  </div>
                  <div className={styles.card}>
                    <span className={styles.cardLabel}>Commission earned</span>
                    <span className={`${styles.cardValue} ${styles.positive}`}>{formatINR(t.commission)}</span>
                  </div>
                  <div className={styles.card}>
                    <span className={styles.cardLabel}>Dispatched / Returned</span>
                    <span className={styles.cardValue}>{formatNum(t.dispatchedQty)} / {formatNum(t.returnedQty)}</span>
                    <span className={styles.cardHint}>unit(s)</span>
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
                          <th className={styles.num}>Assigned</th><th className={styles.num}>Sold</th><th className={styles.num}>Dispatched</th><th className={styles.num}>Returned</th>
                          <th className={styles.num}>Balance</th><th className={styles.num}>Balance KBP</th><th className={styles.num}>Commission</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.products.map((p) => (
                          <tr key={p._id.productId}>
                            <td className={styles.strong}>{p._id.productId}</td>
                            <td>{p.productName}</td>
                            <td className={styles.num}>{formatNum(p.liftedQty)}</td>
                            <td className={styles.num}>{formatNum(p.soldQty)}</td>
                            <td className={styles.num}>{formatNum(p.dispatchedQty)}</td>
                            <td className={styles.num}>{formatNum(p.returnedQty)}</td>
                            <td className={`${styles.num} ${styles.strong}`}>{formatNum(p.balanceQty)}</td>
                            <td className={styles.num}>{formatNum(p.balanceKBP)}</td>
                            <td className={styles.num}>{formatINR(p.commission)}</td>
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
                            <th className={styles.num}>KBP</th><th className={styles.num}>Value</th><th>Member / customer</th>
                            <th className={styles.num}>Commission</th><th>Reference</th><th />
                          </tr>
                        </thead>
                        <tbody>
                          {detail.entries.map((en) => (
                            <tr key={en._id} className={en.voided ? styles.rowVoided : ''} title={en.voided ? `Voided: ${en.voidReason}` : en.note || ''}>
                              <td>{formatDate(en.entryDate)}</td>
                              <td>
                                <span className={typeBadge(en.type)}>{TYPE_LABEL[en.type] || en.type}</span>
                                {en.recordedByRole === 'FRANCHISE' && <span className={styles.muted} style={{ fontSize: 11, marginLeft: 6 }}>by franchise</span>}
                              </td>
                              <td className={styles.strong}>{en.productId}</td>
                              <td>{en.productName}</td>
                              <td className={styles.num}>{formatNum(en.qty)}</td>
                              <td className={styles.num}>{formatNum(en.totalKBP)}</td>
                              <td className={styles.num}>{formatINR(en.totalKSP)}</td>
                              <td>
                                {en.memberId ? (
                                  <span className={styles.memberCell}><strong>{en.memberName}</strong><span>{en.memberId}</span></span>
                                ) : en.customerName ? (
                                  <span className={styles.memberCell}><strong>{en.customerName}</strong><span>{en.customerPhone || 'Customer'}</span></span>
                                ) : <span className={styles.muted}>—</span>}
                              </td>
                              <td className={styles.num}>
                                {en.type === 'SALE' ? (
                                  <span className={en.commissionStatus === 'CREDITED' ? styles.positive : en.commissionStatus === 'FAILED' ? styles.negative : styles.muted}>
                                    {formatINR(en.commissionAmount)}{en.commissionStatus !== 'CREDITED' ? ` · ${en.commissionStatus}` : ''}
                                  </span>
                                ) : <span className={styles.muted}>—</span>}
                              </td>
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
          commissionRate={overview.saleCommissionRate || 0}
          initialType={modalType}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); fetchDetail(); fetchOverview(); }}
        />
      )}
    </div>
  );
};

export default AdminFranchiseInventoryPage;
