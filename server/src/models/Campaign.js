const mongoose = require('mongoose');

/**
 * Campaign Schema - Defines marketing campaigns
 * Campaigns have targets, rewards, and tracking
 */
const CampaignSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,  // ← This automatically creates an index
    trim: true
  },
  description: {
    type: String,
    required: true
  },

  // Campaign Type
  type: {
    type: String,
    required: true,
    enum: [
      'MONTHLY',
      'QUARTERLY',
      'SPECIAL',
      'REFERRAL',
      'REPURCHASE',
      'RANK'
    ]
  },

  // Targets
  targets: {
    type: [{
      name: {
        type: String,
        required: true
      },
      value: {
        type: Number,
        required: true,
        min: 0
      },
      unit: {
        type: String,
        enum: ['INCOME', 'KBP', 'REFERRALS', 'SALES', 'RANK'],
        default: 'INCOME'
      }
    }],
    required: true
  },

  // Reward
  reward: {
    type: {
      type: String,
      enum: ['CASH', 'PRODUCT', 'TRIP', 'MERCHANDISE', 'RECOGNITION'],
      required: true
    },
    value: {
      type: Number,
      default: 0,
      min: 0
    },
    description: {
      type: String,
      required: true
    },
    imageUrl: {
      type: String,
      default: ''
    }
  },

  // Eligibility
  eligibility: {
    minRank: {
      type: String,
      default: null
    },
    minPackage: {
      type: String,
      default: null
    },
    countries: [{
      type: String,
      default: ['India']
    }],
    excludeUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },

  // Duration
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },

  // Status
  status: {
    type: String,
    enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'],
    default: 'DRAFT'
  },

  // Progress Tracking
  progress: {
    totalParticipants: {
      type: Number,
      default: 0
    },
    achievedParticipants: {
      type: Number,
      default: 0
    },
    totalAchieved: {
      type: Number,
      default: 0
    },
    percentageComplete: {
      type: Number,
      default: 0
    }
  },

  // Participants
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    progress: {
      type: Map,
      of: Number
    },
    achieved: {
      type: Boolean,
      default: false
    },
    achievedAt: {
      type: Date,
      default: null
    },
    rewardClaimed: {
      type: Boolean,
      default: false
    },
    rewardClaimedAt: {
      type: Date,
      default: null
    }
  }],

  // Communication
  notifications: {
    startEmail: {
      type: Boolean,
      default: true
    },
    progressEmail: {
      type: Boolean,
      default: false
    },
    completionEmail: {
      type: Boolean,
      default: true
    },
    reminderDays: {
      type: Number,
      default: 7
    }
  },

  // Admin
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Audit
  notes: {
    type: String,
    default: ''
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ============ INDEXES ============
// ✅ REMOVED: code index (already has unique:true)
// ✅ KEPT: status + startDate + endDate compound index (for filtering active campaigns)
// ✅ KEPT: 'participants.userId' index (for checking user participation)
CampaignSchema.index({ status: 1, startDate: 1, endDate: 1 });
CampaignSchema.index({ 'participants.userId': 1 });

const Campaign = mongoose.model('Campaign', CampaignSchema);
module.exports = Campaign;