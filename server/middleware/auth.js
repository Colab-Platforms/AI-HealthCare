const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set!');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded, user ID:', decoded.id);

    // Check if DB is connected (should already be connected by middleware in api/index.js)
    if (mongoose.connection.readyState !== 1) {
      console.error('Database not connected in auth middleware, readyState:', mongoose.connection.readyState);
      // Try to wait briefly for connection
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ message: 'Database not available. Please try again.' });
      }
    }

    // Retry user lookup with timeout (30s to handle Vercel cold starts)
    let retries = 3;
    let user = null;

    while (retries > 0 && !user) {
      try {
        user = await User.findById(decoded.id).select('-password').maxTimeMS(30000);
        if (user) break;
      } catch (dbError) {
        console.error(`User lookup attempt ${4 - retries} failed:`, dbError.message);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
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
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
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
