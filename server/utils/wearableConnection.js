const WearableData = require('../models/WearableData');

// Single-active-device rule: a user may have at most one WearableData doc
// with isConnected:true at a time. Enforced by auto-switching — connecting a
// new device disconnects whichever other device currently holds the slot,
// rather than rejecting the new connection. Called right before every place
// that would otherwise set isConnected = true, so the slot is freed first.
//
// Shared between controllers/wearableController.js (manual connect, os-sync,
// webhook connection.created, webhook self-heal) and
// services/wearableScoreSyncService.js's reconcileOneConnection — that
// reconcile job independently flips a device back to isConnected:true
// whenever Open Wearables still reports it "active" on their side (which
// happens for every device we "disconnect" locally, since a local disconnect
// never revokes the connection on Open Wearables' end), so it needs the same
// switch-over call as the explicit connect paths.
async function disconnectOtherDevices(userId, deviceType, session) {
  await WearableData.updateMany(
    { user: userId, isConnected: true, deviceType: { $ne: deviceType } },
    { $set: { isConnected: false } },
    { session: session || undefined }
  );
}

// Returns the OTHER currently connected device (if any), or null — read-only,
// used only where we want to know/report what's about to be switched away
// from, not to block anything.
async function findBlockingConnection(userId, deviceType, session) {
  return WearableData.findOne({ user: userId, isConnected: true, deviceType: { $ne: deviceType } })
    .select('deviceType deviceName')
    .session(session || null);
}

module.exports = { disconnectOtherDevices, findBlockingConnection };
