// Vercel serverless function - simply export the server app
process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Export the server app directly
module.exports = require('../server/server');
