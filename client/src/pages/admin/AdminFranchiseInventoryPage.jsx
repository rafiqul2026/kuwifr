// client/src/pages/admin/AdminFranchiseInventoryPage.jsx
// Franchise Inventory: assign products to a franchise, track what it sells
// (it earns a commission on every sale), dispatches and returns, and what it
// still holds — by product ID, in units and KBP.
// Backed by /api/admin/franchise-inventory. Responsive: side-by-side on wide
// screens, swipeable franchise row + cards + bottom sheets on phones.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './FranchiseInventory.module.css';
import { formatINR, formatNum, formatDate } from './adminInsightsUtils';

const LEDGER_PAGE_SIZE = 50;

const ENTRY_TYPES = [
  { value: 'LIFT', label: 'Assign', sub: 'Give stock', hint: 'Give products from company stock to this franchise to sell.' },
  { value: 'SALE', label: 'Sale', sub: 'Earns commission', hint: 'Record a sale for this franchise. It earns its sale commission on it.' },
  { value: 'DISPATCH', label: 'Dispatch', sub: 'Free hand-out', hint: 'Franchise hands a product to a member without a sale (no commission).' },
  { value: 'RETURN', label: 'Return', sub: 'Back to company', hint: 'Franchise sends unsold stock back to the company.' }
];

const TYPE_META = {
  LIFT: { label: 'Assigned', badge: styles.badgeLift },
  SALE: { label: 'Sale', badge: styles.badgeSale },
  DISPATCH: { label: 'Dispatch', badge: styles.badgeDispatch },
  RETURN: { label: 'Return', badge: styles.badgeReturn }
};

const LEDGER_TABS = [
  { value: '', label: 'All' },
  { value: 'LIFT', label: 'Assigned' },
  { value: 'SALE', label: 'Sales' },
  { value: 'DISPATCH', label: 'Dispatches' },
  { value: 'RETURN', label: 'Returns' }
];

const today = () => new Date().toISOString().slice(0, 10);
const pct = (rate) => `${((rate || 0) * 100).toFixed(2).replace(/\.00$/, '')}%`;
const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const emptyForm = (type) => ({
  type, productId: '', qty: '1', memberId: '', customerName: '', customerPhone: '', reference: '', note: '', entryDate: today()
});

// ------------------------------------------------------------------ helpers

const useEscape = (onClose) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
};

const StockBar = ({ t, className = styles.bar }) => {
  const total = t.liftedQty || 0;
  if (!total) return <div className={className} />;
  const seg = (v) => `${Math.max(0, (v / total) * 100)}%`;
  return (
    <div className={className} role="img" aria-label={`${t.soldQty || 0} sold, ${t.dispatchedQty || 0} dispatched, ${t.returnedQty || 0} returned, ${t.balanceQty || 0} remaining of ${total}`}>
      <span className={styles.barSold} style={{ width: seg(t.soldQty || 0) }} />
      <span className={styles.barDispatched} style={{ width: seg(t.dispatchedQty || 0) }} />
      <span className={styles.barReturned} style={{ width: seg(t.returnedQty || 0) }} />
      <span className={styles.barRemaining} style={{ width: seg(t.balanceQty || 0) }} />
    </div>
  );
};

const Kpi = ({ label, value, hint, accent, highlight, valueClass = '' }) => (
  <div className={`${styles.kpi} ${highlight ? styles.kpiHighlight : ''}`} style={accent ? { '--kpi-accent': accent } : undefined}>
    <span className={styles.kpiLabel} title={label}>{label}</span>
    <span className={`${styles.kpiValue} ${valueClass}`}>{value}</span>
    {hint && <span className={styles.kpiHint}>{hint}</span>}
  </div>
);

const Buyer = ({ entry }) => {
  if (entry.memberId) {
    return <span className={styles.prodCell}><strong>{entry.memberName}</strong><span>{entry.memberId}</span></span>;
  }
  if (entry.customerName) {
    return <span className={styles.prodCell}><strong>{entry.customerName}</strong><span>{entry.customerPhone || 'Walk-in customer'}</span></span>;
  }
  return <span className={styles.muted}>—</span>;
};

