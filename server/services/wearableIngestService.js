// One write path per metric family, shared by both ingestion routes
// (OS-health /os-sync bridge and the OpenWearables webhook) instead of each
// re-implementing dedup + rollup logic slightly differently. Every function:
//   1. Dedupes by sourceRecordId (application-level — time-series
//      collections don't support unique secondary indexes).
//   2. Writes the normalized record to its dedicated collection.
//   3. Updates that day's permanent rollup (min/max now carry a timestamp,
//      not just a value, so "when" survives past any raw-sample TTL).
//   4. Optionally mirrors the write onto a legacy WearableData doc so
//      existing embedded-array readers keep working during the migration
//      window — pass `wearable` to enable this; omit it once dual-write is
//      no longer needed.
//
// Callers own transaction/session and cache invalidation; these functions
// only touch data.

const DailyActivityMetric = require('../models/DailyActivityMetric');
const SleepSession = require('../models/SleepSession');
const Workout = require('../models/Workout');
const BodyCompositionSample = require('../models/BodyCompositionSample');
const BloodOxygenSample = require('../models/BloodOxygenSample');
const StressSample = require('../models/StressSample');
const VitalsSample = require('../models/VitalsSample');
const WearableMetricSample = require('../models/WearableMetricSample');
const HeartRateSample = require('../models/HeartRateSample');
const HeartRateDailySummary = require('../models/HeartRateDailySummary');
const StressDailySummary = require('../models/StressDailySummary');
const VitalsDailySummary = require('../models/VitalsDailySummary');

