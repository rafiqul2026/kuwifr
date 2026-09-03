// server/src/controllers/setting.controller.js
// Production Controller for KUWIFR System & Enterprise Parameters
const Setting = require('../models/Setting');

// Standard KUWIFR Initial Default Setting Document
const DEFAULT_SYSTEM_SETTINGS = {
  company: {
    name: 'KUWIFR Marketing Pvt Ltd',
    supportEmail: 'support@kuwifr.com',
    supportPhone: '+91 94350 11223',
    address: 'GS Road, Christian Basti, Guwahati, Assam - 781005',
    cinNumber: 'U51909AS2026PTC019821',
    panNumber: 'AAECK1298P',
    gstNumber: '18AAECK1298P1Z5'
  },
  payment: {
    gatewayEnabled: true,
    defaultGateway: 'RAZORPAY',
    razorpayKeyId: 'rzp_live_kuwifr_production',
    razorpayKeySecret: '••••••••••••••••••••',
    upiId: 'kuwifr@icici',
    accountHolder: 'KUWIFR MARKETING PRIVATE LIMITED',
    bankName: 'ICICI Bank Ltd',
    accountNumber: '002105018921',
    ifscCode: 'ICIC0000021'
  },
  security: {
    sessionTimeoutMinutes: 120,
    maxLoginAttempts: 5,
    twoFactorRequiredForAdmin: false,
    allowMultipleLogins: true,
    ipWhitelistEnabled: false
  },
  email: {
    smtpHost: 'smtp.sendgrid.net',
    smtpPort: 587,
    smtpUser: 'apikey',
    smtpPass: '••••••••••••••••••••',
    fromEmail: 'no-reply@kuwifr.com',
    senderName: 'KUWIFR Official System',
    emailAlertsActive: true
  },
  system: {
    maintenanceMode: false,
    maintenanceNotice: 'System optimization underway. Storefront will resume shortly.',
    allowRegistrations: true,
    autoCalculateTTO: true,
    currencySymbol: '₹',
    currencyCode: 'INR'
  }
};

// Helper: Ensure the single settings record exists
const getOrSeedSettings = async () => {
  let doc = await Setting.findOne();
  if (!doc) {
    doc = await Setting.create(DEFAULT_SYSTEM_SETTINGS);
  }
  return doc;
};

/**
 * Public & Admin: Fetch active system settings
 * GET /api/settings or GET /api/admin/settings
 */
exports.getSettings = async (req, res, next) => {
  try {
    const settings = await getOrSeedSettings();
    return res.status(200).json({
      success: true,
      data: settings,
      settings
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      data: DEFAULT_SYSTEM_SETTINGS,
      settings: DEFAULT_SYSTEM_SETTINGS
    });
  }
};

/**
 * Admin: Update system settings
 * PUT /api/settings or PUT /api/admin/settings
 */
exports.updateSettings = async (req, res, next) => {
  try {
    const updates = req.body;
    let doc = await Setting.findOne();

    if (!doc) {
      doc = await Setting.create({ ...DEFAULT_SYSTEM_SETTINGS, ...updates });
    } else {
      // Merge individual nested configuration branches safely
      if (updates.company) doc.company = { ...doc.company, ...updates.company };
      if (updates.payment) doc.payment = { ...doc.payment, ...updates.payment };
      if (updates.security) doc.security = { ...doc.security, ...updates.security };
      if (updates.email) doc.email = { ...doc.email, ...updates.email };
      if (updates.system) doc.system = { ...doc.system, ...updates.system };

      await doc.save();
    }

    return res.status(200).json({
      success: true,
      message: 'System settings saved successfully!',
      data: doc,
      settings: doc
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Reset settings to default values
 * POST /api/admin/settings/reset
 */
exports.resetSettings = async (req, res, next) => {
  try {
    let doc = await Setting.findOne();
    if (doc) {
      Object.assign(doc, DEFAULT_SYSTEM_SETTINGS);
      await doc.save();
    } else {
      doc = await Setting.create(DEFAULT_SYSTEM_SETTINGS);
    }

    return res.status(200).json({
      success: true,
      message: 'Settings restored to factory defaults.',
      data: doc,
      settings: doc
    });
  } catch (error) {
    next(error);
  }
};