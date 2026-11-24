// client/src/pages/member/FranchiseStockSection.jsx
// Franchise dashboard: products the admin assigned to this franchise, a
// "Sell" action for each, and the franchise's sales with the commission
// earned on every sale. Backed by GET /api/franchise/stock and
// POST /api/franchise/sales.
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from '../admin/AdminInsights.module.css';
import { formatINR, formatNum, formatDate } from '../admin/adminInsightsUtils';

const today = () => new Date().toISOString().slice(0, 10);
const weekAgo = () => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
const pct = (rate) => `${((rate || 0) * 100).toFixed(2).replace(/\.00$/, '')}%`;

const SellModal = ({ product, rate, onClose, onSold }) => {
  const { showNotification } = useNotification();
  const [form, setForm] = useState({ qty: '1', memberId: '', customerName: '', customerPhone: '', reference: '', entryDate: today() });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const qty = parseInt(form.qty, 10) || 0;
  const tooMany = qty > product.balanceQty;
  const saleValue = product.kspPerUnit * qty;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/api/franchise/sales', { ...form, qty, productId: product.productId });
      showNotification(res.data?.message || 'Sale recorded.', 'success');
      onSold();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Could not record this sale.', 'error');
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className={styles.panelTitle}>Sell {product.productName}</h2>
        <p className={styles.resultsMeta}>Product ID {product.productId} · {product.balanceQty} unit(s) in your stock</p>

        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label htmlFor="fs-qty">Quantity</label>
            <input id="fs-qty" className={styles.input} type="number" min="1" max={product.balanceQty} step="1" value={form.qty} onChange={set('qty')} required />
          </div>
          <div className={styles.field}>
            <label htmlFor="fs-date">Sale date</label>
            <input id="fs-date" className={styles.input} type="date" min={weekAgo()} max={today()} value={form.entryDate} onChange={set('entryDate')} required />
          </div>
          <div className={styles.field}>
            <label htmlFor="fs-member">Buyer Member ID (if a member)</label>
            <input id="fs-member" className={styles.input} placeholder="KFR123456" value={form.memberId} onChange={set('memberId')} />
          </div>
          <div className={styles.field}>
            <label htmlFor="fs-name">Or customer name</label>
            <input id="fs-name" className={styles.input} maxLength={120} value={form.customerName} onChange={set('customerName')} required={!form.memberId.trim()} />
          </div>
          <div className={styles.field}>
            <label htmlFor="fs-phone">Customer phone</label>
            <input id="fs-phone" className={styles.input} maxLength={20} inputMode="tel" value={form.customerPhone} onChange={set('customerPhone')} />
          </div>
          <div className={styles.field}>
            <label htmlFor="fs-ref">Bill / receipt no.</label>
            <input id="fs-ref" className={styles.input} maxLength={120} value={form.reference} onChange={set('reference')} />
          </div>
        </div>

        {qty > 0 && (
          <div className={tooMany ? styles.warning : styles.notice} style={{ marginTop: 12, marginBottom: 0 }}>
            {tooMany ? (
              <>You only have {product.balanceQty} unit(s) of this product.</>
            ) : (
              <>
                Sale value {formatINR(saleValue)} · your commission <strong>{formatINR(saleValue * rate)}</strong> ({pct(rate)}),
                added to your Income wallet as soon as you record the sale.
              </>
            )}
          </div>
        )}

        <div className={styles.formActions}>
          <button type="button" className={styles.btn} onClick={onClose}>Cancel</button>
          <button type="submit" className={styles.btnPrimary} disabled={saving || qty < 1 || tooMany}>
            {saving ? 'Recording…' : 'Record sale'}
          </button>
        </div>
      </form>
    </div>
  );
};

