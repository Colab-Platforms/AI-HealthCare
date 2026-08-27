const ExerciseLog = require('../models/ExerciseLog');
const ExerciseSummary = require('../models/ExerciseSummary');
const User = require('../models/User');
const cache = require('../utils/cache');
const { logActivity } = require('../utils/activityLogger');
const gamificationService = require('../services/gamificationService');
const { triggerDailyScoreRecompute } = require('../utils/scoreRecompute');

// Helper function to add timeout to all queries for Vercel compatibility
// Query objects expose .maxTimeMS(); Aggregate objects only expose .option({ maxTimeMS })
const withTimeout = (query, timeoutMs = 30000) => {
  if (typeof query.maxTimeMS === 'function') return query.maxTimeMS(timeoutMs);
  return query.option({ maxTimeMS: timeoutMs });
};

function parseDayParam(dateInput) {
  let targetDate;
  if (dateInput instanceof Date) {
    targetDate = new Date(dateInput.toISOString().split('T')[0]);
  } else if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    targetDate = new Date(dateInput.split('T')[0]);
  } else {
    targetDate = new Date(new Date(dateInput).toISOString().split('T')[0]);
  }
  targetDate.setUTCHours(0, 0, 0, 0);
  return targetDate;
}

async function getCachedUserWeight(userId) {
  const cacheKey = `user_weight:${userId}`;
  const cached = await cache.get(cacheKey);
  if (cached !== null && cached !== undefined) return cached;
  const user = await User.findById(userId).select('profile.weight').lean();
  const weight = user?.profile?.weight || 0;
  await cache.set(cacheKey, weight, 15 * 60);
  return weight;
}

// Log a new exercise session
exports.logExercise = async (req, res) => {
  try {
    const {
      activityType,
      duration,
      distance,
      avgPace,
      avgHeartRate,
      maxHeartRate,
      elevationGain,
      exercises,
      intensity,
      notes,
      timestamp,
      caloriesBurned: manualCalories
    } = req.body;

    if (!activityType || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Activity type and duration are required'
      });
    }

    const weightKg = await getCachedUserWeight(req.user._id);
    const { calories, metValue } = ExerciseLog.calculateCalories(activityType, intensity, duration, weightKg);

    const exerciseLog = new ExerciseLog({
      userId: req.user._id,
      activityType,
      duration: Number(duration),
      distance: distance !== undefined ? Number(distance) : undefined,
      avgPace: avgPace !== undefined ? Number(avgPace) : undefined,
      avgHeartRate: avgHeartRate !== undefined ? Number(avgHeartRate) : undefined,
      maxHeartRate: maxHeartRate !== undefined ? Number(maxHeartRate) : undefined,
      elevationGain: elevationGain !== undefined ? Number(elevationGain) : undefined,
      exercises: Array.isArray(exercises) ? exercises : undefined,
      intensity: intensity || 'medium',
      notes,
      caloriesBurned: Number(manualCalories) > 0 ? Number(manualCalories) : calories,
      metValue,
      timestamp: (() => {
        const inputDate = timestamp || req.body.date;
        if (inputDate && typeof inputDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inputDate)) {
          const [y, m, d] = inputDate.split('-').map(Number);
          return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
        }
        return inputDate ? new Date(inputDate) : new Date();
      })()
    });

    await exerciseLog.save();

    await updateDailyExerciseSummary(req.user._id, exerciseLog.timestamp);

    await logActivity(req.user._id, 'LOG_EXERCISE', 'fitness', {
      activityType,
      duration: exerciseLog.duration,
      caloriesBurned: exerciseLog.caloriesBurned
    }, req);

    const gamificationResult = await gamificationService
      .awardPoints(req.user._id, 'workout', `Logged ${activityType.replace('_', ' ')}`, activityType)
      .catch((err) => {
        console.error('Gamification Error:', err);
        return null;
      });

    res.json({
      success: true,
      exerciseLog,
      gamification: gamificationResult,
      message: 'Exercise logged successfully'
    });
  } catch (error) {
    console.error('Log exercise error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log exercise',
      error: error.message
    });
  }
};

// Get exercise logs (paginated, filterable)
exports.getExerciseLogs = async (req, res) => {
  try {
    const { startDate, endDate, activityType, date, page, limit: limitParam } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(limitParam) || 20));
    const skip = (pageNum - 1) * pageSize;

    const query = { userId: req.user._id };

    if (date) {
      const [y, m, d] = date.split('-').map(Number);
      const d0 = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
      const nextDay = new Date(d0);
      nextDay.setUTCDate(d0.getUTCDate() + 1);
      query.timestamp = { $gte: d0, $lt: nextDay };
    } else if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    if (activityType) query.activityType = activityType;

    const [exerciseLogs, total] = await Promise.all([
      withTimeout(ExerciseLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(pageSize).lean()),
      ExerciseLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      exerciseLogs,
      count: exerciseLogs.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Get exercise logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get exercise logs',
      error: error.message
    });
  }
};

