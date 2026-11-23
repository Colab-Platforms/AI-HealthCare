/**
 * Take Admin analytics. Group totals only, never single-user data.
 * Privacy rules (from the Take Admin spec):
 *  - no names, emails or clinical values are returned
 *  - any group with fewer than MIN_GROUP users is hidden (merged into "Other (small groups)")
 *  - admin-type accounts are excluded from every count
 */
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { logAudit } = require('../services/auditService');

const MIN_GROUP = 10;
const DAY = 24 * 60 * 60 * 1000;
const STAFF_ROLES = ['admin', 'takeadmin', 'superadmin'];
const customers = { role: { $nin: STAFF_ROLES } };

const parseRange = (q) => {
  const end = q.endDate ? new Date(q.endDate) : new Date();
  end.setHours(23, 59, 59, 999);
  const start = q.startDate ? new Date(q.startDate) : new Date(end.getTime() - 30 * DAY);
  start.setHours(0, 0, 0, 0);
  return { start, end };
};

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

/** Fold groups below MIN_GROUP into a single bucket so small groups can't be singled out. */
const suppressSmall = (rows, label = 'Other (small groups)') => {
  const big = rows.filter((r) => r.value >= MIN_GROUP);
  const smallSum = rows.filter((r) => r.value < MIN_GROUP).reduce((s, r) => s + r.value, 0);
  if (smallSum >= MIN_GROUP) big.push({ name: label, value: smallSum });
  return big.sort((a, b) => b.value - a.value);
};

const wrap = (name, fn) => async (req, res) => {
  try {
    const data = await fn(req);
    await logAudit(req, { action: 'view:analytics', module: 'user_analytics', reason: name });
    res.json({ success: true, minGroupSize: MIN_GROUP, ...data });
  } catch (err) {
    console.error(`[analytics:${name}]`, err);
    res.status(500).json({ success: false, message: 'Failed to load analytics' });
  }
};

