// One-off: keeps only the newest active FCM token per user per phone platform
// (android/ios). Older ones for the same platform were still deliverable, so
// those phones got every push twice. fcmTokenService.upsertToken now does this
// on every new registration; this cleans up the rows from before that.
//
// Dry run (lists only):  node scripts/dedupeFcmTokens.js
// Apply:                 node scripts/dedupeFcmTokens.js --apply
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const tokens = mongoose.connection.db.collection('fcmtokens');

  const groups = await tokens.aggregate([
    { $match: { isActive: true, platform: { $in: ['android', 'ios'] } } },
    { $sort: { updatedAt: -1, createdAt: -1 } },
    { $group: { _id: { userId: '$userId', platform: '$platform' }, ids: { $push: '$_id' } } },
    { $match: { 'ids.1': { $exists: true } } },
  ]).toArray();

  // Everything after the first (newest) id in each group is an older token.
  const older = groups.flatMap((g) => g.ids.slice(1));
  console.log(`Users/platforms with more than one active token: ${groups.length}`);
  console.log(`Older tokens to deactivate: ${older.length}`);

  if (process.argv.includes('--apply')) {
    const { modifiedCount } = await tokens.updateMany({ _id: { $in: older } }, { $set: { isActive: false } });
    console.log(`Deactivated ${modifiedCount} tokens.`);
  } else {
    console.log('Dry run, nothing changed. Re-run with --apply to deactivate them.');
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
