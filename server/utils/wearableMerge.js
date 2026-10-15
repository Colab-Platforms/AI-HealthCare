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

module.exports = { mergeDeviceRows };
