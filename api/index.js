// Vercel serverless function - just export the server app
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

module.exports = require('../server/server');
