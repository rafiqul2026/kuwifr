// server/src/utils/sponsorLookup.js
//
// One place that decides whether a Sponsor ID is valid, shared by
// registration (auth.controller.js) and the Register page's live "Verified /
// Incorrect Sponsor ID" check (GET /api/users/verify-sponsor/:code), so the
// two can never disagree.
const User = require('../models/User');

const INACTIVE_STATUSES = ['SUSPENDED', 'BLOCKED', 'DEACTIVATED'];

// Member IDs / referral codes are short alphanumerics (e.g. KFR424443).
// Anything else is rejected before touching the database.
const SPONSOR_CODE_PATTERN = /^[A-Za-z0-9_-]{3,30}$/;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Looks up a sponsor by Member ID or referral code (case-insensitive,
 * exact match). Returns { sponsor, error } — `error` is 'NOT_FOUND' or
 * 'INACTIVE' when the code can't be used as a sponsor.
 */
const findSponsorByCode = async (rawCode, projection) => {
  const code = String(rawCode || '').trim();
  if (!SPONSOR_CODE_PATTERN.test(code)) return { sponsor: null, error: 'NOT_FOUND' };

  const exact = new RegExp(`^${escapeRegex(code)}$`, 'i');
  let query = User.findOne({ $or: [{ memberId: exact }, { referralCode: exact }] });
  if (projection) query = query.select(projection);
  const sponsor = await query;

  if (!sponsor) return { sponsor: null, error: 'NOT_FOUND' };
  if (INACTIVE_STATUSES.includes(sponsor.status)) return { sponsor, error: 'INACTIVE' };
  return { sponsor, error: null };
};

module.exports = { findSponsorByCode };
