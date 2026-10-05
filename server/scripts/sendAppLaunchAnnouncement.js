/**
 * One-time bulk send: "Take is now live" announcement to all registered users.
 *
 * Priority order (within each daily run, across the whole remaining queue):
 *   1. Users who registered in the last 5 months AND were originally on the waitlist
 *   2. Users who registered in the last 5 months, not from the waitlist
 *   3. Everyone else (older registrations), regardless of waitlist origin
 * Each tier is sorted by createdAt descending (most recent first).
 *
 * Idempotent: every successful send is logged in AnnouncementEmailLog
 * (campaign + userId, unique). Re-running the script — same day or a later
 * day — only picks up users not already logged for this campaign, so it's
 * safe to re-run after a crash or to resume the next day.
 *
 * Usage:
 *   node scripts/sendAppLaunchAnnouncement.js --db=staging --limit=1700
 *   node scripts/sendAppLaunchAnnouncement.js --db=production --limit=1700
 *   node scripts/sendAppLaunchAnnouncement.js --db=production --limit=1700 --dry-run
 */
const path = require('path');
const dotenv = require('dotenv');
const dns = require('dns');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.RENDER && !process.env.VERCEL && !process.env.RAILWAY_ENVIRONMENT_ID && process.env.FORCE_PUBLIC_DNS !== 'false') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

const CAMPAIGN = 'app_launch_2026_10';
const RECENT_MONTHS = 5;

// A separate transporter from emailService's — that one is intentionally
// throttled to 3 msgs/10s for transactional mail (OTP, password reset) and
// we don't want this bulk job sharing/competing with that pool. 1 msg/sec
// here is still well under Workspace's 2000/day cap with margin to spare.
const bulkTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  pool: { maxConnections: 2, maxMessages: 100, rateDelta: 10000, rateLimit: 10 },
  connectionTimeout: 10000,
  socketTimeout: 10000
});

function parseArgs() {
  const args = {};
  for (const raw of process.argv.slice(2)) {
    const [key, value] = raw.replace(/^--/, '').split('=');
    args[key] = value === undefined ? true : value;
  }
  return args;
}

(async () => {
  const args = parseArgs();
  const dbTarget = args.db === 'production' ? 'production' : 'staging'; // staging is the safe default
  const limit = parseInt(args.limit, 10) || 1700;
  const dryRun = Boolean(args['dry-run']);

  const uri = dbTarget === 'production' ? process.env.MONGODB_URI : process.env.MONGODB_URI_STAGING;
  if (!uri) {
    console.error(`Missing ${dbTarget === 'production' ? 'MONGODB_URI' : 'MONGODB_URI_STAGING'} in .env`);
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000, family: 4 });
  console.log(`Connected to [${dbTarget.toUpperCase()}] ${mongoose.connection.host}/${mongoose.connection.name}`);

  const User = require('../models/User');
  const WaitlistUserEmail = require('../models/WaitlistUserEmail');
  const AnnouncementEmailLog = require('../models/AnnouncementEmailLog');
  const emailService = require('../services/emailService');

  const recentCutoff = new Date();
  recentCutoff.setMonth(recentCutoff.getMonth() - RECENT_MONTHS);

  // Everyone already emailed for this campaign (any previous run/day) — excluded.
  const alreadySent = await AnnouncementEmailLog.find({ campaign: CAMPAIGN }).distinct('userId');
  const alreadySentSet = new Set(alreadySent.map(String));

  // Waitlist emails, for the tier-1 check.
  const waitlistEmails = await WaitlistUserEmail.find({}).distinct('email');
  const waitlistEmailSet = new Set(waitlistEmails.map((e) => e.toLowerCase()));

  const allUsers = await User.find({ email: { $exists: true, $ne: '' } })
    .select('_id name email createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const pending = allUsers.filter((u) => !alreadySentSet.has(String(u._id)));

  const tier1 = []; // recent + was on waitlist
  const tier2 = []; // recent + not on waitlist
  const tier3 = []; // everyone older

  for (const u of pending) {
    const isRecent = u.createdAt && u.createdAt >= recentCutoff;
    const wasWaitlisted = waitlistEmailSet.has((u.email || '').toLowerCase());
    if (isRecent && wasWaitlisted) tier1.push(u);
    else if (isRecent) tier2.push(u);
    else tier3.push(u);
  }

  const queue = [...tier1, ...tier2, ...tier3].slice(0, limit);

  console.log(`Pending total: ${pending.length} (tier1=${tier1.length}, tier2=${tier2.length}, tier3=${tier3.length})`);
  console.log(`Sending to ${queue.length} users today (limit=${limit})${dryRun ? ' [DRY RUN]' : ''}`);

  let sent = 0;
  let failed = 0;

  for (const user of queue) {
    if (dryRun) {
      console.log(`[dry-run] would send to ${user.email}`);
      sent++;
      continue;
    }

    try {
      const html = emailService.getAppLaunchAnnouncementTemplate(user.name, String(user._id));
      await bulkTransporter.sendMail({
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: user.email,
        subject: "Take is now live. Your wait is over.",
        html
      });
      await AnnouncementEmailLog.create({
        userId: user._id,
        email: user.email,
        campaign: CAMPAIGN,
        status: 'sent'
      });
      sent++;
      console.log(`✅ ${sent + failed}/${queue.length} sent -> ${user.email}`);
    } catch (err) {
      failed++;
      console.error(`❌ failed -> ${user.email}: ${err.message}`);
      // Not logged on failure — so it's picked up again on the next run.
    }
  }

  console.log(`\nDone. Sent: ${sent}, Failed: ${failed}, Remaining after today: ${pending.length - queue.length}`);

  await mongoose.disconnect();
  process.exit(failed > 0 && sent === 0 ? 1 : 0);
})().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
