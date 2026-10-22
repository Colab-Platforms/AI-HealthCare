/**
 * Build/sync all Mongoose indexes deliberately, outside the request path.
 *
 * autoIndex is disabled in production (see config/db.js) because Mongoose would
 * otherwise issue a createIndex for every index on every model at boot, making
 * the app slow or unresponsive until it finished. Run this after any deploy that
 * adds or changes an index:
 *
 *     NODE_ENV=production node scripts/syncIndexes.js            # apply
 *     NODE_ENV=production node scripts/syncIndexes.js --dry-run  # show what it WOULD drop/create
 *
 * Target DB: USE_STAGING_DB=true -> MONGODB_URI_STAGING, otherwise MONGODB_URI.
 * The connected host/db and STAGING/PRODUCTION label are printed first — check them.
 *
 * syncIndexes() also DROPS indexes that no longer exist in the schema, so review
 * the output. Safe to re-run; it is a no-op when everything already matches.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const dns = require('dns');
const mongoose = require('mongoose');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Match the application's development connection path. Some Windows/local
// DNS resolvers refuse MongoDB Atlas SRV lookups even when public DNS works.
if (!process.env.RENDER && !process.env.VERCEL && !process.env.RAILWAY_ENVIRONMENT_ID && process.env.FORCE_PUBLIC_DNS !== 'false') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

// Mongoose builds a model's missing indexes in the background as soon as the model
// is compiled on an open connection (autoIndex defaults to true) — so merely
// loading the models below used to CREATE indexes, even under --dry-run, and
// raced the explicit syncIndexes() calls. Turn that off: this script creates or
// drops indexes only through the explicit syncIndexes() call, never under --dry-run.
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);

(async () => {
  // Same selection rule as config/db.js and the other scripts: USE_STAGING_DB=true
  // targets MONGODB_URI_STAGING, anything else targets MONGODB_URI. This used to
  // check the staging variable but connect to the production one regardless.
  const useStaging = process.env.USE_STAGING_DB === 'true';
  const mongoUri = useStaging ? process.env.MONGODB_URI_STAGING : process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error(`${useStaging ? 'MONGODB_URI_STAGING' : 'MONGODB_URI'} is not set`);
    process.exit(1);
  }

  const dryRun = process.argv.includes('--dry-run');

  // --only=NudgeLog,ExerciseLog restricts the run to those models. syncIndexes()
  // makes the live indexes match the schema, so any model whose schema drifted
  // from production gets changed too; --only keeps a targeted deploy targeted.
  const onlyArg = process.argv.find((a) => a.startsWith('--only='));
  const only = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean)) : null;

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 30000,
    family: 4,
  });
  console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name} [${useStaging ? 'STAGING' : 'PRODUCTION'}]`);
  console.log(dryRun ? 'MODE: DRY RUN (nothing is created or dropped)\n' : 'MODE: APPLY (creates missing indexes, DROPS ones not in the schema)\n');

  // Register every model so mongoose.models is fully populated.
  const modelsDir = path.join(__dirname, '..', 'models');
  for (const file of fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'))) {
    require(path.join(modelsDir, file));
  }

  let failed = 0;
  if (only) {
    const unknown = [...only].filter((n) => !mongoose.models[n]);
    if (unknown.length) {
      console.error(`--only names unknown model(s): ${unknown.join(', ')}`);
      await mongoose.disconnect();
      process.exit(1);
    }
    console.log(`ONLY: ${[...only].join(', ')}\n`);
  }

  for (const name of Object.keys(mongoose.models).sort()) {
    if (only && !only.has(name)) continue;
    const started = Date.now();
    try {
      if (dryRun) {
        // diffIndexes() compares the schema with the live collection and writes nothing.
        const { toDrop, toCreate } = await mongoose.models[name].diffIndexes();
        const ms = Date.now() - started;
        const note = (toDrop.length || toCreate.length)
          ? ` (would drop: ${toDrop.join(', ') || '-'} | would create: ${toCreate.map((i) => Object.keys(i).join('+')).join(', ') || '-'})`
          : '';
        console.log(`  ${toDrop.length || toCreate.length ? '🔎' : '✅'} ${name.padEnd(28)} ${String(ms).padStart(6)}ms${note}`);
        continue;
      }
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
