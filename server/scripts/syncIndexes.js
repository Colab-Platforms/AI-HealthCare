/**
 * Build/sync all Mongoose indexes deliberately, outside the request path.
 *
 * autoIndex is disabled in production (see config/db.js) because Mongoose would
 * otherwise issue a createIndex for every index on every model at boot, making
 * the app slow or unresponsive until it finished. Run this after any deploy that
 * adds or changes an index:
 *
 *     NODE_ENV=production node scripts/syncIndexes.js
 *
 * syncIndexes() also DROPS indexes that no longer exist in the schema, so review
 * the output. Safe to re-run; it is a no-op when everything already matches.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env') });

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    family: 4,
  });
  console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name}\n`);

  // Register every model so mongoose.models is fully populated.
  const modelsDir = path.join(__dirname, '..', 'models');
  for (const file of fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'))) {
    require(path.join(modelsDir, file));
  }

  let failed = 0;
  for (const name of Object.keys(mongoose.models).sort()) {
    const started = Date.now();
    try {
      const dropped = await mongoose.models[name].syncIndexes();
      const ms = Date.now() - started;
      const note = dropped?.length ? ` (dropped: ${dropped.join(', ')})` : '';
      console.log(`  ✅ ${name.padEnd(28)} ${String(ms).padStart(6)}ms${note}`);
    } catch (err) {
      failed++;
      console.error(`  ❌ ${name.padEnd(28)} ${err.message}`);
    }
  }

  await mongoose.disconnect();
  console.log(failed ? `\nDone with ${failed} failure(s).` : '\nAll indexes in sync.');
  process.exit(failed ? 1 : 0);
})().catch(err => {
  console.error('Index sync failed:', err.message);
  process.exit(1);
});
