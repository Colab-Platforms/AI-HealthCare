/**
 * One-off migration: "Jain" moved from a free-text tag to a diet type.
 *
 *   node scripts/migrateJainDiet.js            # dry run — prints what it WOULD do
 *   node scripts/migrateJainDiet.js --apply    # performs it
 *
 * Before: a user wrote "Jain" into Restrictions / Must Do / favourites while
 * their diet type said something else. The two disagreed, so nobody could say
 * what they meant.
 *
 * What this does, per user holding a stored "Jain" tag:
 *   - diet is 'vegetarian'      -> they were using the tag to mean Jain food:
 *                                   set diet to 'jain' and remove the tag.
 *   - any other diet            -> the diet type is what they chose most
 *                                   explicitly: leave it, remove the stale tag.
 *                                   (vegan is left alone on purpose — Jain + vegan
 *                                   is rare enough to confirm with the user.)
 *
 * `foodsToAvoid` is never touched: those are dishes the user rejected, and they
 * stay rejected whatever their diet is.
 *
 * Idempotent: a second run finds no tags and does nothing.
 */
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');

const APPLY = process.argv.includes('--apply');
const JAIN = /\bjain(?:ism|s)?\b/i;
const LISTS = ['dietaryRestrictions', 'dietaryDo', 'dietaryDont', 'preferredFoods'];
const SLOTS = ['breakfast', 'lunch', 'snacks', 'dinner'];

const listPaths = [
  ...LISTS.map((k) => `foodPreferences.${k}`),
  ...SLOTS.map((s) => `foodPreferences.mealPreferences.${s}`),
];

function tagsOf(user) {
  const fp = user.foodPreferences || {};
  const found = [];
  for (const k of LISTS) (fp[k] || []).filter((v) => JAIN.test(v)).forEach((v) => found.push(`${k}: "${v}"`));
  for (const s of SLOTS) (fp.mealPreferences?.[s] || []).filter((v) => JAIN.test(v)).forEach((v) => found.push(`${s}: "${v}"`));
  return found;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const users = await User.find({ $or: listPaths.map((p) => ({ [p]: JAIN })) })
    .select('email profile.dietaryPreference foodPreferences')
    .lean();

  console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — ${users.length} user(s) hold a stored Jain tag\n`);

  const counts = { toJain: 0, tagOnly: 0 };
  for (const u of users) {
    const diet = u.profile?.dietaryPreference;
    const makeJain = diet === 'vegetarian';
    makeJain ? counts.toJain++ : counts.tagOnly++;

    console.log(`${u.email}  diet=${diet}  ->  ${makeJain ? "diet becomes 'jain'" : 'diet unchanged'}, tag removed`);
    tagsOf(u).forEach((t) => console.log(`     ${t}`));

    if (!APPLY) continue;

    const $pull = Object.fromEntries(listPaths.map((p) => [p, { $regex: JAIN.source, $options: 'i' }]));
    const update = { $pull };
    if (makeJain) update.$set = { 'profile.dietaryPreference': 'jain' };
    // updateOne (not updateMany) so the User model's post-update hook drops the cached copy.
    await User.updateOne({ _id: u._id }, update);
  }

  console.log(`\n${counts.toJain} user(s) -> jain diet, ${counts.tagOnly} user(s) had only the stale tag removed.`);
  if (!APPLY) console.log('Nothing was written. Re-run with --apply to perform it.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
