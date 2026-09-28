// client/src/pages/member/idCardDocument.js
//
// Member "Consultant / Advisor ID Card" as ONE standalone HTML document —
// previewed in an <iframe> on the ID Card page and printed / saved as PDF
// from its own window (same approach as invoiceDocument.js), so the
// download is exactly what the member sees.
//
// Every size inside the card is in `cqw` (1% of the card's width), so the
// card keeps the design's proportions at any size: responsive on screen,
// and a real 88 x 133 mm card when printed.

import { openPrintableDocument, AUTO_PRINT_SCRIPT } from '../../utils/printDocument';

// Company line and title exactly as on the approved card design.
const CARD_COMPANY = 'KUWIFR SERVICES PVT LTD';
const CARD_CONTACT_LINE = ['Howly, Barpeta, Assam', 'Contact: 6000509719', 'Email: kuwifrservices@gmail.com'];
const CARD_TITLE = 'CONSULTANT / ADVISOR ID CARD';
const CARD_FOOTER = 'THIS CARD IS THE PROPERTY OF KUWIFR SERVICES PVT LTD • NON-TRANSFERABLE';

// Single-line headings must never overflow the card — e.g. if the web font
// can't load and a wider fallback font is used. Shrink them to fit, once now
// and again when fonts finish loading. Runs before the auto-print script.
const FIT_TEXT_SCRIPT = `<script>
  (function () {
    // Sizes are set back in cqw (relative to the card width), so the fit
    // still holds when the card is resized for print.
    function fit() {
      var card = document.querySelector('.card');
      if (!card || !card.clientWidth) return;
      var cqw = card.clientWidth / 100;
      document.querySelectorAll('.top, .title, .strip, .bottom').forEach(function (el) {
        el.style.fontSize = '';
        if (el.scrollWidth <= el.clientWidth) return;
        var px = parseFloat(getComputedStyle(el).fontSize) * (el.clientWidth / el.scrollWidth) * 0.97;
        el.style.fontSize = (px / cqw).toFixed(3) + 'cqw';
      });
    }
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    window.addEventListener('resize', fit);
    window.addEventListener('beforeprint', fit);
  })();
</script>`;

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const formatCardAddress = (a) =>
  a ? [a.street, a.city, a.state, a.pincode || a.postalCode].map((x) => String(x || '').trim()).filter(Boolean).join(', ') : '';

/** Profile fields the card prints; empty ones leave a blank dotted line. */
export const idCardFields = (member) => [
  { label: 'Name', value: member?.fullName },
  { label: 'S/D/W/O', value: member?.guardianName },
  { label: 'Identity Number', value: member?.memberId, mono: true },
  { label: 'Address', value: formatCardAddress(member?.address), multi: true },
  { label: 'Mob', value: member?.phoneNumber },
  { label: 'Email', value: member?.email, small: true }
];

