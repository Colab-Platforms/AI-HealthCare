const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const fs = require('fs');
const path = require('path');

dotenv.config();

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/health', require('./routes/healthRoutes'));
app.use('/api/doctors', require('./routes/doctorRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/wearables', require('./routes/wearableRoutes'));

// Health check
app.get('/api/health-check', (req, res) => {
  res.json({ status: 'ok', message: 'Healthcare AI Platform API' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Something went wrong!' });
});

// Connect to database
let dbConnected = false;
const initDB = async () => {
  if (!dbConnected) {
    await connectDB();
    dbConnected = true;
    // Initialize reminder service after database connection
    require('./services/reminderService');
  }
};

// For Vercel serverless
if (process.env.VERCEL) {
  initDB().catch(console.error);
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
  });
}
