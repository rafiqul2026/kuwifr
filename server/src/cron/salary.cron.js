// server/src/cron/salary.cron.js
const cron = require('node-cron');
const BinaryNode = require('../models/BinaryNode');
const SalaryService = require('../services/salary.service');

/**
 * Monthly Salary Settlement Cron Job
 * Schedule: 00:05 AM on the 1st of every month (5 0 1 * *)
 */
const initSalaryScheduler = () => {
  cron.schedule('5 0 1 * *', async () => {
    console.log('⏰ [SALARY CRON] Running automated monthly salary settlement...');

    try {
      // 1. Calculate evaluated month string (YYYY-MM for the month just completed)
      const now = new Date();
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
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
  });

  console.log('🚀 [SALARY CRON] Monthly salary distribution scheduler initialized.');
};

module.exports = { initSalaryScheduler };