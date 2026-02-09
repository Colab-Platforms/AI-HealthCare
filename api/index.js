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

// Load routes with error handling
let routesLoadError = null;
let routesLoaded = false;

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
  
  console.log('  Loading nutritionRoutes...');
  const nutritionRoutes = require('../server/routes/nutritionRoutes');
  console.log('  ✓ nutritionRoutes loaded, type:', typeof nutritionRoutes);
  
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
  
  console.log('  Mounting nutritionRoutes at /api/nutrition...');
  app.use('/api/nutrition', nutritionRoutes);
  console.log('  ✓ nutritionRoutes mounted');
  
  app.use('/api/diet-recommendations', dietRecommendationRoutes);
  app.use('/api', chatRoutes);
  app.use('/api/chat', chatHistoryRoutes);
  
  routesLoaded = true;
  console.log('✅ All routes mounted successfully');
  console.log('📍 Nutrition routes should be available at /api/nutrition/*');
} catch (error) {
  routesLoadError = error;
  console.error('❌ Error loading routes:', error.message);
  console.error(error.stack);
}

// Debug endpoint to check route loading status
app.get('/api/debug/routes', (req, res) => {
  res.json({
    routesLoaded,
    error: routesLoadError ? {
      message: routesLoadError.message,
      stack: routesLoadError.stack
    } : null,
    dbConnected: dbInitialized
  });
});

// Test endpoints AFTER routes are mounted
app.get('/api/test-route', (req, res) => {
  res.json({
    message: 'Routing works!',
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl
  });
});

// Test nutrition endpoint (no auth required)
app.get('/api/nutrition-test', (req, res) => {
  res.json({
    message: 'Nutrition routing works!',
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl
  });
});

// Test auth endpoint (requires authentication)
app.get('/api/nutrition-test-auth', async (req, res) => {
  try {
    // Manually check auth
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        error: 'No token provided',
        authHeader: req.headers.authorization,
        allHeaders: req.headers
      });
    }
    
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({
        error: 'JWT verification failed',
        message: jwtError.message,
        hasSecret: !!process.env.JWT_SECRET
      });
    }
    
    res.json({
      message: 'Auth works!',
      userId: decoded.id,
      path: req.path,
      dbConnected: dbInitialized
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
});

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
