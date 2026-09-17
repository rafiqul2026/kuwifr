// client/src/pages/public/NotFoundPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import Seo from '../../seo/Seo';

/**
 * Renders for any unmatched public URL (see PublicRoutes.jsx's path="*").
 * Previously an unmatched public route rendered an empty <main> with the
 * generic site title and no noindex signal — a "soft 404" that search
 * engines could treat as a thin, duplicate, or low-value indexable page.
 *
 * LIMITATION (documented, not fixed here — see SEO report): this is a pure
 * client-side-rendered SPA served via Vercel's catch-all rewrite to
 * index.html, so the initial HTTP response for an unmatched path is still
 * status 200, not a real 404 — only fixable with server-side routing/SSR,
 * which is out of scope ("do not migrate the project to another framework
 * just for SEO"). The `noindex` meta tag below is the correct, safe
 * mitigation available in a pure-CSR SPA and is what Google's own guidance
 * recommends for JS-rendered soft-404 pages.
 */
const NotFoundPage = () => {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '80px 20px'
      }}
    >
      <Seo title="Page Not Found" description="The page you're looking for doesn't exist." path="/404" robots="noindex" />
      <span style={{ fontSize: '56px' }} aria-hidden="true">🧭</span>
      <h1 style={{ fontSize: '32px', margin: '16px 0 8px' }}>Page Not Found</h1>
      <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '440px', margin: '0 0 28px' }}>
        The page you're looking for doesn't exist or may have moved. Try one of these instead:
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          to="/"
          style={{
            padding: '11px 22px',
            background: '#2563eb',
            color: '#fff',
            borderRadius: '8px',
            fontWeight: 600,
            textDecoration: 'none'
          }}
        >
          Go to Homepage
        </Link>
        <Link
          to="/shop"
          style={{
            padding: '11px 22px',
            background: '#f1f5f9',
            color: '#171717',
            borderRadius: '8px',
            fontWeight: 600,
            textDecoration: 'none'
          }}
        >
          Browse Shop
        </Link>
        <Link
          to="/contact"
          style={{
            padding: '11px 22px',
            background: '#f1f5f9',
            color: '#171717',
            borderRadius: '8px',
            fontWeight: 600,
            textDecoration: 'none'
          }}
        >
          Contact Support
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
