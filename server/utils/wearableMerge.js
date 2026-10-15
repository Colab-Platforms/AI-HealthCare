// Merges same-date rows from DailyActivityMetric/SleepSession (one row per
// user+deviceType+day) into a single value per field.
//
// Two different situations land here and need OPPOSITE treatment:
//
// 1. Two REAL devices (deviceType !== 'manual') for the same date — since
//    controllers/wearableController.js's findBlockingConnection() blocks a
//    second device from ever becoming isConnected:true while one already is,
//    two real-device rows on the same date can only mean a clean switch
//    (disconnect A, connect B, same day) — their tracked windows cannot
//    overlap by construction, so their numbers are genuinely additive. SUM.
//
// 2. A manual entry alongside a real device — manual logging isn't gated by
//    the connection lock at all (it never sets isConnected), so it can
//    coexist with a connected device freely. Here we can't tell whether the
//    manual number duplicates what the device already counted (e.g. the user
//    re-typing their step count) or is genuinely separate. Safer to assume
//    overlap and take the larger one rather than risk double-counting. MAX.
//
// Combined rule: sum every real-device row, then take the max of that sum
// against the manual row (if any) — never add manual on top of the device
// total.
function mergeDeviceRows(rows, fields) {
  const result = {};
  for (const field of fields) result[field] = 0;
  if (!rows || rows.length === 0) return result;

  let deviceSum = null;
  let manualRow = null;

  for (const row of rows) {
    if (row.deviceType === 'manual') {
      manualRow = row;
      continue;
    }
    if (!deviceSum) {
      deviceSum = {};
      for (const field of fields) deviceSum[field] = 0;
    }
    for (const field of fields) deviceSum[field] += Number(row[field]) || 0;
  }

  for (const field of fields) {
    const deviceValue = deviceSum ? deviceSum[field] : 0;
    const manualValue = manualRow ? Number(manualRow[field]) || 0 : 0;
    result[field] = Math.max(deviceValue, manualValue);
  }

  return result;
}

// For metrics that represent ONE continuous event rather than accumulation
// across a day — sleep is the case this exists for. Steps/calories/active
// minutes genuinely add up across a day's separate windows (hence
// mergeDeviceRows' sum-real-devices rule above), but a night's sleep can't
// be split into two non-overlapping real sessions the way daytime activity
// can — a device doesn't get swapped mid-sleep. Two SleepSession rows for
// the same date almost always mean two devices measuring the SAME sleep, so
// summing them double-counts it (confirmed live: WHOOP correctly measured
// 7.8h one night while a Health Connect sync for the same night reported
// ~14.7h — summing them would have shown ~22.5h slept). Always max, device
// or manual, never add.
function maxAcrossRows(rows, fields) {
  const result = {};
  for (const field of fields) result[field] = 0;
  if (!rows || rows.length === 0) return result;

  for (const field of fields) {
    result[field] = rows.reduce((max, row) => Math.max(max, Number(row[field]) || 0), 0);
  }
  return result;
}

// For a "whole row" metric where the fields only make sense together — sleep
// again: bedTime, wakeTime, and the deep/light/REM stage breakdown are one
// coherent set from a single device, not independently combinable numbers.
// Two rows for the same date are the same night measured twice, so this
// keeps whichever WHOLE row has the highest value of `pickField` (default
// totalSleepMinutes) as that date's canonical row, instead of frankensteining
// fields from different rows together.
function collapseToOnePerDay(rows, { dateField = 'date', pickField = 'totalSleepMinutes' } = {}) {
  const byDate = new Map();
  for (const row of rows || []) {
    const key = new Date(row[dateField]).toISOString().split('T')[0];
    const existing = byDate.get(key);
    if (!existing || (Number(row[pickField]) || 0) > (Number(existing[pickField]) || 0)) {
      byDate.set(key, row);
    }
  }
  return Array.from(byDate.values());
}

// A device reporting more sleep than this for one night isn't a longer real
// sleep, it's a broken sync — confirmed live: a Health Connect import
// repeatedly reported ~14.7h for nights WHOOP correctly measured at 7-8.5h,
// most likely double-counting a stage or syncing a stale duplicate record.
// 14h is already a generous ceiling (rare but real for illness/extreme
// recovery) — anything past it is excluded rather than trusted, so a single
// broken device can't out-vote every other reading via maxAcrossRows/
// collapseToOnePerDay just because it reports the biggest number.
const MAX_PLAUSIBLE_SLEEP_MINUTES = 840; // 14h

// Call this on sleep rows BEFORE passing them to maxAcrossRows/
// collapseToOnePerDay — those two just trust "biggest number wins", which a
// consistently-inflated device would win every time. This drops any
// obviously-broken reading first, so a real device's correct number is
// compared only against other plausible numbers.
function filterPlausibleSleep(rows) {
  if (!rows || rows.length === 0) return rows || [];
  const plausible = rows.filter((r) => (Number(r.totalSleepMinutes) || 0) <= MAX_PLAUSIBLE_SLEEP_MINUTES);
  if (plausible.length > 0) return plausible;
  // Every row for this night is implausible — still show a number rather
  // than nothing, but capped at the ceiling instead of the raw broken value.
  const leastBad = rows.reduce((min, r) => (
    (Number(r.totalSleepMinutes) || 0) < (Number(min.totalSleepMinutes) || 0) ? r : min
  ), rows[0]);
  return [{ ...leastBad, totalSleepMinutes: MAX_PLAUSIBLE_SLEEP_MINUTES }];
}

module.exports = { mergeDeviceRows, maxAcrossRows, collapseToOnePerDay, filterPlausibleSleep, MAX_PLAUSIBLE_SLEEP_MINUTES };
