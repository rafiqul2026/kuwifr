// server/src/models/Setting.js
// Production Mongoose Schema for KUWIFR System & Enterprise Configuration
const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
  {
    // 1. Company Information
    company: {
      name: { type: String, default: 'KUWIFR Marketing Pvt Ltd' },
      supportEmail: { type: String, default: 'support@kuwifr.com' },
      supportPhone: { type: String, default: '+91 94350 11223' },
      address: { type: String, default: 'GS Road, Christian Basti, Guwahati, Assam - 781005' },
      cinNumber: { type: String, default: 'U51909AS2026PTC019821' },
      panNumber: { type: String, default: 'AAECK1298P' },
      gstNumber: { type: String, default: '18AAECK1298P1Z5' }
    },

    // 2. Payment Gateway Configuration
    payment: {
      gatewayEnabled: { type: Boolean, default: true },
      defaultGateway: { type: String, default: 'RAZORPAY' },
      razorpayKeyId: { type: String, default: 'rzp_live_kuwifr_production' },
      razorpayKeySecret: { type: String, default: '••••••••••••••••••••' },
      upiId: { type: String, default: 'kuwifr@icici' },
      accountHolder: { type: String, default: 'KUWIFR MARKETING PRIVATE LIMITED' },
      bankName: { type: String, default: 'ICICI Bank Ltd' },
      accountNumber: { type: String, default: '002105018921' },
      ifscCode: { type: String, default: 'ICIC0000021' }
    },

    // 3. Security & Access Control
    security: {
      sessionTimeoutMinutes: { type: Number, default: 120 },
      maxLoginAttempts: { type: Number, default: 5 },
      twoFactorRequiredForAdmin: { type: Boolean, default: false },
      allowMultipleLogins: { type: Boolean, default: true },
      ipWhitelistEnabled: { type: Boolean, default: false }
    },

    // 4. Email & Notification Dispatcher
    email: {
      smtpHost: { type: String, default: 'smtp.sendgrid.net' },
      smtpPort: { type: Number, default: 587 },
      smtpUser: { type: String, default: 'apikey' },
      smtpPass: { type: String, default: '••••••••••••••••••••' },
      fromEmail: { type: String, default: 'no-reply@kuwifr.com' },
      senderName: { type: String, default: 'KUWIFR Official System' },
      emailAlertsActive: { type: Boolean, default: true }
    },

    // 5. System & Maintenance Engine
    system: {
      maintenanceMode: { type: Boolean, default: false },
      maintenanceNotice: { type: String, default: 'Routine database index optimization underway. Back online shortly.' },
      allowRegistrations: { type: Boolean, default: true },
      autoCalculateTTO: { type: Boolean, default: true },
      currencySymbol: { type: String, default: '₹' },
      currencyCode: { type: String, default: 'INR' }
    },

    // 6. Compensation Plan — every commission/level-income rate the admin can
    // tune from the admin panel without a code deploy. income.service.js,
    // binary.service.js, repurchase.service.js and withdrawal.service.js all
    // read this block live (via settingsService.getCompensation()) instead of
    // hardcoding rates, with the defaults below matching the KUWIFR business
    // plan exactly if the admin never touches this screen.
    compensation: {
      // Direct Referral Income: flat % of the sponsored member's package KBP.
      referral: {
        rate: { type: Number, default: 0.10, min: 0, max: 1 }
      },

      // Binary Matching Income: 1 "unit" = unitValue KBP on each leg. First
      // pair requires a 2:1 or 1:2 ratio (firstPairSmallUnits : firstPairLargeUnits)
      // and at least firstPairMinDirects direct sponsors (split across both
      // legs); every pair after that matches 1:1 to unlimited depth.
      matching: {
        rate: { type: Number, default: 0.10, min: 0, max: 1 },
        unitValue: { type: Number, default: 1000, min: 1 },
        firstPairSmallUnits: { type: Number, default: 1, min: 1 },
        firstPairLargeUnits: { type: Number, default: 2, min: 1 },
        firstPairMinDirects: { type: Number, default: 2, min: 0 }
      },

      // Leadership / Cheque Match Bonus: % of a qualified downline leader's
      // OWN matching-income payout, paid to their level-1/2/3 sponsor-tree
      // upline (index 0 = level 1 = 50%, index 1 = level 2 = 30%, index 2 =
      // level 3 = 20%). Both the earner (leader) and the recipient (upline)
      // must hold at least `minRankCode`.
      leadership: {
        levelRates: { type: [Number], default: [0.50, 0.30, 0.20] },
        minRankCode: { type: String, default: 'KUWI_STAR' }
      },

      // Repurchase Plan: 25% instant self cashback + 10-level downline matrix.
      // levelRates index 0 = level 1 ... index 9 = level 10. unlockLevelsByDirects
      // index 0 = "with 1 active direct referral, this many levels are unlocked"
      // ... index 4 = "5+ active directs unlocks all levels".
      repurchase: {
        selfRate: { type: Number, default: 0.25, min: 0, max: 1 },
        levelRates: {
          type: [Number],
          default: [0.17, 0.13, 0.09, 0.05, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01]
        },
        unlockLevelsByDirects: { type: [Number], default: [2, 4, 6, 8, 10] }
      },

      // Withdrawal deductions, applied to the gross amount requested.
      withdrawal: {
        minAmount: { type: Number, default: 100, min: 0 },
        adminChargeRate: { type: Number, default: 0.05, min: 0, max: 1 },
        serviceChargeRate: { type: Number, default: 0.05, min: 0, max: 1 },
        tdsRate: { type: Number, default: 0.05, min: 0, max: 1 }
      },

      // Franchise commissions.
      franchise: {
        kspRate: { type: Number, default: 0.10, min: 0, max: 1 },
        kbpLifetimeRate: { type: Number, default: 0.01, min: 0, max: 1 }
      }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.models.Setting || mongoose.model('Setting', settingSchema);