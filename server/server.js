const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const fs = require('fs');
const path = require('path');

dotenv.config();

const uploadsDir = path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (error) {
  console.error('Error creating uploads directory:', error);
}

const app = express();
// Ensure database connection for every request (crucial for serverless)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health-check', (req, res) => {
  res.json({
    status: 'ok',
    message: 'FitCure API',
    timestamp: new Date().toISOString()
  });
});

try {
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/health', require('./routes/healthRoutes'));
  app.use('/api/metrics', require('./routes/metricRoutes'));
  app.use('/api/doctors', require('./routes/doctorRoutes'));
  app.use('/api/admin', require('./routes/adminRoutes'));
  app.use('/api/wearables', require('./routes/wearableRoutes'));
  app.use('/api/nutrition', require('./routes/nutritionRoutes'));
  app.use('/api/diet-recommendations', require('./routes/dietRecommendationRoutes'));
  app.use('/api/users', require('./routes/userRoutes'));
  app.use('/api/notifications', require('./routes/notificationRoutes'));
  app.use('/api', require('./routes/chatRoutes'));
  app.use('/api/chat', require('./routes/chatHistoryRoutes'));
} catch (error) {
  console.error('Error loading routes:', error);
}

app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    message: err.message || 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Initialize database connection
// In serverless (Vercel), this ensures connection is ready before handlers run
connectDB().catch(err => {
  console.error('Initial DB connection failed:', err);
});

// Initialize services (only if not on Vercel or if needed)
if (!process.env.VERCEL) {
  require('./services/reminderService');
  try { require('./services/notificationService'); } catch (e) { console.error('Notification service error:', e); }
}

// Export app for local development or Vercel
if (process.env.VERCEL) {
  module.exports = app;
} else {
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}
