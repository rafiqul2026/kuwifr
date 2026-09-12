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
const productRoutes = require('./routes/product.routes');
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

// ============================================================
// ✅ MOUNTED API ROUTERS
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/packages', require('./routes/package.routes'));
app.use('/api/package-purchases', packagePurchaseRoutes);
app.use('/api/ranks', rankRoutes);
app.use('/api/admin/ranks', rankRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin/products', productRoutes);
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

// ==================== ERROR HANDLING ====================
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;