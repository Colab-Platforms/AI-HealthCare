const User = require('../models/User');
const ConsentLog = require('../models/ConsentLog');
const HealthReport = require('../models/HealthReport');
const MedicalDocument = require('../models/MedicalDocument');
const FoodLog = require('../models/FoodLog');
const HealthMetric = require('../models/HealthMetric');
const ActivityLog = require('../models/ActivityLog');
const ChatHistory = require('../models/ChatHistory');
const { ZipArchive } = require('archiver');
const emailService = require('../services/emailService');
const Otp = require('../models/Otp');
const crypto = require('crypto');
const SupportTicket = require('../models/SupportTicket');
const Payment = require('../models/Payment');
const Order = require('../models/Order');

const CONSENT_VERSION = '1.0';

// Privacy Policy retention schedule — these three are the only categories
// with a defined period different from the standard 30-day erasure.
const CONSENT_LOG_RETENTION_YEARS = 5;
const SUPPORT_TICKET_RETENTION_YEARS = 3;
const TRANSACTION_RETENTION_YEARS = 8; // Income Tax Act 1961 / Companies Act 2013

// Shared by the authenticated delete-request (Privacy Settings) and the
// public unauthenticated one (Play Store's "delete without the app"
// requirement) — same 30-day pipeline, same reminder cron, either way in.
const scheduleAccountDeletion = async (userId, { reason, feedback, ip, userAgent }) => {
    const scheduledDeletion = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await User.findByIdAndUpdate(userId, {
        'dataRetention.scheduledDeletion':   scheduledDeletion,
        'dataRetention.deletionRequestedAt': new Date(),
        'dataRetention.deletionReason':      reason,
        ...(feedback ? { 'dataRetention.deletionFeedback': feedback } : {}),
    });
    await ConsentLog.create({
        userId,
        version:   CONSENT_VERSION,
        action:    'withdrawn',
        purposes:  ['health_processing', 'analytics', 'marketing'],
        ipAddress: ip,
        userAgent,
    }).catch(err => console.error('Deletion ConsentLog failed:', err.message));
    return scheduledDeletion;
};

