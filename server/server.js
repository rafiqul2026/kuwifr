// server/server.js
const path = require('path');
// 1. MUST BE AT THE VERY TOP to load .env into process.env before app initializes
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = require('./src/app');

// Render provisions process.env.PORT (typically 10000). Fallback to 5000 locally.
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Bound to host: ${HOST}`);
});

// Handle unhandled Promise rejections without crashing server
process.on('unhandledRejection', (err) => {
  console.error('⚠️ Unhandled Promise Rejection:', err.message);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
});

// Graceful shutdown on server termination
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('💤 Process terminated.');
  });
});