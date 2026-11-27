// client/src/pages/member/FranchiseHero.jsx
// Franchise-holder treatment: the "Official KUWIFR Franchise Partner" hero,
// the partner card with a printable certificate, and a one-time
// congratulations banner the first time a newly approved franchise visits.
import React, { useEffect, useState } from 'react';
import h from './FranchiseHero.module.css';

const longDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const pct = (rate) => `${((rate || 0) * 100).toFixed(2).replace(/\.00$/, '')}%`;
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CONFETTI_COLORS = ['#e8c26a', '#0f766e', '#f59e0b', '#14b8a6', '#b8892d', '#fcd34d'];

const printCertificate = ({ name, memberId, code, since }) => {
  const w = window.open('', '_blank', 'width=1000,height=760');
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Franchise Certificate — ${escapeHtml(name)}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  body { margin: 0; font-family: Georgia, "Times New Roman", serif; background: #f4f1ea; }
  .sheet { box-sizing: border-box; width: 297mm; height: 210mm; padding: 14mm; margin: 0 auto; background: #fffdf7; position: relative; }
  .frame { height: 100%; box-sizing: border-box; border: 3px solid #b8892d; outline: 1px solid #e8c26a; outline-offset: -10px; padding: 16mm 20mm; text-align: center; display: flex; flex-direction: column; justify-content: center; }
  .brand { font-family: Arial, sans-serif; font-weight: 800; letter-spacing: 6px; color: #0f5752; font-size: 15px; }
  h1 { margin: 10px 0 4px; font-size: 44px; color: #0b3d3a; letter-spacing: 1px; }
  .sub { font-family: Arial, sans-serif; letter-spacing: 4px; color: #b8892d; font-size: 13px; text-transform: uppercase; }
  .presented { margin-top: 26px; font-style: italic; color: #555; font-size: 16px; }
  .name { margin: 8px 0 4px; font-size: 40px; color: #1c2a2a; border-bottom: 1px solid #e8c26a; display: inline-block; padding: 0 30px 6px; }
  .id { font-family: Arial, sans-serif; color: #555; font-size: 14px; }
  .body { margin: 22px auto 0; max-width: 620px; font-size: 16px; line-height: 1.6; color: #333; }
  .row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 34px; font-family: Arial, sans-serif; }
  .cell { width: 32%; font-size: 13px; color: #555; }
  .cell b { display: block; font-size: 16px; color: #1c2a2a; margin-bottom: 4px; }
  .seal { width: 92px; height: 92px; border-radius: 50%; margin: 0 auto; background: radial-gradient(circle at 30% 30%, #f8e3a8, #e8c26a 55%, #b8892d); display: grid; place-items: center; font-size: 40px; box-shadow: 0 0 0 6px #f5dc9c; }
  @media print { body { background: #fff; } }
</style></head><body><div class="sheet"><div class="frame">
  <div class="brand">KUWIFR</div>
  <h1>Certificate of Franchise</h1>
  <div class="sub">Official Franchise Partner</div>
  <div class="presented">This is to certify that</div>
  <div><span class="name">${escapeHtml(name)}</span></div>
  <div class="id">Member ID ${escapeHtml(memberId)}</div>
  <div class="body">has been appointed an <b>Official Franchise Partner of KUWIFR</b>, authorised to represent KUWIFR products and serve its members within their franchise territory.</div>
  <div class="row">
    <div class="cell"><b>${escapeHtml(code)}</b>Partner No.</div>
    <div class="cell"><div class="seal">👑</div></div>
    <div class="cell"><b>${escapeHtml(longDate(since))}</b>Franchise Partner since</div>
  </div>
</div></div><script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
  return true;
};

export const FranchiseCongrats = ({ franchiseId, name }) => {
  const key = `kuwifr.franchiseWelcomed.${franchiseId}`;
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!franchiseId) return;
    try {
      if (!localStorage.getItem(key)) setShow(true);
    } catch {
      // storage blocked — skip the one-time banner
    }
  }, [franchiseId, key]);

  if (!show) return null;
  const dismiss = () => {
    try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
    setShow(false);
  };

  return (
    <div className={h.congrats} role="status">
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className={h.confetti}
          style={{ left: `${(i * 5.5) % 100}%`, background: CONFETTI_COLORS[i % CONFETTI_COLORS.length], animationDelay: `${(i % 6) * 0.15}s` }}
          aria-hidden="true"
        />
      ))}
      <span className={h.congratsIcon} aria-hidden="true">🎉</span>
      <div>
        <strong>Congratulations{name ? `, ${name.split(' ')[0]}` : ''}! You are now an Official KUWIFR Franchise Partner.</strong>
        <p>Your franchise dashboard, stock and partner certificate are ready below.</p>
      </div>
      <button type="button" className={h.congratsClose} onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  );
};

const FranchiseHero = ({ user, partner, rates, territoryMembers, onCertificateBlocked }) => {
  const name = user?.fullName || 'Franchise Partner';
  const code = partner?.code || '—';
  const since = partner?.since;

  return (
    <section className={h.hero} aria-label="Franchise partner">
      <div>
        <span className={h.ribbon}><span className={h.crown} aria-hidden="true">👑</span>Official Franchise Partner</span>
        <h1 className={h.heroTitle}>Welcome, <span>{name}</span></h1>
        <p className={h.heroText}>
          You are an authorised KUWIFR franchise. Your whole downline is your territory — you earn on every activation in it and on every product you sell.
        </p>
        <div className={h.perks}>
          {territoryMembers != null && <span className={h.perk}>🌐 Territory <b>{territoryMembers.toLocaleString('en-IN')}</b> members</span>}
          <span className={h.perk}>⚡ Activation commission <b>{pct(rates?.kspRate)}</b></span>
          <span className={h.perk}>🛍️ Product sale commission <b>{pct(rates?.saleCommissionRate)}</b></span>
        </div>
      </div>

      <div className={h.card}>
        <span className={h.cardSeal} aria-hidden="true">👑</span>
        <span className={h.cardLabel}>Partner No.</span>
        <span className={h.cardCode}>{code}</span>
        <span className={h.cardName}>{name}</span>
        <span className={h.cardMeta}>{user?.memberId}{since ? ` · Partner since ${longDate(since)}` : ''}</span>
        <button
          type="button"
          className={h.certBtn}
          disabled={!partner}
          onClick={() => {
            if (!printCertificate({ name, memberId: user?.memberId || '', code, since })) onCertificateBlocked?.();
          }}
        >
          📜 View certificate
        </button>
      </div>
    </section>
  );
};

export default FranchiseHero;
