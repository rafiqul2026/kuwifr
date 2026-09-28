// client/src/pages/member/invoiceDocument.js
//
// The member tax invoice as ONE standalone A4 HTML document. The Orders page
// shows it in an <iframe> preview and prints/downloads exactly the same
// document in its own window — printing the app page itself (hiding
// everything else with CSS) left the hidden layout taking up space, so the
// PDF came out blank at the top and clipped.

import {
  COMPANY_LEGAL_NAME,
  COMPANY_ADDRESS,
  COMPANY_EMAIL,
  COMPANY_GSTIN,
  COMPANY_PAN,
  COMPANY_CIN
} from '../../seo/seoConfig';
import { openPrintableDocument, AUTO_PRINT_SCRIPT } from '../../utils/printDocument';

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const inr = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const belowHundred = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const belowThousand = (n) =>
  [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : '', belowHundred(n % 100)].filter(Boolean).join(' ');

/** Indian numbering: 110000.5 -> "Rupees One Lakh Ten Thousand and Fifty Paise Only" */
export const amountInWords = (amount) => {
  const rupees = Math.floor(Math.max(0, Number(amount) || 0));
  const paise = Math.round(((Number(amount) || 0) - rupees) * 100);
  const parts = [];
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;
  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  const words = parts.join(' ') || 'Zero';
  return `Rupees ${words}${paise ? ` and ${belowHundred(paise)} Paise` : ''} Only`;
};

const formatDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatAddress = (a) => (a ? [a.street, a.city, a.state, a.pincode].filter(Boolean).join(', ') : '');

export const invoiceNumberOf = (order) =>
  order.invoiceNumber || order.orderNumber || `INV-${String(order._id || '').slice(-6).toUpperCase()}`;

const STYLES = `
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1f2937; font-size: 12px; line-height: 1.45;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .sheet { max-width: 186mm; margin: 0 auto; padding: 20px 0; }
  .toolbar { display: flex; gap: 8px; justify-content: flex-end; max-width: 186mm; margin: 16px auto 0; }
  .toolbar button {
    font: inherit; font-weight: 600; font-size: 13px; padding: 9px 16px; border-radius: 8px; cursor: pointer;
    border: 1px solid #0f766e; background: #0f766e; color: #fff;
  }
  .toolbar button.secondary { background: #fff; color: #0f766e; }

  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
    padding-bottom: 14px; border-bottom: 3px solid #0f766e; }
  .brand { display: flex; gap: 12px; align-items: flex-start; }
  .brand img { width: 54px; height: 54px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
  .brand h1 { margin: 0 0 2px; font-size: 19px; letter-spacing: 0.2px; color: #111827; }
  .brand p { margin: 1px 0; font-size: 11px; color: #4b5563; }
  .brand strong { color: #111827; }
  .title { text-align: right; flex-shrink: 0; }
  .title h2 { margin: 0; font-size: 20px; letter-spacing: 2px; color: #0f766e; }
  .title .copy { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .title .paid { display: inline-block; margin-top: 8px; padding: 2px 10px; border: 1.5px solid #16a34a;
    color: #16a34a; font-weight: 700; font-size: 11px; border-radius: 4px; letter-spacing: 1px; }

  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 14px 0; }
  .box { border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden; }
  .box h3 { margin: 0; padding: 6px 10px; font-size: 10px; letter-spacing: 1px; text-transform: uppercase;
    background: #f3f4f6; border-bottom: 1px solid #d1d5db; color: #374151; }
  .box .body { padding: 8px 10px; }
  .box .name { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 2px; }
  .box p { margin: 2px 0; font-size: 11.5px; }
  .kv { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  .kv td { padding: 2px 0; vertical-align: top; }
  .kv td:first-child { color: #6b7280; width: 42%; }
  .kv td:last-child { font-weight: 600; color: #111827; }

  table.items { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  table.items th { background: #0f766e; color: #fff; font-size: 10.5px; text-transform: uppercase;
    letter-spacing: 0.5px; padding: 8px 8px; text-align: left; font-weight: 600; }
  table.items td { padding: 9px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  table.items .r { text-align: right; white-space: nowrap; }
  table.items .c { text-align: center; }
  table.items .sub { font-size: 10.5px; color: #6b7280; margin-top: 2px; }
  table.items .pname { font-weight: 600; color: #111827; }
  .offer { color: #15803d; }

  .summary { display: grid; grid-template-columns: 1fr 76mm; gap: 14px; margin-top: 14px; align-items: start; }
  .words { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 10px; font-size: 11.5px; }
  .words .label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px; }
  .words strong { color: #111827; }
  .totals { width: 100%; border-collapse: collapse; font-size: 12px; }
  .totals td { padding: 5px 10px; }
  .totals td:last-child { text-align: right; white-space: nowrap; }
  .totals tr.grand td { background: #0f766e; color: #fff; font-weight: 700; font-size: 13.5px; padding: 8px 10px; }

  .foot { display: grid; grid-template-columns: 1fr 64mm; gap: 14px; margin-top: 20px; align-items: end; }
  .terms h4 { margin: 0 0 4px; font-size: 11px; color: #374151; }
  .terms ol { margin: 0; padding-left: 16px; font-size: 10.5px; color: #4b5563; }
  .sign { text-align: center; font-size: 11px; }
  .sign .for { font-weight: 700; color: #111827; }
  .sign .space { height: 44px; }
  .sign .line { border-top: 1px solid #9ca3af; padding-top: 4px; color: #4b5563; }
  .generated { margin-top: 18px; padding-top: 8px; border-top: 1px dashed #d1d5db; text-align: center;
    font-size: 10px; color: #6b7280; }

  table.items tr, .summary, .foot { page-break-inside: avoid; break-inside: avoid; }

  @media print {
    .toolbar { display: none !important; }
    .sheet { padding: 0; max-width: none; }
  }
  @media screen and (max-width: 640px) {
    .sheet { padding: 14px; }
    .head, .info, .summary, .foot { display: block; }
    .title { text-align: left; margin-top: 10px; }
    .info .box, .summary .words { margin-bottom: 10px; }
    .items-wrap { overflow-x: auto; }
    table.items { min-width: 560px; }
    .toolbar { padding: 0 14px; }
  }
`;

