// server/server.js

// Load environment variables
require('dotenv').config();

const app = require('./src/app');
const { initSalaryScheduler } = require('./src/cron/salary.cron');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);

  // Initialize automated monthly salary scheduler (runs 00:05 AM on the 1st of every month)
  try {
    initSalaryScheduler();
  } catch (err) {
    console.error('⚠️ Failed to initialize salary scheduler:', err.message);
  }
});