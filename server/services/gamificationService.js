const User = require('../models/User');
const GamificationLog = require('../models/GamificationLog');
const HealthReport = require('../models/HealthReport');

const POINT_VALUES = {
  login:          5,
  food_log:       10,
  step_goal:      20,
  nutrition_goal: 20,
  workout:        15,
  water_intake:   5,
  health_checkup: 25,
};

const TIERS = [
  { name: 'Health Novice',    minPoints: 0,    icon: '🌱' },
  { name: 'Wellness Warrior', minPoints: 100,  icon: '⚡' },
  { name: 'Fitness Champion', minPoints: 300,  icon: '🏆' },
  { name: 'Health Master',    minPoints: 600,  icon: '👑' },
  { name: 'Health Legend',    minPoints: 1000, icon: '💎' },
];

// All 15 badges
const BADGES = {
  // Report badges
  FIRST_STEP:        { id: 'first_step',        name: 'First Step',        icon: '🔬', desc: 'Upload your first report' },
  REPORT_PRO:        { id: 'report_pro',         name: 'Report Pro',        icon: '📋', desc: 'Upload 5 reports' },
  HEALTH_HISTORIAN:  { id: 'health_historian',   name: 'Health Historian',  icon: '🗂️', desc: 'Upload 10 reports' },
  CONSISTENT:        { id: 'consistent',          name: 'Consistent',        icon: '📅', desc: 'Upload a report every month for 3 months' },
  // Score badges
  ON_THE_RISE:       { id: 'on_the_rise',        name: 'On The Rise',       icon: '📈', desc: 'Improve health score by 10+ points' },
  SCORE_70:          { id: 'score_70',            name: 'Score 70',          icon: '🎯', desc: 'Reach a health score of 70+' },
  SCORE_80:          { id: 'score_80',            name: 'Score 80',          icon: '🏅', desc: 'Reach a health score of 80+' },
  PERFECT_HEALTH:    { id: 'perfect_health',      name: 'Perfect Health',    icon: '💎', desc: 'Reach a health score of 90+' },
  // Activity badges
  WEEK_STREAK:       { id: 'week_streak',         name: '7-Day Streak',      icon: '🔥', desc: 'Log activity 7 days in a row' },
  MONTH_STREAK:      { id: 'month_streak',        name: '30-Day Streak',     icon: '⚡', desc: 'Log activity 30 days in a row' },
  HYDRATION_HERO:    { id: 'hydration_hero',      name: 'Hydration Hero',    icon: '💧', desc: 'Log water for 7 days' },
  NUTRITION_STAR:    { id: 'nutrition_star',      name: 'Nutrition Star',    icon: '🥗', desc: 'Log meals for 7 days' },
  // Health badges
  METRIC_MASTER:     { id: 'metric_master',       name: 'Metric Master',     icon: '💪', desc: 'A metric improved from abnormal to normal' },
  ALL_CLEAR:         { id: 'all_clear',           name: 'All Clear',         icon: '✅', desc: 'All metrics normal in one report' },
  HEALTH_LEGEND:     { id: 'health_legend',       name: 'Health Legend',     icon: '🌟', desc: 'Reach Health Legend tier' },
};

const notify = (userId, title, message, icon = '🏆') => {
  require('./notificationService').createNotification(userId, {
    type: 'gamification_badge',
    title,
    message,
    icon,
    priority: 'high',
  }).catch(console.error);
};

const pushBadge = (user, badge) => {
  user.gamification.badges.push({
    badgeId:  badge.id,
    name:     badge.name,
    icon:     badge.icon,
    earnedAt: new Date(),
  });
  notify(user._id, '🏅 New Badge Unlocked!', `You earned the ${badge.icon} ${badge.name} badge!`);
};

class GamificationService {
  calculateTier(totalPoints) {
    const tiers = [...TIERS].reverse();
    return tiers.find(t => totalPoints >= t.minPoints) || TIERS[0];
  }

  // Current streak — consecutive days with any gamification log
  async getCurrentStreak(userId) {
    const logs = await GamificationLog.find({ user: userId })
      .sort({ createdAt: -1 })
      .select('createdAt')
      .lean();

    if (!logs.length) return 0;

    const days = [...new Set(logs.map(l => new Date(l.createdAt).toISOString().split('T')[0]))];
    let streak = 0;
    let check  = new Date();
    check.setHours(0, 0, 0, 0);

    for (const day of days) {
      const d = new Date(day);
      const diff = Math.round((check - d) / (1000 * 60 * 60 * 24));
      if (diff === 0 || diff === 1) { streak++; check = d; }
      else break;
    }
    return streak;
  }