/**
 * Full HTML document for one invoice.
 * @param {object} p
 * @param {object} p.order      the order (with invoiceType 'PACKAGE' | 'REPURCHASE')
 * @param {object} p.totals     { items: [{name, subtitle, qty, mrp, price}], mrp, offer, total }
 * @param {object} p.billedTo   member profile { fullName, memberId, email, phoneNumber, address }
 * @param {boolean} [p.forPrint] adds the Print / Close toolbar and opens the print dialog on load
 */
export const buildInvoiceHtml = ({ order, totals, billedTo, forPrint = false }) => {
  const invoiceNo = invoiceNumberOf(order);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kuwifr.in';
  const address = formatAddress(billedTo?.address);

  const rows = totals.items.map((it, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td><div class="pname">${esc(it.name)}</div>${it.subtitle ? `<div class="sub">${esc(it.subtitle)}</div>` : ''}</td>
        <td class="c">${it.qty}</td>
        <td class="r">${inr(it.mrp * it.qty)}</td>
        <td class="r offer">${it.mrp > it.price ? `− ${inr((it.mrp - it.price) * it.qty)}` : '—'}</td>
        <td class="c">Incl.</td>
        <td class="r"><strong>${inr(it.price * it.qty)}</strong></td>
      </tr>`).join('');

  const toolbar = forPrint
    ? `<div class="toolbar">
         <button type="button" onclick="window.print()">Download / Print PDF</button>
         <button type="button" class="secondary" onclick="window.close()">Close</button>
       </div>`
    : '';

  // Print once the logo (and fonts) have loaded, so nothing is missing from the PDF.
  const autoPrint = forPrint ? AUTO_PRINT_SCRIPT : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(invoiceNo)} - ${esc(COMPANY_LEGAL_NAME)}</title>
<style>${STYLES}</style>
</head>
<body>
${toolbar}
<div class="sheet">
  <div class="head">
    <div class="brand">
      <img src="${origin}/logo.jpg" alt="" />
      <div>
        <h1>${esc(COMPANY_LEGAL_NAME)}</h1>
        <p>${esc(COMPANY_ADDRESS)}, India</p>
        <p>GSTIN: <strong>${esc(COMPANY_GSTIN)}</strong> &nbsp;|&nbsp; PAN: <strong>${esc(COMPANY_PAN)}</strong></p>
        <p>CIN: <strong>${esc(COMPANY_CIN)}</strong></p>
        <p>${esc(COMPANY_EMAIL)} &nbsp;|&nbsp; www.kuwifr.in</p>
      </div>
    </div>
    <div class="title">
      <h2>TAX INVOICE</h2>
      <div class="copy">Original for Recipient</div>
      <div class="paid">PAID</div>
    </div>
  </div>

  <div class="info">
    <div class="box">
      <h3>Billed To</h3>
      <div class="body">
        <div class="name">${esc(billedTo?.fullName || 'Member')}</div>
        <p>Member ID: <strong>${esc(billedTo?.memberId || '—')}</strong></p>
        ${billedTo?.phoneNumber ? `<p>Phone: ${esc(billedTo.phoneNumber)}</p>` : ''}
        ${billedTo?.email ? `<p>Email: ${esc(billedTo.email)}</p>` : ''}
        ${address ? `<p>Address: ${esc(address)}</p>` : ''}
      </div>
    </div>
    <div class="box">
      <h3>Invoice Details</h3>
      <div class="body">
        <table class="kv">
          <tr><td>Invoice No.</td><td>${esc(invoiceNo)}</td></tr>
          <tr><td>Invoice Date</td><td>${esc(formatDate(order.createdAt))}</td></tr>
          <tr><td>Order Type</td><td>${order.invoiceType === 'PACKAGE' ? 'Package Purchase' : 'Repurchase Order'}</td></tr>
          <tr><td>Payment Mode</td><td>${esc((order.paymentMethod || 'Online').replace(/_/g, ' '))}</td></tr>
          <tr><td>Place of Supply</td><td>Assam (18)</td></tr>
        </table>
      </div>
    </div>
  </div>

  <div class="items-wrap">
    <table class="items">
      <thead>
        <tr>
          <th class="c" style="width:6%">#</th>
          <th style="width:36%">Product</th>
          <th class="c" style="width:7%">Qty</th>
          <th class="r" style="width:14%">MRP</th>
          <th class="r" style="width:14%">Offer</th>
          <th class="c" style="width:8%">GST</th>
          <th class="r" style="width:15%">Total Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div class="summary">
    <div class="words">
      <div class="label">Amount in Words</div>
      <strong>${esc(amountInWords(totals.total))}</strong>
    </div>
    <table class="totals">
      <tr><td>Total MRP</td><td>${inr(totals.mrp)}</td></tr>
      <tr><td>Offer Discount</td><td class="offer">${totals.offer > 0 ? `− ${inr(totals.offer)}` : inr(0)}</td></tr>
      <tr><td>GST</td><td>Included</td></tr>
      <tr class="grand"><td>Total Amount</td><td>${inr(totals.total)}</td></tr>
    </table>
  </div>

  <div class="foot">
    <div class="terms">
      <h4>Terms &amp; Conditions</h4>
      <ol>
        <li>All prices are inclusive of GST.</li>
        <li>Goods once sold will be exchanged or returned only as per company policy.</li>
        <li>For billing queries, write to ${esc(COMPANY_EMAIL)} quoting the invoice number.</li>
      </ol>
    </div>
    <div class="sign">
      <div class="for">For ${esc(COMPANY_LEGAL_NAME)}</div>
      <div class="space"></div>
      <div class="line">Authorised Signatory</div>
    </div>
  </div>

  <div class="generated">This is a computer-generated invoice and does not require a physical signature.</div>
</div>
${autoPrint}
</body>
</html>`;
};

/**
 * Opens the invoice as its own page and brings up the print dialog, where
 * the member picks "Save as PDF". The browser suggests the page title
 * (invoice number) as the file name.
 */
export const printInvoice = (args) =>
  openPrintableDocument(buildInvoiceHtml({ ...args, forPrint: true }), buildInvoiceHtml(args));
