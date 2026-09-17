// client/src/seo/seoConfig.js
//
// Single source of truth for site-wide SEO constants. Every SEO component
// (Seo.jsx, schema builders, sitemap/robots on the backend) should read from
// here instead of hardcoding the production domain or brand name — see the
// SEO audit finding that "https://www.kuwifr.in" was previously scattered as
// string literals across several unrelated files.
//
// IMPORTANT: no field on this file is invented. Company legal/contact data
// mirrors server/src/models/Setting.js's `company` sub-document defaults
// (the actual configured production values) — if that record is ever
// updated in the database, keep this file in sync by hand, since the client
// has no live settings API call wired up for public pages.

export const SITE_URL = 'https://kuwifr.in';
export const SITE_NAME = 'KUWIFR';
export const SITE_TAGLINE = 'Health, Wellness & Lifestyle Essentials';
export const COMPANY_LEGAL_NAME = 'KUWIFR SERVICES PVT LTD';

// Mirrors server/src/models/Setting.js `company` defaults — the real,
// configured contact details for this business, not placeholders.
export const COMPANY_EMAIL = 'support@kuwifr.com';
export const COMPANY_PHONE = '+91 94350 11223';
export const COMPANY_ADDRESS = 'GS Road, Christian Basti, Guwahati, Assam - 781005';

// Real social profile URLs go here once provided — deliberately empty
// (never filled with placeholder facebook.com/instagram.com links) until
// the business supplies its actual profile URLs. Organization JSON-LD omits
// `sameAs` entirely while this stays empty, per "no fake data" policy.
export const SOCIAL_PROFILES = [];

// No real branded 1200x630 share image or logo file exists in this
// codebase yet (verified during the SEO audit — only a payment QR standee
// image exists under client/public/images). Left null rather than pointing
// at a stock photo or fabricated graphic; pages with a genuine on-page hero
// image set their own `image` prop on <Seo> instead. See the SEO
// implementation report for what a design team should supply.
export const DEFAULT_OG_IMAGE = null;

// No Twitter/X handle is configured anywhere in the codebase — omitted
// rather than guessed.
export const TWITTER_SITE_HANDLE = null;

export const buildCanonical = (path = '/') => {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${clean === '/' ? '' : clean.replace(/\/+$/, '')}` || SITE_URL;
};
