const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const fs = require('fs');
const path = require('path');

dotenv.config();

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (error) {
  console.error('Error creating uploads directory:', error);
}

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Health check - must be before other routes
app.get('/api/health-check', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Healthcare AI Platform API',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Routes - wrapped in try-catch for Vercel
try {
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/health', require('./routes/healthRoutes'));
  app.use('/api/doctors', require('./routes/doctorRoutes'));
  app.use('/api/admin', require('./routes/adminRoutes'));
  app.use('/api/wearables', require('./routes/wearableRoutes'));
  app.use('/api', require('./routes/chatRoutes')); // AI chat route
  app.use('/api/chat', require('./routes/chatHistoryRoutes')); // Chat history routes
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

// Connect to database
let dbConnected = false;
let dbConnectionPromise = null;

const initDB = async () => {
  if (dbConnected) return true;
  
  if (dbConnectionPromise) {
    await dbConnectionPromise;
    return dbConnected;
  }
  
  try {
    dbConnectionPromise = connectDB();
    await dbConnectionPromise;
    dbConnected = true;
    console.log('Database connected successfully');
    
    // Initialize reminder service after database connection
    try {
      require('./services/reminderService');
    } catch (error) {
      console.error('Error loading reminder service:', error);
    }
    
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    dbConnectionPromise = null;
    return false;
  }
};

// For Vercel serverless
if (process.env.VERCEL) {
  console.log('Running in Vercel environment');
  // Initialize DB connection immediately
  initDB().catch(err => console.error('DB init error:', err));
  module.exports = app;
} else {
  // For local development
  const PORT = process.env.PORT || 5000;
  
  connectDB().then(() => {
    // Initialize reminder service after database connection
    require('./services/reminderService');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Local: http://localhost:${PORT}`);
      console.log(`Network: http://<your-local-ip>:${PORT}`);
    });
  }).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
