const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Cache database connection
let isConnecting = false;
let connectionPromise = null;

const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) {
    return true; // Already connected
  }
  
  if (isConnecting && connectionPromise) {
    await connectionPromise; // Wait for existing connection attempt
    return mongoose.connection.readyState === 1;
  }
  
  try {
    isConnecting = true;
    connectionPromise = connectDB();
    await connectionPromise;
    isConnecting = false;
    return true;
  } catch (error) {
    isConnecting = false;
    connectionPromise = null;
    console.error('Failed to connect to database:', error.message);
    return false;
  }
};

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded, user ID:', decoded.id);
    
    // Ensure database connection with retry
    const connected = await ensureDBConnection();
    if (!connected) {
      console.error('Database connection failed');
      return res.status(500).json({ message: 'Database connection error' });
    }
    
    // Retry user lookup with timeout
    let retries = 3;
    let user = null;
    
    while (retries > 0 && !user) {
      try {
        user = await User.findById(decoded.id).select('-password').maxTimeMS(5000);
        if (user) break;
      } catch (dbError) {
        console.error(`User lookup attempt ${4 - retries} failed:`, dbError.message);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
        }
      }
    }
    
    if (!user) {
      console.error('User not found in database after retries:', decoded.id);
      return res.status(401).json({ message: 'User not found' });
    }
    
    req.user = user;
    console.log('User authenticated:', req.user._id, req.user.name);
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized for this action' });
    }
    next();
  };
};
