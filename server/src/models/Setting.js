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
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.models.Setting || mongoose.model('Setting', settingSchema);