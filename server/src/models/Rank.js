// server/src/models/Rank.js
const mongoose = require('mongoose');

const RankSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  level: {
    type: Number,
    required: true,
    unique: true,
    min: 0,
    max: 12
  },
  code: {
    type: String,
    required: true,
    unique: true,
    enum: [
      'NO_RANK',
      'KUWI_STAR',
      'BRONZE_STAR',
      'SILVER_STAR',
      'PLATINUM_STAR',
      'GOLD_STAR',
      'SAPPHIRE_STAR',
      'EMERALD_STAR',
      'RUBY_STAR',
      'DIAMOND_STAR',
      'SALES_DIRECTOR',
      'AMBASSADOR',
      'CROWN'
    ]
  },
  kuwiStarRequirements: {
    directSponsors: {
      type: Number,
      default: 3
    },
    kbpRequired: {
      type: Number,
      default: 3000
    },
    // Days from joining to qualify for Kuwi Star. No longer enforced
    // anywhere (business rule: Kuwi Star has no time limit); kept so
    // existing Rank documents still read cleanly.
    timeLimit: {
      type: Number,
      default: 0
    }
  },
  starsRequired: {
    type: Number,
    default: 0
  },
  reward: {
    type: String,
    default: ''
  },
  rewardValue: {
    type: Number,
    default: 0
  },
  salaryPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  benefits: [{
    type: String,
    trim: true
  }],
  icon: {
    type: String,
    default: ''
  },
  color: {
    type: String,
    default: '#2563eb'
  },
  badge: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

RankSchema.index({ starsRequired: 1 });
RankSchema.index({ isActive: 1 });

// Export with fallback check to avoid OverwriteModelError
module.exports = mongoose.models.Rank || mongoose.model('Rank', RankSchema);