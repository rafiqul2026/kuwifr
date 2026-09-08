// server/src/scripts/reconcile_incomes.js
require('dotenv').config();
const mongoose = require('mongoose');
const IncomeTransaction = require('../models/IncomeTransaction');
const Order = require('../models/Order');
const Wallet = require('../models/Wallet');
const IncomeService = require('../services/income.service');

async function runReconciliation() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://...');
    console.log('📦 Connected to MongoDB for reconciliation...');

    // 1. Clear corrupted income transactions and reset wallets
    console.log('🧹 Purging corrupted income ledger records...');
    await IncomeTransaction.deleteMany({});
    await Wallet.updateMany({}, { $set: { incomeBalance: 0, totalIncome: 0 } });

    // 2. Re-process completed orders using authoritative KBP rules
    const completedOrders = await Order.find({ orderStatus: 'COMPLETED' });
    console.log(`🔄 Re-processing income for ${completedOrders.length} completed orders...`);

    for (const order of completedOrders) {
      await IncomeService.processOrderIncome(order);
    }

    console.log('✅ Reconciliation and KBP recalculation completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Reconciliation failed:', error);
    process.exit(1);
  }
}

runReconciliation();