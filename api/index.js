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
    dbConnected: mongoose.connection.readyState === 1
  });
});

// Load routes
try {
  app.use('/api/auth', require('../server/routes/authRoutes'));
  app.use('/api/health', require('../server/routes/healthRoutes'));
  app.use('/api/metrics', require('../server/routes/metricRoutes'));
  app.use('/api/doctors', require('../server/routes/doctorRoutes'));
  app.use('/api/admin', require('../server/routes/adminRoutes'));
  app.use('/api/wearables', require('../server/routes/wearableRoutes'));
  app.use('/api/nutrition', require('../server/routes/nutritionRoutes'));
  app.use('/api/diet-recommendations', require('../server/routes/dietRecommendationRoutes'));
  app.use('/api/users', require('../server/routes/userRoutes'));
  app.use('/api/notifications', require('../server/routes/notificationRoutes'));
  app.use('/api', require('../server/routes/chatRoutes'));
  app.use('/api/chat', require('../server/routes/chatHistoryRoutes'));
} catch (error) {
  console.error('Error loading routes:', error);
}

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
