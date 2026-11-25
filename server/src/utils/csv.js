// server/src/utils/csv.js
// CSV export helpers shared by admin and franchise reports.

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Sends rows as a UTF-8 CSV download (with BOM so Excel shows ₹ correctly).
 * columns: [{ label, key } | { label, get: (row) => value }]
 */
const sendCsv = (res, filename, columns, rows) => {
  const lines = [columns.map((c) => csvCell(c.label)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvCell(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`﻿${lines.join('\r\n')}`);
};

module.exports = { csvCell, sendCsv };
