/**
 * Validate that all required environment variables are set
 * This prevents the app from running with missing configuration
 */
const validateEnv = () => {
  // List of environment variables we must have. PORT is deliberately NOT
  // required here — server.js falls back to 5000 when it's unset, and a
  // serverless deployment (Vercel) never sets or uses PORT at all (there's
  // no app.listen() call in that mode), so requiring it would make the app
  // fail to boot there for no reason.
  const required = [
    'NODE_ENV',
    'MONGODB_URI',
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
    'CLIENT_URL'
  ];

  // Find which required variables are missing
  const missing = required.filter(key => !process.env[key]);

  // If any are missing, fail loudly. `process.exit(1)` is deliberately NOT
  // used here — on a serverless platform (Vercel) that would abruptly kill
  // the function's process, which can behave unpredictably (or affect other
  // in-flight invocations sharing a warm instance) instead of cleanly
  // failing just this request. Throwing lets the caller (and, in Express,
  // the error-handling middleware) turn this into a normal error response,
  // and it still fully stops a traditional server (Render/local) at boot,
  // since nothing calls this inside a try/catch there either.
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('Please add these to your .env file (or your hosting dashboard\'s environment variables).');
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Warn if JWT_SECRET is too short (security risk)
  if (process.env.JWT_SECRET.length < 32) {
    console.warn('⚠️  JWT_SECRET should be at least 32 characters for production');
  }

  console.log('✅ Environment variables validated');
};

// Export configuration object for use in other files
const config = {
  env: process.env.NODE_ENV,
  port: parseInt(process.env.PORT, 10),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  clientUrl: process.env.CLIENT_URL,
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173']
};

module.exports = { config, validateEnv };