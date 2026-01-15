// Vercel serverless function entry point
process.env.VERCEL = '1';

let app;

try {
  // Try to load Express
  const express = require('express');
  const appInstance = express();
  
  appInstance.use(express.json());
  
  // Simple health check that always works
  appInstance.get('/api/health-check', (req, res) => {
    res.json({ 
      status: 'ok', 
      message: 'Healthcare AI Platform API',
      timestamp: new Date().toISOString()
    });
  });
  
  // Try to load the full server app
  try {
    const fullApp = require('../server/server');
    app = fullApp;
    console.log('Full app loaded successfully');
  } catch (serverError) {
    console.error('Error loading full server:', serverError.message);
    // Use simple app if full app fails
    app = appInstance;
  }
} catch (expressError) {
  console.error('Critical error - Express not available:', expressError.message);
  
  // Fallback: Export a simple function
  module.exports = (req, res) => {
    res.status(500).json({
      error: 'Server initialization failed',
      message: expressError.message
    });
  };
}

if (app) {
  module.exports = app;
}
