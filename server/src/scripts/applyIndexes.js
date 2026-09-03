// server/src/scripts/applyIndexes.js
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const applyIndexes = async () => {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
    if (!uri) {
      throw new Error('MongoDB URI not found in environment variables.');
    }

    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(uri);

    const db = mongoose.connection.db;

    console.log('Applying compound indexes for high-speed Admin queries...');

    // 1. Users collection
    await db.collection('users').createIndex({ role: 1, status: 1 });
    await db.collection('users').createIndex({ memberId: 1 }, { unique: true, sparse: true });
    await db.collection('users').createIndex({ email: 1 });
    await db.collection('users').createIndex({ createdAt: -1 });

    // 2. Orders collection (if exists)
    try {
      await db.collection('orders').createIndex({ orderStatus: 1, createdAt: -1 });
      await db.collection('orders').createIndex({ userId: 1, createdAt: -1 });
    } catch (e) {
      console.log('Note: Orders collection skipped or empty.');
    }

    // 3. Withdrawals collection (if exists)
    try {
      await db.collection('withdrawals').createIndex({ status: 1, createdAt: -1 });
      await db.collection('withdrawals').createIndex({ userId: 1, createdAt: -1 });
    } catch (e) {
      console.log('Note: Withdrawals collection skipped or empty.');
    }

    console.log('All performance indexes successfully synced with MongoDB Atlas.');
    process.exit(0);
  } catch (err) {
    console.error('Error applying indexes:', err.message);
    process.exit(1);
  }
};

applyIndexes();