// ---- Platform ------------------------------------------------------------
exports.platform = wrap('platform', async (req) => {
  const { start, end } = parseRange(req.query);
  const span = end - start;
  const prevStart = new Date(start.getTime() - span);
  const todayStart = new Date(end);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(end.getTime() - 7 * DAY);

  const [totalUsers, newUsers, prevNewUsers, dau, wau, mau, signupTrend, activeTrend] = await Promise.all([
    User.countDocuments(customers),
    User.countDocuments({ ...customers, createdAt: { $gte: start, $lte: end } }),
    User.countDocuments({ ...customers, createdAt: { $gte: prevStart, $lt: start } }),
    ActivityLog.distinct('user', { timestamp: { $gte: todayStart, $lte: end } }).then((u) => u.length),
    ActivityLog.distinct('user', { timestamp: { $gte: weekStart, $lte: end } }).then((u) => u.length),
    ActivityLog.distinct('user', { timestamp: { $gte: start, $lte: end } }).then((u) => u.length),
    User.aggregate([
      { $match: { ...customers, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    // distinct active users per day (DAU line)
    ActivityLog.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end } } },
      { $group: { _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, u: '$user' } } },
      { $group: { _id: '$_id.d', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return {
    period: { start, end },
    kpis: {
      totalUsers,
      newUsers,
      newUserGrowthPct: prevNewUsers > 0 ? Math.round(((newUsers - prevNewUsers) / prevNewUsers) * 100) : null,
      dau,
      wau,
      mau,
      stickinessPct: pct(dau, mau), // DAU / MAU
      inactiveInPeriod: Math.max(totalUsers - mau, 0),
    },
    signupTrend: signupTrend.map((r) => ({ date: r._id, signups: r.count })),
    activeTrend: activeTrend.map((r) => ({ date: r._id, activeUsers: r.count })),
  };
});

// ---- Weekly cohort retention --------------------------------------------
exports.retention = wrap('retention', async () => {
  const WEEKS = 6;
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); // this week's Monday

  const cohorts = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const start = new Date(monday.getTime() - i * 7 * DAY);
    const end = new Date(start.getTime() + 7 * DAY);
    const ids = await User.find({ ...customers, createdAt: { $gte: start, $lt: end } }).distinct('_id');
    const size = ids.length;
    const weeks = [];
    if (size >= MIN_GROUP) {
      const maxWeek = Math.min(Math.floor((now - start) / (7 * DAY)), WEEKS - 1);
      const rows = await ActivityLog.aggregate([
        { $match: { user: { $in: ids }, timestamp: { $gte: start } } },
        {
          $group: {
            _id: { w: { $floor: { $divide: [{ $subtract: ['$timestamp', start] }, 7 * DAY] } }, u: '$user' },
          },
        },
        { $group: { _id: '$_id.w', active: { $sum: 1 } } },
      ]);
      const byWeek = Object.fromEntries(rows.map((r) => [r._id, r.active]));
      for (let w = 0; w <= maxWeek; w++) weeks.push(pct(byWeek[w] || 0, size));
    }
    cohorts.push({ cohortStart: start, size: size >= MIN_GROUP ? size : null, hidden: size < MIN_GROUP, weeks });
  }
  return { cohorts };
});

// ---- Feature usage -------------------------------------------------------
exports.features = wrap('features', async (req) => {
  const { start, end } = parseRange(req.query);
  const rows = await ActivityLog.aggregate([
    { $match: { timestamp: { $gte: start, $lte: end }, category: { $ne: 'authentication' } } },
    { $group: { _id: { c: '$category', u: '$user' } } },
    { $group: { _id: '$_id.c', users: { $sum: 1 } } },
    { $sort: { users: -1 } },
  ]);
  const activeUsers = await ActivityLog.distinct('user', { timestamp: { $gte: start, $lte: end } }).then((u) => u.length);
  const labels = { diagnostics: 'Medical reports', nutrition: 'Nutrition', fitness: 'Fitness', medical: 'Medical records', glucose: 'Glucose', system: 'System' };
  return {
    period: { start, end },
    activeUsers,
    features: rows
      .filter((r) => r.users >= MIN_GROUP)
      .map((r) => ({ key: r._id, name: labels[r._id] || r._id, users: r.users, pctOfActive: pct(r.users, activeUsers) })),
  };
});

// ---- Regional ------------------------------------------------------------
exports.regional = wrap('regional', async (req) => {
  const { start, end } = parseRange(req.query);
  const state = (req.query.state || '').trim();
  const base = { ...customers };
  const filtered = state ? { ...base, 'foodPreferences.state': state } : base;

  const [byState, byCity, diet, withState, total, activeIds, regionRows] = await Promise.all([
    User.aggregate([
      { $match: { ...base, 'foodPreferences.state': { $nin: [null, ''] } } },
      { $group: { _id: '$foodPreferences.state', value: { $sum: 1 } } },
      { $sort: { value: -1 } },
    ]),
    state
      ? User.aggregate([
          { $match: { ...filtered, 'foodPreferences.city': { $nin: [null, ''] } } },
          { $group: { _id: '$foodPreferences.city', value: { $sum: 1 } } },
          { $sort: { value: -1 } },
        ])
      : Promise.resolve([]),
    User.aggregate([
      { $match: { ...filtered, 'profile.dietaryPreference': { $exists: true, $ne: null } } },
      { $group: { _id: '$profile.dietaryPreference', value: { $sum: 1 } } },
      { $sort: { value: -1 } },
    ]),
    User.countDocuments({ ...base, 'foodPreferences.state': { $nin: [null, ''] } }),
    User.countDocuments(filtered),
    ActivityLog.distinct('user', { timestamp: { $gte: start, $lte: end } }),
    User.aggregate([
      { $match: { ...filtered, 'foodPreferences.region': { $nin: [null, ''] } } },
      { $group: { _id: '$foodPreferences.region', value: { $sum: 1 } } },
      { $sort: { value: -1 } },
    ]),
  ]);

  let activeInSelection = null;
  if (state) {
    activeInSelection = await User.countDocuments({ ...filtered, _id: { $in: activeIds } });
    if (total < MIN_GROUP) {
      return { period: { start, end }, state, hidden: true, message: `Fewer than ${MIN_GROUP} users in this state; details are hidden to protect privacy.` };
    }
  }

  const toRows = (arr) => arr.map((r) => ({ name: r._id, value: r.value }));
  const states = toRows(byState);
  return {
    period: { start, end },
    state: state || null,
    totalUsers: total,
    coverage: { withState, pctWithState: pct(withState, await User.countDocuments(base)) },
    activeUsers: activeInSelection,
    states: suppressSmall(states),
    cities: suppressSmall(toRows(byCity)),
    dietTypes: suppressSmall(toRows(diet)),
    regions: suppressSmall(toRows(regionRows)),
    // Food-level popularity and suggestion acceptance are not collected per state yet.
    notAvailable: ['popularFoodsByState', 'suggestionAcceptanceByState', 'foodCoverageByState'],
  };
});

// ---- Behaviour groups ----------------------------------------------------
exports.behaviour = wrap('behaviour', async () => {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * DAY);
  const d10 = new Date(now.getTime() - 10 * DAY);
  const d30 = new Date(now.getTime() - 30 * DAY);

  const perUser = await ActivityLog.aggregate([
    { $match: { timestamp: { $gte: d30 } } },
    {
      $group: {
        _id: '$user',
        days: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } } },
        last: { $max: '$timestamp' },
        nutrition: { $sum: { $cond: [{ $eq: ['$category', 'nutrition'] }, 1, 0] } },
      },
    },
  ]);

  let highlyActive = 0, usedOnce = 0, atRisk = 0, mealTrackers = 0;
  const d7s = d7.toISOString().slice(0, 10);
  perUser.forEach((u) => {
    const recentDays = u.days.filter((d) => d >= d7s).length;
    if (recentDays >= 5) highlyActive++;
    if (u.days.length === 1) usedOnce++;
    if (u.last < d10 && u.days.length >= 3) atRisk++; // was regular, now quiet
    if (u.nutrition >= 16) mealTrackers++;            // roughly 4+ days a week of nutrition activity
  });

  const [totalUsers, newUsers, incompleteProfile] = await Promise.all([
    User.countDocuments(customers),
    User.countDocuments({ ...customers, createdAt: { $gte: d7 } }),
    User.countDocuments({
      ...customers,
      $or: [{ 'foodPreferences.state': { $in: [null, ''] } }, { 'profile.dietaryPreference': { $exists: false } }],
    }),
  ]);
  const activeIn30 = perUser.length;

  const groups = [
    { key: 'new', name: 'New users', desc: 'Signed up in the last 7 days', value: newUsers, action: 'Welcome series; check onboarding' },
    { key: 'highly_active', name: 'Highly active', desc: 'Used the app on 5+ of the last 7 days', value: highlyActive, action: 'Ask for reviews; beta features' },
    { key: 'used_once', name: 'Used once', desc: 'Opened the app on one day only (30 days)', value: usedOnce, action: 'Morning message with a local meal idea' },
    { key: 'at_risk', name: 'At risk', desc: 'Was regular, quiet for 10+ days', value: atRisk, action: 'Gentle reminder' },
    { key: 'inactive', name: 'Inactive', desc: 'No activity for 30+ days', value: Math.max(totalUsers - activeIn30, 0), action: 'Win-back offer' },
    { key: 'meal_trackers', name: 'Meal trackers', desc: 'Frequent nutrition logging', value: mealTrackers, action: 'Offer diet plans' },
    { key: 'incomplete', name: 'Incomplete profile', desc: 'Missing state or diet type', value: incompleteProfile, action: 'Ask to complete profile' },
  ].map((g) => (g.value < MIN_GROUP ? { ...g, value: null, hidden: true } : g));

  return {
    totalUsers,
    activeIn30,
    usedOncePct: pct(usedOnce, activeIn30),
    groups,
    // Groups are based on app usage and what users told us; never on health conditions.
    note: 'Groups use app activity only. Health conditions are never used.',
  };
});