/* ─────────────────────────────────────────────
   POST /api/privacy/consent
   Record user's consent (grant or withdraw)
───────────────────────────────────────────── */
exports.recordConsent = async (req, res) => {
    try {
        const { action, purposes } = req.body; // action: 'granted' | 'withdrawn'
        if (!['granted', 'withdrawn'].includes(action)) {
            return res.status(400).json({ message: 'action must be granted or withdrawn' });
        }

        await ConsentLog.create({
            userId:    req.user._id,
            version:   CONSENT_VERSION,
            action,
            purposes:  purposes || ['health_processing'],
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });

        const consentUpdate = action === 'granted'
            ? { 'consent.given': true, 'consent.version': CONSENT_VERSION, 'consent.givenAt': new Date(), 'consent.withdrawn': false, 'consent.withdrawnAt': null }
            : { 'consent.withdrawn': true, 'consent.withdrawnAt': new Date() };

        // Mirror purpose choices into privacySettings — the fields activityLogger
        // and emailService actually check before logging/emailing.
        if (action === 'granted' && Array.isArray(purposes)) {
            consentUpdate['privacySettings.analyticsEnabled'] = purposes.includes('analytics');
            consentUpdate['privacySettings.marketingEnabled'] = purposes.includes('marketing');
        }

        await User.findByIdAndUpdate(req.user._id, consentUpdate);

        res.json({ success: true, action, version: CONSENT_VERSION });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* ─────────────────────────────────────────────
   GET /api/privacy/consent
   Get current consent status
───────────────────────────────────────────── */
exports.getConsentStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('consent privacySettings');
        const logs = await ConsentLog.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(10);
        res.json({ consent: user.consent, privacySettings: user.privacySettings, history: logs, currentVersion: CONSENT_VERSION });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* ─────────────────────────────────────────────
   PUT /api/privacy/settings
   Update privacy preferences
───────────────────────────────────────────── */
exports.updatePrivacySettings = async (req, res) => {
    try {
        const { analyticsEnabled, marketingEnabled, dataSharing } = req.body;
        const update = {};
        if (analyticsEnabled !== undefined) update['privacySettings.analyticsEnabled'] = analyticsEnabled;
        if (marketingEnabled !== undefined) update['privacySettings.marketingEnabled'] = marketingEnabled;
        if (dataSharing !== undefined)      update['privacySettings.dataSharing'] = dataSharing;

        const user = await User.findByIdAndUpdate(req.user._id, update, { new: true }).select('privacySettings');
        res.json({ success: true, privacySettings: user.privacySettings });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* ─────────────────────────────────────────────
   GET /api/privacy/export
   Download all personal data as ZIP (DPDPA Art. 11)
   Streams the ZIP directly — no temp file on disk
───────────────────────────────────────────── */
exports.exportData = async (req, res) => {
    try {
        const userId = req.user._id;

        const [user, reports, documents, foodLogs, metrics, chatHistory, consentLogs, activityLogs] = await Promise.all([
            User.findById(userId).select('-password -resetPasswordCode -emailVerificationCode').lean(),
            HealthReport.find({ user: userId }).lean(),
            MedicalDocument.find({ userId }).lean(),
            FoodLog.find({ userId }).lean(),
            HealthMetric.find({ userId }).lean(),
            ChatHistory.find({ userId }).lean(),   // ChatHistory uses userId
            ConsentLog.find({ userId }).lean(),
            ActivityLog.find({ user: userId }).lean(), // ActivityLog uses 'user' not 'userId'
        ]);

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="takehealth-data-export-${Date.now()}.zip"`);

        const archive = new ZipArchive({ zlib: { level: 6 } });
        archive.on('error', err => { throw err; });
        archive.pipe(res);

        const add = (filename, data) =>
            archive.append(JSON.stringify(data, null, 2), { name: filename });

        add('profile.json',        user);
        add('health_reports.json', reports);
        add('documents.json',      documents);
        add('food_logs.json',      foodLogs);
        add('health_metrics.json', metrics);
        add('chat_history.json',   chatHistory);
        add('consent_logs.json',   consentLogs);
        add('activity_logs.json',  activityLogs);
        add('README.txt',          `take.health Personal Data Export\nGenerated: ${new Date().toISOString()}\nThis archive contains all personal data stored for your account under DPDPA 2023.\n`);

        await archive.finalize();
    } catch (error) {
        console.error('Data export error:', error);
        if (!res.headersSent) res.status(500).json({ message: error.message });
    }
};

/* ─────────────────────────────────────────────
   POST /api/privacy/delete-account
   Schedule account deletion in 30 days (DPDPA right to erasure)
   Sends confirmation; cron job does actual deletion
───────────────────────────────────────────── */
exports.requestAccountDeletion = async (req, res) => {
    try {
        // isActive stays true — user can still login and cancel within 30 days
        const scheduledDeletion = await scheduleAccountDeletion(req.user._id, {
            reason: 'user_requested',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });

        res.json({
            success: true,
            message: 'Account deletion scheduled. Your data will be permanently deleted in 30 days.',
            scheduledDeletion,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* ─────────────────────────────────────────────
   POST /api/privacy/public-delete/request
   Google Play "delete your account without the app" requirement — public,
   unauthenticated. Never confirms whether the email has an account (avoids
   account-enumeration): same generic response either way. If it does, an
   OTP goes to that registered email — never trusts the submitted phone/
   reason to identify the account, only the email + a code only the real
   inbox owner can read.
───────────────────────────────────────────── */
const GENERIC_PUBLIC_DELETE_RESPONSE = {
    success: true,
    message: "If an account exists with that email, we've sent a confirmation code to it.",
};

exports.requestPublicDeletion = async (req, res) => {
    try {
        const email = req.body.email?.toLowerCase().trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: 'A valid email address is required' });
        }

        const user = await User.findOne({ email }).select('_id name email').lean();
        if (user) {
            const code = crypto.randomInt(100000, 1000000).toString();
            await Otp.findOneAndUpdate(
                { email },
                { code, createdAt: Date.now() },
                { upsert: true, new: true }
            );
            // Optional free-text reason is only ever read again at confirm time
            // (client resends it), not persisted before the request is verified.
            await emailService.sendPublicDeletionConfirmCode(email, user.name, code).catch(
                (e) => console.error('Public deletion OTP email failed:', e.message)
            );
        }

        res.json(GENERIC_PUBLIC_DELETE_RESPONSE);
    } catch (error) {
        console.error('Public deletion request error:', error.message);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
};

/* ─────────────────────────────────────────────
   POST /api/privacy/public-delete/confirm
   Verifies the code, then hands off to the exact same pipeline the
   in-app "Delete My Account" button uses — 30-day window, 48h/24h
   reminder emails, cancel-anytime, all identical either way in.
───────────────────────────────────────────── */
exports.confirmPublicDeletion = async (req, res) => {
    try {
        const email = req.body.email?.toLowerCase().trim();
        const { otp, reason } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and code are required' });
        }

        const otpRecord = await Otp.findOne({ email, code: otp });
        if (!otpRecord) {
            return res.status(400).json({ message: 'Invalid or expired code' });
        }
        await Otp.deleteOne({ _id: otpRecord._id });

        const user = await User.findOne({ email }).select('_id').lean();
        if (!user) {
            // OTP existed but the account is gone by now — nothing left to delete.
            return res.json({ success: true, message: 'Account deletion request processed.' });
        }

        const scheduledDeletion = await scheduleAccountDeletion(user._id, {
            reason: 'user_requested',
            feedback: reason?.trim()?.slice(0, 1000) || undefined,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });

        res.json({
            success: true,
            message: 'Account deletion scheduled. Your data will be permanently deleted in 30 days.',
            scheduledDeletion,
        });
    } catch (error) {
        console.error('Public deletion confirm error:', error.message);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
};

/* ─────────────────────────────────────────────
   POST /api/privacy/cancel-deletion
   Cancel a pending account deletion request
───────────────────────────────────────────── */
exports.cancelAccountDeletion = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            'dataRetention.scheduledDeletion':   null,
            'dataRetention.deletionRequestedAt': null,
            'dataRetention.reminder48SentAt':    null,
            'dataRetention.reminder24SentAt':    null,
            'dataRetention.deletionReason':      null,
            isActive: true,
        });
        // Same reasoning as the password-changed alert — confirm the
        // reversal happened by email, not just a UI toast, so the account
        // owner would notice if they didn't actually cancel it themselves.
        emailService.sendDeletionCancelledConfirmation(req.user.email, req.user.name).catch(
            (e) => console.error('Deletion-cancelled email failed:', e.message)
        );
        res.json({ success: true, message: 'Account deletion cancelled.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const GUARDIAN_GRACE_PERIOD_DAYS = 15;
// Caps how many first-time notices go out per day. This is a rollout/legal-
// review safety valve (don't mass-email hundreds of real users the first
// time this runs) — it is NOT a performance requirement; even the full
// unbatched query is a single sub-100ms indexed-scale query and the email
// loop is async I/O, so it never blocks the request-handling event loop
// either way. Un-notified users simply carry over to the next day's run
// until everyone's been through Phase 1.
const GRACE_NOTICE_DAILY_BATCH_LIMIT = 20;

/* ─────────────────────────────────────────────
   Cron helper — called by server.js daily
   DPDPA Section 9: finds accounts whose profile indicates age < 18 with
   guardianConsent never given (this only ever touches accounts predating
   the guardian-otp gate — new signups can't reach this state at all, since
   checkGuardianConsentRequired blocks every profile write until consent is
   verified). Two phases, both idempotent:

   1. First sighting -> send a grace-period notice (once, via
      graceNoticeSentAt) and set a deadline. No deletion yet — this is
      instead of "immediately deactivate and delete", which would be unfair
      to a genuine long-time user who simply predates the feature.
   2. Deadline passed, still unconsented -> hand off to the *existing*
      deletion pipeline (dataRetention.scheduledDeletion), tagged
      deletionReason: 'unconsented_minor' so verifyGuardianConsentOtp knows
      it's safe to auto-cancel if they complete verification even this late.
      From here the already-built 48h/24h reminder cron and daily deletion
      cron take over — no new deletion logic needed.
───────────────────────────────────────────── */
exports.runUnconsentedMinorGraceCron = async () => {
    const now = new Date();

    // Phase 1: notify newly-found unconsented minors, once each.
    try {
        const newlyFound = await User.find({
            'profile.age': { $gt: 0, $lt: 18 },
            'guardianConsent.given': { $ne: true },
            'guardianConsent.graceNoticeSentAt': null,
        }).select('_id name email').limit(GRACE_NOTICE_DAILY_BATCH_LIMIT).lean();

        const deadline = new Date(now.getTime() + GUARDIAN_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
        for (const user of newlyFound) {
            try {
                await emailService.sendGuardianConsentGraceNotice(user.email, user.name, deadline);
                await User.updateOne({ _id: user._id }, {
                    'guardianConsent.graceNoticeSentAt': now,
                    'guardianConsent.graceDeadline': deadline,
                });
            } catch (emailErr) {
                console.error(`[Guardian Grace] notice email failed for ${user.email}:`, emailErr.message);
            }
        }
        if (newlyFound.length) console.log(`[Guardian Grace] Grace notices sent: ${newlyFound.length}`);
    } catch (err) {
        console.error('[Guardian Grace] Phase 1 (notify) error:', err.message);
    }

    // Phase 2: deadline passed, guardian still never verified -> schedule
    // deletion through the existing pipeline instead of deleting directly.
    try {
        const overdue = await User.find({
            'guardianConsent.given': { $ne: true },
            'guardianConsent.graceDeadline': { $lte: now },
            'dataRetention.scheduledDeletion': null, // don't clobber an unrelated deletion already in flight
        }).select('_id').lean();

        for (const user of overdue) {
            await User.updateOne({ _id: user._id }, {
                'dataRetention.scheduledDeletion':   new Date(now.getTime() + 48 * 60 * 60 * 1000),
                'dataRetention.deletionRequestedAt': now,
                'dataRetention.deletionReason':      'unconsented_minor',
            });
        }
        if (overdue.length) console.log(`[Guardian Grace] Deletion scheduled (grace expired): ${overdue.length}`);
    } catch (err) {
        console.error('[Guardian Grace] Phase 2 (enforce) error:', err.message);
    }
};

/* ─────────────────────────────────────────────
   Cron helper — called by server.js hourly
   DPDP Rules 2025, Rule 8: notify the user before erasure. Sends a reminder
   at both the 48h and 24h marks, each exactly once (idempotency markers
   on the user doc), so notice is always given well before the deletion
   cron below actually runs.

   Runs hourly rather than daily like the other DPDPA cron: a daily-only
   check has up to ~24h of jitter against a wall-clock deletion timestamp
   (the "24h before" window could be missed by nearly a full day depending
   on time-of-day alignment), which risks giving less than the legally
   required notice. Hourly caps that jitter at under an hour.
───────────────────────────────────────────── */
exports.runDeletionReminderCron = async () => {
    const REMINDER_HOURS_BEFORE = [48, 24];
    const now = new Date();

    for (const hoursBefore of REMINDER_HOURS_BEFORE) {
        try {
            const sentField = `dataRetention.reminder${hoursBefore}SentAt`;
            const windowEnd = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);

            // hint() forces the partial index below rather than trusting the
            // planner's cost estimate — at today's collection size Mongo
            // sometimes prefers a COLLSCAN since it looks "cheap enough", but
            // that stops holding as the users collection grows. The index is
            // provably tiny (only accounts with scheduledDeletion set are in
            // it at all), so forcing it is strictly a win, never a regression.
            const dueSoon = await User.find({
                'dataRetention.scheduledDeletion': { $gt: now, $lte: windowEnd },
                [sentField]: null,
            }).hint('dataRetention.scheduledDeletion_1').select('_id name email dataRetention.scheduledDeletion').lean();

            if (!dueSoon.length) continue;

            for (const user of dueSoon) {
                try {
                    await emailService.sendDeletionReminder(
                        user.email,
                        user.name,
                        user.dataRetention.scheduledDeletion,
                        hoursBefore
                    );
                    // Mark sent only after the email succeeds — a transient SMTP
                    // failure should let the next hourly run retry, not silently
                    // skip the user's only notice.
                    await User.updateOne({ _id: user._id }, { [sentField]: now });
                } catch (emailErr) {
                    console.error(`[Deletion Reminder] ${hoursBefore}h email failed for ${user.email}:`, emailErr.message);
                }
            }
            console.log(`[Deletion Reminder] ${hoursBefore}h reminders sent: ${dueSoon.length}`);
        } catch (err) {
            console.error(`[Deletion Reminder] ${hoursBefore}h window error:`, err.message);
        }
    }
};

/* ─────────────────────────────────────────────
   Cron helper — called by server.js daily
   Hard-deletes accounts whose 30-day window passed
───────────────────────────────────────────── */
exports.runDeletionCron = async () => {
    try {
        const due = await User.find({
            'dataRetention.scheduledDeletion': { $lte: new Date() },
        }).hint('dataRetention.scheduledDeletion_1').select('_id email').lean();

        if (!due.length) return;

        const consentRetainUntil = new Date(Date.now() + CONSENT_LOG_RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000);

        for (const u of due) {
            const uid = u._id;
            await Promise.all([
                HealthReport.deleteMany({ user: uid }),
                MedicalDocument.deleteMany({ userId: uid }),
                FoodLog.deleteMany({ userId: uid }),
                HealthMetric.deleteMany({ userId: uid }),
                ChatHistory.deleteMany({ userId: uid }),
                ActivityLog.deleteMany({ user: uid }), // ActivityLog's field is `user`, not `userId`
                // NOT deleted here — DPDPA §6 evidence-of-compliance requires
                // proof consent existed to outlive the account itself. Stamped
                // instead; a separate cron purges these after CONSENT_LOG_RETENTION_YEARS.
                ConsentLog.updateMany({ userId: uid }, { retainUntil: consentRetainUntil }),
            ]);
            // Payment/Order records are deliberately left untouched — see
            // runTransactionRetentionCron (8-year statutory retention).
            await User.findByIdAndDelete(uid);
            console.log(`🗑️ [DPDPA] Deleted account: ${u.email}`);
        }
    } catch (err) {
        console.error('❌ Deletion cron error:', err.message);
    }
};

/* ─────────────────────────────────────────────
   Cron helper — called by server.js daily
   Privacy Policy: consent records retained 5 years after the account they
   belonged to was actually deleted (retainUntil stamped by runDeletionCron
   above). Purges only rows whose 5 years is now up — never touches a row
   still tied to an active account, since those never got stamped at all.
───────────────────────────────────────────── */
exports.runConsentLogRetentionCron = async () => {
    try {
        const result = await ConsentLog.deleteMany({ retainUntil: { $lte: new Date() } }).hint('retainUntil_1');
        if (result.deletedCount) console.log(`[Retention] ConsentLog rows purged (5yr): ${result.deletedCount}`);
    } catch (err) {
        console.error('[Retention] ConsentLog cron error:', err.message);
    }
};

/* ─────────────────────────────────────────────
   Cron helper — called by server.js daily
   Privacy Policy: support/communication records retained 3 years from
   resolution (or last activity, if never formally resolved).
───────────────────────────────────────────── */
exports.runSupportTicketRetentionCron = async () => {
    try {
        const cutoff = new Date(Date.now() - SUPPORT_TICKET_RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000);
        const result = await SupportTicket.deleteMany({
            $or: [
                { resolvedAt: { $lte: cutoff } },
                { resolvedAt: null, updatedAt: { $lte: cutoff } },
            ],
        });
        if (result.deletedCount) console.log(`[Retention] SupportTicket rows purged (3yr): ${result.deletedCount}`);
    } catch (err) {
        console.error('[Retention] SupportTicket cron error:', err.message);
    }
};

/* ─────────────────────────────────────────────
   Cron helper — called by server.js daily
   Privacy Policy: transaction/payment records retained 8 years per the
   Income Tax Act 1961 and Companies Act 2013 — deliberately independent of
   whether the paying account still exists (runDeletionCron never touches
   these), and independent of the standard 30-day erasure entirely.
───────────────────────────────────────────── */
exports.runTransactionRetentionCron = async () => {
    try {
        const cutoff = new Date(Date.now() - TRANSACTION_RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000);
        const [payments, orders] = await Promise.all([
            Payment.deleteMany({ createdAt: { $lte: cutoff } }),
            Order.deleteMany({ createdAt: { $lte: cutoff } }),
        ]);
        if (payments.deletedCount || orders.deletedCount) {
            console.log(`[Retention] Transaction records purged (8yr): ${payments.deletedCount} payments, ${orders.deletedCount} orders`);
        }
    } catch (err) {
        console.error('[Retention] Transaction cron error:', err.message);
    }
};
