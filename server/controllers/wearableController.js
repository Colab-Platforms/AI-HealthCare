const mongoose = require('mongoose');
const WearableData = require('../models/WearableData');
const WearableSyncReceipt = require('../models/WearableSyncReceipt');
const HeartRateSample = require('../models/HeartRateSample');
const cache = require('../utils/cache');
const { logActivity } = require('../utils/activityLogger');
const openWearablesClient = require('../config/openWearables');
const ProcessedWebhook = require('../models/ProcessedWebhook');
const { getSleepAnalytics, SleepAnalyticsInputError } = require('../services/sleepAnalyticsService');
const { getActivityAnalytics, ActivityAnalyticsInputError } = require('../services/activityAnalyticsService');
const { getStressAnalytics, StressAnalyticsInputError } = require('../services/stressAnalyticsService');
const { getVitalsAnalytics, VitalsAnalyticsInputError } = require('../services/vitalsAnalyticsService');
const { getRecoveryAnalytics, RecoveryAnalyticsInputError } = require('../services/recoveryAnalyticsService');
const { getSleepInsight } = require('../services/sleepInsightService');
const { getActivityInsight } = require('../services/activityInsightService');
const wearableIngest = require('../services/wearableIngestService');
const DailyActivityMetric = require('../models/DailyActivityMetric');
const SleepSession = require('../models/SleepSession');
const HeartRateDailySummary = require('../models/HeartRateDailySummary');