const Commission = ({ entry }) => {
  if (entry.type !== 'SALE') return <span className={styles.muted}>—</span>;
  if (entry.commissionStatus === 'CREDITED') return <span className={styles.green}>{formatINR(entry.commissionAmount)}</span>;
  if (entry.commissionStatus === 'REVERSED') return <span className={styles.prodCell} style={{ alignItems: 'flex-end' }}><span className={styles.muted}>{formatINR(entry.commissionAmount)}</span><span>reversed</span></span>;
  if (entry.commissionStatus === 'FAILED') return <span className={styles.prodCell} style={{ alignItems: 'flex-end' }}><span className={styles.red}>{formatINR(entry.commissionAmount)}</span><span>failed</span></span>;
  return <span className={styles.muted}>{formatINR(entry.commissionAmount)}</span>;
};

const recordedBy = (entry) => (entry.recordedByRole === 'FRANCHISE' ? 'by franchise' : entry.recordedByRole === 'ADMIN_AS_FRANCHISE' ? 'admin as franchise' : null);

// ------------------------------------------------------------- entry dialog

const StockEntryDialog = ({ franchise, products, balances, commissionRate, initialType, onClose, onSaved }) => {
  const { showNotification } = useNotification();
  const [form, setForm] = useState(() => emptyForm(initialType));
  const [saving, setSaving] = useState(false);
  useEscape(onClose);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const product = products.find((p) => p.id === form.productId);
  const balance = balances.find((b) => b._id.productId === form.productId)?.balanceQty || 0;
  const qty = parseInt(form.qty, 10) || 0;
  const companyStock = product && product.stock !== null && product.stock !== undefined ? product.stock : null;
  const isOutflow = form.type !== 'LIFT';
  const overLimit = qty > 0 && (isOutflow ? qty > balance : companyStock !== null && qty > companyStock);

  // Outflows only make sense for products this franchise actually holds.
  const productOptions = isOutflow ? products.filter((p) => balances.some((b) => b._id.productId === p.id && b.balanceQty > 0)) : products;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post(`/api/admin/franchise-inventory/${franchise._id}/entries`, { ...form, qty });
      showNotification(res.data?.message || 'Entry recorded.', 'success');
      onSaved();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Could not record this entry.', 'error');
      setSaving(false);
    }
  };

  const typeMeta = ENTRY_TYPES.find((t) => t.value === form.type);
  const submitLabel = { LIFT: 'Assign stock', SALE: 'Record sale', DISPATCH: 'Record dispatch', RETURN: 'Record return' }[form.type];

  return (
    <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className={styles.dialog} onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="se-title">
        <div className={styles.dialogHead}>
          <div>
            <h2 id="se-title" className={styles.dialogTitle}>New stock entry</h2>
            <p className={styles.dialogSub}>{franchise.member?.fullName} · {franchise.member?.memberId}</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.dialogBody}>
          <div className={styles.typeGrid} role="radiogroup" aria-label="Entry type">
            {ENTRY_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={form.type === t.value}
                className={`${styles.typeOption} ${form.type === t.value ? styles.typeOptionActive : ''}`}
                onClick={() => setForm((f) => ({ ...f, type: t.value, productId: t.value !== 'LIFT' && f.type === 'LIFT' ? '' : f.productId }))}
              >
                {t.label}
                <small>{t.sub}</small>
              </button>
            ))}
          </div>
          <p className={styles.hint}>{typeMeta?.hint}</p>

          <div className={styles.formGrid}>
            <div className={`${styles.field} ${styles.full}`}>
              <label htmlFor="se-product">Product</label>
              <select id="se-product" className={styles.select} value={form.productId} onChange={set('productId')} required>
                <option value="">{productOptions.length ? 'Choose a product…' : 'This franchise holds no stock yet'}</option>
                {productOptions.map((p) => {
                  const held = balances.find((b) => b._id.productId === p.id)?.balanceQty || 0;
                  const extra = isOutflow
                    ? ` · ${held} in franchise stock`
                    : p.stock !== null && p.stock !== undefined ? ` · ${p.stock} in company stock` : '';
                  return <option key={p.id} value={p.id}>{p.name} ({p.id}){extra}</option>;
                })}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="se-qty">Quantity</label>
              <input id="se-qty" className={styles.input} type="number" inputMode="numeric" min="1" step="1" value={form.qty} onChange={set('qty')} required />
            </div>
            <div className={styles.field}>
              <label htmlFor="se-date">Date</label>
              <input id="se-date" className={styles.input} type="date" max={today()} value={form.entryDate} onChange={set('entryDate')} required />
            </div>

            {form.type === 'DISPATCH' && (
              <div className={`${styles.field} ${styles.full}`}>
                <label htmlFor="se-member">Dispatched to (Member ID)</label>
                <input id="se-member" className={styles.input} placeholder="e.g. KFR123456" autoCapitalize="characters" value={form.memberId} onChange={set('memberId')} required />
              </div>
            )}

            {form.type === 'SALE' && (
              <>
                <div className={`${styles.field} ${styles.full}`}>
                  <label htmlFor="se-buyer">Buyer Member ID <span className={styles.muted}>(if the buyer is a member)</span></label>
                  <input id="se-buyer" className={styles.input} placeholder="e.g. KFR123456" autoCapitalize="characters" value={form.memberId} onChange={set('memberId')} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="se-cname">Or customer name</label>
                  <input id="se-cname" className={styles.input} maxLength={120} autoComplete="off" value={form.customerName} onChange={set('customerName')} required={!form.memberId.trim()} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="se-cphone">Customer phone</label>
                  <input id="se-cphone" className={styles.input} maxLength={20} inputMode="tel" autoComplete="off" value={form.customerPhone} onChange={set('customerPhone')} />
                </div>
              </>
            )}

            <div className={`${styles.field} ${styles.full}`}>
              <label htmlFor="se-ref">Reference / invoice no. <span className={styles.muted}>(optional)</span></label>
              <input id="se-ref" className={styles.input} maxLength={120} value={form.reference} onChange={set('reference')} />
            </div>
            <div className={`${styles.field} ${styles.full}`}>
              <label htmlFor="se-note">Note <span className={styles.muted}>(optional)</span></label>
              <textarea id="se-note" className={styles.textarea} maxLength={500} value={form.note} onChange={set('note')} />
            </div>
          </div>

          {product && qty > 0 && (
            <div className={overLimit ? styles.summaryWarn : styles.summary} aria-live="polite">
              {overLimit ? (
                isOutflow
                  ? <>This franchise only holds <b>{balance}</b> unit(s) of {product.name}.</>
                  : <>Only <b>{companyStock}</b> unit(s) of {product.name} left in company stock.</>
              ) : (
                <>
                  <div className={styles.summaryRow}><span>{qty} × {product.name}</span><b>{formatINR(product.ksp * qty)}</b></div>
                  <div className={styles.summaryRow}><span>KBP</span><b>{formatNum(product.kbp * qty)}</b></div>
                  {form.type === 'SALE' && (
                    <div className={styles.summaryRow}><span>Franchise commission ({pct(commissionRate)})</span><b>{formatINR(product.ksp * qty * commissionRate)}</b></div>
                  )}
                  <div className={styles.summaryRow}>
                    <span>Franchise stock after this</span>
                    <b>{isOutflow ? balance - qty : balance + qty} unit(s)</b>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className={styles.dialogFoot}>
          <button type="button" className={styles.btn} onClick={onClose}>Cancel</button>
          <button type="submit" className={styles.btnPrimary} disabled={saving || !form.productId || qty < 1 || overLimit}>
            {saving ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

// --------------------------------------------------------------- void dialog

const VoidDialog = ({ entry, onClose, onVoided }) => {
  const { showNotification } = useNotification();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  useEscape(onClose);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post(`/api/admin/franchise-inventory/entries/${entry._id}/void`, { reason: reason.trim() });
      showNotification(res.data?.message || 'Entry voided.', 'success');
      onVoided();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Could not void this entry.', 'error');
      setSaving(false);
    }
  };

  const takesBack = entry.type === 'SALE' && entry.commissionStatus === 'CREDITED' && entry.commissionAmount > 0;

  return (
    <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className={styles.dialogSmall} onSubmit={submit} role="alertdialog" aria-modal="true" aria-labelledby="void-title">
        <div className={styles.dialogHead}>
          <div>
            <h2 id="void-title" className={styles.dialogTitle}>Void this entry?</h2>
            <p className={styles.dialogSub}>
              {TYPE_META[entry.type]?.label} · {entry.qty} × {entry.productName} · {formatDate(entry.entryDate)}
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={styles.dialogBody}>
          <p className={styles.hint} style={{ marginBottom: 12 }}>
            The entry stays in the ledger marked as voided and no longer counts toward stock.
            {takesBack && <> The <b>{formatINR(entry.commissionAmount)}</b> commission paid for this sale will be taken back from the franchise's Income wallet.</>}
          </p>
          <div className={styles.field}>
            <label htmlFor="void-reason">Reason</label>
            <textarea id="void-reason" className={styles.textarea} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Entered twice by mistake" autoFocus required />
          </div>
        </div>
        <div className={styles.dialogFoot}>
          <button type="button" className={styles.btn} onClick={onClose}>Keep entry</button>
          <button type="submit" className={styles.btnDanger} disabled={saving || reason.trim().length < 3}>
            {saving ? 'Voiding…' : 'Void entry'}
          </button>
        </div>
      </form>
    </div>
  );
};

// --------------------------------------------------------------------- page

const AdminFranchiseInventoryPage = () => {
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [overview, setOverview] = useState({ franchises: [], totals: {}, saleCommissionRate: 0 });
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [showVoided, setShowVoided] = useState(false);
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState([]);
  const [entryDialog, setEntryDialog] = useState(null); // 'LIFT' | 'SALE' | null
  const [voidTarget, setVoidTarget] = useState(null);

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
        params: { type: typeFilter || undefined, includeVoided: showVoided ? 'true' : undefined, page, limit: LEDGER_PAGE_SIZE }
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
      .catch(() => showNotification('Could not load the product list.', 'error'));
  }, [showNotification]);

  const refreshAll = () => { fetchDetail(); fetchOverview(); };

  const selectFranchise = (id) => {
    if (id === selectedId) return;
    setSelectedId(id);
    setDetail(null);
    setPage(1);
    setTypeFilter('');
  };

  const filteredFranchises = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return overview.franchises;
    return overview.franchises.filter((f) =>
      [f.member?.fullName, f.member?.memberId, f.member?.phoneNumber].some((v) => (v || '').toLowerCase().includes(q)));
  }, [overview.franchises, search]);

  const selected = overview.franchises.find((f) => f._id === selectedId);
  const isApproved = selected?.status === 'APPROVED';
  const T = overview.totals || {};
  const t = detail?.totals || {};
  const totalPages = Math.max(1, Math.ceil((detail?.total || 0) / LEDGER_PAGE_SIZE));
  const hasStock = (t.balanceQty || 0) > 0;

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Franchise Inventory</h1>
          <p className={styles.subtitle}>
            Assign products to a franchise, then track what it sells, hands out and still holds — by product ID, in units and KBP.
          </p>
        </div>
        <div className={styles.ratePill}>
          <span>Sale commission <strong>{pct(overview.saleCommissionRate)}</strong> of KSP</span>
          <button type="button" className={styles.ratePillBtn} onClick={() => navigate('/admin/settings')}>Change</button>
        </div>
      </header>

      {/* All-franchise KPIs */}
      <section className={styles.kpis} aria-label="All franchises">
        <Kpi label="Assigned to franchises" value={`${formatNum(T.liftedQty)} units`} hint={`${formatNum(T.liftedKBP)} KBP`} accent="#16a34a" />
        <Kpi label="Sold by franchises" value={formatINR(T.soldKSP)} hint={`${formatNum(T.soldQty)} units · ${formatNum(T.soldKBP)} KBP`} accent="#0f766e" />
        <Kpi label="Commission paid" value={formatINR(T.commission)} valueClass={styles.green} accent="#047857" />
        <Kpi label="Dispatched to members" value={`${formatNum(T.dispatchedQty)} units`} hint={`${formatNum(T.dispatchedKBP)} KBP`} accent="#f59e0b" />
        <Kpi label="Still with franchises" value={`${formatNum(T.balanceQty)} units`} hint={`${formatNum(T.balanceKBP)} KBP · ${formatINR(T.balanceKSP)}`} highlight />
      </section>

      {loadingOverview ? (
        <div className={styles.skeleton} style={{ height: 320 }} />
      ) : overview.franchises.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🏬</span>
          No approved franchises yet.{' '}
          <button type="button" className={styles.ratePillBtn} onClick={() => navigate('/admin/franchise')}>Approve or grant a franchise</button>
        </div>
      ) : (
        <div className={styles.layout}>
          {/* Franchise list */}
          <aside className={styles.listPanel} aria-label="Franchises">
            <div className={styles.listHead}>
              <div className={styles.listTitle}>
                <span>Franchises</span>
                <span>{overview.franchises.length}</span>
              </div>
              {overview.franchises.length > 4 && (
                <input className={styles.search} type="search" placeholder="Search name or ID…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search franchises" />
              )}
            </div>
            <div className={styles.list}>
              {filteredFranchises.map((f) => (
                <button
                  key={f._id}
                  type="button"
                  className={`${styles.franchiseItem} ${f._id === selectedId ? styles.franchiseItemActive : ''}`}
                  onClick={() => selectFranchise(f._id)}
                  aria-pressed={f._id === selectedId}
                >
                  <span className={styles.avatar} aria-hidden="true">{initials(f.member?.fullName)}</span>
                  <span className={styles.itemBody}>
                    <span className={styles.itemName} title={f.member?.fullName}>{f.member?.fullName || 'Unknown'}</span>
                    <span className={styles.itemMeta}>
                      {f.member?.memberId}
                      {f.status !== 'APPROVED' && <span className={styles.dotRevoked}>Revoked</span>}
                    </span>
                  </span>
                  <span className={styles.itemStock}>
                    <strong>{formatNum(f.totals.balanceQty)}</strong>
                    in stock
                  </span>
                </button>
              ))}
              {filteredFranchises.length === 0 && <div className={styles.empty} style={{ margin: 12 }}>No match.</div>}
            </div>
          </aside>

          {/* Detail */}
          <section aria-label="Franchise stock" style={{ minWidth: 0 }}>
            {selected && (
              <div className={styles.detailHead}>
                <div className={styles.who}>
                  <span className={styles.avatarLg} aria-hidden="true">{initials(selected.member?.fullName)}</span>
                  <div style={{ minWidth: 0 }}>
                    <h2 className={styles.whoName}>{selected.member?.fullName}</h2>
                    <p className={styles.whoMeta}>
                      {selected.member?.memberId}{selected.member?.phoneNumber ? ` · ${selected.member.phoneNumber}` : ''}
                      {!isApproved && ' · Franchise revoked'}
                    </p>
                  </div>
                </div>
                <div className={styles.actions}>
                  <button type="button" className={styles.btn} onClick={() => setEntryDialog('SALE')} disabled={!isApproved || !hasStock} title={!hasStock ? 'Assign stock first' : undefined}>
                    Record sale
                  </button>
                  <button type="button" className={styles.btnPrimary} onClick={() => setEntryDialog('LIFT')} disabled={!isApproved}>
                    + Assign products
                  </button>
                </div>
              </div>
            )}

            {!detail ? (
              <>
                <div className={styles.skeleton} style={{ height: 96, marginBottom: 14 }} />
                <div className={styles.skeleton} style={{ height: 220 }} />
              </>
            ) : (
              <>
                <section className={styles.kpis} style={{ marginBottom: 14 }} aria-label="This franchise">
                  <Kpi label="Assigned" value={`${formatNum(t.liftedQty)} units`} hint={`${formatNum(t.liftedKBP)} KBP`} accent="#16a34a" />
                  <Kpi label="Sold" value={formatINR(t.soldKSP)} hint={`${formatNum(t.soldQty)} units`} accent="#0f766e" />
                  <Kpi label="Commission earned" value={formatINR(t.commission)} valueClass={styles.green} accent="#047857" />
                  <Kpi label="In stock now" value={`${formatNum(t.balanceQty)} units`} hint={`${formatNum(t.balanceKBP)} KBP · ${formatINR(t.balanceKSP)}`} highlight />
                </section>

                {(t.liftedQty || 0) > 0 && (
                  <div className={styles.flowCard}>
                    <div className={styles.flowTop}>
                      <span className={styles.flowTitle}>Where the assigned stock went</span>
                      <span className={styles.flowTotal}>{formatNum(t.liftedQty)} units assigned</span>
                    </div>
                    <StockBar t={t} />
                    <div className={styles.legend}>
                      <span><i className={styles.barSold} />Sold <b>{formatNum(t.soldQty)}</b></span>
                      <span><i className={styles.barDispatched} />Dispatched <b>{formatNum(t.dispatchedQty)}</b></span>
                      <span><i className={styles.barReturned} />Returned <b>{formatNum(t.returnedQty)}</b></span>
                      <span><i className={styles.barRemaining} />In stock <b>{formatNum(t.balanceQty)}</b></span>
                    </div>
                  </div>
                )}

                {/* Products */}
                <section className={styles.section}>
                  <div className={styles.sectionHead}>
                    <h3 className={styles.sectionTitle}>Products<span className={styles.count}>{detail.products.length}</span></h3>
                  </div>
                  {detail.products.length === 0 ? (
                    <div className={styles.empty}>
                      <span className={styles.emptyIcon}>📦</span>
                      No products assigned to this franchise yet.
                      {isApproved && (
                        <div style={{ marginTop: 12 }}>
                          <button type="button" className={styles.btnPrimary} onClick={() => setEntryDialog('LIFT')}>+ Assign products</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className={styles.tableWrap}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th className={styles.num}>Assigned</th>
                              <th className={styles.num}>Sold</th>
                              <th className={styles.num}>Dispatched</th>
                              <th className={styles.num}>Returned</th>
                              <th className={styles.num}>In stock</th>
                              <th className={styles.num}>Stock KBP</th>
                              <th className={styles.num}>Commission</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.products.map((p) => (
                              <tr key={p._id.productId}>
                                <td>
                                  <span className={styles.prodCell}>
                                    <strong>{p.productName}</strong>
                                    <span><code className={styles.code}>{p._id.productId}</code></span>
                                  </span>
                                </td>
                                <td className={styles.num}>{formatNum(p.liftedQty)}</td>
                                <td className={styles.num}>{formatNum(p.soldQty)}</td>
                                <td className={styles.num}>{formatNum(p.dispatchedQty)}</td>
                                <td className={styles.num}>{formatNum(p.returnedQty)}</td>
                                <td className={`${styles.num} ${styles.strong}`}>{formatNum(p.balanceQty)}</td>
                                <td className={styles.num}>{formatNum(p.balanceKBP)}</td>
                                <td className={`${styles.num} ${styles.green}`}>{formatINR(p.commission)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className={styles.cards}>
                        {detail.products.map((p) => (
                          <article key={p._id.productId} className={styles.itemCard}>
                            <div className={styles.cardTop}>
                              <span className={styles.prodCell}>
                                <strong>{p.productName}</strong>
                                <span><code className={styles.code}>{p._id.productId}</code></span>
                              </span>
                              <span className={styles.green} style={{ fontWeight: 600, fontSize: 13 }}>{formatINR(p.commission)}</span>
                            </div>
                            <div className={styles.cardStats}>
                              <div className={styles.cardStat}><span>Assigned</span><b>{formatNum(p.liftedQty)}</b></div>
                              <div className={styles.cardStat}><span>Sold</span><b>{formatNum(p.soldQty)}</b></div>
                              <div className={styles.cardStat}><span>In stock</span><b>{formatNum(p.balanceQty)}</b></div>
                            </div>
                            <StockBar t={p} className={styles.miniBar} />
                            <div className={styles.cardFoot}>
                              <span>Dispatched {formatNum(p.dispatchedQty)} · Returned {formatNum(p.returnedQty)}</span>
                              <span>{formatNum(p.balanceKBP)} KBP</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    </>
                  )}
                </section>

                {/* Ledger */}
                <section className={styles.section}>
                  <div className={styles.sectionHead}>
                    <h3 className={styles.sectionTitle}>Stock history<span className={styles.count}>{formatNum(detail.total)}</span></h3>
                    <label className={styles.toggle}>
                      <input type="checkbox" checked={showVoided} onChange={(e) => { setShowVoided(e.target.checked); setPage(1); }} />
                      Show voided
                    </label>
                  </div>
                  <div className={styles.tabs} role="tablist" aria-label="Filter history" style={{ marginBottom: 12 }}>
                    {LEDGER_TABS.map((tab) => (
                      <button
                        key={tab.value}
                        type="button"
                        role="tab"
                        aria-selected={typeFilter === tab.value}
                        className={`${styles.tab} ${typeFilter === tab.value ? styles.tabActive : ''}`}
                        onClick={() => { setTypeFilter(tab.value); setPage(1); }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {detail.entries.length === 0 ? (
                    <div className={styles.empty}>{loadingDetail ? 'Loading…' : 'No entries here yet.'}</div>
                  ) : (
                    <>
                      <div className={styles.tableWrap}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Type</th>
                              <th>Product</th>
                              <th className={styles.num}>Qty</th>
                              <th className={styles.num}>Value</th>
                              <th>Member / customer</th>
                              <th className={styles.num}>Commission</th>
                              <th aria-label="Actions" />
                            </tr>
                          </thead>
                          <tbody>
                            {detail.entries.map((en) => (
                              <tr key={en._id} className={en.voided ? styles.rowVoided : ''} title={en.voided ? `Voided: ${en.voidReason}` : en.note || undefined}>
                                <td>{formatDate(en.entryDate)}</td>
                                <td>
                                  <span className={en.voided ? styles.badgeVoid : TYPE_META[en.type]?.badge}>{en.voided ? 'Voided' : TYPE_META[en.type]?.label}</span>
                                  {recordedBy(en) && <span className={styles.byline}>{recordedBy(en)}</span>}
                                </td>
                                <td className={styles.wrap}>
                                  <span className={styles.prodCell}>
                                    <strong>{en.productName}</strong>
                                    <span>{en.productId}{en.reference ? ` · Ref ${en.reference}` : ''}</span>
                                  </span>
                                </td>
                                <td className={styles.num}>{formatNum(en.qty)}</td>
                                <td className={styles.num}>
                                  <span className={styles.prodCell} style={{ alignItems: 'flex-end' }}>
                                    <strong>{formatINR(en.totalKSP)}</strong>
                                    <span>{formatNum(en.totalKBP)} KBP</span>
                                  </span>
                                </td>
                                <td className={styles.wrap}><Buyer entry={en} /></td>
                                <td className={styles.num}><Commission entry={en} /></td>
                                <td>{!en.voided && <button type="button" className={styles.linkDanger} onClick={() => setVoidTarget(en)}>Void</button>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className={styles.cards}>
                        {detail.entries.map((en) => (
                          <article key={en._id} className={`${styles.itemCard} ${en.voided ? styles.rowVoided : ''}`} style={en.voided ? { opacity: 0.55 } : undefined}>
                            <div className={styles.cardTop}>
                              <div>
                                <span className={en.voided ? styles.badgeVoid : TYPE_META[en.type]?.badge}>{en.voided ? 'Voided' : TYPE_META[en.type]?.label}</span>
                                <span className={styles.muted} style={{ fontSize: 12, marginLeft: 8 }}>{formatDate(en.entryDate)}</span>
                              </div>
                              {!en.voided && <button type="button" className={styles.linkDanger} onClick={() => setVoidTarget(en)}>Void</button>}
                            </div>
                            <div className={styles.cardTop} style={{ marginTop: 10 }}>
                              <span className={styles.prodCell}><strong>{en.qty} × {en.productName}</strong><span>{en.productId} · {formatNum(en.totalKBP)} KBP</span></span>
                              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{formatINR(en.totalKSP)}</b>
                            </div>
                            {(en.memberId || en.customerName || en.type === 'SALE') && (
                              <div className={styles.cardFoot}>
                                <Buyer entry={en} />
                                {en.type === 'SALE' && <Commission entry={en} />}
                              </div>
                            )}
                            {(en.reference || recordedBy(en) || en.voided) && (
                              <div className={styles.cardFoot} style={{ marginTop: 6 }}>
                                <span>{en.reference ? `Ref ${en.reference}` : ''}</span>
                                <span>{en.voided ? `Voided: ${en.voidReason}` : recordedBy(en) || ''}</span>
                              </div>
                            )}
                          </article>
                        ))}
                      </div>

                      {totalPages > 1 && (
                        <div className={styles.pagination}>
                          <button type="button" className={styles.btn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Previous</button>
                          <span>Page {page} of {totalPages}</span>
                          <button type="button" className={styles.btn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
                        </div>
                      )}
                    </>
                  )}
                </section>
              </>
            )}
          </section>
        </div>
      )}

      {entryDialog && selected && detail && (
        <StockEntryDialog
          franchise={selected}
          products={products}
          balances={detail.products}
          commissionRate={overview.saleCommissionRate || 0}
          initialType={entryDialog}
          onClose={() => setEntryDialog(null)}
          onSaved={() => { setEntryDialog(null); refreshAll(); }}
        />
      )}

      {voidTarget && (
        <VoidDialog
          entry={voidTarget}
          onClose={() => setVoidTarget(null)}
          onVoided={() => { setVoidTarget(null); refreshAll(); }}
        />
      )}
    </div>
  );
};

export default AdminFranchiseInventoryPage;
