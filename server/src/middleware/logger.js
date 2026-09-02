/**
 * Request Logger Middleware
 * Logs all incoming requests with timing information
 */
const requestLogger = (req, res, next) => {
  // Record start time
  const start = Date.now();

  // Log request
  console.log(`📝 ${req.method} ${req.url}`);

  // When response is sent, log the result
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? '❌' : '✅';
    console.log(
      `${statusColor} ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`
    );
  });

  next();
};

/**
 * Request Logger with more details (optional)
 */
const detailedRequestLogger = (req, res, next) => {
  const start = Date.now();

  // Log detailed request info
  console.log('\n📝 REQUEST:');
  console.log(`  Method: ${req.method}`);
  console.log(`  URL: ${req.url}`);
  console.log(`  IP: ${req.ip}`);
  console.log(`  User-Agent: ${req.headers['user-agent']}`);

  // Log body for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    console.log('  Body:', JSON.stringify(req.body, null, 2));
  }

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`✅ Response: ${res.statusCode} - ${duration}ms\n`);
  });

  next();
};

module.exports = { requestLogger, detailedRequestLogger };