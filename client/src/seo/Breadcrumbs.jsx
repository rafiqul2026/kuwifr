// client/src/seo/Breadcrumbs.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { buildBreadcrumbSchema } from './schema';

/**
 * Visible breadcrumb trail + matching BreadcrumbList JSON-LD, in one place
 * so the two can never drift apart (the spec requires the schema to exactly
 * match what's visibly rendered). `items` is [{ name, path }], root-first;
 * the last item renders as plain text (current page), not a link.
 */
const Breadcrumbs = ({ items = [] }) => {
  if (!items.length) return null;

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(buildBreadcrumbSchema(items))}</script>
      </Helmet>
      <nav aria-label="Breadcrumb" style={{ fontSize: '13px', padding: '14px 0', color: '#64748b' }}>
        <ol
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '6px',
            listStyle: 'none',
            margin: 0,
            padding: 0
          }}
        >
          {items.map((it, idx) => {
            const isLast = idx === items.length - 1;
            return (
              <li key={it.path || it.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {idx > 0 && <span aria-hidden="true">/</span>}
                {isLast ? (
                  <span aria-current="page" style={{ color: '#171717', fontWeight: 600 }}>
                    {it.name}
                  </span>
                ) : (
                  <Link to={it.path} style={{ color: '#64748b', textDecoration: 'none' }}>
                    {it.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
};

export default Breadcrumbs;
