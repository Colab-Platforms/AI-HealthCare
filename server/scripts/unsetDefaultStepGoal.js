// One-off: removes the stored stepGoal of 10,000 that the old User schema
// default wrote onto every user. Nobody chose it (every stored value was
// exactly 10,000), and while it's stored, utils/stepGoal.js treats it as a
// goal the user picked instead of using the age-based one.
//
// Dry run (counts only):  node scripts/unsetDefaultStepGoal.js
// Apply:                  node scripts/unsetDefaultStepGoal.js --apply
require('dotenv').config();
const mongoose = require('mongoose');

const FILTER = { 'profile.lifestyle.stepGoal': 10000 };

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.db.collection('users');
  const before = await users.countDocuments(FILTER);
  console.log(`Users with the stored 10,000 default: ${before}`);

  if (process.argv.includes('--apply')) {
    const { modifiedCount } = await users.updateMany(FILTER, { $unset: { 'profile.lifestyle.stepGoal': '' } });
    console.log(`Unset on ${modifiedCount} users. Remaining: ${await users.countDocuments(FILTER)}`);
  } else {
    console.log('Dry run, nothing changed. Re-run with --apply to unset.');
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
