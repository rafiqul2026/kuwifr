// server/src/services/salary.service.js
const User = require('../models/User');
const DownlineService = require('./downline.service');
const Wallet = require('../models/Wallet');
const SalaryLog = require('../models/SalaryLog');
const TTORecord = require('../models/TTORecord');
const WalletService = require('./wallet.service');

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
 *
 * Real-money-relevant: this feeds Gold Star (and above) monthly salary
 * qualification below. It used to walk the `Referral` collection, which is
 * a best-effort mirror of User.sponsorId written once at registration
 * inside a try/catch that can silently fail (see referral.service.js) — so
 * a member with a genuinely large downline could be under-counted here and
 * wrongly denied (or short-paid) their monthly rank salary. Now computed
 * from the live, always-correct User.sponsorId graph via DownlineService
 * (a single $graphLookup query), so there is no separate, driftable
 * collection this financial calculation depends on.
 */
const countVerifiedSubtreeStars = async (userId) => {
  const downlineMembers = await DownlineService.getFullDownlineIds(userId);
  let leftStars = 0;
  let rightStars = 0;

  for (const member of downlineMembers) {
    const isStar = await checkIsKuwiStar(member._id);
    if (isStar) {
      const side = String(member.binarySide || '').toLowerCase();
      if (side === 'left') leftStars++;
      else if (side === 'right') rightStars++;
    }
  }

  return { leftStars, rightStars };
};

// ============================================================================
// MONTHLY SALARY (GOLD STAR) SETTLEMENT ENGINE
//
// Implements the rules implied by the SalaryLog schema:
//   - Gold Star threshold: 200 total qualified-star downline count
//   - Monthly growth requirement: >= 10% growth in total stars vs prior month
//   - 50:50 leg balance: left/right star growth must be reasonably even
//   - Payout: 1% of that month's Team Turn Over (TTO) if all conditions pass
//
// ASSUMPTIONS MADE (please verify against your actual comp-plan document —
// these were not fully specified in the existing code and had to be inferred
// from field names in SalaryLog.js and wallet.controller.js):
//   1. "Star" count = number of star-qualified downline members on each leg,
//      as computed by countVerifiedSubtreeStars() (already existed).
//   2. "Starting" baseline for a month = the currentLeftStar/currentRightStar
//      recorded in the PREVIOUS month's SalaryLog. If no prior log exists
//      (first-ever evaluation for this user), growth can't be measured, so
//      the growth requirement is waived for that first month only.
//   3. "50:50 balanced" = neither leg's growth is less than half the other
//      leg's growth (i.e. smaller/larger growth ratio >= 0.5). Adjust
//      REQUIRED_BALANCE_RATIO below if your real rule is stricter/looser.
//   4. "TTO" (Team Turn Over) = the totalKBP field on the TTORecord document
//      for that user+month, since no separate currency-based TTO figure
//      exists anywhere in the schema. If you track TTO in ₹ elsewhere,
//      swap the lookup in getTeamTurnoverForMonth() below.
//   5. If no TTORecord exists for the month, the member can still be marked
//      "qualified" on stars/growth/balance, but salaryAmount is ₹0 (we never
//      fabricate a payout amount from missing turnover data).
// ============================================================================

const GOLD_STAR_THRESHOLD = 200;
const REQUIRED_GROWTH_PERCENT = 10;
const REQUIRED_BALANCE_RATIO = 0.5;
const SALARY_PERCENTAGE = 1; // 1% of TTO

/**
 * Format a Date as "YYYY-MM".
 */
