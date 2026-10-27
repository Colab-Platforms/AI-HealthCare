const mongoose = require('mongoose');

const fcmTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  platform: {
    type: String,
    enum: ['web', 'android', 'ios'],
    default: 'web'
  },
  deviceLabel: {
    type: String,
    default: 'Unknown Device'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Compound index — fast lookup for "all active tokens for a user"
fcmTokenSchema.index({ userId: 1, isActive: 1 });

// Stale tokens (lastUsedAt untouched for 60 days) are DELETED, not marked
// inactive. lastUsedAt moves on register/login and on every successful send, so
// this only removes devices that neither opened the app nor received a push.
fcmTokenSchema.index({ lastUsedAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

module.exports = mongoose.model('FCMToken', fcmTokenSchema);
