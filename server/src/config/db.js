// server/src/config/db.js
const mongoose = require('mongoose');

/**
 * Connect to MongoDB Database — serverless-safe cached connection.
 *
 * Render (and any traditional long-running host) keeps ONE Node process
 * alive for the app's whole lifetime, so calling mongoose.connect() once at
 * boot was fine there. Vercel (and any serverless platform) runs this same
 * module inside short-lived function instances that can be spun up
 * concurrently — without caching, every cold start (and under concurrent
 * traffic, that can mean many at once) would call mongoose.connect() again,
 * rapidly exhausting MongoDB Atlas's connection limit and eventually
 * causing every request to fail with a connection-pool error.
 *
 * The fix: cache the connection (and the in-flight connection promise) on
 * `global`, which — on platforms that reuse a "warm" function instance
 * between invocations (Vercel does this) — persists across requests within
 * that instance, so a warm invocation reuses the existing connection
 * instantly instead of reconnecting. This is a strict superset of the old
 * behavior: on Render it still connects exactly once and reuses the same
 * connection for the process's whole lifetime, same as before.
 */
let cached = global._kuwifrMongooseConn;
if (!cached) {
  cached = global._kuwifrMongooseConn = { conn: null, promise: null };
}

const connectDB = async () => {
  // Already connected on this instance — reuse it, no network round-trip.
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    // Check both standard variable names and sanitize whitespace/quotes
    const rawUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    const uri = rawUri ? rawUri.trim().replace(/^['"]|['"]$/g, '') : null;

    if (!uri) {
      throw new Error(
        'Neither MONGODB_URI nor MONGO_URI is defined. Check environment variables in your hosting dashboard/local .env.'
      );
    }

    cached.promise = mongoose
      .connect(uri, {
        // Conservative pool size — on a serverless platform EACH concurrent
        // function instance gets its own pool, so N instances x maxPoolSize
        // must stay under Atlas's total connection limit. 10 is a safe
        // default for a typical Atlas free/shared tier; raise only if
        // you've also raised the Atlas connection limit accordingly.
        maxPoolSize: 10,
        // Fail fast instead of silently queuing queries indefinitely if the
        // connection isn't ready — the app.js middleware below always
        // awaits connectDB() before handling a request, so queries should
        // never actually hit this path, but it's a safety net rather than
        // a silent hang.
        bufferCommands: false,
        serverSelectionTimeoutMS: 10000
      })
      .then((conn) => {
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}`);
        return conn;
      })
      .catch((error) => {
        // Let the next call retry from scratch instead of caching a
        // rejected promise forever.
        cached.promise = null;
        console.error(`❌ MongoDB Connection Error: ${error.message}`);

        if (error.message.includes('ECONNREFUSED')) {
          console.error('💡 MongoDB server is unreachable. Check cluster host status.');
        }
        if (error.message.includes('bad auth') || error.message.includes('Authentication failed')) {
          console.error('💡 Authentication failed: verify Atlas username, password, and URL encoding.');
        }
        if (error.message.includes('Invalid scheme')) {
          console.error('💡 Connection string format error: verify it starts with "mongodb+srv://" without quotes.');
        }

        throw error;
      });

    // Connection lifecycle listeners — attach once, not per connect() call.
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

module.exports = connectDB;