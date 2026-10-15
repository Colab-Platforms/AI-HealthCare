// One-time cleanup for the single-active-device rule added in
// controllers/wearableController.js (findBlockingConnection). That rule only
// stops NEW connects going forward — it doesn't retroactively fix users who
// already had more than one WearableData doc with isConnected:true before
// the rule existed (confirmed live: one user had manual + google + whoop all
// isConnected:true at once).
//
// For every user with more than one connected device, keeps the one with the
// most recent lastSyncedAt as isConnected:true and sets the rest to false.
//
// Dry-run by default — prints what WOULD change without writing anything.
// Pass --apply to actually write.
//
// Usage:
//   node scripts/fixMultipleConnectedDevices.js          (dry run)
//   node scripts/fixMultipleConnectedDevices.js --apply   (writes)

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const WearableData = require('../models/WearableData');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const APPLY = process.argv.includes('--apply');

(async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URI_STAGING;
  if (!mongoUri) {
    console.error('MONGODB_URI or MONGODB_URI_STAGING must be set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 30000, family: 4 });

  const groups = await WearableData.aggregate([
    { $match: { isConnected: true } },
    { $group: { _id: '$user', count: { $sum: 1 }, docs: { $push: { _id: '$_id', deviceType: '$deviceType', lastSyncedAt: '$lastSyncedAt' } } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${groups.length} user(s) with more than one connected device`);

  let usersFixed = 0;
  let devicesDisconnected = 0;

  for (const group of groups) {
    const sorted = [...group.docs].sort(
      (a, b) => new Date(b.lastSyncedAt || 0) - new Date(a.lastSyncedAt || 0)
    );
    const keep = sorted[0];
    const toDisconnect = sorted.slice(1);

    console.log(`\nuser=${group._id}`);
    console.log(`  keep:       ${keep.deviceType} (lastSyncedAt=${keep.lastSyncedAt?.toISOString() || 'never'})`);
    for (const d of toDisconnect) {
      console.log(`  disconnect: ${d.deviceType} (lastSyncedAt=${d.lastSyncedAt?.toISOString() || 'never'})`);
    }

    if (APPLY) {
      await WearableData.updateMany(
        { _id: { $in: toDisconnect.map((d) => d._id) } },
        { $set: { isConnected: false } }
      );
    }

    usersFixed += 1;
    devicesDisconnected += toDisconnect.length;
  }

  console.log(`\n${APPLY ? 'Applied' : 'Would apply'}: ${usersFixed} user(s), ${devicesDisconnected} device(s) set to isConnected:false`);
  if (!APPLY) console.log('Re-run with --apply to write these changes.');

  process.exit(0);
})();
