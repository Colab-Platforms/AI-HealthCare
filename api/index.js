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
  // Prioritize x-original-url or x-matched-path (Vercel specific)
  let url = req.url || '/';
  
  // Vercel rewrites often put the original path in req.url, 
  // but if it's already /api/index, we might need to check x-original-url
  const originalPath = req.headers['x-matched-path'] || req.headers['x-now-route-source'] || url;
  
  // Log original incoming path for debugging
  console.log(`[Vercel Handler] Method: ${req.method} | req.url: ${url} | x-matched: ${req.headers['x-matched-path']}`);

  // Determine the true path we want to route in Express
  let targetUrl = url;
  
  // If req.url is just the function file name, use the matched path instead
  if (targetUrl.includes('api/index.js') || targetUrl.includes('api/index')) {
    targetUrl = originalPath;
  }

  // Ensure targetUrl is cleaned up (remove /api/index if present in final path)
  targetUrl = targetUrl.replace('/api/index.js', '/api').replace('/api/index', '/api');

  // Fix: If it's still missing /api/ prefix, add it
  if (!targetUrl.startsWith('/api/')) {
    if (targetUrl.startsWith('/admin')) {
        targetUrl = '/api' + targetUrl;
    } else if (targetUrl === '/' || targetUrl === '') {
        targetUrl = '/api';
    } else if (targetUrl !== '/api') {
        targetUrl = '/api' + targetUrl;
    }
  }

  // Update request object for Express routing
  req.url = targetUrl;
  req.originalUrl = targetUrl;

  console.log(`[Vercel Handler] FINAL Proxied Path: ${req.url}`);

  return app(req, res);
};
