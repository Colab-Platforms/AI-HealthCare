// Vercel serverless function entry point
process.env.VERCEL = '1';

// Simple health check that doesn't require database
const express = require('express');
const app = express();

app.use(express.json());

// Health check endpoint that works without database
app.get('/api/health-check', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Healthcare AI Platform API',
    timestamp: new Date().toISOString()
  });
});

// Load the full app for other routes
let fullApp;
try {
  fullApp = require('../server/server');
} catch (error) {
  console.error('Error loading server:', error);
}

// Use full app if available, otherwise use simple app
module.exports = fullApp || app;
