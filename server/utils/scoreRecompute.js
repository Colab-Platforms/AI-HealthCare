// Fire-and-forget triggers for the Health Score engine — called from log-write
// endpoints (meals, water, steps, sleep, smoke, alcohol) so the Daily Score
// stays current without ever slowing down the request that logged the data.

const triggerDailyScoreRecompute = (userId, dateStr) => {
  const { calculateDailyScore } = require('../services/dailyHealthScoreService');
  const date = dateStr || new Date().toISOString().split('T')[0];
  calculateDailyScore(userId, date).catch((e) =>
    console.error(`[HealthScore] Daily recompute failed for user ${userId}:`, e.message),
  );
};

// Long-Term score is heavier (reads the latest report + 30/90-day rolling
// windows) — only trigger it on report upload/analysis, not on every log write.
// The weekly cron (see server/services/notificationScheduler or a dedicated
// cron job) handles the routine recompute for everyone else.
const triggerLongTermScoreRecompute = (userId) => {
  const { calculateLongTermScore } = require('../services/longTermHealthScoreService');
  calculateLongTermScore(userId).catch((e) =>
    console.error(`[HealthScore] Long-term recompute failed for user ${userId}:`, e.message),
  );
};

module.exports = { triggerDailyScoreRecompute, triggerLongTermScoreRecompute };