  async awardPoints(userId, actionType, description, subType = '') {
    try {
      const points = POINT_VALUES[actionType] || 0;
      if (points === 0) return null;

      const today = new Date().toISOString().split('T')[0];
      const uniqueActionKey = `${actionType}${subType ? '_' + subType : ''}_${today}_${userId.toString()}`;

      try {
        await GamificationLog.create({ user: userId, actionType, pointsAwarded: points, description, uniqueActionKey });
      } catch (err) {
        if (err.code === 11000) return { status: 'already_awarded', points: 0 };
        throw err;
      }

      const user = await User.findById(userId);
      if (!user) return null;

      if (!user.gamification) user.gamification = { totalPoints: 0, currentTier: 'Health Novice', badges: [] };
      if (!Array.isArray(user.gamification.badges)) user.gamification.badges = [];

      user.gamification.totalPoints = (user.gamification.totalPoints || 0) + points;
      user.gamification.lastPointsAwardedAt = new Date();

      const newTier   = this.calculateTier(user.gamification.totalPoints);
      const prevTier  = user.gamification.currentTier;
      const tierUpgraded = newTier.name !== prevTier;

      if (tierUpgraded) {
        user.gamification.currentTier = newTier.name;
        notify(userId,
          `${newTier.icon} Tier Upgraded!`,
          `You've reached the ${newTier.name} tier!`,
          newTier.icon
        );
      }

      // ✅ FIX: Do NOT overwrite healthScore from gamification points
      await user.save();

      // Async badge check — non-blocking
      this.checkAndAwardBadges(userId).catch(console.error);

      return { status: 'success', pointsAwarded: points, totalPoints: user.gamification.totalPoints, newTier: newTier.name, tierUpgraded };
    } catch (error) {
      console.error('Error awarding gamification points:', error);
      return null;
    }
  }

