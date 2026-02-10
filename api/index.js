// Vercel serverless function handler
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../server/.env') });

// Set Vercel environment
process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Import and export the server app
const app = require('../server/server');

// Export as Vercel serverless function
module.exports = app;

// Also export as default for Vercel
module.exports.default = app;
