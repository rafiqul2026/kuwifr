// server/src/config/db.js
const mongoose = require('mongoose');

/**
 * Connect to MongoDB Database
 * Supports resilient URI lookup and connection monitoring
 */
const connectDB = async () => {
  try {
    // Check both standard variable names and sanitize whitespace/quotes
    const rawUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    const uri = rawUri ? rawUri.trim().replace(/^['"]|['"]$/g, '') : null;

    if (!uri) {
      throw new Error(
        'Neither MONGODB_URI nor MONGO_URI is defined. Check environment variables in Render/local .env.'
      );
    }

    const conn = await mongoose.connect(uri);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`📍 Connection State: ${conn.connection.readyState}`);

    // Connection lifecycle listeners
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);

    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 MongoDB server is unreachable. Check cluster host status.');
    }

    if (error.message.includes('bad auth') || error.message.includes('Authentication failed')) {
      console.error('💡 Authentication failed: verify Atlas username, password, and URL encoding.');
    }

    if (error.message.includes('Invalid scheme')) {
      console.error('💡 Connection string format error: verify it starts with "mongodb+srv://" without quotes.');
    }

    // Do not abruptly exit immediately so Render port binding diagnostics can log
    throw error;
  }
};

module.exports = connectDB;