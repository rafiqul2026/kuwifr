// client/src/pages/member/FranchisePanel.jsx
// Franchise Panel (member side): the franchise's stock, sales, deliveries,
// bills and the product list — each with search, date range and CSV export.
// Desktop shows tables; phones show cards. Backed by /api/franchise/stock,
// /api/franchise/sales and /api/franchise/panel/*.
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import s from '../admin/FranchiseInventory.module.css';
import { formatINR, formatNum, formatDate, downloadCsv } from '../admin/adminInsightsUtils';

const TABS = [
  { key: 'stock', label: 'My Stock' },
  { key: 'received', label: 'Stock Received' },
  { key: 'sales', label: 'Sales Report' },
  { key: 'deliveries', label: 'Deliveries' },
  { key: 'bills', label: 'Billing' },
  { key: 'products', label: 'Product List' }
];

const today = () => new Date().toISOString().slice(0, 10);
const weekAgo = () => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
const pct = (rate) => `${((rate || 0) * 100).toFixed(2).replace(/\.00$/, '')}%`;
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const recipient = (r) => (r.memberId
  ? <span className={s.prodCell}><strong>{r.memberName}</strong><span>{r.memberId}</span></span>
  : <span className={s.prodCell}><strong>{r.customerName || '—'}</strong><span>{r.customerPhone || 'Walk-in customer'}</span></span>);

const product = (r) => <span className={s.prodCell}><strong>{r.productName}</strong><span><code className={s.code}>{r.productId}</code></span></span>;

const commission = (r) => {
  if (r.voided) return <span className={s.muted}>Cancelled</span>;
  if (r.commissionStatus === 'CREDITED') return <span className={s.green}>{formatINR(r.commissionAmount)}</span>;
  if (r.commissionStatus === 'FAILED') return <span className={s.amber} title="Recorded for the admin team to resolve">Pending</span>;
  return <span className={s.muted}>{formatINR(r.commissionAmount)}</span>;
};

// ------------------------------------------------------------------ helpers

const useDebounced = (value, ms = 350) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};

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

const Kpi = ({ label, value, hint, accent, highlight, valueClass = '' }) => (
  <div className={`${s.kpi} ${highlight ? s.kpiHighlight : ''}`} style={accent ? { '--kpi-accent': accent } : undefined}>
    <span className={s.kpiLabel}>{label}</span>
    <span className={`${s.kpiValue} ${valueClass}`}>{value}</span>
    {hint && <span className={s.kpiHint}>{hint}</span>}
  </div>
);

/**
 * Table on desktop, cards on phones, from one column list.
 * column: { key, label, render(row), num, card: 'title'|'aside'|'stat'|'meta'|false }
 */
