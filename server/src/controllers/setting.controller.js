// server/src/controllers/setting.controller.js
// Production Controller for KUWIFR System & Enterprise Parameters
const Setting = require('../models/Setting');
const SettingsService = require('../services/settings.service');

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
  },
  compensation: SettingsService.DEFAULT_COMPENSATION
};

// Fields that must NEVER be sent to an unauthenticated caller. The public
// GET /api/settings endpoint (no auth — used by the storefront for company
// name, maintenance banner, currency, etc.) previously returned the ENTIRE
// settings document as-is, including live payment gateway secrets and the
// SMTP password. Anything under these keys is stripped before that response
// goes out; the authenticated admin endpoints still return the full document.
const PUBLIC_SAFE_FIELDS = {
  company: true,
  system: true,
  payment: { gatewayEnabled: true, defaultGateway: true, upiId: true },
  compensation: true // rates are not secret — useful for a public compensation-plan page
};

const toPublicSettings = (doc) => {
  const full = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const safe = {};
  for (const [section, fields] of Object.entries(PUBLIC_SAFE_FIELDS)) {
    if (!full[section]) continue;
    if (fields === true) {
      safe[section] = full[section];
    } else {
      safe[section] = {};
      for (const field of Object.keys(fields)) {
        if (full[section][field] !== undefined) safe[section][field] = full[section][field];
      }
    }
  }
  return safe;
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
 * Public: Fetch the PUBLIC-SAFE subset of system settings (company info,
 * maintenance banner, currency, compensation rates). Never returns payment
 * gateway secrets, SMTP credentials, or bank account details.
 * GET /api/settings
 */
exports.getSettings = async (req, res, next) => {
  try {
    const settings = await getOrSeedSettings();
    const publicSettings = toPublicSettings(settings);
    return res.status(200).json({
      success: true,
      data: publicSettings,
      settings: publicSettings
    });
  } catch (error) {
    const publicDefaults = toPublicSettings(DEFAULT_SYSTEM_SETTINGS);
    return res.status(200).json({
      success: true,
      data: publicDefaults,
      settings: publicDefaults
    });
  }
};

/**
 * Admin only: Fetch the FULL system settings document, including payment
 * gateway/SMTP credentials. Mounted behind auth+adminAuth in setting.routes.js.
 * GET /api/admin/settings
 */
exports.getFullSettings = async (req, res, next) => {
  try {
    const settings = await getOrSeedSettings();
    return res.status(200).json({
      success: true,
      data: settings,
      settings
    });
  } catch (error) {
    next(error);
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
      if (updates.company) doc.company = { ...doc.company.toObject?.() ?? doc.company, ...updates.company };
      if (updates.payment) doc.payment = { ...doc.payment.toObject?.() ?? doc.payment, ...updates.payment };
      if (updates.security) doc.security = { ...doc.security.toObject?.() ?? doc.security, ...updates.security };
      if (updates.email) doc.email = { ...doc.email.toObject?.() ?? doc.email, ...updates.email };
      if (updates.system) doc.system = { ...doc.system.toObject?.() ?? doc.system, ...updates.system };
      if (updates.compensation) {
        const current = doc.compensation?.toObject?.() ?? doc.compensation ?? {};
        const incoming = updates.compensation;
        doc.compensation = {
          referral: { ...current.referral, ...incoming.referral },
          matching: { ...current.matching, ...incoming.matching },
          leadership: { ...current.leadership, ...incoming.leadership },
          repurchase: { ...current.repurchase, ...incoming.repurchase },
          withdrawal: { ...current.withdrawal, ...incoming.withdrawal },
          franchise: { ...current.franchise, ...incoming.franchise }
        };
      }

      await doc.save();
    }

    // A saved rate change must take effect immediately, not after the next
    // 15s cache window happens to expire on its own.
    SettingsService.invalidateCache();

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
    // DEFAULT_SYSTEM_SETTINGS has no `compensation` key, so a plain
    // Object.assign here would leave commission/level-income rates
    // untouched — reset the compensation plan back to the business-plan
    // defaults too, since the admin now edits those from this same page.
    const resetPayload = { ...DEFAULT_SYSTEM_SETTINGS, compensation: SettingsService.DEFAULT_COMPENSATION };
    if (doc) {
      Object.assign(doc, resetPayload);
      await doc.save();
    } else {
      doc = await Setting.create(resetPayload);
    }

    SettingsService.invalidateCache();

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