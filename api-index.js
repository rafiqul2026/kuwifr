// api/index.js — Vercel serverless entry point for the KUWIFR backend.
//
// Vercel's Node.js runtime (@vercel/node) hands incoming requests straight
// to whatever this file exports, as long as it implements the same
// (req, res) => void shape Node's own http server uses — an Express app
// already does exactly that. So this file does NOT redefine any routes or
// wrap the app in an extra adapter library; it simply re-exports the same,
// already-fully-configured Express app that server.js uses on Render. Every
// route, every piece of middleware (CORS, auth, rate limiting, the MongoDB
// connection gate in app.js) behaves identically on both hosts — this file
// only swaps out *how* the app receives requests (server.js's app.listen()
// vs. Vercel calling this export directly per-invocation).
//
// vercel.json routes every request under /api/* here (see its "rewrites"
// section) with the ORIGINAL path preserved, so Express's own internal
// router (app.use('/api/admin', ...), app.use('/api/wallet', ...), etc. in
// server/src/app.js) does the real routing exactly as it already does today
// on Render — nothing about that logic needed to change for this file to
// work.
module.exports = require('../server/src/app');