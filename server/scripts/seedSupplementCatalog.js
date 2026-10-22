/**
 * Seed / update the supplement catalog (Berberine, CoQ10, Magnesium).
 *
 *     node scripts/seedSupplementCatalog.js --dry-run   # show what would be written
 *     node scripts/seedSupplementCatalog.js             # upsert by slug
 *
 * Idempotent: upserts by `slug`, so re-running after editing a value below updates
 * that product in place. Target DB: USE_STAGING_DB=true -> MONGODB_URI_STAGING,
 * otherwise MONGODB_URI. The connected host/db and STAGING/PRODUCTION label are
 * printed first — check them. The app caches the catalog for 10 minutes, so an
 * edit shows up within that window.
 */
const path = require('path');
const dotenv = require('dotenv');
const dns = require('dns');
const mongoose = require('mongoose');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.RENDER && !process.env.VERCEL && !process.env.RAILWAY_ENVIRONMENT_ID && process.env.FORCE_PUBLIC_DNS !== 'false') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

// strength is PER UNIT (per capsule); dailyTotal is strength x quantity x doses/day.
const CATALOG = [
  {
    slug: 'berberine',
    name: 'Berberine',
    tagline: 'Metabolic support',
    form: 'capsule',
    strength: { value: 500, unit: 'mg' },
    quantityPerDose: 1,
    defaultFrequency: 'twice', // "2 capsules daily" = 1 capsule x 2 doses
    dailyTotal: { value: 1000, unit: 'mg' },
    recommendedUsage: 'Take 2 capsules daily, preferably before meals, or as directed by a healthcare professional.',
    recommendedDuration: { minDays: 56, maxDays: 84, text: '8–12 weeks, subject to individual needs and healthcare professional guidance.' },
    sortOrder: 1,
  },
  {
    slug: 'coq10',
    name: 'CoQ10',
    tagline: 'Heart & Energy',
    form: 'capsule',
    strength: { value: 200, unit: 'mg' },
    quantityPerDose: 1,
    defaultFrequency: 'once',
    dailyTotal: { value: 200, unit: 'mg' },
    recommendedUsage: 'Take 1 capsule daily with a meal, preferably one containing healthy fats, or as directed by your healthcare professional.',
    recommendedDuration: { minDays: 60, maxDays: 90, text: 'Use daily for 60 to 90 days to let energy and health benefits build up in your body.' },
    sortOrder: 2,
  },
  {
    slug: 'magnesium-sleep',
    name: 'Magnesium',
    tagline: 'Sleep & Recovery',
    form: 'capsule',
    // 370 mg/day (tentative) over 2 capsules => 185 mg per capsule. Revisit when the dosage is final.
    strength: { value: 185, unit: 'mg' },
    quantityPerDose: 2,
    defaultFrequency: 'once',
    defaultTimes: ['21:30'], // 30-45 min before bedtime
    dailyTotal: { value: 370, unit: 'mg' },
    recommendedUsage: 'Take 2 capsules daily with a glass of water, 30 to 45 minutes before bedtime, or as directed by your healthcare professional.',
    recommendedDuration: { minDays: 56, maxDays: 84, text: 'Consume daily for a minimum of 8–12 weeks for optimal intracellular recovery and sleep quality benefits.' },
    sortOrder: 3,
  },
];

(async () => {
  const useStaging = process.env.USE_STAGING_DB === 'true';
  const mongoUri = useStaging ? process.env.MONGODB_URI_STAGING : process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error(`${useStaging ? 'MONGODB_URI_STAGING' : 'MONGODB_URI'} is not set`);
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run');

  mongoose.set('autoIndex', false);
  mongoose.set('autoCreate', false);
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 30000, family: 4 });
  console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name} [${useStaging ? 'STAGING' : 'PRODUCTION'}]`);
  console.log(dryRun ? 'MODE: DRY RUN (nothing is written)\n' : 'MODE: APPLY (upsert by slug)\n');

  const SupplementCatalog = require('../models/SupplementCatalog');

  for (const item of CATALOG) {
    if (dryRun) {
      const exists = await SupplementCatalog.exists({ slug: item.slug });
      console.log(`  ${exists ? '✏️  would update' : '➕ would create'}  ${item.slug}`);
      continue;
    }
    await SupplementCatalog.updateOne({ slug: item.slug }, { $set: { ...item, isActive: true } }, { upsert: true });
    console.log(`  ✅ ${item.slug}`);
  }

  await mongoose.disconnect();
  console.log('\nDone.');
})().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