// Get today's exercise logs
exports.getTodayLogs = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const exerciseLogs = await withTimeout(ExerciseLog.find({
      userId: req.user._id,
      timestamp: { $gte: today, $lt: tomorrow }
    }).sort({ timestamp: 1 }));

    res.json({
      success: true,
      exerciseLogs,
      count: exerciseLogs.length
    });
  } catch (error) {
    console.error('Get today exercise logs error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to get today's exercise logs",
      error: error.message
    });
  }
};

// Update exercise log
exports.updateExerciseLog = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const exerciseLog = await ExerciseLog.findOne({ _id: id, userId: req.user._id });

    if (!exerciseLog) {
      return res.status(404).json({ success: false, message: 'Exercise log not found' });
    }

    Object.assign(exerciseLog, updates);

    // Recompute calories if the metrics that drive the estimate changed and no manual override was given
    if ((updates.duration || updates.activityType || updates.intensity) && !updates.caloriesBurned) {
      const weightKg = await getCachedUserWeight(req.user._id);
      const { calories, metValue } = ExerciseLog.calculateCalories(
        exerciseLog.activityType, exerciseLog.intensity, exerciseLog.duration, weightKg
      );
      exerciseLog.caloriesBurned = calories;
      exerciseLog.metValue = metValue;
    }

    await exerciseLog.save();

    await updateDailyExerciseSummary(req.user._id, exerciseLog.timestamp);

    res.json({
      success: true,
      exerciseLog,
      message: 'Exercise log updated successfully'
    });
  } catch (error) {
    console.error('Update exercise log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update exercise log',
      error: error.message
    });
  }
};

// Delete exercise log
exports.deleteExerciseLog = async (req, res) => {
  try {
    const { id } = req.params;

    const exerciseLog = await ExerciseLog.findOneAndDelete({ _id: id, userId: req.user._id });

    if (!exerciseLog) {
      return res.status(404).json({ success: false, message: 'Exercise log not found' });
    }

    await updateDailyExerciseSummary(req.user._id, exerciseLog.timestamp);

    res.json({
      success: true,
      message: 'Exercise log deleted successfully'
    });
  } catch (error) {
    console.error('Delete exercise log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete exercise log',
      error: error.message
    });
  }
};

// Get daily summary
exports.getDailySummary = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = parseDayParam(date || new Date());
    const isToday = targetDate.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];

    let summary;
    if (isToday) {
      summary = await updateDailyExerciseSummary(req.user._id, targetDate);
    } else {
      summary = await withTimeout(ExerciseSummary.findOne({ userId: req.user._id, date: targetDate }));
      if (!summary) {
        summary = await updateDailyExerciseSummary(req.user._id, targetDate);
      }
    }

    res.json({ success: true, summary });
  } catch (error) {
    console.error('Get exercise daily summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get daily summary',
      error: error.message
    });
  }
};