function dateOnlyUTCFromDate(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Rolls one HR sample into that day's running avg/min/max. Raw samples live in
// HeartRateSample; this permanent rollup powers long-term trends. Mutates
// `wearable` in place; caller saves.
//
// `type` (resting/active/peak/cardio) also updates restingBpm separately when
// it's 'resting'. Only classifyHeartRateContext() below is allowed to produce
// 'resting' for webhook-sourced samples — see its comment for why.
function upsertHeartRateDailySummary(wearable, timestamp, bpm, type) {
  const bpmNum = Number(bpm);
  if (!(bpmNum > 0)) return;

  const date = dateOnlyUTCFromDate(new Date(timestamp));
  let entry = wearable.heartRateDailySummary.find(
    (s) => dateOnlyUTCFromDate(new Date(s.date)).getTime() === date.getTime()
  );

  if (!entry) {
    wearable.heartRateDailySummary.push({
      date,
      avgBpm: bpmNum,
      minBpm: bpmNum,
      maxBpm: bpmNum,
      readingCount: 1,
      restingBpm: type === 'resting' ? bpmNum : undefined
    });
    wearable.markModified('heartRateDailySummary');
    return;
  }

  const newCount = (entry.readingCount || 0) + 1;
  entry.avgBpm = Math.round(((entry.avgBpm * (entry.readingCount || 0)) + bpmNum) / newCount);
  entry.minBpm = entry.minBpm != null ? Math.min(entry.minBpm, bpmNum) : bpmNum;
  entry.maxBpm = entry.maxBpm != null ? Math.max(entry.maxBpm, bpmNum) : bpmNum;
  entry.readingCount = newCount;
  if (type === 'resting') {
    entry.restingBpm = entry.restingBpm != null ? Math.min(entry.restingBpm, bpmNum) : bpmNum;
  }
  wearable.markModified('heartRateDailySummary');
}

// Classifies a heart_rate.created sample's rest/activity type from the
// provider's `context` field. Previously this defaulted to 'resting' unless
// context === 'active', which meant sleep, walking, sedentary-but-not-still,
// or simply missing context all got counted as true rest — silently
// contaminating the restingBpm rollup (HeartRateDailySummary.restingBpm is a
// running MIN, so a single misclassified low active-context reading can
// drag it down permanently for that day).
//
// Fix: require positive evidence of rest, and require positive evidence of
// activity separately. Anything the provider doesn't clearly label either way
// stays 'unspecified' and is excluded from restingBpm (see
// upsertHeartRateDailySummary / wearableIngestService.applyHeartRateSamples,
// both gated on type === 'resting').
//
// If Open Wearables' actual context vocabulary differs from this list,
// extend it here — do not fall back to assuming 'resting'.
const RESTING_HR_CONTEXTS = new Set(['resting', 'sedentary', 'sleep', 'idle']);
const ACTIVE_HR_CONTEXTS = new Set(['active', 'workout', 'exercise', 'walking', 'running', 'cycling']);

function classifyHeartRateContext(context) {
  if (RESTING_HR_CONTEXTS.has(context)) return 'resting';
  if (ACTIVE_HR_CONTEXTS.has(context)) return 'active';
  return 'unspecified';
}

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
    console.error(`[Wearables] connectDevice failed: user=${req.user?._id} error=${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

// Disconnect device
exports.disconnectDevice = async (req, res) => {
  try {
    // Nothing else logs who/when a device gets disconnected, and this endpoint
    // has already been the prime suspect in one "connection vanished on its
    // own" investigation — cheap enough to always print, not worth a debug flag
    console.log(
      `[Wearables] disconnect requested: user=${req.user._id} deviceType=${req.params.deviceType} ip=${req.ip} ua=${req.headers['user-agent']}`
    );

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
    // Just the connection summary — dailyMetrics/sleepData/etc. belong to
    // /dashboard, not here, so the payload stays small for a devices-list screen
    const devices = await WearableData.find({ user: req.user._id })
      .select('deviceType deviceName isConnected lastSyncedAt');
    res.json(devices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Sync daily metrics (simulated - in real app would come from device API)
exports.syncDailyMetrics = async (req, res) => {
  try {
    const { deviceType = 'manual', metrics } = req.body;

    let wearable = await WearableData.findOne({ user: req.user._id, deviceType });
    if (!wearable) {
      if (deviceType === 'manual') {
        wearable = await WearableData.create({
          user: req.user._id,
          deviceType: 'manual',
          deviceName: 'Manual Entry',
          isConnected: false,
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

    // Mirror the resolved (additive-or-replace already settled above) values
    // into the right-sized collection activityAnalyticsService/dashboard now
    // read from — $set here, never $inc, since additive merging already
    // happened against the embedded array.
    const resolved = wearable.dailyMetrics.find(m => dateOnlyUTCFromDate(new Date(m.date)).getTime() === targetDate.getTime());
    if (resolved) {
      await DailyActivityMetric.findOneAndUpdate(
        { user: req.user._id, deviceType, date: targetDate },
        { $set: {
            steps: resolved.steps,
            caloriesBurned: resolved.caloriesBurned,
            activeMinutes: resolved.activeMinutes,
            distance: resolved.distance,
            floorsClimbed: resolved.floorsClimbed,
            source: deviceType
          } },
        { upsert: true }
      );
    }

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
    cache.deletePattern(`activity_analytics:${req.user._id}:*`);
    require('../utils/scoreRecompute').triggerDailyScoreRecompute(req.user._id, targetDateString);
    require('../utils/scoreRecompute').triggerRecoveryScoreRecompute(req.user._id, targetDateString);

    res.json({ wearable, gamification: gamificationResult });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Receive normalized records read by the Android Health Connect or iOS HealthKit bridge.
// The mobile syncId makes retries safe: a batch is applied at most once.
exports.syncOsHealthData = async (req, res) => {
  let session;
  try {
    const {
      source,
      provider,
      deviceName,
      sourceDeviceId,
      syncId,
      metrics = {},
      syncMode = 'incremental',
      cursor,
      batchSequence,
      isFinalBatch = true
    } = req.body;

    if (!['health_connect', 'healthkit'].includes(source)) {
      return res.status(400).json({ message: 'source must be health_connect or healthkit' });
    }
    // Matches WearableData.deviceType's enum for the OS-bridge-relevant
    // providers — apple/apple_watch for HealthKit, the rest for Health Connect.
    const validOsProviders = ['noise', 'boat', 'xiaomi', 'samsung', 'apple', 'apple_watch', 'google'];
    if (!validOsProviders.includes(provider)) {
      return res.status(400).json({ message: `provider must be one of: ${validOsProviders.join(', ')}` });
    }
    if (!provider || !syncId || typeof metrics !== 'object' || Array.isArray(metrics)) {
      return res.status(400).json({ message: 'provider, syncId, and metrics are required' });
    }
    if (!['initial', 'incremental'].includes(syncMode) || typeof syncId !== 'string' || syncId.length > 128) {
      return res.status(400).json({ message: 'syncMode or syncId is invalid' });
    }
    if (cursor !== undefined && (typeof cursor !== 'string' || cursor.length > 4096)) {
      return res.status(400).json({ message: 'cursor is invalid' });
    }
    if (batchSequence !== undefined && (!Number.isInteger(batchSequence) || batchSequence < 0)) {
      return res.status(400).json({ message: 'batchSequence must be a non-negative integer' });
    }

    const metricGroups = ['dailyMetrics', 'heartRate', 'sleepData', 'bloodOxygen', 'bodyComposition', 'stress', 'vitals'];
    const records = metricGroups.flatMap(group => Array.isArray(metrics[group]) ? metrics[group] : []);
    if (records.length > 1000) {
      return res.status(413).json({ message: 'A maximum of 1000 records is allowed per sync batch' });
    }
    if (metricGroups.some(group => metrics[group] !== undefined && !Array.isArray(metrics[group]))) {
      return res.status(400).json({ message: 'metric groups must be arrays' });
    }

    const now = Date.now();
    const maxFutureTimestamp = now + (5 * 60 * 1000);
    const requireRecordId = (record, group) => {
      if (typeof record.sourceRecordId !== 'string' || record.sourceRecordId.length < 1 || record.sourceRecordId.length > 256) {
        throw new Error(`${group} records require sourceRecordId`);
      }
    };
    const validateTimestamp = (value, field) => {
      const timestamp = new Date(value);
      if (Number.isNaN(timestamp.getTime()) || timestamp.getTime() > maxFutureTimestamp) {
        throw new Error(`${field} contains an invalid or future timestamp`);
      }
      return timestamp;
    };
    const validateNumber = (value, field, min, max) => {
      if (value === undefined) return;
      const number = Number(value);
      if (!Number.isFinite(number) || number < min || number > max) {
        throw new Error(`${field} is outside the allowed range`);
      }
    };

    for (const metric of metrics.dailyMetrics || []) {
      requireRecordId(metric, 'dailyMetrics');
      validateTimestamp(metric.date, 'dailyMetrics.date');
      validateNumber(metric.steps, 'steps', 0, 200000);
      validateNumber(metric.caloriesBurned, 'caloriesBurned', 0, 10000);
      validateNumber(metric.activeMinutes, 'activeMinutes', 0, 1440);
      validateNumber(metric.distance, 'distance', 0, 1000);
      validateNumber(metric.floorsClimbed, 'floorsClimbed', 0, 500);
    }
    for (const reading of metrics.heartRate || []) {
      requireRecordId(reading, 'heartRate');
      validateTimestamp(reading.timestamp, 'heartRate.timestamp');
      validateNumber(reading.bpm, 'heartRate.bpm', 20, 250);
      if (reading.type && !['resting', 'active', 'peak', 'cardio', 'unspecified'].includes(reading.type)) {
        return res.status(400).json({ message: 'heartRate.type is invalid' });
      }
    }
    for (const sleep of metrics.sleepData || []) {
      requireRecordId(sleep, 'sleepData');
      validateTimestamp(sleep.date, 'sleepData.date');
      for (const field of ['totalSleepMinutes', 'deepSleepMinutes', 'lightSleepMinutes', 'remSleepMinutes', 'awakeMinutes']) {
        validateNumber(sleep[field], `sleepData.${field}`, 0, 1440);
      }
    }
    for (const oxygen of metrics.bloodOxygen || []) {
      requireRecordId(oxygen, 'bloodOxygen');
      validateTimestamp(oxygen.timestamp, 'bloodOxygen.timestamp');
      validateNumber(oxygen.percentage, 'bloodOxygen.percentage', 0, 100);
    }
    for (const composition of metrics.bodyComposition || []) {
      requireRecordId(composition, 'bodyComposition');
      validateTimestamp(composition.timestamp, 'bodyComposition.timestamp');
      validateNumber(composition.weightKg, 'bodyComposition.weightKg', 0, 500);
      validateNumber(composition.bodyFatPercentage, 'bodyComposition.bodyFatPercentage', 0, 100);
      validateNumber(composition.bmi, 'bodyComposition.bmi', 0, 150);
      validateNumber(composition.leanBodyMassKg, 'bodyComposition.leanBodyMassKg', 0, 500);
    }
    for (const stress of metrics.stress || []) {
      requireRecordId(stress, 'stress');
      validateTimestamp(stress.timestamp, 'stress.timestamp');
      validateNumber(stress.level, 'stress.level', 0, 100);
      validateNumber(stress.hrv, 'stress.hrv', 0, 400);
      if (stress.category !== undefined && !['rest', 'low', 'medium', 'high'].includes(stress.category)) {
        return res.status(400).json({ message: 'stress.category is invalid' });
      }
    }
    for (const vitals of metrics.vitals || []) {
      requireRecordId(vitals, 'vitals');
      validateTimestamp(vitals.timestamp, 'vitals.timestamp');
      validateNumber(vitals.respiratoryRate, 'vitals.respiratoryRate', 0, 60);
      // Wide range deliberately: providers report this either as an absolute
      // skin/wrist reading (~25-42°C) or as a delta from personal baseline
      // (typically within a few degrees either side of 0) — see the note on
      // VitalsSample.skinTemperatureCelsius. Reject only clearly-bogus values.
      validateNumber(vitals.skinTemperatureCelsius, 'vitals.skinTemperatureCelsius', -20, 50);
      validateNumber(vitals.bloodPressureSystolic, 'vitals.bloodPressureSystolic', 50, 250);
      validateNumber(vitals.bloodPressureDiastolic, 'vitals.bloodPressureDiastolic', 30, 150);
      if (vitals.ecgClassification !== undefined && !['sinus_rhythm', 'atrial_fibrillation', 'inconclusive', 'other'].includes(vitals.ecgClassification)) {
        return res.status(400).json({ message: 'vitals.ecgClassification is invalid' });
      }
    }

    session = await mongoose.startSession();
    let result;
    // `wearable` is hoisted out so the time-series groups below (which run
    // AFTER the transaction, not inside it — see comment there) can still
    // mirror into its legacy arrays and save once more.
    let wearable;
    await session.withTransaction(async () => {
      const existingReceipt = await WearableSyncReceipt.findOne({
        user: req.user._id,
        source,
        syncId
      }).session(session);
      if (existingReceipt) {
        result = { received: true, duplicate: true, syncId };
        return;
      }

      await WearableSyncReceipt.create([{
        user: req.user._id,
        syncId,
        source,
        provider,
        syncMode,
        cursor,
        batchSequence,
        isFinalBatch
      }], { session });

      wearable = await WearableData.findOne({ user: req.user._id, deviceType: provider }).session(session);
      if (!wearable) {
        wearable = new WearableData({
          user: req.user._id,
          deviceType: provider,
          deviceName: deviceName || provider,
          isConnected: true,
          osHealthSource: source,
          sourceDeviceId
        });
      } else {
        wearable.isConnected = true;
        wearable.deviceName = deviceName || wearable.deviceName;
        wearable.osHealthSource = source;
        wearable.sourceDeviceId = sourceDeviceId || wearable.sourceDeviceId;
      }

      // Dedup + persist + roll up, via the same functions the OpenWearables
      // webhook path uses below — one code path per metric family instead
      // of two that can silently diverge. `wearable` is passed through so
      // the legacy embedded arrays keep getting mirrored during the
      // migration window; session carries the transaction. Only regular
      // (non-time-series) collections belong in here — see below for why.
      await wearableIngest.applyDailyActivity(req.user._id, provider, source, metrics.dailyMetrics || [], { session, wearable });
      await wearableIngest.applyHeartRateSamples(req.user._id, provider, source, metrics.heartRate || [], { session, wearable });
      await wearableIngest.applySleepSessions(req.user._id, provider, source, metrics.sleepData || [], { session, wearable });
      await wearableIngest.applyBodyComposition(req.user._id, provider, source, metrics.bodyComposition || [], { session, wearable });

      wearable.lastSyncedAt = new Date();
      await wearable.save({ session });
      result = { received: true, duplicate: false, syncId, wearableId: wearable._id };
    });

    if (result.duplicate) return res.json(result);

    // Blood oxygen/stress/vitals write to Mongo time-series collections,
    // which (a) cannot join a multi-document transaction at all — MongoDB
    // rejects the insert outright — and (b) must not merely be moved inside
    // the withTransaction callback without a session either: that callback
    // can be retried by the driver on a transient error, and a
    // non-transactional write left in there would silently re-run and risk
    // a duplicate insert on retry. So these run once, here, only after the
    // transaction has definitely committed.
    await wearableIngest.applyBloodOxygenSamples(req.user._id, provider, source, metrics.bloodOxygen || [], { wearable });
    await wearableIngest.applyStressSamples(req.user._id, provider, source, metrics.stress || []);
    await wearableIngest.applyVitalsSamples(req.user._id, provider, source, metrics.vitals || []);
    if (metrics.bloodOxygen?.length) await wearable.save();

    cache.delete(`dashboard:${req.user._id}`);
    cache.deletePattern(`sleep_analytics:${req.user._id}:*`);
    cache.deletePattern(`activity_analytics:${req.user._id}:*`);
    cache.deletePattern(`stress_analytics:${req.user._id}:*`);
    cache.deletePattern(`vitals_analytics:${req.user._id}:*`);
    cache.deletePattern(`recovery_analytics:${req.user._id}:*`);
    require('../utils/scoreRecompute').triggerRecoveryScoreRecompute(req.user._id);
    return res.json(result);
  } catch (error) {
    console.error(`[Wearables] OS sync failed: user=${req.user?._id} error=${error.message}`);
    if (error.code === 11000) {
      return res.json({ received: true, duplicate: true, syncId: req.body?.syncId });
    }
    const validationError = /required|invalid|outside|must be|maximum/.test(error.message);
    res.status(validationError ? 400 : 503).json({ message: error.message });
  } finally {
    if (session) await session.endSession();
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

    const now = new Date();
    await wearableIngest.applyHeartRateSamples(req.user._id, deviceType, 'manual', [{ timestamp: now, bpm, type }], { wearable });

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
    const { deviceType = 'manual', sleepData } = req.body;

    let wearable = await WearableData.findOne({ user: req.user._id, deviceType });
    if (!wearable) {
      if (deviceType === 'manual') {
        wearable = await WearableData.create({
          user: req.user._id,
          deviceType: 'manual',
          deviceName: 'Manual Entry',
          isConnected: false,
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

    // Mirror the resolved (additive-or-replace already settled above) entry
    // into SleepSession — sleepAnalyticsService now reads from there, not
    // the embedded array.
    const resolvedSleep = wearable.sleepData.find(s => dateOnlyUTCFromDate(new Date(s.date)).getTime() === targetDate.getTime());
    if (resolvedSleep) {
      await SleepSession.findOneAndUpdate(
        { user: req.user._id, deviceType, date: targetDate },
        { $set: {
            totalSleepMinutes: resolvedSleep.totalSleepMinutes,
            deepSleepMinutes: resolvedSleep.deepSleepMinutes,
            lightSleepMinutes: resolvedSleep.lightSleepMinutes,
            remSleepMinutes: resolvedSleep.remSleepMinutes,
            awakeMinutes: resolvedSleep.awakeMinutes,
            sleepScore: resolvedSleep.sleepScore,
            bedTime: resolvedSleep.bedTime,
            wakeTime: resolvedSleep.wakeTime,
            source: deviceType
          } },
        { upsert: true }
      );
    }

    // Log fitness activity
    await logActivity(req.user._id, 'LOG_SLEEP_DATA', 'fitness', {
      deviceType,
      totalSleepMinutes: sleepData.totalSleepMinutes,
      remSleepMinutes: sleepData.remSleepMinutes,
      deepSleepMinutes: sleepData.deepSleepMinutes
    });

    // Invalidate server-side dashboard cache so next fetch returns fresh data
    cache.delete(`dashboard:${req.user._id}`);
    cache.deletePattern(`sleep_analytics:${req.user._id}:*`);
    require('../utils/scoreRecompute').triggerDailyScoreRecompute(req.user._id, targetDateString);
    require('../utils/scoreRecompute').triggerRecoveryScoreRecompute(req.user._id, targetDateString);

    res.json(wearable);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get wearable dashboard data
exports.getWearableDashboard = async (req, res) => {
  try {
    const wearables = await WearableData.find({ user: req.user._id, isConnected: true })
      .select('deviceType deviceName lastSyncedAt')
      .lean();

    if (!wearables.length) {
      return res.json({ connected: false, devices: [] });
    }

    const targetDate = new Date();
    targetDate.setUTCHours(0, 0, 0, 0);
    const weekAgoDate = new Date(targetDate);
    weekAgoDate.setUTCDate(weekAgoDate.getUTCDate() - 7);

    // Bounded at the query level now — DailyActivityMetric/SleepSession are
    // one right-sized doc per user+device+day, so "today" / "last 7 days"
    // is a normal indexed range query instead of loading every device's
    // full history and filtering in JS.
    const [todayActivity, todaySleep, recentSleep, weeklyTrend, recentStoredHeartRate] = await Promise.all([
      DailyActivityMetric.find({ user: req.user._id, date: targetDate }).lean(),
      SleepSession.find({ user: req.user._id, date: targetDate }).lean(),
      SleepSession.find({ user: req.user._id, date: { $gte: weekAgoDate } }).sort({ date: -1 }).lean(),
      DailyActivityMetric.find({ user: req.user._id, date: { $gte: weekAgoDate } }).sort({ date: 1 }).lean(),
      HeartRateSample.find({ user: req.user._id })
        .select('deviceType timestamp bpm type source sourceRecordId')
        .sort({ timestamp: -1 })
        .limit(10)
        .lean()
    ]);

    const dashboard = {
      connected: true,
      devices: wearables.map(w => ({
        type: w.deviceType,
        name: w.deviceName,
        lastSynced: w.lastSyncedAt
      })),
      todayMetrics: null,
      recentHeartRate: recentStoredHeartRate,
      recentSleep,
      weeklyTrend
    };

    for (const entry of todayActivity) {
      dashboard.todayMetrics = dashboard.todayMetrics || { steps: 0, caloriesBurned: 0, activeMinutes: 0, distance: 0, sleep: 0 };
      dashboard.todayMetrics.steps += entry.steps || 0;
      dashboard.todayMetrics.caloriesBurned += entry.caloriesBurned || 0;
      dashboard.todayMetrics.activeMinutes += entry.activeMinutes || 0;
      dashboard.todayMetrics.distance += entry.distance || 0;
    }
    for (const entry of todaySleep) {
      dashboard.todayMetrics = dashboard.todayMetrics || { steps: 0, caloriesBurned: 0, activeMinutes: 0, distance: 0, sleep: 0 };
      dashboard.todayMetrics.sleep = (dashboard.todayMetrics.sleep || 0) + (entry.totalSleepMinutes || 0);
    }

    dashboard.recentHeartRate.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Most recent resting-tagged sample among the recent readings pulled above.
    // Best-effort: see upsertHeartRateDailySummary's note on webhook type accuracy.
    dashboard.latestRestingHeartRate = dashboard.recentHeartRate.find((r) => r.type === 'resting') || null;

    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Analytical sleep breakdown (stages, quality score, daily/weekly/monthly/yearly trends)
exports.getSleepAnalyticsData = async (req, res) => {
  try {
    const range = ['daily', 'weekly', 'monthly', 'yearly'].includes(req.query.range)
      ? req.query.range
      : 'daily';
    const { date, startDate, endDate } = req.query;

    const cacheKey = `sleep_analytics:${req.user._id}:${range}:${date || ''}:${startDate || ''}:${endDate || ''}`;
    const data = await cache.getOrSet(
      cacheKey,
      () => getSleepAnalytics(req.user._id, range, { date, startDate, endDate }),
      300
    );

    res.json({ success: true, ...data });
  } catch (error) {
    if (error instanceof SleepAnalyticsInputError) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

// Steps/activity breakdown — device-agnostic: hasWearableConnected tells the UI
// whether a missing/zero reading means "no device" vs "genuinely inactive".
exports.getActivityAnalyticsData = async (req, res) => {
  try {
    const range = ['daily', 'weekly', 'monthly', 'yearly'].includes(req.query.range)
      ? req.query.range
      : 'daily';
    const { date, startDate, endDate } = req.query;

    const cacheKey = `activity_analytics:${req.user._id}:${range}:${date || ''}:${startDate || ''}:${endDate || ''}`;
    const data = await cache.getOrSet(
      cacheKey,
      () => getActivityAnalytics(req.user._id, range, { date, startDate, endDate }),
      300
    );

    res.json({ success: true, ...data });
  } catch (error) {
    if (error instanceof ActivityAnalyticsInputError) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

// Stress breakdown — same daily/weekly/monthly/yearly bucketing as sleep/activity.
exports.getStressAnalyticsData = async (req, res) => {
  try {
    const range = ['daily', 'weekly', 'monthly', 'yearly'].includes(req.query.range)
      ? req.query.range
      : 'daily';
    const { date, startDate, endDate } = req.query;

    const cacheKey = `stress_analytics:${req.user._id}:${range}:${date || ''}:${startDate || ''}:${endDate || ''}`;
    const data = await cache.getOrSet(
      cacheKey,
      () => getStressAnalytics(req.user._id, range, { date, startDate, endDate }),
      300
    );

    res.json({ success: true, ...data });
  } catch (error) {
    if (error instanceof StressAnalyticsInputError) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

// Vitals breakdown (respiratory rate, skin temperature, blood pressure).
exports.getVitalsAnalyticsData = async (req, res) => {
  try {
    const range = ['daily', 'weekly', 'monthly', 'yearly'].includes(req.query.range)
      ? req.query.range
      : 'daily';
    const { date, startDate, endDate } = req.query;

    const cacheKey = `vitals_analytics:${req.user._id}:${range}:${date || ''}:${startDate || ''}:${endDate || ''}`;
    const data = await cache.getOrSet(
      cacheKey,
      () => getVitalsAnalytics(req.user._id, range, { date, startDate, endDate }),
      300
    );

    res.json({ success: true, ...data });
  } catch (error) {
    if (error instanceof VitalsAnalyticsInputError) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

// Recovery score breakdown — recoveryScore + per-component contributions,
// computed by recoveryScoreService and stored in RecoveryDailySummary.
exports.getRecoveryAnalyticsData = async (req, res) => {
  try {
    const range = ['daily', 'weekly', 'monthly', 'yearly'].includes(req.query.range)
      ? req.query.range
      : 'daily';
    const { date, startDate, endDate } = req.query;

    const cacheKey = `recovery_analytics:${req.user._id}:${range}:${date || ''}:${startDate || ''}:${endDate || ''}`;
    const data = await cache.getOrSet(
      cacheKey,
      () => getRecoveryAnalytics(req.user._id, range, { date, startDate, endDate }),
      300
    );

    res.json({ success: true, ...data });
  } catch (error) {
    if (error instanceof RecoveryAnalyticsInputError) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

// Fact-based sleep-goal adherence + a safety note if the user is training
// while under-slept. No calorie/exercise number is adjusted — see sleepInsightService.
// Device-agnostic: reads WearableData.sleepData regardless of whether entries
// came from manual logging or a connected wearable's webhook.
exports.getSleepInsightData = async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user._id).select('profile.lifestyle.sleepGoalHours').lean();
    const sleepGoalHours = user?.profile?.lifestyle?.sleepGoalHours || 8;

    const insight = await getSleepInsight(req.user._id, sleepGoalHours);
    res.json({ success: true, ...insight });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Fact-based step-goal adherence + a separate "vs. your own normal" signal.
// stepGoal is never modified by this — see activityInsightService.
exports.getActivityInsightData = async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user._id).select('profile.lifestyle.stepGoal').lean();
    const stepGoal = user?.profile?.lifestyle?.stepGoal || 10000;

    const insight = await getActivityInsight(req.user._id, stepGoal);
    res.json({ success: true, ...insight });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Daily HR trend across all connected devices, plus a this-week-vs-last-week
// comparison. Reads heartRateDailySummary (not the capped raw heartRate[]),
// so this works regardless of how much raw sample history survived.
exports.getHeartRateTrend = async (req, res) => {
  try {
    const weeks = Math.min(12, Math.max(1, parseInt(req.query.weeks) || 4));
    const days = weeks * 7;

    const cutoff = new Date();
    cutoff.setUTCHours(0, 0, 0, 0);
    cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));

    // Permanent rollup collection, queried by date range directly instead of
    // pulling every device's full heartRateDailySummary history. Response
    // field names (minBpm/maxBpm) are kept exactly as before even though the
    // rollup itself now stores {value, timestamp} — the timestamp is a new
    // addition, not exposed here yet, but is available via HeartRateDailySummary
    // for a future "when did this happen" surface.
    const entries = await HeartRateDailySummary.find({ user: req.user._id, date: { $gte: cutoff } }).lean();

    const byDate = new Map();
    for (const entry of entries) {
      const key = new Date(entry.date).toISOString().split('T')[0];
      const minBpm = entry.min?.value;
      const maxBpm = entry.max?.value;

      const existing = byDate.get(key);
      if (!existing) {
        byDate.set(key, {
          date: key,
          avgBpm: entry.avgBpm,
          minBpm,
          maxBpm,
          readingCount: entry.readingCount || 0
        });
      } else {
        const totalReadings = existing.readingCount + (entry.readingCount || 0);
        existing.avgBpm = totalReadings > 0
          ? Math.round(((existing.avgBpm * existing.readingCount) + (entry.avgBpm * (entry.readingCount || 0))) / totalReadings)
          : existing.avgBpm;
        existing.minBpm = Math.min(existing.minBpm, minBpm);
        existing.maxBpm = Math.max(existing.maxBpm, maxBpm);
        existing.readingCount = totalReadings;
      }
    }

    const dailyTrend = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const thisWeekStart = new Date(today);
    thisWeekStart.setUTCDate(thisWeekStart.getUTCDate() - 6);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setUTCDate(lastWeekEnd.getUTCDate() - 1);

    const summarizeWindow = (points) => {
      if (points.length === 0) return null;
      const avgSum = points.reduce((sum, p) => sum + p.avgBpm, 0);
      return {
        avgBpm: Math.round(avgSum / points.length),
        minBpm: Math.min(...points.map((p) => p.minBpm)),
        maxBpm: Math.max(...points.map((p) => p.maxBpm)),
        daysWithData: points.length
      };
    };

    const thisWeekPoints = dailyTrend.filter((p) => p.date >= thisWeekStart.toISOString().split('T')[0]);
    const lastWeekPoints = dailyTrend.filter(
      (p) => p.date >= lastWeekStart.toISOString().split('T')[0] && p.date <= lastWeekEnd.toISOString().split('T')[0]
    );

    const thisWeek = summarizeWindow(thisWeekPoints);
    const lastWeek = summarizeWindow(lastWeekPoints);

    res.json({
      success: true,
      dailyTrend,
      thisWeek,
      lastWeek,
      avgBpmDelta: (thisWeek && lastWeek) ? thisWeek.avgBpm - lastWeek.avgBpm : null
    });
  } catch (error) {
    console.error('Get heart rate trend error:', error);
    res.status(500).json({ success: false, message: 'Failed to get heart rate trend', error: error.message });
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

    // Generate 14 days of demo data (2 full weeks, so week-over-week HR comparison has data)
    const dailyMetrics = [];
    const heartRate = [];
    const heartRateDailySummary = [];
    const sleepData = [];

    for (let i = 13; i >= 0; i--) {
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
      const dayBpms = [];
      const restingBpms = [];
      for (let h = 0; h < 6; h++) {
        const timestamp = new Date(date);
        timestamp.setHours(8 + h * 2);
        const isResting = Math.random() <= 0.7;
        const bpm = isResting ? Math.floor(58 + Math.random() * 15) : Math.floor(90 + Math.random() * 40);
        dayBpms.push(bpm);
        if (isResting) restingBpms.push(bpm);
        // Only the most recent ~2 days survive the raw-sample cap once real
        // traffic resumes, so this array intentionally isn't the source of
        // truth for trends beyond that — heartRateDailySummary is.
        heartRate.push({
          timestamp,
          bpm,
          type: isResting ? 'resting' : 'active'
        });
      }
      heartRateDailySummary.push({
        date,
        avgBpm: Math.round(dayBpms.reduce((a, b) => a + b, 0) / dayBpms.length),
        minBpm: Math.min(...dayBpms),
        maxBpm: Math.max(...dayBpms),
        readingCount: dayBpms.length,
        restingBpm: restingBpms.length ? Math.min(...restingBpms) : undefined
      });

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
    wearable.heartRateDailySummary = heartRateDailySummary;
    wearable.sleepData = sleepData;
    wearable.lastSyncedAt = new Date();

    await wearable.save();

    // Mirror into the new right-sized collections too — getWearableDashboard/
    // getHeartRateTrend/analytics services read from these now, not the
    // embedded arrays above, so demo data has to land in both during the
    // migration window or it'd silently stop showing up anywhere.
    const dates = dailyMetrics.map(d => d.date);
    await Promise.all([
      DailyActivityMetric.deleteMany({ user: req.user._id, deviceType, date: { $in: dates } }),
      SleepSession.deleteMany({ user: req.user._id, deviceType, date: { $in: dates } }),
      HeartRateDailySummary.deleteMany({ user: req.user._id, deviceType, date: { $in: dates } }),
      HeartRateSample.deleteMany({ user: req.user._id, deviceType, timestamp: { $gte: dates[0] } })
    ]);
    await Promise.all([
      DailyActivityMetric.insertMany(dailyMetrics.map(d => ({ ...d, user: req.user._id, deviceType, source: 'demo' }))),
      SleepSession.insertMany(sleepData.map(s => ({ ...s, user: req.user._id, deviceType, source: 'demo' }))),
      HeartRateDailySummary.insertMany(heartRateDailySummary.map(h => ({
        user: req.user._id,
        deviceType,
        date: h.date,
        avgBpm: h.avgBpm,
        min: { value: h.minBpm, timestamp: h.date },
        max: { value: h.maxBpm, timestamp: h.date },
        readingCount: h.readingCount,
        restingBpm: h.restingBpm != null ? { value: h.restingBpm, timestamp: h.date } : undefined
      }))),
      HeartRateSample.insertMany(heartRate.map(h => ({ ...h, user: req.user._id, deviceType, source: 'demo' })))
    ]);

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
// Apple/Health Connect don't go through our OAuth redirect flow — the mobile
// SDK talks to Open Wearables directly from the device — but it still needs
// to know which Open Wearables user_id maps to this app account, so it can
// tag the data it pushes. Everything downstream (webhook handling, dashboard)
// is already provider-agnostic and needs no changes once this exists.
exports.getMiddlewareUserId = async (req, res) => {
  try {
    const { provider } = req.params;

    if (!openWearablesClient.isConfigured) {
      return res.status(503).json({
        message: 'Wearable device connections are not available yet',
        error: 'OPEN_WEARABLES_NOT_CONFIGURED'
      });
    }

    const wearable = await ensureOpenWearablesUser(req.user._id, provider);
    res.json({ userId: wearable.openWearablesUserId });
  } catch (error) {
    const upstreamStatus = error.response?.status;
    if (!upstreamStatus) {
      console.error('[OpenWearables] unreachable:', error.message);
      return res.status(503).json({
        message: 'Wearable service is temporarily unavailable, please try again',
        error: 'OPEN_WEARABLES_UNREACHABLE'
      });
    }
    console.error(`[OpenWearables] ${upstreamStatus} on /users (getMiddlewareUserId):`, error.response?.data);
    res.status(502).json({ message: 'Could not set up device connection', error: 'OPEN_WEARABLES_ERROR' });
  }
};

exports.getConnectUrl = async (req, res) => {
  try {
    const { provider } = req.params;

    if (!openWearablesClient.isConfigured) {
      return res.status(503).json({
        message: 'Wearable device connections are not available yet',
        error: 'OPEN_WEARABLES_NOT_CONFIGURED'
      });
    }

    const wearable = await ensureOpenWearablesUser(req.user._id, provider);

    // Without this, the OAuth flow dead-ends on Open Wearables' own JSON success
    // page after the provider redirects back — the mobile app never regains control.
    const { data } = await openWearablesClient.get(
      `/oauth/${provider}/authorize`,
      {
        params: {
          user_id: wearable.openWearablesUserId,
          redirect_uri: `takehealth://wearables?provider=${provider}`
        }
      }
    );

    res.json({ url: data.authorization_url });
  } catch (error) {
    // Distinguish "middleware is down/unreachable" from "we sent it something bad",
    // so a client sees a retryable 503 instead of a blanket 500
    const upstreamStatus = error.response?.status;
    if (!upstreamStatus) {
      console.error('[OpenWearables] unreachable:', error.message);
      return res.status(503).json({
        message: 'Wearable service is temporarily unavailable, please try again',
        error: 'OPEN_WEARABLES_UNREACHABLE'
      });
    }

    console.error(
      `[OpenWearables] ${upstreamStatus} on /oauth/${req.params.provider}/authorize:`,
      error.response?.data
    );
    res.status(502).json({
      message: 'Could not start device connection',
      error: 'OPEN_WEARABLES_ERROR',
      detail: error.response?.data?.detail
    });
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
    if (!process.env.OPEN_WEARABLES_WEBHOOK_SECRET) {
      // Without the secret we cannot tell a real event from a forged one, so
      // refuse rather than trust the payload
      console.error('[OpenWearables] OPEN_WEARABLES_WEBHOOK_SECRET missing — rejecting webhook');
      return res.status(503).json({ message: 'Webhook handler not configured' });
    }

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
    const { type, data } = event;

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

    // Open Wearables emits every metric type (97+ `series_type` values —
    // heart rate, VO2 max, running power, UV exposure, ...) through this same
    // generic batch shape, whether or not the switch below has a named case
    // for it. Capturing it here means a metric we don't have a dedicated
    // field for yet still shows up, instead of silently falling through the
    // switch's default case.
    if (data?.series_type && Array.isArray(data.samples)) {
      const wearable = await findWearableDoc(data.user_id, data.provider);
      if (wearable) {
        await wearableIngest.applyGenericMetric(
          wearable.user,
          data.provider,
          data.provider,
          data.samples.map(s => ({ seriesType: data.series_type, value: s.value, unit: s.unit, timestamp: s.timestamp, device: data.source?.device })),
          { wearable }
        );
        wearable.lastSyncedAt = new Date();
        await wearable.save();
      }
    }

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
        console.log(`[Wearables] connection.created: record ${wearable._id} (mongo user=${wearable.user}) set isConnected=true`);
        break;
      }

      case 'connection.revoked': {
        const updated = await WearableData.findOneAndUpdate(
          { openWearablesUserId: data.user_id, deviceType: data.provider },
          { isConnected: false },
          { new: true }
        );
        console.log(`[Wearables] connection.revoked: record ${updated?._id} (mongo user=${updated?.user}) set isConnected=false, reason=${data.reason || 'unspecified'}`);
        break;
      }

      case 'sleep.created': {
        const wearable = await findWearableDoc(data.user_id, data.source?.provider);
        if (wearable) {
          await wearableIngest.applySleepSessions(wearable.user, wearable.deviceType, 'open_wearables', [{
            date: dateOnlyUTC(data.start_time),
            totalSleepMinutes: Math.round(data.duration_seconds / 60),
            deepSleepMinutes: data.stages?.deep_minutes,
            lightSleepMinutes: data.stages?.light_minutes,
            remSleepMinutes: data.stages?.rem_minutes,
            awakeMinutes: data.stages?.awake_minutes,
            bedTime: data.start_time,
            wakeTime: data.end_time,
            sourceRecordId: data.id ? String(data.id) : undefined
          }], { wearable });
          wearable.lastSyncedAt = new Date();
          await wearable.save();
          cache.deletePattern(`sleep_analytics:${wearable.user}:*`);
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
          // Mirror the same totals into the right-sized DailyActivityMetric
          // collection — $inc keeps this an atomic add regardless of write order.
          await DailyActivityMetric.findOneAndUpdate(
            { user: wearable.user, deviceType: wearable.deviceType, date },
            { $inc: {
                caloriesBurned: data.calories_kcal || 0,
                distance: (data.distance_meters || 0) / 1000,
                activeMinutes: Math.round(data.duration_seconds / 60)
              } },
            { upsert: true }
          );

          wearable.workouts.push({
            workoutId: data.id,
            type: data.type,
            startTime: data.start_time,
            endTime: data.end_time,
            durationSeconds: data.duration_seconds,
            caloriesKcal: data.calories_kcal,
            distanceMeters: data.distance_meters,
            avgHeartRateBpm: data.avg_heart_rate_bpm,
            maxHeartRateBpm: data.max_heart_rate_bpm,
            elevationGainMeters: data.elevation_gain_meters,
            provider: data.source?.provider
          });
          await wearableIngest.applyWorkouts(wearable.user, wearable.deviceType, data.source?.provider, [{
            workoutId: String(data.id),
            type: data.type,
            startTime: data.start_time,
            endTime: data.end_time,
            durationSeconds: data.duration_seconds,
            caloriesKcal: data.calories_kcal,
            distanceMeters: data.distance_meters,
            avgHeartRateBpm: data.avg_heart_rate_bpm,
            maxHeartRateBpm: data.max_heart_rate_bpm,
            elevationGainMeters: data.elevation_gain_meters
          }]);

          wearable.lastSyncedAt = new Date();
          await wearable.save();
          cache.deletePattern(`activity_analytics:${wearable.user}:*`);
        }
        break;
      }

      case 'heart_rate.created': {
        const wearable = await findWearableDoc(data.user_id, data.provider);
        if (wearable) {
          const readings = data.samples
            .filter(sample => sample.type === 'heart_rate')
            .map(sample => ({
              timestamp: sample.timestamp,
              bpm: sample.value,
              type: classifyHeartRateContext(sample.context),
              sourceRecordId: sample.id ? String(sample.id) : undefined
            }));
          await wearableIngest.applyHeartRateSamples(wearable.user, wearable.deviceType, 'open_wearables', readings, { wearable });
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
            await DailyActivityMetric.findOneAndUpdate(
              { user: wearable.user, deviceType: wearable.deviceType, date },
              sample.is_daily_total ? { $set: { steps: sample.value } } : { $inc: { steps: sample.value } },
              { upsert: true }
            );
          }
          wearable.markModified('dailyMetrics');
          wearable.lastSyncedAt = new Date();
          await wearable.save();
          cache.deletePattern(`activity_analytics:${wearable.user}:*`);
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
            await DailyActivityMetric.findOneAndUpdate(
              { user: wearable.user, deviceType: wearable.deviceType, date },
              sample.is_daily_total ? { $set: { caloriesBurned: sample.value } } : { $inc: { caloriesBurned: sample.value } },
              { upsert: true }
            );
          }
          wearable.markModified('dailyMetrics');
          wearable.lastSyncedAt = new Date();
          await wearable.save();
          cache.deletePattern(`activity_analytics:${wearable.user}:*`);
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
          await wearableIngest.applyBodyComposition(wearable.user, wearable.deviceType, 'open_wearables', Array.from(byTimestamp.values()), { wearable });
          wearable.lastSyncedAt = new Date();
          await wearable.save();
        }
        break;
      }

      case 'spo2.created': {
        const wearable = await findWearableDoc(data.user_id, data.provider);
        if (wearable) {
          const readings = data.samples
            .filter(sample => sample.type === 'oxygen_saturation')
            .map(sample => ({ timestamp: sample.timestamp, percentage: sample.value }));
          await wearableIngest.applyBloodOxygenSamples(wearable.user, wearable.deviceType, 'open_wearables', readings, { wearable });
          wearable.lastSyncedAt = new Date();
          await wearable.save();
        }
        break;
      }

      // NOTE: 'stress.created' and 'respiratory_rate'/'skin_temperature'/
      // 'blood_pressure' event names/shapes below follow the same
      // `<metric>.created` + samples[] convention every other named case in
      // this switch uses — same as ensureOpenWearablesUser's /users call
      // above, verify the exact event name/payload against Open Wearables'
      // docs once stress/vitals are live there. Until then, any real event
      // under a different name still isn't lost — it falls through to the
      // generic series_type/samples capture at the top of this handler and
      // lands in WearableMetricSample instead of a dedicated collection.
      case 'stress.created': {
        const wearable = await findWearableDoc(data.user_id, data.provider);
        if (wearable) {
          const readings = (data.samples || []).map(sample => ({
            timestamp: sample.timestamp,
            level: sample.value,
            category: sample.category,
            hrv: sample.hrv,
            sourceRecordId: sample.id ? String(sample.id) : undefined
          }));
          await wearableIngest.applyStressSamples(wearable.user, wearable.deviceType, 'open_wearables', readings);
          wearable.lastSyncedAt = new Date();
          await wearable.save();
          cache.deletePattern(`stress_analytics:${wearable.user}:*`);
          require('../utils/scoreRecompute').triggerRecoveryScoreRecompute(wearable.user);
        }
        break;
      }

      case 'respiratory_rate.created':
      case 'skin_temperature.created':
      case 'blood_pressure.created': {
        const wearable = await findWearableDoc(data.user_id, data.provider);
        if (wearable) {
          const readings = (data.samples || []).map(sample => {
            const reading = { timestamp: sample.timestamp, sourceRecordId: sample.id ? String(sample.id) : undefined };
            if (type === 'respiratory_rate.created') reading.respiratoryRate = sample.value;
            if (type === 'skin_temperature.created') reading.skinTemperatureCelsius = sample.value;
            if (type === 'blood_pressure.created') {
              reading.bloodPressureSystolic = sample.systolic;
              reading.bloodPressureDiastolic = sample.diastolic;
            }
            return reading;
          });
          await wearableIngest.applyVitalsSamples(wearable.user, wearable.deviceType, 'open_wearables', readings);
          wearable.lastSyncedAt = new Date();
          await wearable.save();
          cache.deletePattern(`vitals_analytics:${wearable.user}:*`);
          require('../utils/scoreRecompute').triggerRecoveryScoreRecompute(wearable.user);
        }
        break;
      }

      default:
        // Event type we don't map yet — acknowledge so Svix doesn't retry, but do nothing
        break;
    }

    // Any data event proves the connection is live, and Open Wearables doesn't
    // reliably send connection.created for an account it's already linked to a
    // different internal user (seen when the same Google account gets connected
    // from a second app account) — so mirror isConnected off real traffic too,
    // not just the explicit connection lifecycle events.
    const wearableForCache = data.user_id
      ? await WearableData.findOne({ openWearablesUserId: data.user_id })
      : null;
    if (wearableForCache) {
      if (type !== 'connection.revoked' && !wearableForCache.isConnected) {
        wearableForCache.isConnected = true;
        await wearableForCache.save();
        console.log(`[Wearables] isConnected repaired to true for record ${wearableForCache._id} via ${type} event`);
      }
      cache.delete(`dashboard:${wearableForCache.user}`);
    }

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
