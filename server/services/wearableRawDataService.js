// Read-only raw-data access for WearableMetricSample/WearableScoreSample —
// the two collections Whoop (and other OAuth-connected providers) write to
// via the generic ingestion path, which until now had no app-facing API at
// all (see WHOOP_MISSING_METRICS_DIAGNOSTIC.md §6/§4). Deliberately NOT
// aggregated/scored — "raw" means the app gets exactly what's in Mongo,
// same shape across providers, no interpretation.
//
// Date-window validation mirrors recoveryAnalyticsService.resolveWindow's
// shape (regex + span cap + startDate/endDate-or-default-30d), but targets a
// real Date field (`timestamp`) instead of that service's string-keyed date,
// since these two collections store actual Date objects.

const WearableMetricSample = require('../models/WearableMetricSample');
const WearableScoreSample = require('../models/WearableScoreSample');

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SPAN_DAYS = 90;
const MAX_ROWS = 1000;

class WearableRawDataInputError extends Error {}

function resolveDateWindow({ startDate, endDate }) {
  for (const [label, val] of [['startDate', startDate], ['endDate', endDate]]) {
    if (val !== undefined && !DATE_ONLY_RE.test(val)) {
      throw new WearableRawDataInputError(`${label} must be in YYYY-MM-DD format`);
    }
  }

  const endStr = endDate || new Date().toISOString().split('T')[0];
  let startStr = startDate;
  if (!startStr) {
    const d = new Date(`${endStr}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 30);
    startStr = d.toISOString().split('T')[0];
  }

  if (endStr < startStr) {
    throw new WearableRawDataInputError('endDate must not be before startDate');
  }
  const spanDays = (new Date(`${endStr}T00:00:00.000Z`) - new Date(`${startStr}T00:00:00.000Z`)) / 86400000;
  if (spanDays > MAX_SPAN_DAYS) {
    throw new WearableRawDataInputError(`Date range too large — max ${MAX_SPAN_DAYS} days`);
  }

  // end is exclusive-of-next-day (i.e. inclusive of the whole endDate) —
  // matches the start-inclusive/end-exclusive convention used elsewhere in
  // this codebase (e.g. getWearableDashboard's weekAgoDate/nextDate).
  const gte = new Date(`${startStr}T00:00:00.000Z`);
  const lt = new Date(`${endStr}T00:00:00.000Z`);
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

function parseTypesParam(types) {
  if (!types) return null;
  const list = String(types).split(',').map((t) => t.trim()).filter(Boolean);
  return list.length ? list : null;
}

async function getRawMetrics(userId, { startDate, endDate, types } = {}) {
  const { gte, lt } = resolveDateWindow({ startDate, endDate });
  const typeList = parseTypesParam(types);

  const query = { user: userId, timestamp: { $gte: gte, $lt: lt } };
  if (typeList) query['meta.seriesType'] = { $in: typeList };

  const rows = await WearableMetricSample.find(query)
    .select('meta.deviceType meta.seriesType meta.provider timestamp value unit isDailyTotal')
    .sort({ timestamp: -1 })
    .limit(MAX_ROWS)
    .lean();

  return rows.map((r) => ({
    deviceType: r.meta.deviceType,
    provider: r.meta.provider,
    seriesType: r.meta.seriesType,
    value: r.value,
    unit: r.unit,
    timestamp: r.timestamp,
    isDailyTotal: r.isDailyTotal || false,
  }));
}

async function getRawScores(userId, { startDate, endDate, category } = {}) {
  const { gte, lt } = resolveDateWindow({ startDate, endDate });

  const query = { user: userId, timestamp: { $gte: gte, $lt: lt } };
  if (category) query['meta.category'] = category;

  const rows = await WearableScoreSample.find(query)
    .select('meta.deviceType meta.category meta.provider timestamp value qualifier components')
    .sort({ timestamp: -1 })
    .limit(MAX_ROWS)
    .lean();

  return rows.map((r) => ({
    deviceType: r.meta.deviceType,
    provider: r.meta.provider,
    category: r.meta.category,
    value: r.value,
    qualifier: r.qualifier,
    components: r.components,
    timestamp: r.timestamp,
  }));
}

module.exports = { getRawMetrics, getRawScores, WearableRawDataInputError };
