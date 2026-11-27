const jwt = require('jsonwebtoken');
const User = require('../models/User');
const userCache = require('../utils/userCache');
const { loadProfile, userView } = require('../modules/health-profile/services/profileReadService');

/**
 * Load the request's user, hitting Mongo at most once per user per cache TTL.
 *
 * This runs on every authenticated request, and the frontend fans out ~12
 * parallel calls per dashboard load — so this used to be ~12 findById round
 * trips plus 12 full Mongoose hydrations of a large schema per page view.
 * `.lean()` skips hydration; the cache skips the round trip. Entries are
 * invalidated by hooks in models/User.js whenever a User is written.
 */
async function loadUser(userId) {
  const cached = userCache.get(userId);
  if (cached) return cached;

  // Health facts in req.user.profile come from HealthProfile (the only source,
  // 26 Nov), in the same shape as before. Both reads run in PARALLEL (the id is
  // known from the token), so this costs one round trip, not two; the User hook
  // is skipped for this query because the overlay is done here.
  const [stored, healthProfile] = await Promise.all([
    User.findById(userId).select('-password').setOptions({ skipProfileOverlay: true }).lean().maxTimeMS(15000),
    loadProfile(userId),
  ]);
  const user = stored ? userView(stored, healthProfile) : stored; // profile + foodPreferences health keys
  // Cached together; a HealthProfile write clears this cache (profileWriteService afterCommit).
  if (user) userCache.set(userId, user);
  return user;
}

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

    const user = await loadUser(decoded.id);

    if (!user) {
      console.error('User not found in database:', decoded.id);
      return res.status(401).json({ message: 'User not found' });
    }

    // Read-only: shared by reference with other in-flight requests (see utils/userCache).
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 'TOKEN_EXPIRED', message: 'Token expired' });
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

exports.admin = (req, res, next) => {
  console.log('Checking admin access for user:', req.user?.email, 'role:', req.user?.role);
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};
