// client/src/utils/lazyRoute.jsx
//
// Route-level code splitting. Visitors to the public site no longer
// download the Member and Admin panels up front.
//
// After a new deploy, a tab that was opened earlier may ask for a chunk
// file that no longer exists. In that case reload once to pick up the new
// build instead of showing a blank page.
import React from 'react';

const RELOAD_FLAG = 'kuwifr_chunk_reload';

export const lazyRoute = (factory) =>
  React.lazy(() =>
    factory()
      .then((mod) => {
        try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* ignore */ }
        return mod;
      })
      .catch((err) => {
        let alreadyReloaded = false;
        try { alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1'; } catch { /* ignore */ }
        if (!alreadyReloaded) {
          try { sessionStorage.setItem(RELOAD_FLAG, '1'); } catch { /* ignore */ }
          window.location.reload();
          return new Promise(() => {}); // keep Suspense fallback until reload
        }
        throw err;
      })
  );

// Shown while a route's code loads (usually a fraction of a second).
export const RouteFallback = ({ fullScreen = false }) => (
  <div
    role="status"
    aria-live="polite"
    style={{
      minHeight: fullScreen ? '100vh' : '50vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#fdfaf5'
    }}
  >
    <span
      aria-hidden="true"
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: '3px solid #e5e5e5',
        borderTopColor: '#008080',
        animation: 'kwspin 0.75s linear infinite'
      }}
    />
    <style>{'@keyframes kwspin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){[style*="kwspin"]{animation-duration:2s!important}}'}</style>
    <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Loading…</span>
  </div>
);
