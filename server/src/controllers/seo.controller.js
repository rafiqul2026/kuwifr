// server/src/controllers/seo.controller.js
const { PUBLIC_PRODUCT_IDS } = require('../data/publicProductIds');

const SITE_URL = 'https://kuwifr.in';

/**
 * GET /robots.txt
 * Allows crawling of the public storefront; explicitly blocks the private
 * Member Portal, Admin Panel, auth flows, and the API surface (none of
 * which are meant to be crawled/indexed — see MemberLayout.jsx/
 * AdminLayout.jsx's blanket noindex for the client-side half of this same
 * policy). References the dynamic sitemap below.
 */
const getRobotsTxt = (req, res) => {
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin/login',
    'Disallow: /member',
    'Disallow: /login',
    'Disallow: /register',
    'Disallow: /forgot-password',
    'Disallow: /reset-password',
    'Disallow: /verify-email',
    'Disallow: /dashboard',
    'Disallow: /portal',
    'Disallow: /api/',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`
  ];

  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(lines.join('\n'));
};

const escapeXml = (str = '') =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * GET /sitemap.xml
 * Only canonical, indexable public URLs — no admin/member/auth/API routes,
 * no query-string filter/sort/pagination variants, no localhost URLs. No
 * <lastmod> is emitted anywhere: none of these pages have genuine
 * "last modified" timestamp data available (the static informational pages
 * are hardcoded source files with no CMS date, and the product catalog
 * below is likewise a static, undated list) — omitting the field entirely
 * rather than fabricating a date, per the "no fake data" requirement.
 * lastmod is optional in the sitemap protocol, so this is a fully valid
 * sitemap without it.
 */
const getSitemapXml = (req, res) => {
  const staticEntries = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/shop', priority: '0.9', changefreq: 'daily' },
    { path: '/about', priority: '0.6', changefreq: 'monthly' },
    { path: '/contact', priority: '0.6', changefreq: 'monthly' },
    { path: '/blog', priority: '0.5', changefreq: 'weekly' },
    { path: '/faq', priority: '0.6', changefreq: 'monthly' },
    { path: '/how-it-works', priority: '0.5', changefreq: 'monthly' },
    { path: '/customer-support', priority: '0.5', changefreq: 'monthly' },
    { path: '/payment-info', priority: '0.4', changefreq: 'monthly' },
    { path: '/warranty', priority: '0.4', changefreq: 'monthly' },
    { path: '/seller-verification', priority: '0.4', changefreq: 'monthly' },
    { path: '/grievance', priority: '0.4', changefreq: 'monthly' },
    { path: '/terms', priority: '0.3', changefreq: 'yearly' },
    { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
    { path: '/disclaimer', priority: '0.3', changefreq: 'yearly' },
    { path: '/shipping-policy', priority: '0.3', changefreq: 'yearly' },
    { path: '/refund-policy', priority: '0.3', changefreq: 'yearly' }
  ];

  const productEntries = PUBLIC_PRODUCT_IDS.map((id) => ({
    path: `/product/${id}`,
    priority: '0.7',
    changefreq: 'weekly'
  }));

  const allEntries = [...staticEntries, ...productEntries];

  const urlXml = allEntries
    .map(
      (entry) => `  <url>
    <loc>${escapeXml(SITE_URL + entry.path)}</loc>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlXml}
</urlset>`;

  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(xml);
};

module.exports = { getRobotsTxt, getSitemapXml };
