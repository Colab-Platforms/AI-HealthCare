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

const app = require('../server/server');

module.exports = (req, res) => {
  // Normalize the URL for Express
  let url = req.url || '/';

  // Log original incoming path for debugging
  console.log(`[Vercel Handler] Method: ${req.method} | Original Path: ${url}`);

  // Ensure leading slash
  if (!url.startsWith('/')) {
    url = '/' + url;
  }

  // Force /api prefix if missing or if Vercel rewritten to /api/index
  if (!url.startsWith('/api/')) {
    if (url.startsWith('/admin')) {
      url = '/api' + url;
      console.log(`[Vercel Handler] Admin route detected, forcing /api prefix: ${url}`);
    } else if (url === '/' || url === '/index' || url === '/api/index') {
       // Catch root case
       url = '/api';
    } else if (url !== '/api') {
      url = '/api' + url;
    }
  } else if (url === '/api/index') {
      // Specifically fix the case where rewriter sends to /api/index
      url = '/api';
  }

  // Update request object for Express routing
  req.url = url;
  req.originalUrl = url;

  console.log(`[Vercel Handler] Proxied Path: ${url}`);

  return app(req, res);
};
