// client/src/seo/Seo.jsx
import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE, TWITTER_SITE_HANDLE, buildCanonical } from './seoConfig';

/**
 * Single reusable per-route SEO component. Every public page renders exactly
 * one of these (see pages/public/*.jsx) instead of hand-rolling <title>/meta
 * tags, so title/description/canonical/robots/OG/Twitter/JSON-LD all follow
 * one consistent shape site-wide.
 *
 * NOTE on React crawlability: this project is a pure client-side-rendered
 * Vite SPA with no SSR/prerendering (confirmed during the SEO audit — no
 * such plugin is installed, and adding one is out of scope: "do not migrate
 * the project to another framework just for SEO"). react-helmet-async
 * updates `document.head` after React mounts, which Googlebot picks up
 * because it renders JavaScript during indexing — but crawlers that do NOT
 * execute JavaScript (Facebook/WhatsApp/Slack/LinkedIn link-preview bots,
 * some other search engines) will only ever see client/index.html's static
 * fallback tags, never this component's per-page output. That fallback is
 * kept accurate and branded for that reason. See the SEO report for this
 * documented limitation and what a server-rendering fix would require.
 *
 * @param {string} title - Page-specific title. Rendered as "{title} | KUWIFR".
 * @param {string} description - Unique meta description for this page.
 * @param {string} path - Route path (e.g. "/about") used to build the canonical URL.
 * @param {'noindex'|'index'} [robots='index'] - Pass 'noindex' for private/auth/transactional pages.
 * @param {string} [image] - Absolute or site-relative image URL for og:image/twitter:image. Falls back to DEFAULT_OG_IMAGE (currently unset — see seoConfig.js).
 * @param {'website'|'product'|'article'} [type='website'] - og:type.
 * @param {object[]} [jsonLd] - Array of schema.org objects (see schema.js) to render as <script type="application/ld+json"> tags.
 */
const Seo = ({ title, description, path, robots = 'index', image, type = 'website', jsonLd = [] }) => {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Health, Wellness & Lifestyle Essentials`;
  const canonical = buildCanonical(path || '/');
  const resolvedImage = image || DEFAULT_OG_IMAGE;
  const robotsContent = robots === 'noindex' ? 'noindex, nofollow' : 'index, follow';

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <meta name="robots" content={robotsContent} />
      <link rel="canonical" href={canonical} />

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={canonical} />
      {resolvedImage && <meta property="og:image" content={resolvedImage} />}

      {/* Twitter/X */}
      <meta name="twitter:card" content={resolvedImage ? 'summary_large_image' : 'summary'} />
      {TWITTER_SITE_HANDLE && <meta name="twitter:site" content={TWITTER_SITE_HANDLE} />}
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      {resolvedImage && <meta name="twitter:image" content={resolvedImage} />}

      {jsonLd.filter(Boolean).map((schema, idx) => (
        <script key={idx} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
};

export default Seo;

// Re-export SITE_URL for convenience in call sites that need the raw domain.
export { SITE_URL };
