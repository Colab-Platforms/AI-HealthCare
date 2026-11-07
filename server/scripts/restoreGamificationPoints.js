// One-off: adds back points that were logged but never saved. Every award past
// 1,000 points failed User validation ('Health Legend' was missing from the
// currentTier enum), so the GamificationLog row was written but totalPoints and
// lastPointsAwardedAt stayed where they were. Those rows are exactly the logs
// created after lastPointsAwardedAt, which only a successful save moves.
//
// Dry run (lists only):  node scripts/restoreGamificationPoints.js
// Apply:                 node scripts/restoreGamificationPoints.js --apply
require('dotenv').config();
const mongoose = require('mongoose');
const { TIERS } = require('../services/gamificationService');

const tierFor = (points) => [...TIERS].reverse().find((t) => points >= t.minPoints) || TIERS[0];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const users = await db.collection('users').find(
    { 'gamification.totalPoints': { $gte: TIERS[TIERS.length - 1].minPoints - 25 } },
    { projection: { email: 1, gamification: 1 } }
  ).toArray();

  const fixes = [];
  for (const u of users) {
    const since = u.gamification.lastPointsAwardedAt || new Date(0);
    const [unsaved] = await db.collection('gamificationlogs').aggregate([
      { $match: { user: u._id, createdAt: { $gt: since }, pointsAwarded: { $gt: 0 } } },
      { $group: { _id: null, points: { $sum: '$pointsAwarded' }, last: { $max: '$createdAt' } } },
    ]).toArray();
    if (!unsaved) continue;
    const totalPoints = u.gamification.totalPoints + unsaved.points;
    fixes.push({ _id: u._id, email: u.email, from: u.gamification.totalPoints, add: unsaved.points, totalPoints, tier: tierFor(totalPoints).name, last: unsaved.last });
  }

  fixes.forEach((f) => console.log(`${f.email}: ${f.from} + ${f.add} = ${f.totalPoints} (${f.tier})`));
  if (fixes.length === 0) console.log('Nothing to restore.');

  if (process.argv.includes('--apply')) {
    for (const f of fixes) {
      await db.collection('users').updateOne({ _id: f._id }, {
        $set: { 'gamification.totalPoints': f.totalPoints, 'gamification.currentTier': f.tier, 'gamification.lastPointsAwardedAt': f.last },
      });
    }
    console.log(`Restored ${fixes.length} user(s).`);
  } else if (fixes.length) {
    console.log('Dry run, nothing changed. Re-run with --apply to restore.');
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
