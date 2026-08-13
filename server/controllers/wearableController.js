const WearableData = require('../models/WearableData');
const cache = require('../utils/cache');
const { logActivity } = require('../utils/activityLogger');
const openWearablesClient = require('../config/openWearables');
const ProcessedWebhook = require('../models/ProcessedWebhook');

// Connect a new wearable device
exports.connectDevice = async (req, res) => {
  try {
    const { deviceType, deviceName } = req.body;

    let wearable = await WearableData.findOne({ user: req.user._id, deviceType });

    if (wearable) {
      wearable.isConnected = true;
      wearable.deviceName = deviceName || wearable.deviceName;
      wearable.lastSyncedAt = new Date();
      await wearable.save();
    } else {
      wearable = await WearableData.create({
        user: req.user._id,
        deviceType,
        deviceName,
        isConnected: true
      });
    }

    res.status(201).json(wearable);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Disconnect device
exports.disconnectDevice = async (req, res) => {
  try {
    const wearable = await WearableData.findOneAndUpdate(
      { user: req.user._id, deviceType: req.params.deviceType },
      { isConnected: false },
      { new: true }
    );

    if (!wearable) {
      return res.status(404).json({ message: 'Device not found' });
    }

    res.json({ message: 'Device disconnected', wearable });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all connected devices
exports.getConnectedDevices = async (req, res) => {
  try {
    const devices = await WearableData.find({ user: req.user._id });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Sync daily metrics (simulated - in real app would come from device API)
exports.syncDailyMetrics = async (req, res) => {
  try {
    const { deviceType = 'other', metrics } = req.body;

    let wearable = await WearableData.findOne({ user: req.user._id, deviceType });
    if (!wearable) {
      if (deviceType === 'other') {
        wearable = await WearableData.create({
          user: req.user._id,
          deviceType: 'other',
          deviceName: 'Manual Entry',
          isConnected: true,
          dailyMetrics: []
        });
      } else {
        return res.status(404).json({ message: 'Device not connected' });
      }
    }

    // Use date from metrics or fallback to today
    // IMPORTANT: Parse date strings like "2026-03-13" as UTC directly to avoid timezone shift
    let targetDate;
    if (metrics.date && typeof metrics.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(metrics.date)) {
      // Parse YYYY-MM-DD as UTC midnight directly
      const [y, m, d] = metrics.date.split('-').map(Number);
      targetDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    } else {
      targetDate = metrics.date ? new Date(metrics.date) : new Date();
      targetDate.setUTCHours(0, 0, 0, 0);
    }
    const targetDateString = targetDate.toISOString().split('T')[0];

    // Coerce all numeric fields to numbers before saving
    if (metrics.steps !== undefined) metrics.steps = Number(metrics.steps) || 0;
    if (metrics.caloriesBurned !== undefined) metrics.caloriesBurned = Number(metrics.caloriesBurned) || 0;
    if (metrics.activeMinutes !== undefined) metrics.activeMinutes = Number(metrics.activeMinutes) || 0;
    if (metrics.distance !== undefined) metrics.distance = Number(metrics.distance) || 0;
    if (metrics.floorsClimbed !== undefined) metrics.floorsClimbed = Number(metrics.floorsClimbed) || 0;

    // Check if entry for this date exists
    const existingIndex = wearable.dailyMetrics.findIndex(m => {
      const d = new Date(m.date);
      return d.getUTCFullYear() === targetDate.getUTCFullYear() &&
             d.getUTCMonth() === targetDate.getUTCMonth() &&
             d.getUTCDate() === targetDate.getUTCDate();
    });

    if (existingIndex >= 0) {
      // Merge metrics
      const existing = wearable.dailyMetrics[existingIndex].toObject();
      const updatedMetrics = { ...existing, ...metrics };

      // If additive flag is present, add steps/calories instead of replacing
      if (req.body.isAdditive) {
        if (metrics.steps !== undefined) updatedMetrics.steps = (existing.steps || 0) + Number(metrics.steps);
        if (metrics.caloriesBurned !== undefined) updatedMetrics.caloriesBurned = (existing.caloriesBurned || 0) + Number(metrics.caloriesBurned);
        if (metrics.activeMinutes !== undefined) updatedMetrics.activeMinutes = (existing.activeMinutes || 0) + Number(metrics.activeMinutes);
        if (metrics.distance !== undefined) updatedMetrics.distance = (existing.distance || 0) + Number(metrics.distance);
      }

      wearable.dailyMetrics[existingIndex] = {
        ...updatedMetrics,
        date: targetDate
      };
      wearable.markModified('dailyMetrics');
    } else {
      wearable.dailyMetrics.push({ ...metrics, date: targetDate });
    }

    wearable.lastSyncedAt = new Date();
    await wearable.save();

    // Log fitness activity
    await logActivity(req.user._id, 'LOG_FITNESS_METRICS', 'fitness', {
      deviceType,
      steps: metrics.steps,
      caloriesBurned: metrics.caloriesBurned,
      activeMinutes: metrics.activeMinutes,
      distance: metrics.distance
    });

    const gamificationService = require('../services/gamificationService');
    let gamificationResult = null;
    if (metrics.steps >= 1000) {
      gamificationResult = await gamificationService.awardPoints(req.user._id, 'step_goal', 'Hit daily step target').catch(console.error);
    }

    // Invalidate server-side dashboard cache so next fetch returns fresh data
    cache.delete(`dashboard:${req.user._id}`);
    require('../utils/scoreRecompute').triggerDailyScoreRecompute(req.user._id, targetDateString);

    res.json({ wearable, gamification: gamificationResult });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add heart rate reading
exports.addHeartRate = async (req, res) => {
  try {
    const { deviceType, bpm, type } = req.body;

    const wearable = await WearableData.findOne({ user: req.user._id, deviceType });
    if (!wearable) {
      return res.status(404).json({ message: 'Device not connected' });
    }

    wearable.heartRate.push({ bpm, type, timestamp: new Date() });

    // Keep only last 100 readings
    if (wearable.heartRate.length > 100) {
      wearable.heartRate = wearable.heartRate.slice(-100);
    }

    await wearable.save();

    // Log fitness activity
    await logActivity(req.user._id, 'LOG_HEART_RATE', 'fitness', {
      deviceType,
      bpm,
      type
    });

    res.json(wearable);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add sleep data
exports.addSleepData = async (req, res) => {
  try {
    const { deviceType = 'other', sleepData } = req.body;

    let wearable = await WearableData.findOne({ user: req.user._id, deviceType });
    if (!wearable) {
      if (deviceType === 'other') {
        wearable = await WearableData.create({
          user: req.user._id,
          deviceType: 'other',
          deviceName: 'Manual Entry',
          isConnected: true,
          sleepData: []
        });
      } else {
        return res.status(404).json({ message: 'Device not connected' });
      }
    }

    // IMPORTANT: Parse date strings like "2026-03-13" as UTC directly to avoid timezone shift
    let targetDate;
    if (sleepData.date && typeof sleepData.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sleepData.date)) {
      const [y, m, d] = sleepData.date.split('-').map(Number);
      targetDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    } else {
      targetDate = sleepData.date ? new Date(sleepData.date) : new Date();
      targetDate.setUTCHours(0, 0, 0, 0);
    }
    const targetDateString = targetDate.toISOString().split('T')[0];

    // Coerce all numeric fields to numbers before saving
    if (sleepData.totalSleepMinutes !== undefined) sleepData.totalSleepMinutes = Number(sleepData.totalSleepMinutes) || 0;
    if (sleepData.deepSleepMinutes !== undefined) sleepData.deepSleepMinutes = Number(sleepData.deepSleepMinutes) || 0;
    if (sleepData.lightSleepMinutes !== undefined) sleepData.lightSleepMinutes = Number(sleepData.lightSleepMinutes) || 0;
    if (sleepData.remSleepMinutes !== undefined) sleepData.remSleepMinutes = Number(sleepData.remSleepMinutes) || 0;
    if (sleepData.awakeMinutes !== undefined) sleepData.awakeMinutes = Number(sleepData.awakeMinutes) || 0;

    const existingIndex = wearable.sleepData.findIndex(s => {
      const d = new Date(s.date);
      return d.getUTCFullYear() === targetDate.getUTCFullYear() &&
             d.getUTCMonth() === targetDate.getUTCMonth() &&
             d.getUTCDate() === targetDate.getUTCDate();
    });

    if (existingIndex >= 0) {
      const existing = wearable.sleepData[existingIndex].toObject();
      const updatedSleep = { ...existing, ...sleepData };

      // If additive flag is present, add totalSleepMinutes/remSleepMinutes etc instead of replacing
      if (req.body.isAdditive) {
        if (sleepData.totalSleepMinutes !== undefined) updatedSleep.totalSleepMinutes = (existing.totalSleepMinutes || 0) + Number(sleepData.totalSleepMinutes);
        if (sleepData.remSleepMinutes !== undefined) updatedSleep.remSleepMinutes = (existing.remSleepMinutes || 0) + Number(sleepData.remSleepMinutes);
        if (sleepData.deepSleepMinutes !== undefined) updatedSleep.deepSleepMinutes = (existing.deepSleepMinutes || 0) + Number(sleepData.deepSleepMinutes);
      }

      wearable.sleepData[existingIndex] = {
        ...updatedSleep,
        date: targetDate
      };
      wearable.markModified('sleepData');
    } else {
      wearable.sleepData.push({ ...sleepData, date: targetDate });
    }

    await wearable.save();

    // Log fitness activity
    await logActivity(req.user._id, 'LOG_SLEEP_DATA', 'fitness', {
      deviceType,
      totalSleepMinutes: sleepData.totalSleepMinutes,
      remSleepMinutes: sleepData.remSleepMinutes,
      deepSleepMinutes: sleepData.deepSleepMinutes
    });

    // Invalidate server-side dashboard cache so next fetch returns fresh data
    cache.delete(`dashboard:${req.user._id}`);
    require('../utils/scoreRecompute').triggerDailyScoreRecompute(req.user._id, targetDateString);

    res.json(wearable);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get wearable dashboard data
exports.getWearableDashboard = async (req, res) => {
  try {
    // Project to the fields actually read below, and let Mongo do the
    // heartRate slice — otherwise the whole (unbounded, one-entry-per-sample)
    // heartRate array crosses the wire just to take the last 10 readings.
    const wearables = await WearableData.find({ user: req.user._id, isConnected: true })
      .select('deviceType deviceName lastSyncedAt dailyMetrics sleepData heartRate')
      .slice('heartRate', -10)
      .lean();

    if (!wearables.length) {
      return res.json({ connected: false, devices: [] });
    }

    // Aggregate data from all devices
    const dashboard = {
      connected: true,
      devices: wearables.map(w => ({
        type: w.deviceType,
        name: w.deviceName,
        lastSynced: w.lastSyncedAt
      })),
      todayMetrics: null,
      recentHeartRate: [],
      recentSleep: [],
      weeklyTrend: []
    };

    // Get today's metrics
    const targetDate = new Date();
    targetDate.setUTCHours(0, 0, 0, 0);
    const targetDateString = targetDate.toISOString().split('T')[0];

    for (const wearable of wearables) {
      const todayData = wearable.dailyMetrics.find(
        m => new Date(m.date).toISOString().split('T')[0] === targetDateString
      );

      if (todayData) {
        dashboard.todayMetrics = dashboard.todayMetrics || { steps: 0, caloriesBurned: 0, activeMinutes: 0, distance: 0, sleep: 0 };
        dashboard.todayMetrics.steps += todayData.steps || 0;
        dashboard.todayMetrics.caloriesBurned += todayData.caloriesBurned || 0;
        dashboard.todayMetrics.activeMinutes += todayData.activeMinutes || 0;
        dashboard.todayMetrics.distance += todayData.distance || 0;
      }

      // Aggregate today's sleep from sleepData array
      const todaySleep = wearable.sleepData.find(
        s => new Date(s.date).toISOString().split('T')[0] === targetDateString
      );
      if (todaySleep) {
        dashboard.todayMetrics = dashboard.todayMetrics || { steps: 0, caloriesBurned: 0, activeMinutes: 0, distance: 0, sleep: 0 };
        dashboard.todayMetrics.sleep = (dashboard.todayMetrics.sleep || 0) + (todaySleep.totalSleepMinutes || 0);
      }

      // Get recent heart rate (last 10 readings)
      if (wearable.heartRate.length) {
        dashboard.recentHeartRate.push(...wearable.heartRate.slice(-10));
      }

      // Get recent sleep data (last 7 days)
      if (wearable.sleepData.length) {
        const weekAgoDate = new Date();
        weekAgoDate.setDate(weekAgoDate.getDate() - 7);
        weekAgoDate.setUTCHours(0, 0, 0, 0);
        const recentSleep = wearable.sleepData.filter(s => new Date(s.date) >= weekAgoDate);
        dashboard.recentSleep.push(...recentSleep);
      }

      // Get weekly trend
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weeklyData = wearable.dailyMetrics.filter(m => new Date(m.date) >= weekAgo);
      dashboard.weeklyTrend.push(...weeklyData);
    }

    // Sort by date
    dashboard.recentHeartRate.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    dashboard.recentSleep.sort((a, b) => new Date(b.date) - new Date(a.date));
    dashboard.weeklyTrend.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Generate demo data for testing - DISABLED IN PRODUCTION
exports.generateDemoData = async (req, res) => {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        message: 'Demo data generation is disabled in production',
        error: 'DEMO_DATA_DISABLED'
      });
    }

    const { deviceType } = req.body;

    let wearable = await WearableData.findOne({ user: req.user._id, deviceType });

    if (!wearable) {
      wearable = await WearableData.create({
        user: req.user._id,
        deviceType,
        deviceName: `Demo ${deviceType}`,
        isConnected: true
      });
    }

    // Generate 7 days of demo data
    const dailyMetrics = [];
    const heartRate = [];
    const sleepData = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      dailyMetrics.push({
        date,
        steps: Math.floor(5000 + Math.random() * 8000),
        caloriesBurned: Math.floor(1500 + Math.random() * 1000),
        activeMinutes: Math.floor(20 + Math.random() * 60),
        distance: parseFloat((3 + Math.random() * 7).toFixed(2)),
        floorsClimbed: Math.floor(Math.random() * 20)
      });

      // Heart rate readings throughout the day
      for (let h = 0; h < 6; h++) {
        const timestamp = new Date(date);
        timestamp.setHours(8 + h * 2);
        heartRate.push({
          timestamp,
          bpm: Math.floor(60 + Math.random() * 40),
          type: Math.random() > 0.7 ? 'active' : 'resting'
        });
      }

      sleepData.push({
        date,
        totalSleepMinutes: Math.floor(360 + Math.random() * 120),
        deepSleepMinutes: Math.floor(60 + Math.random() * 60),
        lightSleepMinutes: Math.floor(180 + Math.random() * 60),
        remSleepMinutes: Math.floor(60 + Math.random() * 30),
        awakeMinutes: Math.floor(10 + Math.random() * 20),
        sleepScore: Math.floor(60 + Math.random() * 35)
      });
    }

    wearable.dailyMetrics = dailyMetrics;
    wearable.heartRate = heartRate;
    wearable.sleepData = sleepData;
    wearable.lastSyncedAt = new Date();

    await wearable.save();

    res.json({ message: 'Demo data generated', wearable });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Open Wearables has its own internal user_id space. Before we can call
// oauth/authorize for a provider, our user must exist over there first.
// We find-or-create a WearableData doc, and lazily create the Open Wearables
// user on first connect, caching the returned id on openWearablesUserId.
async function ensureOpenWearablesUser(ourUserId, provider) {
  let wearable = await WearableData.findOne({ user: ourUserId, deviceType: provider });

  if (!wearable) {
    wearable = await WearableData.create({
      user: ourUserId,
      deviceType: provider,
      deviceName: provider,
      isConnected: false // becomes true once the OAuth flow actually completes
    });
  }

  if (!wearable.openWearablesUserId) {
    // NOTE: verify the exact request body Open Wearables expects for
    // "Create user" (POST /api/v1/users) against their docs — this is a
    // reasonable guess (external_id lets us store OUR id on THEIR side too)
    const { data } = await openWearablesClient.post('/users', {
      external_user_id: ourUserId.toString()
    });
    wearable.openWearablesUserId = data.id;
    await wearable.save();
  }

  return wearable;
}

// Get an authorize URL from Open Wearables for a given provider (fitbit/garmin/etc)
exports.getConnectUrl = async (req, res) => {
  try {
    const { provider } = req.params;

    const wearable = await ensureOpenWearablesUser(req.user._id, provider);

    const { data } = await openWearablesClient.get(
      `/oauth/${provider}/authorize`,
      { params: { user_id: wearable.openWearablesUserId } }
    );

    res.json({ url: data.authorization_url });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const { Webhook } = require('svix');

// A user in Open Wearables can have several provider connections (one WearableData
// doc per deviceType), so every event must be matched on BOTH their user id and
// the provider that produced it.
async function findWearableDoc(openWearablesUserId, provider) {
  return WearableData.findOne({ openWearablesUserId, deviceType: provider });
}

function dateOnlyUTC(isoString) {
  const d = new Date(isoString);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Receive events pushed by Open Wearables (via Svix) once an endpoint is
// registered — see server/scripts/registerOpenWearablesWebhook.js for setup.
// No auth middleware on this route — Svix calls it directly, not the browser.
// Signature is verified instead of a JWT/session.
exports.handleWebhook = async (req, res) => {
  try {
    const wh = new Webhook(process.env.OPEN_WEARABLES_WEBHOOK_SECRET);
    let event;
    try {
      // req.rawBody is captured in server.js's express.json({ verify }) hook —
      // Svix needs the exact bytes that were signed, not a re-serialized req.body
      event = wh.verify(req.rawBody, req.headers);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }

    // Svix retries a failed delivery with the SAME svix-id, and several of our
    // handlers accumulate (calories, steps), so replaying an event would inflate
    // the totals. The unique {source, eventId} index makes this insert the lock:
    // whoever wins it processes the event, a duplicate just acknowledges.
    try {
      await ProcessedWebhook.create({
        source: 'open_wearables',
        eventId: req.headers['svix-id']
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(200).json({ received: true, duplicate: true });
      }
      throw err;
    }

    const { type, data } = event;

    switch (type) {
      case 'connection.created': {
        const wearable = await findWearableDoc(data.user_id, data.provider)
          ?? await WearableData.findOneAndUpdate(
            { openWearablesUserId: data.user_id, deviceType: data.provider },
            { openWearablesUserId: data.user_id, deviceType: data.provider, deviceName: data.provider },
            { upsert: true, new: true }
          );
        wearable.isConnected = true;
        wearable.lastSyncedAt = new Date();
        await wearable.save();
        break;
      }

      case 'connection.revoked': {
        await WearableData.findOneAndUpdate(
          { openWearablesUserId: data.user_id, deviceType: data.provider },
          { isConnected: false }
        );
        break;
      }

      case 'sleep.created': {
        const wearable = await findWearableDoc(data.user_id, data.source?.provider);
        if (wearable) {
          wearable.sleepData.push({
            date: dateOnlyUTC(data.start_time),
            totalSleepMinutes: Math.round(data.duration_seconds / 60),
            deepSleepMinutes: data.stages?.deep_minutes,
            lightSleepMinutes: data.stages?.light_minutes,
            remSleepMinutes: data.stages?.rem_minutes,
            awakeMinutes: data.stages?.awake_minutes,
            bedTime: data.start_time,
            wakeTime: data.end_time
          });
          wearable.lastSyncedAt = new Date();
          await wearable.save();
        }
        break;
      }

      case 'workout.created': {
        const wearable = await findWearableDoc(data.user_id, data.source?.provider);
        if (wearable) {
          const date = dateOnlyUTC(data.start_time);
          const existing = wearable.dailyMetrics.find(
            m => dateOnlyUTC(m.date).getTime() === date.getTime()
          );
          if (existing) {
            existing.caloriesBurned += data.calories_kcal || 0;
            existing.distance += (data.distance_meters || 0) / 1000;
            existing.activeMinutes += Math.round(data.duration_seconds / 60);
          } else {
            wearable.dailyMetrics.push({
              date,
              caloriesBurned: data.calories_kcal || 0,
              distance: (data.distance_meters || 0) / 1000,
              activeMinutes: Math.round(data.duration_seconds / 60)
            });
          }
          wearable.markModified('dailyMetrics');
          wearable.lastSyncedAt = new Date();
          await wearable.save();
        }
        break;
      }

      case 'heart_rate.created': {
        const wearable = await findWearableDoc(data.user_id, data.provider);
        if (wearable) {
          for (const sample of data.samples) {
            if (sample.type !== 'heart_rate') continue;
            wearable.heartRate.push({ timestamp: sample.timestamp, bpm: sample.value, type: 'resting' });
          }
          if (wearable.heartRate.length > 100) wearable.heartRate = wearable.heartRate.slice(-100);
          wearable.lastSyncedAt = new Date();
          await wearable.save();
        }
        break;
      }

      case 'steps.created': {
        const wearable = await findWearableDoc(data.user_id, data.provider);
        if (wearable) {
          // Only additive when the provider gives intraday samples (is_daily_total: false);
          // a true daily total should replace, not add to, the day's figure.
          for (const sample of data.samples) {
            const date = dateOnlyUTC(sample.timestamp);
            let entry = wearable.dailyMetrics.find(
              m => dateOnlyUTC(m.date).getTime() === date.getTime()
            );
            if (!entry) {
              // push() copies the object into a subdocument, so read it back —
              // mutating the pushed literal would not touch what gets saved
              wearable.dailyMetrics.push({ date, steps: 0 });
              entry = wearable.dailyMetrics[wearable.dailyMetrics.length - 1];
            }
            entry.steps = sample.is_daily_total ? sample.value : (entry.steps || 0) + sample.value;
          }
          wearable.markModified('dailyMetrics');
          wearable.lastSyncedAt = new Date();
          await wearable.save();
        }
        break;
      }

      case 'calories.created': {
        const wearable = await findWearableDoc(data.user_id, data.provider);
        if (wearable) {
          for (const sample of data.samples) {
            const date = dateOnlyUTC(sample.timestamp);
            let entry = wearable.dailyMetrics.find(
              m => dateOnlyUTC(m.date).getTime() === date.getTime()
            );
            if (!entry) {
              // push() copies the object into a subdocument, so read it back —
              // mutating the pushed literal would not touch what gets saved
              wearable.dailyMetrics.push({ date, caloriesBurned: 0 });
              entry = wearable.dailyMetrics[wearable.dailyMetrics.length - 1];
            }
            // A daily total replaces the day's figure; intraday samples add up
            entry.caloriesBurned = sample.is_daily_total
              ? sample.value
              : (entry.caloriesBurned || 0) + sample.value;
          }
          wearable.markModified('dailyMetrics');
          wearable.lastSyncedAt = new Date();
          await wearable.save();
        }
        break;
      }

      case 'body_composition.created': {
        const wearable = await findWearableDoc(data.user_id, data.provider);
        if (wearable) {
          // One event can carry weight, body fat, BMI, … — group by timestamp so
          // readings taken together land in a single entry
          const byTimestamp = new Map();
          for (const sample of data.samples) {
            const entry = byTimestamp.get(sample.timestamp) || { timestamp: sample.timestamp };
            if (sample.type === 'weight') entry.weightKg = sample.value;
            if (sample.type === 'body_fat_percentage') entry.bodyFatPercentage = sample.value;
            if (sample.type === 'body_mass_index') entry.bmi = sample.value;
            if (sample.type === 'lean_body_mass') entry.leanBodyMassKg = sample.value;
            byTimestamp.set(sample.timestamp, entry);
          }
          wearable.bodyComposition.push(...byTimestamp.values());
          wearable.lastSyncedAt = new Date();
          await wearable.save();
        }
        break;
      }

      case 'spo2.created': {
        const wearable = await findWearableDoc(data.user_id, data.provider);
        if (wearable) {
          for (const sample of data.samples) {
            if (sample.type !== 'oxygen_saturation') continue;
            wearable.bloodOxygen.push({ timestamp: sample.timestamp, percentage: sample.value });
          }
          wearable.lastSyncedAt = new Date();
          await wearable.save();
        }
        break;
      }

      default:
        // Event type we don't map yet — acknowledge so Svix doesn't retry, but do nothing
        break;
    }

    // Invalidate dashboard cache so the next fetch shows fresh data
    const wearableForCache = data.user_id
      ? await WearableData.findOne({ openWearablesUserId: data.user_id })
      : null;
    if (wearableForCache) cache.delete(`dashboard:${wearableForCache.user}`);

    res.status(200).json({ received: true });
  } catch (error) {
    // Processing failed after we claimed the event, so release the claim —
    // otherwise Svix's retry would be swallowed as a duplicate and the data lost
    if (req.headers['svix-id']) {
      await ProcessedWebhook.deleteOne({
        source: 'open_wearables',
        eventId: req.headers['svix-id']
      }).catch(() => {});
    }
    res.status(500).json({ message: error.message });
  }
};
