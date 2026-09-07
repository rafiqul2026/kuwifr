// server/src/services/salary.service.js
const User = require('../models/User');
const Referral = require('../models/Referral');
const Wallet = require('../models/Wallet');

/**
 * 📦 5-Tier Official Package KBP Resolution
 */
const resolveUserKbp = (userDoc) => {
  if (!userDoc || (userDoc.status || '').toUpperCase() !== 'ACTIVE') return 0;

  if (userDoc.activePackageId && typeof userDoc.activePackageId === 'object') {
    if (typeof userDoc.activePackageId.kbp === 'number' && userDoc.activePackageId.kbp > 0) {
      return userDoc.activePackageId.kbp;
    }
  }

  const pkgName = (userDoc.activePackageId?.name || userDoc.currentPackage || '').toUpperCase();
  if (pkgName.includes('TITANIUM')) return 50000;
  if (pkgName.includes('ELITE')) return 10000;
  if (pkgName.includes('LIFESAFE') || pkgName.includes('LIFE SAFE')) return 7500;
  if (pkgName.includes('GROWTH')) return 5000;
  return 1000; // Starter Package default
};

/**
 * 🏆 Strictly checks if a specific user qualifies as a Kuwi Star
 * Requirement: 3 active direct referrals, 2:1 or 1:2 ratio, minimum 3,000 KBP total
 */
const checkIsKuwiStar = async (userId) => {
  const directActives = await User.find({
    sponsorId: userId,
    status: 'ACTIVE'
  }).populate('activePackageId').lean();

  if (!directActives || directActives.length < 3) return false;

  let leftDirects = 0;
  let rightDirects = 0;
  let totalDirectKbp = 0;

  for (const direct of directActives) {
    const kbp = resolveUserKbp(direct);
    if (kbp > 0) {
      totalDirectKbp += kbp;
      const side = String(direct.binarySide || '').toLowerCase();
      if (side === 'left') leftDirects++;
      else if (side === 'right') rightDirects++;
    }
  }

  const isRatioMet = (leftDirects >= 2 && rightDirects >= 1) || (leftDirects >= 1 && rightDirects >= 2);
  const isVolumeMet = totalDirectKbp >= 3000;

  return isRatioMet && isVolumeMet;
};

/**
 * 🔢 Counts actual verified Kuwi Star qualified downlines in Left and Right branches
 */
const countVerifiedSubtreeStars = async (userId) => {
  const downlineMembers = await Referral.find({ sponsorId: userId }).select('userId').lean();
  let leftStars = 0;
  let rightStars = 0;

  for (const ref of downlineMembers) {
    const isStar = await checkIsKuwiStar(ref.userId);
    if (isStar) {
      const u = await User.findById(ref.userId).select('binarySide').lean();
      if (String(u?.binarySide).toLowerCase() === 'left') leftStars++;
      else if (String(u?.binarySide).toLowerCase() === 'right') rightStars++;
    }
  }

  return { leftStars, rightStars };
};

/**
 * 📊 Live Salary Progress for Dashboard (1% TTO)
 */
const getLiveSalaryProgress = async (userId) => {
  // 1. Get true verified Star counts in downlines (NOT raw member counts)
  const { leftStars, rightStars } = await countVerifiedSubtreeStars(userId);
  const matchedStars = Math.min(leftStars, rightStars);

  const requiredStarsForGold = 200;
  const isGoldRank = matchedStars >= requiredStarsForGold;
  const percentage = Math.min(100, Math.round((matchedStars / requiredStarsForGold) * 100));

  return {
    isQualified: isGoldRank,
    currentStars: matchedStars,
    matchedStars,
    leftStars,
    rightStars,
    starsNeeded: Math.max(0, requiredStarsForGold - matchedStars),
    progressPercentage: percentage,
    monthlyGrowthMet: false,
    ratioMet: leftStars > 0 && rightStars > 0,
    statusText: isGoldRank ? 'Active (Gold Star Qualified)' : 'Locked (Pre-Gold Star)'
  };
};

module.exports = {
  getLiveSalaryProgress,
  checkIsKuwiStar,
  countVerifiedSubtreeStars
};