  async checkAndAwardBadges(userId) {
    const user = await User.findById(userId).select('gamification healthMetrics');
    if (!user) return;
    if (!user.gamification) user.gamification = { totalPoints: 0, currentTier: 'Health Novice', badges: [] };
    if (!Array.isArray(user.gamification.badges)) user.gamification.badges = [];

    let modified = false;
    const has = (id) => user.gamification.badges.some(b => b.badgeId === id);
    const award = (badge) => { pushBadge(user, badge); modified = true; };

    // ── Report badges ──────────────────────────────────────────────────────
    const reportCount = await HealthReport.countDocuments({ user: userId, status: 'completed' });

    if (reportCount >= 1  && !has(BADGES.FIRST_STEP.id))       award(BADGES.FIRST_STEP);
    if (reportCount >= 5  && !has(BADGES.REPORT_PRO.id))        award(BADGES.REPORT_PRO);
    if (reportCount >= 10 && !has(BADGES.HEALTH_HISTORIAN.id))  award(BADGES.HEALTH_HISTORIAN);

    // Consistent — report each month for 3 consecutive months
    if (!has(BADGES.CONSISTENT.id) && reportCount >= 3) {
      const reports = await HealthReport.find({ user: userId, status: 'completed' })
        .sort({ reportDate: -1 }).select('reportDate').lean();
      const months = [...new Set(reports.map(r => {
        const d = new Date(r.reportDate);
        return `${d.getFullYear()}-${d.getMonth()}`;
      }))];
      // Check 3 consecutive months
      let consecutiveMonths = 1;
      for (let i = 1; i < months.length; i++) {
        const [y1, m1] = months[i - 1].split('-').map(Number);
        const [y2, m2] = months[i].split('-').map(Number);
        const diff = (y1 * 12 + m1) - (y2 * 12 + m2);
        if (diff === 1) consecutiveMonths++;
        else consecutiveMonths = 1;
        if (consecutiveMonths >= 3) { award(BADGES.CONSISTENT); break; }
      }
    }

    // ── Score badges ───────────────────────────────────────────────────────
    const latestReport = await HealthReport.findOne({ user: userId, status: 'completed' })
      .sort({ reportDate: -1 }).select('aiAnalysis').lean();
    const latestScore = latestReport?.aiAnalysis?.healthScore || 0;

    if (latestScore >= 70 && !has(BADGES.SCORE_70.id))       award(BADGES.SCORE_70);
    if (latestScore >= 80 && !has(BADGES.SCORE_80.id))       award(BADGES.SCORE_80);
    if (latestScore >= 90 && !has(BADGES.PERFECT_HEALTH.id)) award(BADGES.PERFECT_HEALTH);

    // On The Rise — score improved 10+ points vs previous report
    if (!has(BADGES.ON_THE_RISE.id) && reportCount >= 2) {
      const twoReports = await HealthReport.find({ user: userId, status: 'completed' })
        .sort({ reportDate: -1 }).limit(2).select('aiAnalysis').lean();
      if (twoReports.length === 2) {
        const diff = (twoReports[0].aiAnalysis?.healthScore || 0) - (twoReports[1].aiAnalysis?.healthScore || 0);
        if (diff >= 10) award(BADGES.ON_THE_RISE);
      }
    }

    // All Clear — all metrics normal in latest report
    if (!has(BADGES.ALL_CLEAR.id) && latestReport) {
      const metrics = Object.values(latestReport.aiAnalysis?.metrics || {});
      if (metrics.length > 0 && metrics.every(m => m?.status === 'normal')) {
        award(BADGES.ALL_CLEAR);
      }
    }

    // Metric Master — any metric went from abnormal to normal across last 2 reports
    if (!has(BADGES.METRIC_MASTER.id) && reportCount >= 2) {
      const twoReports = await HealthReport.find({ user: userId, status: 'completed' })
        .sort({ reportDate: -1 }).limit(2).select('aiAnalysis').lean();
      if (twoReports.length === 2) {
        const curr = twoReports[0].aiAnalysis?.metrics || {};
        const prev = twoReports[1].aiAnalysis?.metrics || {};
        const improved = Object.keys(curr).some(k => {
          const c = curr[k]?.status;
          const p = prev[k]?.status;
          return (p === 'high' || p === 'low') && c === 'normal';
        });
        if (improved) award(BADGES.METRIC_MASTER);
      }
    }

    // ── Streak badges ──────────────────────────────────────────────────────
    const streak = await this.getCurrentStreak(userId);
    if (streak >= 7  && !has(BADGES.WEEK_STREAK.id))   award(BADGES.WEEK_STREAK);
    if (streak >= 30 && !has(BADGES.MONTH_STREAK.id))  award(BADGES.MONTH_STREAK);

    // Hydration Hero — water logged 7 unique days
    if (!has(BADGES.HYDRATION_HERO.id)) {
      const waterDays = await GamificationLog.distinct('uniqueActionKey', {
        user: userId, actionType: 'water_intake',
      });
      if (waterDays.length >= 7) award(BADGES.HYDRATION_HERO);
    }

    // Nutrition Star — food logged 7 unique days
    if (!has(BADGES.NUTRITION_STAR.id)) {
      const today = new Date().toISOString().split('T')[0];
      const foodLogs = await GamificationLog.find({ user: userId, actionType: 'food_log' })
        .select('uniqueActionKey').lean();
      const foodDays = new Set(foodLogs.map(l => l.uniqueActionKey?.split('_').slice(-2, -1)[0])).size;
      if (foodDays >= 7) award(BADGES.NUTRITION_STAR);
    }

    // ── Tier badge ─────────────────────────────────────────────────────────
    const totalPoints = user.gamification.totalPoints || 0;
    if (totalPoints >= 1000 && !has(BADGES.HEALTH_LEGEND.id)) award(BADGES.HEALTH_LEGEND);

    if (modified) await user.save();

    // Near-badge nudge — max once per day per user
    const todayKey = `near_badge_nudge_${new Date().toISOString().split('T')[0]}_${userId}`;
    const alreadySentToday = await GamificationLog.exists({ user: userId, uniqueActionKey: todayKey });
    if (!alreadySentToday) {
      await this.sendNearBadgeNudges(userId, todayKey).catch(console.error);
    }
  }

