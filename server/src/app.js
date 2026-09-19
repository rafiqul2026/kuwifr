// server/src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import configuration
const { validateEnv } = require('./config/env');
const connectDB = require('./config/db');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/error');
const { requestLogger } = require('./middleware/logger');

// ============================================================
// ✅ ROUTE IMPORTS
// ============================================================
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const campaignRoutes = require('./routes/campaign.routes');
const packageRoutes = require('./routes/package.routes');
const paymentRoutes = require('./routes/payment.routes');
const orderRoutes = require('./routes/order.routes');
const walletRoutes = require('./routes/wallet.routes');
const incomeRoutes = require('./routes/income.routes');
const rankRoutes = require('./routes/rank.routes');
const fundRoutes = require('./routes/fund.routes');
const withdrawalRoutes = require('./routes/withdrawal.routes');
const repurchaseRoutes = require('./routes/repurchase.routes');
const bonanzaRoutes = require('./routes/bonanza.routes');
const notificationRoutes = require('./routes/notification.routes');
const reportRoutes = require('./routes/report.routes');
const contactRoutes = require('./routes/contact.routes');
const newsletterRoutes = require('./routes/newsletter.routes');
const supportRoutes = require('./routes/support.routes');
const adminRoutes = require('./routes/admin.routes');
const settingRoutes = require('./routes/setting.routes');
const franchiseRoutes = require('./routes/franchise.routes');
const auditLogRoutes = require('./routes/auditLog.routes');
const packagePurchaseRoutes = require('./routes/packagePurchase.routes');
const teamRoutes = require('./routes/team.routes'); // 🌟 Ensure teamRoutes is imported
const ruleRoutes = require('./routes/rule.routes');
const offerRoutes = require('./routes/offer.routes');

// Validate environment variables
validateEnv();

// ============================================================
// ✅ INITIALIZE APP
// ============================================================
const app = express();

// Enable proxy trust for Render / Cloudflare reverse proxies
app.set('trust proxy', 1);

// ==================== CORS CONFIGURATION ====================
const defaultAllowedOrigins = [
  'https://www.kuwifr.in',
  'https://kuwifr.in',
  'https://kuwifr.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000'
];

const envAllowedOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [])
].filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const isAllowed =
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.kuwifr.in') ||
      /^https:\/\/kuwifr.*\.vercel\.app$/.test(origin);

    if (isAllowed) {
      return callback(null, true);
    }

    console.warn(`[CORS Blocked] Origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'X-Requested-With',
    'Origin'
  ],
  exposedHeaders: ['Set-Cookie']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ==================== SECURITY & PARSING ====================
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});
app.use('/api', limiter);

// Auth endpoints get a much tighter limit than the general API — the global
// 1000/15min limiter is far too loose to stop credential-stuffing/brute-force
// login attempts or OTP-request spam against a single account.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many attempts from this device. Please try again in a few minutes.'
  }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/register-downline', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(requestLogger);

// ==================== SYSTEM ROUTES ====================
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to KUWIFR API Server',
    version: '1.0.0',
    status: 'Running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    endpoints: {
      health: '/api/health',
      test: '/api/test'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    mongodb: {
      status: 'Connected',
      database: 'kuwifrdb'
    }
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Backend is working!',
    timestamp: new Date().toISOString()
  });
});

// ==================== SEO: robots.txt ====================
// Served at the site root (https://kuwifr.in/robots.txt) — vercel.json
// rewrites this exact path to this serverless function ahead of its
// catch-all SPA rewrite, since Vercel would otherwise serve
// client/dist/index.html for any path with no matching static file. Placed
// before the DB-connect gate below since it never queries MongoDB (see
// seo.controller.js), so it stays available even if the database is
// briefly unreachable. sitemap.xml is registered after the gate instead
// (below) since it now queries RepurchaseProduct for real product URLs.
const { getRobotsTxt, getSitemapXml } = require('./controllers/seo.controller');
app.get('/robots.txt', getRobotsTxt);

// Ensure MongoDB is connected before any DATA route handler runs a query.
// Deliberately placed after the health/test routes above (which should
// keep working even if the database is briefly unreachable) and after
// CORS/security/parsing middleware (so preflight OPTIONS requests and
// security headers are never blocked on a DB round-trip). On a traditional
// server (Render) this resolves once at boot and every request after that
// hits the `mongoose.connection.readyState === 1` fast path in connectDB().
// On serverless (Vercel) this is what makes the cached-connection pattern
// in config/db.js actually safe: a request on a cold function instance
// waits for the (cached, shared-across-warm-invocations) connection promise
// instead of racing ahead and issuing queries before it's ready.
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('❌ Request blocked — database unavailable:', error.message);
    res.status(503).json({
      success: false,
      message: 'Database temporarily unavailable. Please try again in a moment.'
    });
  }
});

// GET /sitemap.xml — after the DB gate above since it queries
// RepurchaseProduct for real product URLs (see seo.controller.js).
// vercel.json rewrites this exact path to this serverless function ahead
// of its catch-all SPA rewrite.
app.get('/sitemap.xml', getSitemapXml);

// ============================================================
// ✅ MOUNTED API ROUTERS
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/packages', require('./routes/package.routes'));
app.use('/api/package-purchases', packagePurchaseRoutes);
app.use('/api/ranks', rankRoutes);
app.use('/api/admin/ranks', rankRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/admin/packages', packageRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin/orders', orderRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/bonanza', bonanzaRoutes);
app.use('/api/repurchase', repurchaseRoutes);
app.use('/api/funds', fundRoutes);
app.use('/api/admin/funds', fundRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/admin/withdrawals', withdrawalRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin/reports', reportRoutes);
app.use('/api/franchise', franchiseRoutes);
app.use('/api/admin/franchise', franchiseRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/admin/offers', offerRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/admin/campaigns', campaignRoutes);
app.use('/api/settings', settingRoutes);
// Dedicated admin-only router: every route (including its root GET) is
// gated behind auth+adminAuth and always returns the FULL settings document.
// This must NOT be the same router instance mounted at /api/settings above —
// that one intentionally serves a public-safe subset from its root path.
app.use('/api/admin/settings', settingRoutes.adminRouter);
app.use('/api/admin/rules', ruleRoutes);
app.use('/api/audit', auditLogRoutes);
app.use('/api/admin/audit', auditLogRoutes);

// 🌟 Team Overview (Binary Tree & Unlimited Depth Downline Branch Inspection)
app.use('/api/team', teamRoutes);

// ==================== VERCEL CRON: CAP ROLLOVER ====================
// Automatic daily trigger for IncomeService.reconcileCappedIncomeShortfall
// Rollover (see that method's own comment for the full explanation): pays
// out whatever a member's daily/weekly/monthly package cap now allows
// toward income that was correctly calculated but still short from a prior
// day's cap being exhausted — the caps are a pacing limit, not a permanent
// forfeiture, so this needs to run again each day for anyone still owed
// money to actually get paid as room frees up. Configured to fire once a
// day via the "crons" entry in vercel.json.
//
// NOT behind the normal user-JWT auth above (Vercel's cron caller has no
// user session) — instead requires the shared secret Vercel sends
// automatically as `Authorization: Bearer <CRON_SECRET>` when a CRON_SECRET
// environment variable is configured for this project in Vercel > Settings
// > Environment Variables. Fails closed: with no CRON_SECRET set, or a
// non-matching one, every call is refused rather than left open.
app.get('/api/cron/reconcile-capped-rollover', async (req, res) => {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return res.status(503).json({ success: false, message: 'CRON_SECRET is not configured for this project.' });
  }

  const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (provided !== expectedSecret) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const IncomeService = require('./services/income.service');
    const summary = await IncomeService.reconcileCappedIncomeShortfallRollover();
    console.log(`⏰ [CAP ROLLOVER CRON] ${summary.corrected} top-up(s) credited across ${summary.checked} checked, ${summary.alreadyFull} already fully paid, ${summary.stillCapped} still capped.`);
    res.json({
      success: true,
      message: `Cap rollover complete. ${summary.corrected} top-up(s) credited across ${summary.checked} transaction(s) checked, ${summary.alreadyFull} already fully paid, ${summary.stillCapped} still capped right now.`,
      data: summary
    });
  } catch (error) {
    console.error('❌ [CAP ROLLOVER CRON] Failed:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Daily-close settlement for Matching Income + Leadership Income — moves
// each member's whole day's earning of these two income types into their
// wallet balance in one batched credit per bucket, once the IST business
// day has fully closed (business rule: "will be add in Members wallet at
// the time of closing the Date"). Every other income type is unaffected
// (still credits instantly, as before). Configured to fire once a day via
// the "crons" entry in vercel.json, scheduled shortly after IST midnight.
//
// Same CRON_SECRET bearer-token pattern as reconcile-capped-rollover above
// — not behind the normal user-JWT auth since Vercel's cron caller has no
// user session. Fails closed with no/mismatched secret.
app.get('/api/cron/settle-daily-income', async (req, res) => {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return res.status(503).json({ success: false, message: 'CRON_SECRET is not configured for this project.' });
  }

  const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (provided !== expectedSecret) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const IncomeService = require('./services/income.service');
    const summary = await IncomeService.settleDailyMatchingAndLeadershipIncome();
    console.log(`⏰ [DAILY SETTLEMENT CRON] ${summary.membersSettled} member(s) settled, ₹${summary.totalSettled.toLocaleString('en-IN')} moved to wallets, ${summary.transactionsFound} transaction(s) processed, ${summary.errors.length} error(s).`);
    res.json({
      success: true,
      message: `Daily settlement complete. ${summary.membersSettled} member(s) settled, ₹${summary.totalSettled.toLocaleString('en-IN')} moved to wallets across ${summary.transactionsFound} transaction(s).`,
      data: summary
    });
  } catch (error) {
    console.error('❌ [DAILY SETTLEMENT CRON] Failed:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ERROR HANDLING ====================
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;