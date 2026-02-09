// Vercel serverless function entry point
// Set VERCEL flag BEFORE requiring anything
process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

let app;

try {
  // Load the full server app
  app = require('../server/server');
  console.log('✅ Server app loaded successfully for Vercel');
} catch (serverError) {
  console.error('❌ Error loading server:', serverError.message);
  console.error('Stack:', serverError.stack);
  
  // Fallback: Create minimal Express app
  const express = require('express');
  app = express();
  
  app.use(express.json());
  
  // Health check endpoint
  app.get('/api/health-check', (req, res) => {
    res.json({ 
      status: 'error',
      message: 'Server failed to load',
      error: serverError.message,
      timestamp: new Date().toISOString()
    });
  });
  
  // Catch-all error response
  app.use((req, res) => {
    res.status(500).json({
      error: 'Server initialization failed',
      message: serverError.message,
      path: req.path
    });
  });
}

// Export the app for Vercel
module.exports = app;
