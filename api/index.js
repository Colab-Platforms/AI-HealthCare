// Vercel serverless function wrapper
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

// Import the Express app
const app = require('../server/server');

// Export as Vercel serverless function
module.exports = app;
