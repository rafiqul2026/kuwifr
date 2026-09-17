// client/src/seo/schema.js
//
// Schema.org JSON-LD builders. Every function here returns a plain object
// (never a string) built ONLY from data actually passed in — none of these
// fabricate reviews, ratings, dates, or business claims. Render the result
// via <Seo jsonLd={[...]} /> (see Seo.jsx), which stringifies it into a
// <script type="application/ld+json"> tag.
import { SITE_URL, SITE_NAME, COMPANY_LEGAL_NAME, COMPANY_EMAIL, COMPANY_PHONE, COMPANY_ADDRESS, SOCIAL_PROFILES, buildCanonical } from './seoConfig';

/**
 * schema.org/Organization for KUWIFR SERVICES PVT LTD. Only includes fields
 * that are actually known — `sameAs` is omitted entirely while
 * SOCIAL_PROFILES is empty rather than filled with placeholder links.
 */
export const buildOrganizationSchema = () => {
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: COMPANY_LEGAL_NAME,
    alternateName: SITE_NAME,
    url: SITE_URL,
    email: COMPANY_EMAIL,
    telephone: COMPANY_PHONE,
    address: {
      '@type': 'PostalAddress',
      streetAddress: COMPANY_ADDRESS,
      addressCountry: 'IN'
    }
  };
  if (SOCIAL_PROFILES.length > 0) {
    org.sameAs = SOCIAL_PROFILES;
  }
  return org;
};

/** schema.org/WebSite for the site shell — no SearchAction since there is no real site-search results URL to point to. */
export const buildWebsiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  publisher: {
    '@type': 'Organization',
    name: COMPANY_LEGAL_NAME
  }
});

/** schema.org/WebPage for a specific public page. */
export const buildWebPageSchema = ({ name, description, path }) => ({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name,
  description,
  url: buildCanonical(path),
  isPartOf: {
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL
  },
  publisher: {
    '@type': 'Organization',
    name: COMPANY_LEGAL_NAME
  }
});

/**
 * schema.org/BreadcrumbList. `items` is [{ name, path }], root-first.
 * The last item is rendered without a `item` URL per schema.org convention
 * (it's the current page).
 */
export const buildBreadcrumbSchema = (items = []) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, idx) => ({
    '@type': 'ListItem',
    position: idx + 1,
    name: it.name,
    ...(idx < items.length - 1 ? { item: buildCanonical(it.path) } : {})
  }))
});

/**
 * schema.org/Product + Offer for a single product. `product` must carry
 * real catalog fields (name, description, ksp/mrp, images, category,
 * inStock) — never invents SKU/brand/rating fields the caller doesn't pass.
 * Ratings/reviews are intentionally NOT supported here since no genuine
 * review/rating data exists anywhere in this codebase (verified in the SEO
 * audit) — adding AggregateRating/Review would be fabricated data.
 */
export const buildProductSchema = (product, path) => {
  if (!product) return null;

  const images = Array.isArray(product.images)
    ? product.images.map((i) => (typeof i === 'string' ? i : i?.url)).filter(Boolean)
    : product.image
    ? [product.image]
    : [];

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    url: buildCanonical(path),
    brand: {
      '@type': 'Brand',
      name: SITE_NAME
    }
  };

  if (images.length > 0) schema.image = images;
  if (product.category) schema.category = product.category;

  const price = product.ksp ?? product.price;
  if (price !== undefined && price !== null) {
    schema.offers = {
      '@type': 'Offer',
      url: buildCanonical(path),
      priceCurrency: 'INR',
      price: String(price),
      availability:
        product.inStock === false || product.isInStock === false
          ? 'https://schema.org/OutOfStock'
          : 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: COMPANY_LEGAL_NAME
      }
    };
  }

  return schema;
};