// Get weekly summary
exports.getWeeklySummary = async (req, res) => {
  try {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const summaries = await ExerciseSummary.find({
      userId: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    const weeklyStats = {
      totalDuration: 0,
      totalCaloriesBurned: 0,
      totalSessions: 0,
      totalDistance: 0,
      daysActive: summaries.length,
      dailySummaries: summaries
    };

    summaries.forEach((summary) => {
      weeklyStats.totalDuration += summary.totalDuration || 0;
      weeklyStats.totalCaloriesBurned += summary.totalCaloriesBurned || 0;
      weeklyStats.totalSessions += summary.sessionsCount || 0;
      weeklyStats.totalDistance += summary.totalDistance || 0;
    });

    res.json({ success: true, weeklyStats });
  } catch (error) {
    console.error('Get exercise weekly summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get weekly summary',
      error: error.message
    });
  }
};

// Get trends over a longer range (aggregated by day)
exports.getTrends = async (req, res) => {
  try {
    const { range } = req.query; // '4weeks' | '3months'
    const days = range === '3months' ? 90 : 28;

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const dailyTrend = await withTimeout(ExerciseLog.aggregate([
      { $match: { userId: req.user._id, timestamp: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          totalCalories: { $sum: '$caloriesBurned' },
          totalDuration: { $sum: '$duration' },
          sessionCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]));

    const byType = await withTimeout(ExerciseLog.aggregate([
      { $match: { userId: req.user._id, timestamp: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: '$activityType',
          totalCalories: { $sum: '$caloriesBurned' },
          totalDuration: { $sum: '$duration' },
          sessionCount: { $sum: 1 }
        }
      },
      { $sort: { sessionCount: -1 } }
    ]));

    res.json({
      success: true,
      dailyTrend: dailyTrend.map((d) => ({
        date: d._id,
        totalCalories: d.totalCalories,
        totalDuration: d.totalDuration,
        sessionCount: d.sessionCount
      })),
      byType: byType.map((t) => ({
        activityType: t._id,
        totalCalories: t.totalCalories,
        totalDuration: t.totalDuration,
        sessionCount: t.sessionCount
      }))
    });
  } catch (error) {
    console.error('Get exercise trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trends',
      error: error.message
    });
  }
};

// Get personal records per activity type
exports.getPersonalRecords = async (req, res) => {
  try {
    const cacheKey = `exercise_prs:${req.user._id}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, personalRecords: cached, cached: true });
    }

    const [cardioBests, strengthBests] = await Promise.all([
      withTimeout(ExerciseLog.aggregate([
        { $match: { userId: req.user._id, category: 'cardio' } },
        {
          $group: {
            _id: '$activityType',
            longestDistance: { $max: '$distance' },
            longestDuration: { $max: '$duration' },
            bestPace: { $min: '$avgPace' },
            mostCalories: { $max: '$caloriesBurned' }
          }
        }
      ])),
      withTimeout(ExerciseLog.aggregate([
        { $match: { userId: req.user._id, category: 'strength' } },
        { $unwind: '$exercises' },
        { $unwind: '$exercises.sets' },
        {
          $group: {
            _id: '$exercises.name',
            heaviestWeight: { $max: '$exercises.sets.weight' },
            maxReps: { $max: '$exercises.sets.reps' }
          }
        }
      ]))
    ]);

    const personalRecords = {
      cardio: cardioBests.map((c) => ({
        activityType: c._id,
        longestDistance: c.longestDistance || 0,
        longestDuration: c.longestDuration || 0,
        bestPace: c.bestPace || null,
        mostCalories: c.mostCalories || 0
      })),
      strength: strengthBests.map((s) => ({
        exerciseName: s._id,
        heaviestWeight: s.heaviestWeight || 0,
        maxReps: s.maxReps || 0
      }))
    };

    await cache.set(cacheKey, personalRecords, 10 * 60);

    res.json({ success: true, personalRecords });
  } catch (error) {
    console.error('Get personal records error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get personal records',
      error: error.message
    });
  }
};

// Internal helper: recompute a day's ExerciseSummary from ExerciseLog entries
exports.updateDailyExerciseSummaryInternal = updateDailyExerciseSummary;
async function updateDailyExerciseSummary(userId, date) {
  try {
    const targetDate = parseDayParam(date);
    const nextDay = new Date(targetDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const [logs, existingSummary] = await Promise.all([
      ExerciseLog.find({ userId, timestamp: { $gte: targetDate, $lt: nextDay } }).lean(),
      ExerciseSummary.findOne({ userId, date: targetDate })
    ]);

    const totals = {
      totalDuration: 0,
      totalCaloriesBurned: 0,
      sessionsCount: logs.length,
      totalDistance: 0,
      avgHeartRate: 0
    };
    const sessionsByType = {};
    let heartRateSum = 0;
    let heartRateCount = 0;

    for (const log of logs) {
      totals.totalDuration += Number(log.duration) || 0;
      totals.totalCaloriesBurned += Number(log.caloriesBurned) || 0;
      totals.totalDistance += Number(log.distance) || 0;
      if (log.avgHeartRate) {
        heartRateSum += log.avgHeartRate;
        heartRateCount++;
      }
      sessionsByType[log.activityType] = (sessionsByType[log.activityType] || 0) + 1;
    }

    totals.avgHeartRate = heartRateCount > 0 ? Math.round(heartRateSum / heartRateCount) : 0;

    const targetDateStr = targetDate.toISOString().split('T')[0];

    if (existingSummary) {
      Object.assign(existingSummary, totals, { sessionsByType });
      await existingSummary.save();
      triggerDailyScoreRecompute(userId, targetDateStr);
      return existingSummary;
    }

    const newSummary = new ExerciseSummary({ userId, date: targetDate, ...totals, sessionsByType });
    await newSummary.save();
    triggerDailyScoreRecompute(userId, targetDateStr);
    return newSummary;
  } catch (error) {
    console.error('Update daily exercise summary error:', error);
    return null;
  }
}
