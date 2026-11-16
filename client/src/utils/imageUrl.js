// client/src/utils/imageUrl.js
//
// Product photos are uploaded to Cloudinary at full size. Cloudinary can
// resize and convert them on the fly via the URL: f_auto serves WebP/AVIF
// when the browser supports it, q_auto picks the quality, c_limit + w_N
// caps the width (never upscales). Non-Cloudinary URLs pass through as-is.
const UPLOAD = '/image/upload/';

export const cdnImage = (url, width) => {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com') || !url.includes(UPLOAD)) return url;
  const [base, rest] = url.split(UPLOAD);
  // Already transformed (first path segment has transformation params)?
  if (/^[a-z]{1,3}_[^/]*\//.test(rest) && !/^v\d+\//.test(rest)) return url;
  return `${base}${UPLOAD}f_auto,q_auto,c_limit,w_${Math.round(width)}/${rest}`;
};

/** srcSet with 1x/2x widths for a CSS width of `width` px. */
export const cdnSrcSet = (url, width) => {
  if (!url || !url.includes('res.cloudinary.com')) return undefined;
  return `${cdnImage(url, width)} 1x, ${cdnImage(url, width * 2)} 2x`;
};
