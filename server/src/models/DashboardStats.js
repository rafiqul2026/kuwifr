const mongoose = require('mongoose');

/**
 * Dashboard Stats Schema - Caches dashboard statistics
 * Reduces database load by caching frequently accessed data
 */
const DashboardStatsSchema = new mongoose.Schema({
  // Stats Data
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // Generation Info
  generatedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    }
  },

  // Version
  version: {
    type: Number,
    default: 1
  }
});

// Indexes
DashboardStatsSchema.index({ generatedAt: -1 });
DashboardStatsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const DashboardStats = mongoose.model('DashboardStats', DashboardStatsSchema);
module.exports = DashboardStats;