const ResponsiveList = ({ columns, rows, rowKey = (r) => r._id, rowClass, footer }) => (
  <>
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.num ? s.num : undefined}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className={rowClass ? rowClass(r) : undefined}>
              {columns.map((c) => <td key={c.key} className={`${c.num ? s.num : ''} ${c.wrap ? s.wrap : ''}`}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
    <div className={s.cards}>
      {rows.map((r) => {
        const title = columns.find((c) => c.card === 'title');
        const aside = columns.find((c) => c.card === 'aside');
        const stats = columns.filter((c) => c.card === 'stat');
        const metas = columns.filter((c) => c.card === 'meta');
        return (
          <article key={rowKey(r)} className={s.itemCard} style={rowClass && rowClass(r) ? { opacity: 0.55 } : undefined}>
            <div className={s.cardTop}>
              {title ? title.render(r) : null}
              {aside ? <span style={{ fontWeight: 600, textAlign: 'right' }}>{aside.render(r)}</span> : null}
            </div>
            {stats.length > 0 && (
              <div className={s.cardStats} style={{ gridTemplateColumns: `repeat(${Math.min(3, stats.length)}, minmax(0, 1fr))` }}>
                {stats.map((c) => <div key={c.key} className={s.cardStat}><span>{c.label}</span><b>{c.render(r)}</b></div>)}
              </div>
            )}
            {metas.map((c) => (
              <div key={c.key} className={s.cardFoot}><span>{c.label}</span><span style={{ textAlign: 'right' }}>{c.render(r)}</span></div>
            ))}
          </article>
        );
      })}
    </div>
  </>
);

const Pager = ({ page, pages, onPage }) => (pages > 1 ? (
  <div className={s.pagination}>
    <button type="button" className={s.btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>← Previous</button>
    <span>Page {page} of {pages}</span>
    <button type="button" className={s.btn} disabled={page >= pages} onClick={() => onPage(page + 1)}>Next →</button>
  </div>
) : null);

const Empty = ({ icon, children }) => (
  <div className={s.empty}><span className={s.emptyIcon}>{icon}</span>{children}</div>
);

/** Search + date range + export, shared by the list tabs. */
const Filters = ({ q, setQ, from, setFrom, to, setTo, placeholder, onExport, exporting, children }) => (
  <div className={s.filters}>
    <input className={s.search} type="search" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
    <input className={s.dateInput} type="date" value={from} max={to || today()} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
    <span className={s.dateSep}>to</span>
    <input className={s.dateInput} type="date" value={to} min={from || undefined} max={today()} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
    {children}
    <button type="button" className={s.btn} onClick={onExport} disabled={exporting}>{exporting ? 'Exporting…' : '⬇ Export'}</button>
  </div>
);

/** Data hook for the paged list endpoints. */
const usePanelList = (url, extraParams = {}) => {
  const { showNotification } = useNotification();
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [exporting, setExporting] = useState(false);
  const dq = useDebounced(q);
  const extraKey = JSON.stringify(extraParams);

  const params = useCallback(() => ({
    q: dq || undefined, from: from || undefined, to: to || undefined, ...JSON.parse(extraKey)
  }), [dq, from, to, extraKey]);

  useEffect(() => { setPage(1); }, [dq, from, to, extraKey]);

  const load = useCallback(async () => {
    try {
      const res = await api.get(url, { params: { ...params(), page } });
      setData(res.data?.data || null);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to load this report.', 'error');
      setData((d) => d || { rows: [], total: 0, page: 1, pages: 1, totals: {} });
    }
  }, [url, params, page, showNotification]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = async (name) => {
    setExporting(true);
    try {
      await downloadCsv(url, params(), `${name}.csv`);
    } catch {
      showNotification('Export failed. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return { q, setQ, from, setFrom, to, setTo, page, setPage, data, exporting, exportCsv, reload: load };
};

// --------------------------------------------------------------- sell modal

const SellModal = ({ item, rate, onClose, onSold }) => {
  const { showNotification } = useNotification();
  const [form, setForm] = useState({ qty: '1', memberId: '', customerName: '', customerPhone: '', reference: '', entryDate: today() });
  const [saving, setSaving] = useState(false);
  useEscape(onClose);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const qty = parseInt(form.qty, 10) || 0;
  const tooMany = qty > item.balanceQty;
  const value = item.kspPerUnit * qty;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/api/franchise/sales', { ...form, qty, productId: item.productId });
      showNotification(res.data?.message || 'Sale recorded.', 'success');
      onSold();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Could not record this sale.', 'error');
      setSaving(false);
    }
  };

  return (
    <div className={s.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className={s.dialog} onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="sell-title">
        <div className={s.dialogHead}>
          <div>
            <h2 id="sell-title" className={s.dialogTitle}>Sell {item.productName}</h2>
            <p className={s.dialogSub}>{item.productId} · {item.balanceQty} in your stock · {formatINR(item.kspPerUnit)} each</p>
          </div>
          <button type="button" className={s.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={s.dialogBody}>
          <div className={s.formGrid}>
            <div className={s.field}>
              <label htmlFor="fs-qty">Quantity</label>
              <input id="fs-qty" className={s.input} type="number" inputMode="numeric" min="1" max={item.balanceQty} step="1" value={form.qty} onChange={set('qty')} required />
            </div>
            <div className={s.field}>
              <label htmlFor="fs-date">Sale date</label>
              <input id="fs-date" className={s.input} type="date" min={weekAgo()} max={today()} value={form.entryDate} onChange={set('entryDate')} required />
            </div>
            <div className={`${s.field} ${s.full}`}>
              <label htmlFor="fs-member">Buyer Member ID <span className={s.muted}>(if the buyer is a member)</span></label>
              <input id="fs-member" className={s.input} placeholder="e.g. KFR123456" autoCapitalize="characters" value={form.memberId} onChange={set('memberId')} />
            </div>
            <div className={s.field}>
              <label htmlFor="fs-name">Or customer name</label>
              <input id="fs-name" className={s.input} maxLength={120} autoComplete="off" value={form.customerName} onChange={set('customerName')} required={!form.memberId.trim()} />
            </div>
            <div className={s.field}>
              <label htmlFor="fs-phone">Customer phone</label>
              <input id="fs-phone" className={s.input} maxLength={20} inputMode="tel" autoComplete="off" value={form.customerPhone} onChange={set('customerPhone')} />
            </div>
            <div className={`${s.field} ${s.full}`}>
              <label htmlFor="fs-ref">Your reference <span className={s.muted}>(optional — a bill number is created automatically)</span></label>
              <input id="fs-ref" className={s.input} maxLength={120} value={form.reference} onChange={set('reference')} />
            </div>
          </div>
          {qty > 0 && (
            <div className={tooMany ? s.summaryWarn : s.summary} aria-live="polite">
              {tooMany ? <>You only have <b>{item.balanceQty}</b> unit(s) of this product.</> : (
                <>
                  <div className={s.summaryRow}><span>Sale value ({qty} × {formatINR(item.kspPerUnit)})</span><b>{formatINR(value)}</b></div>
                  <div className={s.summaryRow}><span>KBP</span><b>{formatNum(item.kbpPerUnit * qty)}</b></div>
                  <div className={s.summaryRow}><span>Your commission ({pct(rate)})</span><b>{formatINR(value * rate)}</b></div>
                  <div className={s.summaryRow}><span>Stock left after this</span><b>{item.balanceQty - qty} unit(s)</b></div>
                </>
              )}
            </div>
          )}
        </div>
        <div className={s.dialogFoot}>
          <button type="button" className={s.btn} onClick={onClose}>Cancel</button>
          <button type="submit" className={s.btnPrimary} disabled={saving || qty < 1 || tooMany}>{saving ? 'Recording…' : 'Record sale'}</button>
        </div>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------- bill view

const printBill = (bill, franchise) => {
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) return false;
  const buyer = bill.memberId ? `${bill.memberName} (${bill.memberId})` : bill.customerName || 'Walk-in customer';
  const addr = franchise.address ? [franchise.address.street, franchise.address.city, franchise.address.state, franchise.address.pincode].filter(Boolean).join(', ') : '';
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Bill ${escapeHtml(bill.billNumber)}</title>
<style>
  body{font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1c2a2a;margin:32px;font-size:13px}
  h1{margin:0;font-size:20px;color:#008080} .muted{color:#737373}
  .top{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #008080;padding-bottom:14px;margin-bottom:18px}
  .grid{display:flex;justify-content:space-between;gap:24px;margin-bottom:18px}
  .label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#a3a3a3;margin-bottom:3px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px} th,td{padding:9px 8px;border-bottom:1px solid #e7e5e0;text-align:left}
  th{font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:#737373;background:#fafaf8} .r{text-align:right}
  .total td{font-weight:700;font-size:15px;border-bottom:none}
  .void{color:#b91c1c;font-weight:700;font-size:16px;border:2px solid #b91c1c;display:inline-block;padding:4px 10px;margin-bottom:12px}
  @media print{body{margin:12mm}}
</style></head><body>
<div class="top"><div><h1>KUWIFR Franchise Bill</h1><div class="muted">${escapeHtml(franchise.name)} · ${escapeHtml(franchise.memberId)}</div>
${addr ? `<div class="muted">${escapeHtml(addr)}</div>` : ''}${franchise.phone ? `<div class="muted">Phone ${escapeHtml(franchise.phone)}</div>` : ''}</div>
<div style="text-align:right"><div class="label">Bill No.</div><div style="font-size:16px;font-weight:700">${escapeHtml(bill.billNumber)}</div>
<div class="label" style="margin-top:8px">Date</div><div>${escapeHtml(formatDate(bill.entryDate))}</div></div></div>
${bill.voided ? `<div class="void">CANCELLED${bill.voidReason ? ` — ${escapeHtml(bill.voidReason)}` : ''}</div>` : ''}
<div class="grid"><div><div class="label">Billed to</div><div style="font-weight:600">${escapeHtml(buyer)}</div>${bill.customerPhone ? `<div class="muted">${escapeHtml(bill.customerPhone)}</div>` : ''}</div>
${bill.reference ? `<div style="text-align:right"><div class="label">Reference</div><div>${escapeHtml(bill.reference)}</div></div>` : ''}</div>
<table><thead><tr><th>Product</th><th>Product ID</th><th class="r">Qty</th><th class="r">MRP</th><th class="r">Rate (KSP)</th><th class="r">KBP</th><th class="r">Amount</th></tr></thead>
<tbody><tr><td>${escapeHtml(bill.productName)}</td><td>${escapeHtml(bill.productId)}</td><td class="r">${bill.qty}</td>
<td class="r">${bill.mrpPerUnit != null ? escapeHtml(formatINR(bill.mrpPerUnit)) : '—'}</td><td class="r">${escapeHtml(formatINR(bill.kspPerUnit))}</td>
<td class="r">${escapeHtml(formatNum(bill.totalKBP))}</td><td class="r">${escapeHtml(formatINR(bill.totalKSP))}</td></tr>
<tr class="total"><td colspan="6" class="r">Total</td><td class="r">${escapeHtml(formatINR(bill.totalKSP))}</td></tr></tbody></table>
<div class="muted">Computer-generated bill from the KUWIFR franchise panel.</div>
<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
  return true;
};

const BillDialog = ({ billId, onClose }) => {
  const { showNotification } = useNotification();
  const [data, setData] = useState(null);
  useEscape(onClose);

  useEffect(() => {
    let alive = true;
    api.get(`/api/franchise/panel/bills/${billId}`)
      .then((res) => { if (alive) setData(res.data?.data || null); })
      .catch((err) => { showNotification(err.response?.data?.message || 'Could not open this bill.', 'error'); onClose(); });
    return () => { alive = false; };
  }, [billId, onClose, showNotification]);

  const b = data?.bill;
  return (
    <div className={s.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-labelledby="bill-title">
        <div className={s.dialogHead}>
          <div>
            <h2 id="bill-title" className={s.dialogTitle}>{b ? `Bill ${b.billNumber}` : 'Bill'}</h2>
            {b && <p className={s.dialogSub}>{formatDate(b.entryDate)}{b.voided ? ' · Cancelled' : ''}</p>}
          </div>
          <button type="button" className={s.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={s.dialogBody}>
          {!b ? <div className={s.skeleton} style={{ height: 200 }} /> : (
            <div className={s.billSheet}>
              {b.voided && <div className={s.summaryWarn} style={{ marginTop: 0, marginBottom: 14 }}>This bill was cancelled{b.voidReason ? `: ${b.voidReason}` : ''}. Its commission was reversed.</div>}
              <div className={s.billGrid}>
                <div>
                  <span className={s.billLabel}>Billed to</span>
                  <strong>{b.memberId ? `${b.memberName} (${b.memberId})` : b.customerName || 'Walk-in customer'}</strong>
                  {b.customerPhone && <div className={s.muted}>{b.customerPhone}</div>}
                </div>
                <div>
                  <span className={s.billLabel}>Sold by</span>
                  <strong>{data.franchise.name}</strong>
                  <div className={s.muted}>{data.franchise.memberId}</div>
                </div>
              </div>
              <div className={s.summary} style={{ marginTop: 0 }}>
                <div className={s.summaryRow}><span>{b.productName} <code className={s.code}>{b.productId}</code></span><b>{b.qty} unit(s)</b></div>
                {b.mrpPerUnit != null && <div className={s.summaryRow}><span>MRP per unit</span><b className={s.mrpStrike}>{formatINR(b.mrpPerUnit)}</b></div>}
                <div className={s.summaryRow}><span>Rate (KSP) per unit</span><b>{formatINR(b.kspPerUnit)}</b></div>
                <div className={s.summaryRow}><span>KBP</span><b>{formatNum(b.totalKBP)}</b></div>
                <div className={s.summaryRow} style={{ fontSize: 15, marginTop: 4 }}><span><b>Bill amount</b></span><b>{formatINR(b.totalKSP)}</b></div>
                <div className={s.summaryRow}><span>Your commission</span><b>{b.voided ? 'Reversed' : formatINR(b.commissionAmount)}</b></div>
              </div>
              {b.reference && <p className={s.hint} style={{ marginTop: 12 }}>Your reference: {b.reference}</p>}
            </div>
          )}
        </div>
        <div className={s.dialogFoot}>
          <button type="button" className={s.btn} onClick={onClose}>Close</button>
          <button
            type="button"
            className={s.btnPrimary}
            disabled={!b}
            onClick={() => { if (!printBill(b, data.franchise)) showNotification('Allow pop-ups for this site to print the bill.', 'warning'); }}
          >
            🖨 Print bill
          </button>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------- tabs

const StockTab = ({ stock, onSell }) => {
  const t = stock.totals || {};
  const rows = stock.products.filter((p) => p.assignedQty > 0 || p.balanceQty > 0);
  return (
    <>
      <section className={s.kpis} aria-label="Stock summary">
        <Kpi label="Stock received" value={`${formatNum(t.liftedQty)} units`} hint={`${formatINR(t.liftedKSP)} KSP · ${formatNum(t.liftedKBP)} KBP`} accent="#16a34a" />
        <Kpi label="Sold" value={formatINR(t.soldKSP)} hint={`${formatNum(t.soldQty)} units · ${formatNum(t.soldKBP)} KBP`} accent="#0f766e" />
        <Kpi label="Commission earned" value={formatINR(t.commission)} valueClass={s.green} hint={`${pct(stock.saleCommissionRate)} of every sale`} accent="#047857" />
        <Kpi label="Remaining stock" value={`${formatNum(t.balanceQty)} units`} hint={`${formatINR(t.balanceKSP)} KSP · ${formatNum(t.balanceKBP)} KBP`} highlight />
      </section>

      {rows.length === 0 ? (
        <Empty icon="📦">No stock has been assigned to you yet. KUWIFR admin will assign products to your franchise.</Empty>
      ) : (
        <ResponsiveList
          rowKey={(r) => r.productId}
          rows={rows}
          columns={[
            { key: 'p', label: 'Product', render: product, card: 'title' },
            { key: 'mrp', label: 'MRP', num: true, render: (r) => (r.mrpPerUnit != null ? formatINR(r.mrpPerUnit) : '—'), card: 'meta' },
            { key: 'ksp', label: 'KSP', num: true, render: (r) => formatINR(r.kspPerUnit), card: 'aside' },
            { key: 'kbp', label: 'KBP', num: true, render: (r) => formatNum(r.kbpPerUnit), card: 'meta' },
            { key: 'in', label: 'Received', num: true, render: (r) => formatNum(r.assignedQty), card: 'stat' },
            { key: 'sold', label: 'Sold', num: true, render: (r) => formatNum(r.soldQty), card: 'stat' },
            { key: 'bal', label: 'In stock', num: true, render: (r) => <span className={s.strong}>{formatNum(r.balanceQty)}</span>, card: 'stat' },
            { key: 'rksp', label: 'Remaining KSP', num: true, render: (r) => formatINR(r.balanceKSP), card: 'meta' },
            { key: 'rkbp', label: 'Remaining KBP', num: true, render: (r) => formatNum(r.balanceKBP), card: 'meta' },
            {
              key: 'act',
              label: '',
              render: (r) => (
                <button type="button" className={s.btnPrimary} style={{ height: 34 }} disabled={r.balanceQty < 1} onClick={() => onSell(r)}>Sell</button>
              ),
              card: 'meta'
            }
          ]}
          footer={(
            <tr>
              <td className={s.strong}>Total</td>
              <td /><td /><td />
              <td className={`${s.num} ${s.strong}`}>{formatNum(t.liftedQty)}</td>
              <td className={`${s.num} ${s.strong}`}>{formatNum(t.soldQty)}</td>
              <td className={`${s.num} ${s.strong}`}>{formatNum(t.balanceQty)}</td>
              <td className={`${s.num} ${s.strong}`}>{formatINR(t.balanceKSP)}</td>
              <td className={`${s.num} ${s.strong}`}>{formatNum(t.balanceKBP)}</td>
              <td />
            </tr>
          )}
        />
      )}
    </>
  );
};

const ListTab = ({ list, placeholder, csvName, meta, empty, columns, rowClass, toolbar }) => {
  const d = list.data;
  return (
    <>
      <Filters {...list} placeholder={placeholder} onExport={() => list.exportCsv(csvName)}>{toolbar}</Filters>
      {!d ? <div className={s.skeleton} style={{ height: 240 }} /> : (
        <>
          <p className={s.metaLine}>{meta(d)}</p>
          {d.rows.length === 0 ? <Empty icon="🗂️">{empty}</Empty> : (
            <>
              <ResponsiveList rows={d.rows} columns={columns} rowClass={rowClass} />
              <Pager page={d.page} pages={d.pages} onPage={list.setPage} />
            </>
          )}
        </>
      )}
    </>
  );
};

const ReceivedTab = () => {
  const list = usePanelList('/api/franchise/panel/received');
  return (
    <ListTab
      list={list}
      placeholder="Search product name, ID or reference…"
      csvName="stock-received"
      empty="No stock received in this period."
      meta={(d) => <><b>{formatNum(d.totals.entries)}</b> assignment(s) · <b>{formatNum(d.totals.qty)}</b> units · <b>{formatINR(d.totals.ksp)}</b> KSP · <b>{formatNum(d.totals.kbp)}</b> KBP</>}
      columns={[
        { key: 'd', label: 'Date', render: (r) => formatDate(r.entryDate), card: 'meta' },
        { key: 'p', label: 'Product', render: product, card: 'title', wrap: true },
        { key: 'q', label: 'Qty', num: true, render: (r) => formatNum(r.qty), card: 'stat' },
        { key: 'uk', label: 'KSP / unit', num: true, render: (r) => formatINR(r.kspPerUnit), card: 'meta' },
        { key: 'ub', label: 'KBP / unit', num: true, render: (r) => formatNum(r.kbpPerUnit), card: 'meta' },
        { key: 'tk', label: 'Total KSP', num: true, render: (r) => <span className={s.strong}>{formatINR(r.totalKSP)}</span>, card: 'stat' },
        { key: 'tb', label: 'Total KBP', num: true, render: (r) => formatNum(r.totalKBP), card: 'stat' },
        { key: 'ref', label: 'Reference', render: (r) => r.reference || <span className={s.muted}>—</span>, card: 'meta' }
      ]}
    />
  );
};

const SalesTab = ({ onOpenBill }) => {
  const [view, setView] = useState('product');
  const list = usePanelList('/api/franchise/panel/sales');
  const { showNotification } = useNotification();
  const [breakdown, setBreakdown] = useState(null);

  useEffect(() => {
    if (view !== 'product') return;
    api.get('/api/franchise/panel/sales', { params: { breakdown: 'product', q: list.q || undefined, from: list.from || undefined, to: list.to || undefined } })
      .then((res) => setBreakdown(res.data?.data?.products || []))
      .catch(() => showNotification('Failed to load the sales breakdown.', 'error'));
  }, [view, list.q, list.from, list.to, showNotification]);

  const toggle = (
    <div className={s.tabs} role="tablist" aria-label="Sales view">
      <button type="button" role="tab" aria-selected={view === 'product'} className={`${s.tab} ${view === 'product' ? s.tabActive : ''}`} onClick={() => setView('product')}>By product</button>
      <button type="button" role="tab" aria-selected={view === 'all'} className={`${s.tab} ${view === 'all' ? s.tabActive : ''}`} onClick={() => setView('all')}>Every sale</button>
    </div>
  );

  if (view === 'product') {
    const rows = breakdown || [];
    const tot = rows.reduce((a, r) => ({ qty: a.qty + r.qty, ksp: a.ksp + r.ksp, kbp: a.kbp + r.kbp, commission: a.commission + r.commission, bills: a.bills + r.bills }), { qty: 0, ksp: 0, kbp: 0, commission: 0, bills: 0 });
    return (
      <>
        <Filters {...list} placeholder="Search product, buyer or bill no.…" onExport={() => list.exportCsv('sales-history')}>{toggle}</Filters>
        {!breakdown ? <div className={s.skeleton} style={{ height: 240 }} /> : rows.length === 0 ? <Empty icon="🧾">No sales in this period.</Empty> : (
          <>
            <p className={s.metaLine}><b>{formatNum(tot.bills)}</b> bill(s) · <b>{formatNum(tot.qty)}</b> units · <b>{formatINR(tot.ksp)}</b> sales · <b>{formatNum(tot.kbp)}</b> KBP · <b>{formatINR(tot.commission)}</b> commission</p>
            <ResponsiveList
              rowKey={(r) => r.productId}
              rows={rows}
              columns={[
                { key: 'p', label: 'Product', render: product, card: 'title', wrap: true },
                { key: 'b', label: 'Bills', num: true, render: (r) => formatNum(r.bills), card: 'stat' },
                { key: 'q', label: 'Units sold', num: true, render: (r) => formatNum(r.qty), card: 'stat' },
                { key: 'k', label: 'Sales (KSP)', num: true, render: (r) => <span className={s.strong}>{formatINR(r.ksp)}</span>, card: 'aside' },
                { key: 'kb', label: 'KBP', num: true, render: (r) => formatNum(r.kbp), card: 'stat' },
                { key: 'c', label: 'Commission', num: true, render: (r) => <span className={s.green}>{formatINR(r.commission)}</span>, card: 'meta' },
                { key: 'l', label: 'Last sold', render: (r) => formatDate(r.lastSold), card: 'meta' }
              ]}
            />
          </>
        )}
      </>
    );
  }

  return (
    <ListTab
      list={list}
      placeholder="Search product, buyer or bill no.…"
      csvName="sales-history"
      toolbar={toggle}
      empty="No sales in this period."
      meta={(d) => <><b>{formatNum(d.totals.entries)}</b> sale(s) · <b>{formatNum(d.totals.qty)}</b> units · <b>{formatINR(d.totals.ksp)}</b> · <b>{formatINR(d.totals.commission)}</b> commission</>}
      columns={[
        { key: 'd', label: 'Date', render: (r) => formatDate(r.entryDate), card: 'meta' },
        { key: 'bill', label: 'Bill no.', render: (r) => <button type="button" className={s.linkBtn} onClick={() => onOpenBill(r._id)}>{r.billNumber}</button>, card: 'meta' },
        { key: 'p', label: 'Product', render: product, card: 'title', wrap: true },
        { key: 'q', label: 'Qty', num: true, render: (r) => formatNum(r.qty), card: 'stat' },
        { key: 'v', label: 'Value', num: true, render: (r) => <span className={s.strong}>{formatINR(r.totalKSP)}</span>, card: 'aside' },
        { key: 'kb', label: 'KBP', num: true, render: (r) => formatNum(r.totalKBP), card: 'stat' },
        { key: 'buyer', label: 'Buyer', render: recipient, card: 'meta', wrap: true },
        { key: 'c', label: 'Commission', num: true, render: commission, card: 'stat' }
      ]}
    />
  );
};

const DeliveriesTab = ({ onOpenBill }) => {
  const [kind, setKind] = useState('');
  const list = usePanelList('/api/franchise/panel/deliveries', { kind: kind || undefined });
  const kinds = [['', 'All'], ['SALE', 'Sales'], ['DISPATCH', 'Dispatches']];
  return (
    <ListTab
      list={list}
      placeholder="Search recipient name, Member ID, phone or product…"
      csvName="deliveries"
      toolbar={(
        <div className={s.tabs} role="tablist" aria-label="Delivery type">
          {kinds.map(([v, l]) => (
            <button key={v} type="button" role="tab" aria-selected={kind === v} className={`${s.tab} ${kind === v ? s.tabActive : ''}`} onClick={() => setKind(v)}>{l}</button>
          ))}
        </div>
      )}
      empty="No deliveries in this period."
      meta={(d) => <><b>{formatNum(d.totals.entries)}</b> deliver{d.totals.entries === 1 ? 'y' : 'ies'} · <b>{formatNum(d.totals.qty)}</b> units</>}
      columns={[
        { key: 'd', label: 'Date', render: (r) => formatDate(r.entryDate), card: 'meta' },
        { key: 'r', label: 'Delivered to', render: recipient, card: 'title', wrap: true },
        { key: 't', label: 'Type', render: (r) => <span className={r.type === 'SALE' ? s.badgeSale : s.badgeDispatch}>{r.type === 'SALE' ? 'Sale' : 'Dispatch'}</span>, card: 'aside' },
        { key: 'p', label: 'Product', render: product, card: 'meta', wrap: true },
        { key: 'q', label: 'Qty', num: true, render: (r) => formatNum(r.qty), card: 'stat' },
        { key: 'kb', label: 'KBP', num: true, render: (r) => formatNum(r.totalKBP), card: 'stat' },
        { key: 'bill', label: 'Bill no.', render: (r) => (r.billNumber ? <button type="button" className={s.linkBtn} onClick={() => onOpenBill(r._id)}>{r.billNumber}</button> : <span className={s.muted}>—</span>), card: 'meta' }
      ]}
    />
  );
};

const BillsTab = ({ onOpenBill }) => {
  const [status, setStatus] = useState('');
  const list = usePanelList('/api/franchise/panel/bills', { status: status || undefined });
  const statuses = [['', 'All bills'], ['ACTIVE', 'Valid'], ['CANCELLED', 'Cancelled']];
  return (
    <ListTab
      list={list}
      placeholder="Search bill no., buyer or product…"
      csvName="billing-record"
      toolbar={(
        <div className={s.tabs} role="tablist" aria-label="Bill status">
          {statuses.map(([v, l]) => (
            <button key={v} type="button" role="tab" aria-selected={status === v} className={`${s.tab} ${status === v ? s.tabActive : ''}`} onClick={() => setStatus(v)}>{l}</button>
          ))}
        </div>
      )}
      empty="No bills in this period."
      rowClass={(r) => (r.voided ? s.rowVoided : '')}
      meta={(d) => <><b>{formatNum(d.totals.entries)}</b> valid bill(s) worth <b>{formatINR(d.totals.ksp)}</b>{d.totals.cancelled ? <> · <b>{d.totals.cancelled}</b> cancelled</> : null} · <b>{formatINR(d.totals.commission)}</b> commission</>}
      columns={[
        { key: 'bill', label: 'Bill no.', render: (r) => <button type="button" className={s.linkBtn} onClick={() => onOpenBill(r._id)}>{r.billNumber}</button>, card: 'title' },
        { key: 'd', label: 'Date', render: (r) => formatDate(r.entryDate), card: 'meta' },
        { key: 'buyer', label: 'Billed to', render: recipient, card: 'meta', wrap: true },
        { key: 'p', label: 'Product', render: product, card: 'meta', wrap: true },
        { key: 'q', label: 'Qty', num: true, render: (r) => formatNum(r.qty), card: 'stat' },
        { key: 'rate', label: 'Rate', num: true, render: (r) => formatINR(r.kspPerUnit), card: 'stat' },
        { key: 'amt', label: 'Amount', num: true, render: (r) => <span className={s.strong}>{formatINR(r.totalKSP)}</span>, card: 'aside' },
        { key: 'c', label: 'Commission', num: true, render: commission, card: 'stat' },
        { key: 'st', label: 'Status', render: (r) => <span className={r.voided ? s.badgeVoid : s.badgeLift}>{r.voided ? 'Cancelled' : 'Valid'}</span>, card: 'meta' }
      ]}
    />
  );
};

const ProductsTab = () => {
  const { showNotification } = useNotification();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [rows, setRows] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get('/api/franchise/panel/catalog', { params: { q: dq || undefined } })
      .then((res) => setRows(res.data?.data?.products || []))
      .catch(() => showNotification('Failed to load the product list.', 'error'));
  }, [dq, showNotification]);

  const exportCsv = async () => {
    setExporting(true);
    try { await downloadCsv('/api/franchise/panel/catalog', { q: dq || undefined }, 'product-list.csv'); } catch { showNotification('Export failed.', 'error'); } finally { setExporting(false); }
  };

  return (
    <>
      <div className={s.filters}>
        <input className={s.search} type="search" placeholder="Search product name, ID or category…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
        <button type="button" className={s.btn} onClick={exportCsv} disabled={exporting}>{exporting ? 'Exporting…' : '⬇ Export'}</button>
      </div>
      {!rows ? <div className={s.skeleton} style={{ height: 300 }} /> : rows.length === 0 ? <Empty icon="🔍">No products match.</Empty> : (
        <>
          <p className={s.metaLine}><b>{rows.length}</b> product(s) · MRP = printed price · KSP = your selling price · KBP = business points</p>
          <div className={s.catalogGrid}>
            {rows.map((p) => (
              <article key={p.productId} className={s.productCard}>
                {p.image ? <img className={s.productImg} src={p.image} alt={p.name} loading="lazy" /> : <div className={s.productImg} aria-hidden="true">📦</div>}
                <div className={s.productBody}>
                  <span className={s.prodCell}>
                    <strong>{p.name}</strong>
                    <span><code className={s.code}>{p.productId}</code> · {p.category}</span>
                  </span>
                  <div className={s.priceRow}>
                    <div className={s.price}><span>MRP</span><b className={p.mrp > p.ksp ? s.mrpStrike : ''}>{formatINR(p.mrp)}</b></div>
                    <div className={s.price}><span>KSP</span><b>{formatINR(p.ksp)}</b></div>
                    <div className={s.price}><span>KBP</span><b>{formatNum(p.kbp)}</b></div>
                  </div>
                  <div className={s.cardFoot} style={{ marginTop: 'auto' }}>
                    <span>{p.saving > 0 ? <span className={s.green}>Save {formatINR(p.saving)}</span> : ' '}</span>
                    <span>{p.inStock > 0 ? <><b style={{ color: 'var(--ink)' }}>{p.inStock}</b> in your stock</> : 'Not in your stock'}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
};

// --------------------------------------------------------------------- root

const FranchisePanel = () => {
  const { showNotification } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'stock';
  const [stock, setStock] = useState(null);
  const [selling, setSelling] = useState(null);
  const [billId, setBillId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadStock = useCallback(async () => {
    try {
      const res = await api.get('/api/franchise/stock');
      setStock(res.data?.data || null);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to load your stock.', 'error');
    }
  }, [showNotification]);

  useEffect(() => { loadStock(); }, [loadStock]);

  const setTab = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'stock') next.delete('tab'); else next.set('tab', key);
    setSearchParams(next, { replace: true });
  };

  const closeBill = useCallback(() => setBillId(null), []);
  const closeSell = useCallback(() => setSelling(null), []);

  return (
    <section className={s.panelRoot} aria-label="Franchise panel">
      <div className={s.header} style={{ marginBottom: 14 }}>
        <div>
          <h2 className={s.title} style={{ fontSize: 22 }}>Franchise Panel</h2>
          <p className={s.subtitle}>
            Your stock, sales, deliveries and bills. You earn <strong>{pct(stock?.saleCommissionRate)}</strong> of the sale value on every product you sell.
          </p>
        </div>
      </div>

      <div className={s.panelTabs} role="tablist" aria-label="Franchise panel sections">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`${s.panelTab} ${tab === t.key ? s.panelTabActive : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div key={`${tab}-${refreshKey}`}>
        {tab === 'stock' && (stock ? <StockTab stock={stock} onSell={setSelling} /> : <div className={s.skeleton} style={{ height: 320 }} />)}
        {tab === 'received' && <ReceivedTab />}
        {tab === 'sales' && <SalesTab onOpenBill={setBillId} />}
        {tab === 'deliveries' && <DeliveriesTab onOpenBill={setBillId} />}
        {tab === 'bills' && <BillsTab onOpenBill={setBillId} />}
        {tab === 'products' && <ProductsTab />}
      </div>

      {selling && stock && (
        <SellModal
          item={selling}
          rate={stock.saleCommissionRate || 0}
          onClose={closeSell}
          onSold={() => { setSelling(null); loadStock(); setRefreshKey((k) => k + 1); }}
        />
      )}
      {billId && <BillDialog billId={billId} onClose={closeBill} />}
    </section>
  );
};

export default FranchisePanel;