function dateOnlyUTC(value) {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Generic "roll one numeric reading into today's running avg/min/max" —
// same incremental-average math WearableData.heartRateDailySummary already
// used, now shared and now tracking when min/max occurred.
async function upsertNumericDailySummary(Model, key, value, timestamp, avgField, session) {
  const numValue = Number(value);
  if (!Number.isFinite(numValue)) return;

  const doc = await Model.findOne(key).session(session || null);
  if (!doc) {
    await Model.create([{
      ...key,
      [avgField]: numValue,
      min: { value: numValue, timestamp },
      max: { value: numValue, timestamp },
      readingCount: 1
    }], { session });
    return;
  }

  const newCount = (doc.readingCount || 0) + 1;
  doc[avgField] = Math.round((((doc[avgField] || 0) * (doc.readingCount || 0)) + numValue) / newCount);
  if (doc.min?.value == null || numValue < doc.min.value) doc.min = { value: numValue, timestamp };
  if (doc.max?.value == null || numValue > doc.max.value) doc.max = { value: numValue, timestamp };
  doc.readingCount = newCount;
  await doc.save({ session });
}

// --- Heart rate ------------------------------------------------------------

async function applyHeartRateSamples(userId, deviceType, source, readings, { session, wearable } = {}) {
  for (const reading of readings) {
    // Don't default an unlabeled reading to 'resting' — that's what caused
    // the restingBpm contamination bug (see classifyHeartRateContext in
    // wearableController.js). Callers that know a reading is genuinely at
    // rest must say so explicitly via reading.type.
    const type = reading.type || 'unspecified';
    const filter = { user: userId, deviceType };
    if (reading.sourceRecordId) filter.sourceRecordId = reading.sourceRecordId;
    const exists = reading.sourceRecordId ? await HeartRateSample.exists(filter).session(session || null) : null;
    if (exists) continue;

    await HeartRateSample.create([{
      user: userId,
      deviceType,
      timestamp: reading.timestamp,
      bpm: Number(reading.bpm),
      type,
      source,
      sourceRecordId: reading.sourceRecordId
    }], { session });

    const date = dateOnlyUTC(reading.timestamp);
    await upsertNumericDailySummary(
      HeartRateDailySummary,
      { user: userId, deviceType, date },
      reading.bpm,
      reading.timestamp,
      'avgBpm',
      session
    );
    if (type === 'resting') {
      const summary = await HeartRateDailySummary.findOne({ user: userId, deviceType, date }).session(session || null);
      if (summary && (summary.restingBpm?.value == null || Number(reading.bpm) < summary.restingBpm.value)) {
        summary.restingBpm = { value: Number(reading.bpm), timestamp: reading.timestamp };
        await summary.save({ session });
      }
    }

    if (wearable) {
      wearable.heartRate.push({ timestamp: reading.timestamp, bpm: Number(reading.bpm), type, source, sourceRecordId: reading.sourceRecordId });
      wearable.markModified('heartRate');
    }
  }
}

// --- Sleep -------------------------------------------------------------

async function applySleepSessions(userId, deviceType, source, sessions, { session, wearable } = {}) {
  for (const entry of sessions) {
    const date = dateOnlyUTC(entry.date);
    const values = {
      totalSleepMinutes: entry.totalSleepMinutes,
      deepSleepMinutes: entry.deepSleepMinutes,
      lightSleepMinutes: entry.lightSleepMinutes,
      remSleepMinutes: entry.remSleepMinutes,
      awakeMinutes: entry.awakeMinutes,
      sleepScore: entry.sleepScore,
      bedTime: entry.bedTime,
      wakeTime: entry.wakeTime,
      source,
      sourceRecordId: entry.sourceRecordId
    };
    await SleepSession.findOneAndUpdate(
      { user: userId, deviceType, date },
      { $set: values },
      { upsert: true, new: true, session }
    );

    if (wearable && !wearable.sleepData.some(s => entry.sourceRecordId && s.sourceRecordId === entry.sourceRecordId)) {
      wearable.sleepData.push({ ...entry, date, source });
      wearable.markModified('sleepData');
    }
  }
}

// --- Daily activity (steps/calories/etc.) -------------------------------

async function applyDailyActivity(userId, deviceType, source, records, { session, wearable, additive = false } = {}) {
  for (const record of records) {
    const date = dateOnlyUTC(record.date);
    const fields = ['steps', 'caloriesBurned', 'activeMinutes', 'distance', 'floorsClimbed'];
    const update = {};
    for (const field of fields) {
      if (record[field] === undefined) continue;
      update[field] = additive ? undefined : Number(record[field]);
    }

    if (additive) {
      const existing = await DailyActivityMetric.findOne({ user: userId, deviceType, date }).session(session || null);
      for (const field of fields) {
        if (record[field] === undefined) continue;
        update[field] = (existing?.[field] || 0) + Number(record[field]);
      }
    }

    await DailyActivityMetric.findOneAndUpdate(
      { user: userId, deviceType, date },
      { $set: { ...update, source, sourceRecordId: record.sourceRecordId } },
      { upsert: true, new: true, session }
    );

    if (wearable) {
      const sameDay = wearable.dailyMetrics.find(m => dateOnlyUTC(m.date).getTime() === date.getTime());
      if (sameDay) Object.assign(sameDay, update);
      else wearable.dailyMetrics.push({ date, source, sourceRecordId: record.sourceRecordId, ...update });
      wearable.markModified('dailyMetrics');
    }
  }
}

// --- Body composition ------------------------------------------------------

async function applyBodyComposition(userId, deviceType, source, samples, { session, wearable } = {}) {
  for (const sample of samples) {
    if (sample.sourceRecordId) {
      const exists = await BodyCompositionSample.exists({ user: userId, deviceType, sourceRecordId: sample.sourceRecordId }).session(session || null);
      if (exists) continue;
    }
    await BodyCompositionSample.create([{
      user: userId,
      deviceType,
      timestamp: sample.timestamp,
      weightKg: sample.weightKg,
      bodyFatPercentage: sample.bodyFatPercentage,
      bmi: sample.bmi,
      leanBodyMassKg: sample.leanBodyMassKg,
      source,
      sourceRecordId: sample.sourceRecordId
    }], { session });

    if (wearable && !wearable.bodyComposition.some(b => sample.sourceRecordId && b.sourceRecordId === sample.sourceRecordId)) {
      wearable.bodyComposition.push({ ...sample, source });
      wearable.markModified('bodyComposition');
    }
  }
}

// --- Workouts ------------------------------------------------------------

async function applyWorkouts(userId, deviceType, provider, workouts, { session, wearable } = {}) {
  for (const w of workouts) {
    await Workout.findOneAndUpdate(
      { user: userId, deviceType, workoutId: w.workoutId },
      { $set: { ...w, provider } },
      { upsert: true, new: true, session }
    );

    if (wearable) {
      wearable.workouts.push({ ...w, provider });
      wearable.markModified('workouts');
    }
  }
}

// --- Blood oxygen ----------------------------------------------------------

// No session param — BloodOxygenSample is a Mongo time-series collection,
// and time-series inserts cannot join a multi-document transaction (this bit
// us in practice: MongoDB rejects it outright). Callers must not run this
// inside session.withTransaction()'s callback either — that callback can be
// retried by the driver on transient errors, and a non-transactional write
// re-run on retry risks a duplicate insert (the sourceRecordId check below
// is best-effort, not atomic with the insert).
async function applyBloodOxygenSamples(userId, deviceType, source, samples, { wearable } = {}) {
  for (const sample of samples) {
    if (sample.sourceRecordId) {
      const exists = await BloodOxygenSample.exists({ user: userId, 'meta.deviceType': deviceType, sourceRecordId: sample.sourceRecordId });
      if (exists) continue;
    }
    await BloodOxygenSample.create({
      user: userId,
      meta: { deviceType, source },
      timestamp: sample.timestamp,
      percentage: Number(sample.percentage),
      sourceRecordId: sample.sourceRecordId
    });

    if (wearable && !wearable.bloodOxygen.some(o => sample.sourceRecordId && o.sourceRecordId === sample.sourceRecordId)) {
      wearable.bloodOxygen.push({ timestamp: sample.timestamp, percentage: Number(sample.percentage), source, sourceRecordId: sample.sourceRecordId });
      wearable.markModified('bloodOxygen');
    }
  }
}

// --- Stress (greenfield — no legacy mirror) ---------------------------------

async function applyStressSamples(userId, deviceType, source, samples) {
  for (const sample of samples) {
    if (sample.sourceRecordId) {
      const exists = await StressSample.exists({ user: userId, 'meta.deviceType': deviceType, sourceRecordId: sample.sourceRecordId });
      if (exists) continue;
    }
    await StressSample.create({
      user: userId,
      meta: { deviceType, source },
      timestamp: sample.timestamp,
      level: sample.level,
      category: sample.category,
      hrv: sample.hrv,
      sourceRecordId: sample.sourceRecordId
    });

    const date = dateOnlyUTC(sample.timestamp);
    await upsertNumericDailySummary(
      StressDailySummary,
      { user: userId, deviceType, date },
      sample.level,
      sample.timestamp,
      'avgLevel'
    );
    if (sample.category === 'high') {
      await StressDailySummary.updateOne({ user: userId, deviceType, date }, { $inc: { highStressMinutes: 1 } });
    }
  }
}

// --- Vitals (greenfield — no legacy mirror) --------------------------------

async function applyVitalsSamples(userId, deviceType, source, samples) {
  for (const sample of samples) {
    if (sample.sourceRecordId) {
      const exists = await VitalsSample.exists({ user: userId, 'meta.deviceType': deviceType, sourceRecordId: sample.sourceRecordId });
      if (exists) continue;
    }
    await VitalsSample.create({
      user: userId,
      meta: { deviceType, source },
      timestamp: sample.timestamp,
      respiratoryRate: sample.respiratoryRate,
      skinTemperatureCelsius: sample.skinTemperatureCelsius,
      bloodPressureSystolic: sample.bloodPressureSystolic,
      bloodPressureDiastolic: sample.bloodPressureDiastolic,
      ecgClassification: sample.ecgClassification,
      sourceRecordId: sample.sourceRecordId
    });

    const date = dateOnlyUTC(sample.timestamp);
    const doc = await VitalsDailySummary.findOneAndUpdate(
      { user: userId, deviceType, date },
      { $setOnInsert: { readingCount: 0, respiratoryRateCount: 0, skinTemperatureCount: 0 } },
      { upsert: true, new: true }
    );
    // Each field's average is divided by how many samples actually reported
    // THAT field, not by the total samples processed that day — a sample
    // with only skinTemperature must not dilute avgRespiratoryRate as if it
    // were a respiratoryRate reading of 0.
    if (sample.respiratoryRate != null) {
      const newRrCount = (doc.respiratoryRateCount || 0) + 1;
      doc.avgRespiratoryRate = Math.round((((doc.avgRespiratoryRate || 0) * (doc.respiratoryRateCount || 0)) + sample.respiratoryRate) / newRrCount);
      doc.respiratoryRateCount = newRrCount;
    }
    if (sample.skinTemperatureCelsius != null) {
      const newTempCount = (doc.skinTemperatureCount || 0) + 1;
      doc.avgSkinTemperatureCelsius = (((doc.avgSkinTemperatureCelsius || 0) * (doc.skinTemperatureCount || 0)) + sample.skinTemperatureCelsius) / newTempCount;
      doc.skinTemperatureCount = newTempCount;
    }
    if (sample.bloodPressureSystolic != null && sample.bloodPressureDiastolic != null) {
      if (!doc.bloodPressure?.min?.systolic || sample.bloodPressureSystolic < doc.bloodPressure.min.systolic) {
        doc.bloodPressure = doc.bloodPressure || {};
        doc.bloodPressure.min = { systolic: sample.bloodPressureSystolic, diastolic: sample.bloodPressureDiastolic, timestamp: sample.timestamp };
      }
      if (!doc.bloodPressure?.max?.systolic || sample.bloodPressureSystolic > doc.bloodPressure.max.systolic) {
        doc.bloodPressure = doc.bloodPressure || {};
        doc.bloodPressure.max = { systolic: sample.bloodPressureSystolic, diastolic: sample.bloodPressureDiastolic, timestamp: sample.timestamp };
      }
    }
    doc.readingCount = (doc.readingCount || 0) + 1;
    await doc.save();
  }
}

// --- Generic catch-all (replaces WearableData.metrics[]) -------------------

async function applyGenericMetric(userId, deviceType, provider, samples, { wearable } = {}) {
  for (const sample of samples) {
    await WearableMetricSample.create({
      user: userId,
      meta: { deviceType, seriesType: sample.seriesType, provider, device: sample.device },
      timestamp: sample.timestamp,
      value: sample.value,
      unit: sample.unit
    });

    if (wearable) {
      wearable.metrics.push({ seriesType: sample.seriesType, value: sample.value, unit: sample.unit, timestamp: sample.timestamp, provider, device: sample.device });
    }
  }
}

module.exports = {
  applyHeartRateSamples,
  applySleepSessions,
  applyDailyActivity,
  applyBodyComposition,
  applyWorkouts,
  applyBloodOxygenSamples,
  applyStressSamples,
  applyVitalsSamples,
  applyGenericMetric
};