  // Checks progress toward locked badges and nudges if close (max once/day enforced by caller)
  async sendNearBadgeNudges(userId, todayKey) {
    const user = await User.findById(userId).select('gamification name').lean();
    if (!user) return;

    const has = (id) => (user.gamification?.badges || []).some(b => b.badgeId === id);
    const { sendToUser } = require('./fcmService');

    const reportCount = await HealthReport.countDocuments({ user: userId, status: 'completed' });
    const streak      = await this.getCurrentStreak(userId);

    const nudges = [];

    // Report Pro — 5 reports needed, nudge when 1 away (4 done)
    if (!has('report_pro') && reportCount === 4) {
      nudges.push({ title: '📋 Badge Almost Yours!', body: 'Upload 1 more report to unlock the Report Pro badge!' });
    }

    // Health Historian — 10 reports, nudge at 8+
    if (!has('health_historian') && reportCount >= 8 && reportCount < 10) {
      nudges.push({ title: '🗂️ Almost There!', body: `${10 - reportCount} more report(s) to unlock Health Historian badge!` });
    }

    // 7-Day Streak — nudge at day 5 or 6
    if (!has('week_streak') && streak >= 5 && streak < 7) {
      nudges.push({ title: '🔥 Streak Badge Close!', body: `${7 - streak} more day(s) to unlock the 7-Day Streak badge! Keep going!` });
    }

    // 30-Day Streak — nudge at 25+
    if (!has('month_streak') && streak >= 25 && streak < 30) {
      nudges.push({ title: '⚡ 30-Day Legend Close!', body: `Just ${30 - streak} more day(s) to unlock the 30-Day Streak badge!` });
    }

    // Hydration Hero — nudge at 5-6 water days
    if (!has('hydration_hero')) {
      const waterDays = await GamificationLog.distinct('uniqueActionKey', { user: userId, actionType: 'water_intake' });
      if (waterDays.length >= 5 && waterDays.length < 7) {
        nudges.push({ title: '💧 Hydration Hero Almost!', body: `Log water ${7 - waterDays.length} more day(s) to unlock the Hydration Hero badge!` });
      }
    }

    // Nutrition Star — nudge at 5-6 food days
    if (!has('nutrition_star')) {
      const foodLogs = await GamificationLog.find({ user: userId, actionType: 'food_log' }).select('uniqueActionKey').lean();
      const foodDays = new Set(foodLogs.map(l => l.uniqueActionKey?.split('_').slice(-2, -1)[0])).size;
      if (foodDays >= 5 && foodDays < 7) {
        nudges.push({ title: '🥗 Nutrition Star Close!', body: `Log meals ${7 - foodDays} more day(s) to unlock the Nutrition Star badge!` });
      }
    }

    // Send only 1 nudge at a time (most relevant = first one found)
    if (nudges.length > 0) {
      await sendToUser(userId, nudges[0]);
      // Mark as sent today so we don't spam
      await GamificationLog.create({
        user: userId,
        actionType: 'system_event',
        pointsAwarded: 0,
        description: 'Near-badge nudge sent',
        uniqueActionKey: todayKey,
      }).catch(() => {}); // ignore duplicate key errors
    }
  }

  async getProfile(userId) {
    const user = await User.findById(userId).select('gamification healthMetrics name').lean();
    if (!user) throw new Error('User not found');

    const recentLogs = await GamificationLog.find({ user: userId })
      .sort({ createdAt: -1 }).limit(10)
      .select('actionType pointsAwarded description createdAt').lean();

    const streak      = await this.getCurrentStreak(userId);
    const totalPoints = user.gamification?.totalPoints || 0;
    const tier        = this.calculateTier(totalPoints);

    // Next tier progress
    const tiers       = TIERS;
    const tierIdx     = tiers.findIndex(t => t.name === tier.name);
    const nextTier    = tiers[tierIdx + 1] || null;
    const progress    = nextTier
      ? Math.min(100, Math.round(((totalPoints - tier.minPoints) / (nextTier.minPoints - tier.minPoints)) * 100))
      : 100;

    // All badges — earned + locked
    const earnedIds   = (user.gamification?.badges || []).map(b => b.badgeId);
    const allBadges   = Object.values(BADGES).map(b => ({
      ...b,
      earned:   earnedIds.includes(b.id),
      earnedAt: user.gamification?.badges?.find(eb => eb.badgeId === b.id)?.earnedAt || null,
    }));

    return {
      totalPoints,
      currentTier:    tier.name,
      tierIcon:       tier.icon,
      nextTier:       nextTier?.name || null,
      nextTierPoints: nextTier?.minPoints || null,
      progress,
      streak,
      healthScore:    user.healthMetrics?.healthScore || 0,
      badges:         user.gamification?.badges || [],
      allBadges,
      recentActivity: recentLogs,
    };
  }

  // Called externally after report analysis completes (from healthController)
  async onReportComplete(userId, reportId) {
    await this.checkAndAwardBadges(userId);
  }
}

module.exports = new GamificationService();