const FranchiseStockSection = () => {
  const { showNotification } = useNotification();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [selling, setSelling] = useState(null);

  const fetchStock = useCallback(async () => {
    try {
      const res = await api.get('/api/franchise/stock', { params: { page } });
      setData(res.data?.data || null);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to load your stock.', 'error');
    }
  }, [page, showNotification]);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  if (!data) return <div className={styles.loading} style={{ marginTop: 24 }}>Loading your stock…</div>;

  const t = data.totals || {};
  const inStock = data.products.filter((p) => p.balanceQty > 0 || p.soldQty > 0 || p.assignedQty > 0);

  return (
    <section style={{ marginTop: 28 }}>
      <div className={styles.headerRow} style={{ marginBottom: 12 }}>
        <div>
          <h2 className={styles.pageTitle} style={{ fontSize: 20 }}>My Stock &amp; Sales</h2>
          <p className={styles.pageSubtitle}>
            Products assigned to you by KUWIFR. Record each sale here — you earn <strong>{pct(data.saleCommissionRate)}</strong> of
            the sale value as commission, credited straight to your Income wallet.
          </p>
        </div>
      </div>

      <div className={styles.cardGrid}>
        <div className={`${styles.card} ${styles.cardAccent}`}>
          <span className={styles.cardLabel}>In stock</span>
          <span className={styles.cardValue}>{formatNum(t.balanceQty)} unit(s)</span>
          <span className={styles.cardHint}>{formatNum(t.balanceKBP)} KBP · {formatINR(t.balanceKSP)}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Total sold</span>
          <span className={styles.cardValue}>{formatINR(t.soldKSP)}</span>
          <span className={styles.cardHint}>{formatNum(t.soldQty)} unit(s)</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Commission earned</span>
          <span className={`${styles.cardValue} ${styles.positive}`}>{formatINR(t.commission)}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Total assigned to you</span>
          <span className={styles.cardValue}>{formatNum(t.liftedQty)} unit(s)</span>
        </div>
      </div>

      {inStock.length === 0 ? (
        <div className={styles.empty}>No products have been assigned to you yet. KUWIFR admin will assign stock to your franchise.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th className={styles.num}>Price (KSP)</th>
                <th className={styles.num}>Assigned</th>
                <th className={styles.num}>Sold</th>
                <th className={styles.num}>In stock</th>
                <th className={styles.num}>Commission</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {inStock.map((p) => (
                <tr key={p.productId}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {p.image ? (
                        <img src={p.image} alt="" width="36" height="36" style={{ borderRadius: 8, objectFit: 'cover', border: '1px solid #e5e5e5' }} />
                      ) : null}
                      <span className={styles.memberCell}><strong>{p.productName}</strong><span>{p.productId}</span></span>
                    </div>
                  </td>
                  <td className={styles.num}>{formatINR(p.kspPerUnit)}</td>
                  <td className={styles.num}>{formatNum(p.assignedQty)}</td>
                  <td className={styles.num}>{formatNum(p.soldQty)}</td>
                  <td className={`${styles.num} ${styles.strong}`}>{formatNum(p.balanceQty)}</td>
                  <td className={`${styles.num} ${styles.positive}`}>{formatINR(p.commission)}</td>
                  <td>
                    <button type="button" className={styles.btnPrimary} style={{ height: 32 }} disabled={p.balanceQty < 1} onClick={() => setSelling(p)}>
                      Sell
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className={styles.sectionTitle}>My sales</h3>
      {data.sales.length === 0 ? (
        <div className={styles.empty}>No sales recorded yet.</div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th><th>Product</th><th className={styles.num}>Qty</th><th className={styles.num}>Sale value</th>
                  <th>Buyer</th><th className={styles.num}>Commission</th><th>Bill no.</th>
                </tr>
              </thead>
              <tbody>
                {data.sales.map((s) => (
                  <tr key={s._id} className={s.voided ? styles.rowVoided : ''} title={s.voided ? `Cancelled by admin: ${s.voidReason}` : ''}>
                    <td>{formatDate(s.entryDate)}</td>
                    <td><span className={styles.memberCell}><strong>{s.productName}</strong><span>{s.productId}</span></span></td>
                    <td className={styles.num}>{formatNum(s.qty)}</td>
                    <td className={styles.num}>{formatINR(s.totalKSP)}</td>
                    <td>
                      {s.memberId
                        ? <span className={styles.memberCell}><strong>{s.memberName}</strong><span>{s.memberId}</span></span>
                        : <span className={styles.memberCell}><strong>{s.customerName || '—'}</strong><span>{s.customerPhone || 'Customer'}</span></span>}
                    </td>
                    <td className={styles.num}>
                      {s.voided ? (
                        <span className={styles.muted}>Cancelled</span>
                      ) : s.commissionStatus === 'CREDITED' ? (
                        <span className={styles.positive}>{formatINR(s.commissionAmount)}</span>
                      ) : s.commissionStatus === 'FAILED' ? (
                        <span className={styles.pendingText} title="Recorded for the admin team to resolve">Pending</span>
                      ) : <span className={styles.muted}>{formatINR(s.commissionAmount)}</span>}
                    </td>
                    <td className={styles.muted}>{s.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.pages > 1 && (
            <div className={styles.pagination}>
              <button type="button" className={styles.btn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Previous</button>
              <span>Page {page} of {data.pages}</span>
              <button type="button" className={styles.btn} disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {selling && (
        <SellModal
          product={selling}
          rate={data.saleCommissionRate || 0}
          onClose={() => setSelling(null)}
          onSold={() => { setSelling(null); setPage(1); fetchStock(); }}
        />
      )}
    </section>
  );
};

export default FranchiseStockSection;