function getMonthString(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Returns the "YYYY-MM" string for the month immediately before `monthString`.
 */
function getPreviousMonthString(monthString) {
  const [year, month] = monthString.split('-').map(Number);
  const prevDate = new Date(year, month - 2, 1); // month is 1-indexed in the string
  return getMonthString(prevDate);
}

/**
 * Look up this member's Team Turn Over for a given month. See assumption #4 above.
 */
async function getTeamTurnoverForMonth(userId, monthString) {
  const record = await TTORecord.findOne({ userId, period: monthString }).lean();
  return record ? (record.totalKBP || 0) : 0;
}

/**
 * Core, side-effect-free evaluation shared by both the live dashboard preview
 * and the actual monthly settlement. Does NOT read/write SalaryLog itself for
 * the "current" baseline lookup beyond reading the previous month's log.
 */
async function evaluateStarQualification(userId, month) {
  // 1. Current star counts for this evaluation period.
  const { leftStars: currentLeftStar, rightStars: currentRightStar } =
    await countVerifiedSubtreeStars(userId);
  const totalStarAtEvaluation = currentLeftStar + currentRightStar;

  // 2. Baseline from the previous month's log, if any.
  const previousMonth = getPreviousMonthString(month);
  const previousLog = await SalaryLog.findOne({ userId, month: previousMonth }).lean();
  const startingLeftStar = previousLog ? (previousLog.currentLeftStar || 0) : 0;
  const startingRightStar = previousLog ? (previousLog.currentRightStar || 0) : 0;
  const isFirstEvaluation = !previousLog;

  // 3. Growth.
  const leftGrowth = currentLeftStar - startingLeftStar;
  const rightGrowth = currentRightStar - startingRightStar;
  const totalGrowth = leftGrowth + rightGrowth;
  const startingTotal = startingLeftStar + startingRightStar;

  let growthPercentageAchieved;
  if (startingTotal > 0) {
    growthPercentageAchieved = (totalGrowth / startingTotal) * 100;
  } else {
    // No baseline to measure growth against (first-ever evaluation).
    growthPercentageAchieved = totalStarAtEvaluation > 0 ? 100 : 0;
  }

  // 4. 50:50 leg balance on this month's growth.
  let isRatioBalanced;
  if (isFirstEvaluation) {
    isRatioBalanced = true; // nothing to compare yet
  } else if (leftGrowth <= 0 || rightGrowth <= 0) {
    isRatioBalanced = false; // one leg had zero/negative growth — not balanced
  } else {
    const ratio = Math.min(leftGrowth, rightGrowth) / Math.max(leftGrowth, rightGrowth);
    isRatioBalanced = ratio >= REQUIRED_BALANCE_RATIO;
  }

  // 5. Qualification checks.
  const meetsStarThreshold = totalStarAtEvaluation >= GOLD_STAR_THRESHOLD;
  const meetsGrowthRequirement = isFirstEvaluation || growthPercentageAchieved >= REQUIRED_GROWTH_PERCENT;

  const failureReasons = [];
  if (!meetsStarThreshold) {
    failureReasons.push(`Total stars ${totalStarAtEvaluation} below required ${GOLD_STAR_THRESHOLD}`);
  }
  if (!meetsGrowthRequirement) {
    failureReasons.push(`Monthly growth ${growthPercentageAchieved.toFixed(2)}% below required ${REQUIRED_GROWTH_PERCENT}%`);
  }
  if (!isRatioBalanced) {
    failureReasons.push('Left/Right growth is not balanced 50:50');
  }

  const isQualified = meetsStarThreshold && meetsGrowthRequirement && isRatioBalanced;

  // 6. Team Turn Over and the salary that would result if qualified.
  const teamTurnoverAmount = await getTeamTurnoverForMonth(userId, month);
  const salaryAmount = isQualified ? Math.round(teamTurnoverAmount * (SALARY_PERCENTAGE / 100)) : 0;

  return {
    month,
    currentLeftStar,
    currentRightStar,
    totalStarAtEvaluation,
    startingLeftStar,
    startingRightStar,
    isFirstEvaluation,
    leftGrowth,
    rightGrowth,
    totalGrowth,
    growthPercentageAchieved,
    isRatioBalanced,
    meetsStarThreshold,
    meetsGrowthRequirement,
    isQualified,
    failureReasons,
    teamTurnoverAmount,
    salaryAmount
  };
}

/**
 * 📊 Live Salary Progress for Dashboard (1% TTO)
 * Read-only preview of the CURRENT (in-progress) month's evaluation —
 * nothing is persisted or paid here. Field names match what
 * wallet.controller.js's getSalaryWalletDetails expects.
 */
const getLiveSalaryProgress = async (userId) => {
  const currentMonth = getMonthString(new Date());
  const evaluation = await evaluateStarQualification(userId, currentMonth);

  return {
    isGoldStarAchieved: evaluation.meetsStarThreshold,
    currentTotalStar: evaluation.totalStarAtEvaluation,
    requiredMinStar: GOLD_STAR_THRESHOLD,
    startingTotalStar: evaluation.startingLeftStar + evaluation.startingRightStar,
    requiredTotalGrowth: REQUIRED_GROWTH_PERCENT,
    leftGrowth: evaluation.leftGrowth,
    rightGrowth: evaluation.rightGrowth,
    requiredPerLegGrowth: REQUIRED_BALANCE_RATIO,
    has5050Balance: evaluation.isRatioBalanced,
    has10PercentGrowth: evaluation.meetsGrowthRequirement,
    isCurrentlyQualified: evaluation.isQualified,
    currentMonthTTO: evaluation.teamTurnoverAmount,
    estimatedSalary: evaluation.salaryAmount
  };
};

/**
 * Evaluate and (if qualified) pay out a member's Gold Star monthly salary
 * for the given month. Idempotent: re-running for a month that was already
 * PROCESSED simply returns the existing log without paying twice.
 */
async function processMonthlySalaryPayout(userId, targetMonth) {
  const month = targetMonth || getMonthString(getPreviousMonthMarker());

  // Idempotency guard — never pay the same member for the same month twice.
  const existingLog = await SalaryLog.findOne({ userId, month });
  if (existingLog && existingLog.status === 'PROCESSED') {
    return {
      success: true,
      qualified: existingLog.isQualified,
      alreadyProcessed: true,
      salaryAmount: existingLog.salaryAmount,
      message: `Salary for ${month} was already processed.`,
      log: existingLog
    };
  }

  const evaluation = await evaluateStarQualification(userId, month);

  const logData = {
    userId,
    month,
    rankAtEvaluation: 'Gold Star',
    totalStarAtEvaluation: evaluation.totalStarAtEvaluation,
    startingLeftStar: evaluation.startingLeftStar,
    startingRightStar: evaluation.startingRightStar,
    currentLeftStar: evaluation.currentLeftStar,
    currentRightStar: evaluation.currentRightStar,
    leftGrowth: evaluation.leftGrowth,
    rightGrowth: evaluation.rightGrowth,
    totalGrowth: evaluation.totalGrowth,
    growthPercentageAchieved: evaluation.growthPercentageAchieved,
    isRatioBalanced: evaluation.isRatioBalanced,
    isQualified: evaluation.isQualified,
    disqualificationReason: evaluation.isQualified ? '' : evaluation.failureReasons.join('; '),
    teamTurnoverAmount: evaluation.teamTurnoverAmount,
    salaryPercentage: SALARY_PERCENTAGE,
    salaryAmount: evaluation.salaryAmount,
    status: evaluation.isQualified ? 'PROCESSED' : 'DISQUALIFIED',
    processedAt: new Date()
  };

  const salaryLog = await SalaryLog.findOneAndUpdate(
    { userId, month },
    { $set: logData },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Pay out to the Salary wallet if qualified and there's an actual amount.
  if (evaluation.isQualified && evaluation.salaryAmount > 0) {
    try {
      await WalletService.creditSalary(userId, evaluation.salaryAmount, salaryLog._id, {
        month,
        description: `Gold Star monthly salary for ${month}`
      });
    } catch (payErr) {
      // Don't silently mark PROCESSED if the actual payout failed.
      salaryLog.status = 'PENDING';
      salaryLog.disqualificationReason = `Payout failed: ${payErr.message}`;
      await salaryLog.save();
      throw payErr;
    }
  }

  return {
    success: true,
    qualified: evaluation.isQualified,
    salaryAmount: evaluation.salaryAmount,
    message: evaluation.isQualified
      ? (evaluation.salaryAmount > 0
        ? `Qualified! ₹${evaluation.salaryAmount} credited for ${month}.`
        : `Qualified for ${month}, but no Team Turn Over record was found — ₹0 paid.`)
      : `Not qualified for ${month}: ${evaluation.failureReasons.join('; ')}`,
    log: salaryLog
  };
}

/**
 * Helper: "one month ago" — used only as the default when no targetMonth is
 * explicitly passed to processMonthlySalaryPayout (matches the cron, which
 * always settles the month that just completed).
 */
function getPreviousMonthMarker() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

module.exports = {
  getLiveSalaryProgress,
  checkIsKuwiStar,
  countVerifiedSubtreeStars,
  getMonthString,
  processMonthlySalaryPayout
};