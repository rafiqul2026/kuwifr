// server/src/cron/salary.cron.js
const cron = require('node-cron');
const BinaryNode = require('../models/BinaryNode');
const SalaryService = require('../services/salary.service');
const { getPreviousBusinessMonthStart } = require('../utils/businessDate');

/**
 * Monthly Salary Settlement Cron Job
 * Schedule: 00:05 AM IST on the 1st of every month (5 0 1 * *).
 *
 * NOTE: node-cron has no explicit timezone by default — it fires at 00:05
 * in whatever timezone the Node PROCESS runs in, which on Vercel is UTC,
 * not IST. `timezone: 'Asia/Kolkata'` below makes this actually fire at
 * IST midnight-plus-5-minutes instead of 5:35 AM IST. Separately: node-cron
 * requires a long-lived process to keep its internal timer alive — if this
 * app runs as short-lived Vercel serverless functions (no persistent
 * process between requests), this in-process schedule may never actually
 * fire in production regardless of the timezone setting. The Vercel-native
 * cron in vercel.json (GET /api/cron/reconcile-capped-rollover) is the
 * pattern proven to work on that platform; this file's initSalaryScheduler()
 * should be re-verified against wherever/however it's actually invoked in
 * production, and migrated to a Vercel cron route if it isn't already
 * running reliably. Out of scope for this IST business-date centralization
 * — flagging so it isn't missed.
 */
const initSalaryScheduler = () => {
  cron.schedule('5 0 1 * *', async () => {
    console.log('⏰ [SALARY CRON] Running automated monthly salary settlement...');

    try {
      // 1. Calculate evaluated month string (YYYY-MM for the month just
      // completed) — IST-anchored (see utils/businessDate.js), not
      // server-local, so this always settles the correct IST month even
      // when the process itself runs in UTC.
      const prevMonthDate = getPreviousBusinessMonthStart();
      const targetMonth = SalaryService.getMonthString(prevMonthDate);

      console.log(`📅 [SALARY CRON] Processing settlement for month: ${targetMonth}`);

      // 2. Find eligible members with at least 200 Total Star Volume (Gold Star threshold)
      const eligibleNodes = await BinaryNode.find({
        $expr: { $gte: [{ $add: ['$leftVolume', '$rightVolume'] }, 200] }
      }).select('userId leftVolume rightVolume');

      console.log(`🔍 [SALARY CRON] Found ${eligibleNodes.length} Gold Star members eligible for evaluation.`);

      let qualifiedCount = 0;
      let totalDisbursed = 0;

      // 3. Process settlement for each member sequentially to ensure transaction integrity
      for (const node of eligibleNodes) {
        try {
          const outcome = await SalaryService.processMonthlySalaryPayout(node.userId, targetMonth);
          if (outcome && outcome.qualified) {
            qualifiedCount++;
            totalDisbursed += outcome.salaryAmount;
          }
        } catch (memberErr) {
          console.error(`⚠️ [SALARY CRON] Error settling User ${node.userId}:`, memberErr.message);
        }
      }

      console.log(`✅ [SALARY CRON] Monthly settlement complete for ${targetMonth}:`);
      console.log(`   - Qualified Members: ${qualifiedCount}`);
      console.log(`   - Total Amount Credited: ₹${totalDisbursed.toLocaleString('en-IN')}`);
    } catch (cronErr) {
      console.error('❌ [SALARY CRON] Fatal error executing monthly settlement:', cronErr);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('🚀 [SALARY CRON] Monthly salary distribution scheduler initialized.');
};

module.exports = { initSalaryScheduler };