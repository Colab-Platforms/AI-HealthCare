const WearableData = require('../models/WearableData');

// Single-active-device rule: a user may have at most one WearableData doc
// with isConnected:true at a time. Checked right before every place that
// would otherwise set isConnected = true, so a second device is blocked at
// the moment it tries to become "the" connected one, rather than silently
// co-existing with the first (which used to let steps/sleep/etc. get
// double-counted across devices — see the DailyActivityMetric merge fixes).
//
// Shared between controllers/wearableController.js (manual connect, os-sync,
// webhook connection.created, webhook self-heal) and
// services/wearableScoreSyncService.js's reconcileOneConnection — that
// reconcile job independently flips a device back to isConnected:true
// whenever Open Wearables still reports it "active" on their side (which
// happens for every device we "disconnect" locally, since a local disconnect
// never revokes the connection on Open Wearables' end) and used to do so
// with no awareness of this rule at all, silently undoing a disconnect and
// landing two devices connected again within one cron cycle.
//
// Returns the OTHER connected device (if any), or null if connecting is safe.
async function findBlockingConnection(userId, deviceType, session) {
  return WearableData.findOne({ user: userId, isConnected: true, deviceType: { $ne: deviceType } })
    .select('deviceType deviceName')
    .session(session || null);
}

module.exports = { findBlockingConnection };
