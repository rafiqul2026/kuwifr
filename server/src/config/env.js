/**
 * Validate that all required environment variables are set
 * This prevents the app from running with missing configuration
 */
const validateEnv = () => {
  // List of environment variables we must have
  const required = [
    'NODE_ENV',
    'PORT',
    'MONGODB_URI',
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
    'CLIENT_URL'
  ];

  // Find which required variables are missing
  const missing = required.filter(key => !process.env[key]);

  // If any are missing, show error and exit
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('Please add these to your .env file');
    process.exit(1);
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