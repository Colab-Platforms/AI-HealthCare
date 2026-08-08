const cron = require('node-cron');
const User = require('../models/User');
const { calculateLongTermScore } = require('./longTermHealthScoreService');

const BATCH_SIZE = 25; // avoid opening hundreds of concurrent Mongo queries at once

class HealthScoreCronService {
  constructor() {
    this.startWeeklyRecompute();
  }

  startWeeklyRecompute() {
    // Sunday 3 AM — off-peak. Instant recompute on report upload (see
    // healthController.js) covers the "just changed something important" case;
    // this is the routine refresh for Today/Consistency/Trend drift.
    cron.schedule('0 3 * * 0', () => this.recomputeAllUsers());
    console.log('Health Score weekly recompute scheduler started');
  }

  async recomputeAllUsers() {
    console.log('[HealthScore] Starting weekly recompute for all users...');
    const userIds = await User.find({ isActive: true }).select('_id').lean();
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map((u) => calculateLongTermScore(u._id)));
      results.forEach((r) => (r.status === 'fulfilled' ? succeeded++ : failed++));
    }

    console.log(`[HealthScore] Weekly recompute done — ${succeeded} succeeded, ${failed} failed.`);
  }
}

module.exports = new HealthScoreCronService();
