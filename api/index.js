// Vercel serverless function entry point
process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Debug middleware - log all incoming requests
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url} (originalUrl: ${req.originalUrl}, path: ${req.path})`);
  next();
});

// Initialize database connection
let dbInitialized = false;
const initDB = async () => {
  if (dbInitialized) return;
  
  try {
    const connectDB = require('../server/config/db');
    await connectDB();
    dbInitialized = true;
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
  }
};

// Initialize DB on first request (before routes)
app.use((req, res, next) => {
  if (!dbInitialized) {
    initDB().then(() => next()).catch(() => next());
  } else {
    next();
  }
});

// Health check
app.get('/api/health-check', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Healthcare AI Platform API - Vercel',
    env: process.env.NODE_ENV,
    dbConnected: dbInitialized,
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to verify routing works (no auth required)
app.get('/api/test-route', (req, res) => {
  res.json({
    message: 'Routing works!',
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl
  });
});

// Test nutrition endpoint (no auth required)
app.get('/api/nutrition/test', (req, res) => {
  res.json({
    message: 'Nutrition routing works!',
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl
  });
});

// Load routes with error handling
try {
  console.log('📦 Loading routes...');
  
  const authRoutes = require('../server/routes/authRoutes');
  console.log('  ✓ authRoutes loaded');
  
  const healthRoutes = require('../server/routes/healthRoutes');
  console.log('  ✓ healthRoutes loaded');
  
  const doctorRoutes = require('../server/routes/doctorRoutes');
  console.log('  ✓ doctorRoutes loaded');
  
  const adminRoutes = require('../server/routes/adminRoutes');
  console.log('  ✓ adminRoutes loaded');
  
  const wearableRoutes = require('../server/routes/wearableRoutes');
  console.log('  ✓ wearableRoutes loaded');
  
  const nutritionRoutes = require('../server/routes/nutritionRoutes');
  console.log('  ✓ nutritionRoutes loaded');
  
  const dietRecommendationRoutes = require('../server/routes/dietRecommendationRoutes');
  console.log('  ✓ dietRecommendationRoutes loaded');
  
  const chatRoutes = require('../server/routes/chatRoutes');
  console.log('  ✓ chatRoutes loaded');
  
  const chatHistoryRoutes = require('../server/routes/chatHistoryRoutes');
  console.log('  ✓ chatHistoryRoutes loaded');

  app.use('/api/auth', authRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/doctors', doctorRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/wearables', wearableRoutes);
  app.use('/api/nutrition', nutritionRoutes);
  app.use('/api/diet-recommendations', dietRecommendationRoutes);
  app.use('/api', chatRoutes);
  app.use('/api/chat', chatHistoryRoutes);
  
  console.log('✅ All routes mounted successfully');
  
  // Log all registered routes for debugging
  console.log('📋 Registered routes:');
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      console.log(`  ${Object.keys(middleware.route.methods)} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const path = middleware.regexp.source.replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/');
          console.log(`  ${Object.keys(handler.route.methods)} ${path}${handler.route.path}`);
        }
      });
    }
  });
} catch (error) {
  console.error('❌ Error loading routes:', error.message);
  console.error(error.stack);
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ 
    message: err.message || 'Something went wrong!',
    path: req.path
  });
});

// 404 handler
app.use((req, res) => {
  console.log('404 - Route not found:', req.method, req.path);
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.path,
    message: 'The requested endpoint does not exist'
  });
});

// Export for Vercel
module.exports = app;
