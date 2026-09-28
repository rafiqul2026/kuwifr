// client/src/utils/printDocument.js
//
// Opens a standalone HTML document (invoice, ID card, ...) in its own window
// so the member can print it or "Save as PDF". The document itself decides
// when to call window.print() (after its fonts/images load). If a popup
// blocker stops the window, `fallbackHtml` (the same document without the
// toolbar / auto-print script) is printed from a hidden iframe instead.
export const openPrintableDocument = (html, fallbackHtml) => {
  const win = window.open('', '_blank');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    return;
  }

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(fallbackHtml);
  doc.close();
  const print = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 60000);
  };
  // Give web fonts / images a moment to load before printing.
  const fontsReady = doc.fonts?.ready || Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2500))]).then(() => setTimeout(print, 400));
};

/**
 * Inline script for a printable document: waits for web fonts and every
 * <img>, then opens the print dialog once (capped at ~3s so a slow image
 * can't block it).
 */
export const AUTO_PRINT_SCRIPT = `<script>
  (function () {
    var done = false;
    function go() { if (done) return; done = true; setTimeout(function () { window.focus(); window.print(); }, 200); }
    var imgs = Array.prototype.slice.call(document.images);
    var pending = imgs.filter(function (i) { return !i.complete; }).map(function (i) {
      return new Promise(function (res) { i.onload = res; i.onerror = res; });
    });
    var fonts = (document.fonts && document.fonts.ready) || Promise.resolve();
    Promise.all(pending.concat([fonts])).then(go);
    setTimeout(go, 3000);
  })();
</script>`;
