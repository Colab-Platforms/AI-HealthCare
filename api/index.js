// Vercel serverless function handler
// 
// CRITICAL: We MUST use the server's Express app directly (not rebuild it here)
// because the server, models, and controllers all share the SAME mongoose 
// instance from server/node_modules/mongoose. If we import mongoose separately
// in this file, it creates a DIFFERENT instance with no connection, causing
// "buffering timed out" errors on all model queries.

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables BEFORE requiring the server
const envPath = path.join(__dirname, '../server/.env');
dotenv.config({ path: envPath });

// Set Vercel environment BEFORE requiring server.js
process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Import the Express app from server.js
// server.js checks process.env.VERCEL and does module.exports = app
const app = require('../server/server');

// Robust URL prefixing for Vercel
module.exports = (req, res) => {
  let url = req.url || '/';

  // Vercel sometimes passes paths without leading /, or sometimes captures 
  // without the /api prefix. Express expects /api/path...

  // Ensure leading slash
  if (!url.startsWith('/')) {
    url = '/' + url;
  }

  // Check if we need to prefix with /api
  if (!url.startsWith('/api/') && url !== '/api') {
    url = '/api' + url;
    console.log(`[Vercel] Prefixed URL: ${req.url} -> ${url}`);
  }

  req.url = url;
  req.originalUrl = url;

  return app(req, res);
};