const STYLES = `
  @page { size: A4 portrait; margin: 15mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: #eef1f6;
    font-family: "Roboto Condensed", "Arial Narrow", Arial, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .stage { display: flex; justify-content: center; padding: 20px 14px 28px; }
  .toolbar { display: flex; gap: 8px; justify-content: center; padding: 16px 14px 0; }
  .toolbar button {
    font: 600 14px/1 Arial, sans-serif; padding: 11px 18px; border-radius: 8px; cursor: pointer;
    border: 1px solid #0e3d86; background: #0e3d86; color: #fff;
  }
  .toolbar button.secondary { background: #fff; color: #0e3d86; }

  .card {
    container-type: inline-size;
    width: min(100%, 440px);
    background: #ffffff;
    border-radius: 4.5cqw;
    overflow: hidden;
    box-shadow: 0 18px 40px rgba(14, 33, 70, 0.22), 0 2px 6px rgba(14, 33, 70, 0.12);
    display: flex; flex-direction: column;
  }
  .top {
    background: #0e3d86;
    color: #fff;
    text-align: center;
    padding: 5.2cqw 3cqw 5cqw;
    font-family: "Oswald", "Arial Narrow", sans-serif;
    font-weight: 600;
    font-size: 8.6cqw;
    line-height: 1;
    letter-spacing: 0.1cqw;
    white-space: nowrap;
  }
  .strip {
    background: #a9cdf2;
    color: #0e2a5c;
    text-align: center;
    font-size: 2.15cqw;
    font-weight: 500;
    padding: 1.7cqw 2cqw;
    white-space: nowrap;
  }
  .strip .dot { margin: 0 1cqw; }
  .body {
    flex: 1;
    background:
      radial-gradient(90% 50% at 50% 20%, rgba(169, 205, 242, 0.12), rgba(255, 255, 255, 0) 70%),
      #fbfcfe;
    padding: 5cqw 6cqw 4cqw;
  }
  /* logo.jpg is the blue disc on a light-grey square — crop to the disc
     (it spans ~80% of the image, centred slightly above middle). */
  .logo {
    position: relative;
    width: 58cqw; height: 58cqw;
    margin: 0 auto;
    border-radius: 50%;
    overflow: hidden;
    box-shadow: 0 1.6cqw 3.4cqw rgba(14, 61, 134, 0.28);
  }
  .logo img { position: absolute; width: 126%; height: 126%; left: -13%; top: -10.1%; max-width: none; }
  .title {
    margin: 5cqw 0 5cqw;
    text-align: center;
    color: #0b2c66;
    font-family: "Oswald", "Arial Narrow", sans-serif;
    font-weight: 700;
    font-size: 5.7cqw;
    line-height: 1;
    letter-spacing: 0.08cqw;
    white-space: nowrap;
  }
  .details { display: flex; gap: 5cqw; align-items: flex-start; }
  .photo {
    flex: 0 0 36cqw;
    height: 31cqw;
    border: 0.3cqw dashed #4b5563;
    border-radius: 2.4cqw;
    display: flex; align-items: center; justify-content: center;
    color: #9ca3af;
    font-family: "Oswald", sans-serif;
    font-size: 4.2cqw;
    letter-spacing: 0.2cqw;
    overflow: hidden;
    background: #fff;
  }
  .photo.has-img { border-style: solid; border-color: #c7d2e3; }
  .photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .fields { flex: 1; min-width: 0; }
  .row { display: flex; align-items: flex-end; gap: 1cqw; min-height: 5.4cqw; margin-bottom: 0.4cqw; }
  .label { color: #0e2347; font-weight: 500; font-size: 3cqw; white-space: nowrap; line-height: 1.25; }
  .value {
    flex: 1; min-width: 0;
    /* Dotted leader drawn as a background: a CSS dotted border prints as
       dashes in Chrome's PDF output. */
    background: radial-gradient(circle, #1f2d4d 0.2cqw, rgba(0, 0, 0, 0) 0.24cqw) left bottom / 1.2cqw 0.55cqw repeat-x;
    color: #0b2c66; font-weight: 700; font-size: 2.55cqw; line-height: 1.3;
    padding: 0 0 0.8cqw 0.4cqw;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .value.mono { font-family: "Roboto Mono", "Consolas", monospace; letter-spacing: 0.1cqw; }
  .value.small { font-size: 2.3cqw; }
  .value.multi {
    white-space: normal; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
    font-size: 2.3cqw; line-height: 1.25;
  }
  .sign { margin-top: 4cqw; display: flex; justify-content: flex-end; }
  .sign span {
    color: #0e2347; font-size: 2.6cqw; font-weight: 500;
    padding-bottom: 1.6cqw; border-bottom: 0.3cqw solid #0e2347; min-width: 25cqw; text-align: center;
  }
  .bottom {
    background: #0e3d86;
    color: #fff;
    text-align: center;
    font-weight: 600;
    font-size: 2.2cqw;
    padding: 4.2cqw 2cqw;
    white-space: nowrap;
    letter-spacing: 0.05cqw;
  }

  @media print {
    body { background: #fff; }
    .toolbar { display: none !important; }
    .stage { padding: 0; }
    .card { width: 88mm; box-shadow: none; border: 0.2mm solid #d6dce8; break-inside: avoid; }
  }
`;

/**
 * @param {object} p
 * @param {object} p.member   profile: fullName, guardianName, memberId, address, phoneNumber, email, profileImage
 * @param {boolean} [p.forPrint] adds the Print / Close toolbar and opens the print dialog once loaded
 */
export const buildIdCardHtml = ({ member, forPrint = false }) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kuwifr.in';
  const photo = member?.profileImage?.url;
  const rows = idCardFields(member)
    .map((f) => `
        <div class="row">
          <span class="label">${esc(f.label)}:</span>
          <span class="value${f.mono ? ' mono' : ''}${f.multi ? ' multi' : ''}${f.small ? ' small' : ''}">${esc(f.value || '')}</span>
        </div>`)
    .join('');

  const toolbar = forPrint
    ? `<div class="toolbar">
         <button type="button" onclick="window.print()">Download / Print ID Card</button>
         <button type="button" class="secondary" onclick="window.close()">Close</button>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ID Card - ${esc(member?.memberId || '')} - ${esc(member?.fullName || '')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Roboto+Condensed:wght@500;700&family=Roboto+Mono:wght@600&display=swap" rel="stylesheet" />
<style>${STYLES}</style>
</head>
<body>
${toolbar}
<div class="stage">
  <div class="card">
    <div class="top">${esc(CARD_COMPANY)}</div>
    <div class="strip">${CARD_CONTACT_LINE.map(esc).join('<span class="dot">&bull;</span>')}</div>
    <div class="body">
      <div class="logo"><img src="${origin}/logo.jpg" alt="Kuwifr" /></div>
      <div class="title">${esc(CARD_TITLE)}</div>
      <div class="details">
        <div class="photo${photo ? ' has-img' : ''}">
          ${photo ? `<img src="${esc(photo)}" alt="" />` : 'PHOTO'}
        </div>
        <div class="fields">${rows}
        </div>
      </div>
      <div class="sign"><span>Authorised Signature</span></div>
    </div>
    <div class="bottom">${esc(CARD_FOOTER)}</div>
  </div>
</div>
${FIT_TEXT_SCRIPT}
${forPrint ? AUTO_PRINT_SCRIPT : ''}
</body>
</html>`;
};

export const printIdCard = (member) =>
  openPrintableDocument(buildIdCardHtml({ member, forPrint: true }), buildIdCardHtml({ member }));
