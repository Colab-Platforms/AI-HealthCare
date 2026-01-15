// Vercel serverless function entry point
process.env.VERCEL = '1';
const app = require('../server/server');

module.exports = app;
