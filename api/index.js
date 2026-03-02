// Vercel serverless function handler
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../server/.env') });

// Set Vercel environment
process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Connection state
let isConnected = false;

const connectToDatabase = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('Using existing database connection');
    return;
  }

  try {
    const options = {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(process.env.MONGODB_URI, options);
    isConnected = true;
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection error:', error);
    isConnected = false;
    throw error;
  }
};

// Import the Express app (not the handler)
const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/api/health-check', (req, res) => {
  res.json({
    status: 'ok',
    message: 'FitCure API',
    timestamp: new Date().toISOString(),
    dbConnected: mongoose.connection.readyState === 1,
    environment: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL,
    routes: {
      auth: !!authRoutes,
      health: !!healthRoutes,
      metrics: !!metricRoutes,
      doctors: !!doctorRoutes,
      admin: !!adminRoutes,
      wearables: !!wearableRoutes,
      nutrition: !!nutritionRoutes,
      dietRecommendations: !!dietRecommendationRoutes,
      users: !!userRoutes,
      notifications: !!notificationRoutes,
      chat: !!chatRoutes,
      chatHistory: !!chatHistoryRoutes
    }
  });
});

// Test route to verify nutrition routes are loaded
app.get('/api/test-nutrition', (req, res) => {
  res.json({
    message: 'Nutrition routes test',
    nutritionRoutesLoaded: !!nutritionRoutes,
    timestamp: new Date().toISOString()
  });
});

// Load routes with better error handling
const loadRoute = (path, name) => {
  try {
    const route = require(path);
    console.log(`✓ Loaded ${name} route`);
    return route;
  } catch (error) {
    console.error(`✗ Error loading ${name} route:`, error.message);
    return null;
  }
};

console.log('Loading routes...');
const authRoutes = loadRoute('../server/routes/authRoutes', 'auth');
const healthRoutes = loadRoute('../server/routes/healthRoutes', 'health');
const metricRoutes = loadRoute('../server/routes/metricRoutes', 'metrics');
const doctorRoutes = loadRoute('../server/routes/doctorRoutes', 'doctors');
const adminRoutes = loadRoute('../server/routes/adminRoutes', 'admin');
const wearableRoutes = loadRoute('../server/routes/wearableRoutes', 'wearables');
const nutritionRoutes = loadRoute('../server/routes/nutritionRoutes', 'nutrition');
const dietRecommendationRoutes = loadRoute('../server/routes/dietRecommendationRoutes', 'diet-recommendations');
const userRoutes = loadRoute('../server/routes/userRoutes', 'users');
const notificationRoutes = loadRoute('../server/routes/notificationRoutes', 'notifications');
const chatRoutes = loadRoute('../server/routes/chatRoutes', 'chat');
const chatHistoryRoutes = loadRoute('../server/routes/chatHistoryRoutes', 'chat-history');
console.log('Routes loaded.');

if (authRoutes) app.use('/api/auth', authRoutes);
if (healthRoutes) app.use('/api/health', healthRoutes);
if (metricRoutes) app.use('/api/metrics', metricRoutes);
if (doctorRoutes) app.use('/api/doctors', doctorRoutes);
if (adminRoutes) app.use('/api/admin', adminRoutes);
if (wearableRoutes) app.use('/api/wearables', wearableRoutes);
if (nutritionRoutes) app.use('/api/nutrition', nutritionRoutes);
if (dietRecommendationRoutes) app.use('/api/diet-recommendations', dietRecommendationRoutes);
if (userRoutes) app.use('/api/users', userRoutes);
if (notificationRoutes) app.use('/api/notifications', notificationRoutes);
if (chatRoutes) app.use('/api', chatRoutes);
if (chatHistoryRoutes) app.use('/api/chat', chatHistoryRoutes);

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  console.log('404 - Route not found:', req.method, req.originalUrl);
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.originalUrl,
    availableRoutes: Object.keys(app._router.stack
      .filter(r => r.route)
      .reduce((acc, r) => {
        acc[r.route.path] = Object.keys(r.route.methods);
        return acc;
      }, {}))
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    message: err.message || 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Serverless handler with DB connection
const handler = async (req, res) => {
  try {
    await connectToDatabase();
  } catch (error) {
    console.error('Failed to connect to database:', error);
    // Continue anyway - some endpoints might not need DB
  }
  return app(req, res);
};

module.exports = handler;
module.exports.default = handler;
