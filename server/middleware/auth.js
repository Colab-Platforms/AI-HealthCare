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

    // Single lookup - no retry loop needed (wastes serverless execution time)
    const user = await User.findById(decoded.id).select('-password').maxTimeMS(15000);

    if (!user) {
      console.error('User not found in database:', decoded.id);
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    
    // Explicitly return 401 ONLY for authentication failures
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Invalid or expired token',
        errorType: error.name 
      });
    }

    // For other errors (database timeouts, etc.), return 500 so the frontend doesn't log the user out
    res.status(500).json({ 
      message: 'Internal authentication error. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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
