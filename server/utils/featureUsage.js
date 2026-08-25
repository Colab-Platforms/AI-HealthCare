// Usage counters for plan-based feature gating (middleware/subscriptionAccess.js).
// Each function counts how much of a quota the user has already consumed in the
// current period, using data that's already being written by normal app flow —
// no separate tracking table needed.

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfThisMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

// AI chat messages are streamed and not persisted as documents — but every
// completed exchange logs a UsageLog row (feature: 'ai_chat'), so that's the
// count of record for the daily limit.
const countAiChatToday = async (req) => {
  const UsageLog = require('../models/UsageLog');
  return UsageLog.countDocuments({
    userId: req.user._id,
    feature: 'ai_chat',
    createdAt: { $gte: startOfToday() },
  });
};

// Failed analyses don't consume the user's monthly quota — the upload didn't
// deliver anything, so it shouldn't cost them a slot.
const countReportsThisMonth = async (req) => {
  const HealthReport = require('../models/HealthReport');
  return HealthReport.countDocuments({
    user: req.user._id,
    status: { $ne: 'failed' },
    createdAt: { $gte: startOfThisMonth() },
  });
};

const countDietPlansThisMonth = async (req) => {
  const PersonalizedDietPlan = require('../models/PersonalizedDietPlan');
  return PersonalizedDietPlan.countDocuments({
    userId: req.user._id,
    createdAt: { $gte: startOfThisMonth() },
  });
};

module.exports = { countAiChatToday, countReportsThisMonth, countDietPlansThisMonth };
