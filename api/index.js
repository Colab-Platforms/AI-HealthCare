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

// Export the handler for Vercel
module.exports = (req, res) => {
  // CRITICAL: Vercel serverless functions often strip the /api prefix.
  // Express app expects paths like '/api/nutrition/...'.
  // We must ensure the URL has the correct prefix before passing it to Express.
  const originalUrl = req.url || '/';
  if (!originalUrl.startsWith('/api/') && originalUrl !== '/api') {
    const prefixedUrl = '/api' + (originalUrl.startsWith('/') ? originalUrl : '/' + originalUrl);
    console.log(`[Vercel Handler] Prefixed URL: ${originalUrl} -> ${prefixedUrl}`);
    req.url = prefixedUrl;
  }

  return app(req, res);
};
