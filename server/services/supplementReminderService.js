const crypto = require('crypto');
const mongoose = require('mongoose');
const DoseLog = require('../models/DoseLog');
const UserSupplement = require('../models/UserSupplement');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const notificationService = require('./notificationService');
const { materializeSupplement } = require('./supplementService');
const { MISSED_AFTER_MIN } = require('../utils/supplementSchedule');
const { buildReminderMessage, isInQuietHours } = require('../utils/supplementReminderMessage');
const { localHHmm, addDays } = require('../utils/zonedTime');

// ---- tuning ----------------------------------------------------------------

// Doses claimed per round trip. The claim is an _id-keyed updateMany, so this only
// bounds the size of that $in list and of the in-memory working set.
const REMINDER_BATCH = 1000;

// A reminder only goes out if it came due within this window. A tick that was down
// for an hour must not send "your 8:00 dose is in 10 minutes" at 9:00 — a late
// reminder is worse than none. (Same principle as utils/reminderWindow.js.)
const REMINDER_STALE_MIN = 10;

// Same write shape as notificationService: bounded chunks, bounded concurrency,
// so a big tick can't take the shared Mongo pool (maxPoolSize 20) from the API.
const INSERT_CHUNK = 500;
const CHUNK_CONCURRENCY = 5;

const EXTEND_BATCH = 300;     // supplements whose dose horizon is topped up per tick
const EXTEND_CONCURRENCY = 5;
const EXTEND_LEAD_DAYS = 3;   // top up once fewer than ~this many days are left
const NOTIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

// Stay inside the QStash/serverless request limit. Anything not done is picked up
// by the next tick — every step is idempotent and resumable.
const TICK_BUDGET_MS = 50 * 1000;

const utcDate = (d) => d.toISOString().slice(0, 10);

class SupplementReminderService {
    constructor() {
        // In-process re-entrancy guard only. Correctness across overlapping ticks or
        // multiple instances comes from the atomic claim in processReminderBatch.
        this.running = false;
    }

    /**
     * One tick. Order matters: reminders are time-critical so they go first; the
     * housekeeping after them can run a minute late without anyone noticing.
     */
    async runTick() {
        if (this.running) return { ok: true, skipped: true };
        this.running = true;

        const startedAt = Date.now();
        const deadline = startedAt + TICK_BUDGET_MS;
        const stats = { claimed: 0, notified: 0, missed: 0, completed: 0, extended: 0 };
        const errors = [];

        // Each step is isolated: a failure in housekeeping must not stop reminders
        // from going out, nor the reverse.
        const step = async (name, fn) => {
            try {
                await fn();
            } catch (err) {
                console.error(`[SupplementReminder] ${name} failed:`, err.message);
                errors.push(`${name}: ${err.message}`);
            }
        };

        try {
            await step('reminders', async () => {
                let batch;
                do {
                    batch = await this.processReminderBatch(new Date());
                    stats.claimed += batch.claimed;
                    stats.notified += batch.notified;
                } while (batch.full && Date.now() < deadline);
            });
            await step('missed', async () => { stats.missed = await this.markMissedDoses(new Date()); });
            await step('complete', async () => { stats.completed = await this.completeFinishedSupplements(new Date()); });
            await step('extend', async () => { stats.extended = await this.extendWindows(new Date(), deadline); });

            const ms = Date.now() - startedAt;
            if (stats.claimed || stats.missed || stats.completed || stats.extended) {
                console.log(`💊 Supplement tick: ${JSON.stringify(stats)} in ${ms}ms`);
            }
            // Non-ok makes the route answer 500 so QStash retries; a retry is safe
            // (claims are atomic, the rest is idempotent).
            return errors.length ? { ok: false, error: errors.join('; '), stats } : { ok: true, stats };
        } finally {
            this.running = false;
        }
    }

    /**
     * Claim -> group -> notify, for up to REMINDER_BATCH due doses.
     *
     * The claim is what makes this safe under QStash retries, overlapping ticks and
     * multiple instances: a dose is flipped reminderPending true -> false with a
     * conditional update BEFORE anything is sent, and only the tick whose claimId
     * ends up on the row sends it. Delivery is therefore at-most-once: a crash after
     * the claim loses that reminder rather than duplicating it.
     */
    async processReminderBatch(now) {
        const windowStart = new Date(now.getTime() - REMINDER_STALE_MIN * 60 * 1000);

        // 1. Candidates — an index-only range scan over armed, unclaimed doses.
        const candidates = await DoseLog.find({
            reminderPending: true,
            remindAt: { $gt: windowStart, $lte: now },
        }).select('_id').limit(REMINDER_BATCH).lean();
        if (candidates.length === 0) return { claimed: 0, notified: 0, full: false };

        // 2. Claim them. Anything another tick claimed in between no longer matches
        //    reminderPending:true, so it is simply not ours.
        const ids = candidates.map((c) => c._id);
        const claimId = crypto.randomUUID();
        await DoseLog.updateMany(
            { _id: { $in: ids }, reminderPending: true },
            { $set: { reminderPending: false, reminderClaimId: claimId } }
        );

        // 3. Read back exactly the ones this tick won (by _id, so no extra index).
        const claimed = await DoseLog.find({ _id: { $in: ids }, reminderClaimId: claimId, status: 'pending' })
            .select('userId userSupplementId scheduledFor snapshot').lean();

        const notified = claimed.length ? await this.notifyUsers(claimed, now) : 0;
        return { claimed: claimed.length, notified, full: candidates.length === REMINDER_BATCH };
    }

    // One notification per user, however many doses of theirs came due.
    async notifyUsers(claimedRows, now) {
        const byUser = new Map();
        for (const row of claimedRows) {
            const key = String(row.userId);
            if (!byUser.has(key)) byUser.set(key, []);
            byUser.get(key).push(row);
        }

        // Preferences for only the users who are actually due — never all users.
        const prefs = await NotificationPreference.find({ userId: { $in: [...byUser.keys()].map((id) => new mongoose.Types.ObjectId(id)) } })
            .select('userId timezone quietHours medicationReminders').lean();
        const prefByUser = new Map(prefs.map((p) => [String(p.userId), p]));

        const entries = []; // { doc, push } built in memory, written once
        for (const [userId, rows] of byUser) {
            const pref = prefByUser.get(userId);
            const timezone = pref?.timezone || 'Asia/Kolkata';

            // The user's master switch, and Do Not Disturb. A reminder that lands in
            // quiet hours is dropped, not deferred: the dose stays pending and can be
            // logged later, and a deferred reminder would arrive after it's useless.
            if (pref?.medicationReminders?.enabled === false) continue;
            if (isInQuietHours(localHHmm(now, timezone), pref?.quietHours)) continue;

            const { title, message, doseIds, supplementIds } = buildReminderMessage(rows, timezone);
            const _id = new mongoose.Types.ObjectId();
            entries.push({
                doc: {
                    _id,
                    userId: rows[0].userId,
                    type: 'supplement_reminder',
                    title,
                    message,
                    icon: 'pill',
                    priority: 'high',
                    actionUrl: '/supplements',
                    metadata: { doseIds, supplementIds },
                    expiresAt: new Date(now.getTime() + NOTIFICATION_TTL_MS),
                },
                push: {
                    userId: rows[0].userId,
                    payload: {
                        title,
                        body: message,
                        data: { type: 'supplement_reminder', screen: 'supplement-today', notificationId: String(_id) },
                    },
                },
            });
        }
        if (entries.length === 0) return 0;

        const chunks = [];
        for (let i = 0; i < entries.length; i += INSERT_CHUNK) chunks.push(entries.slice(i, i + INSERT_CHUNK));

        const processChunk = async (chunk) => {
            try {
                const inserted = await Notification.insertMany(chunk.map((e) => e.doc), { ordered: false });
                // Reuse the existing push fan-out and its per-notification delivery
                // record (see Notification.pushDelivery) rather than a second copy.
                const pushResult = await notificationService.dispatchPush(chunk.map((e) => e.push));
                await notificationService.recordPushDelivery(inserted, pushResult?.results);
                return inserted.length;
            } catch (err) {
                console.error(`[SupplementReminder] chunk failed (${chunk.length} users):`, err.message);
                return 0;
            }
        };

        let written = 0;
        for (let i = 0; i < chunks.length; i += CHUNK_CONCURRENCY) {
            const results = await Promise.all(chunks.slice(i, i + CHUNK_CONCURRENCY).map(processChunk));
            written += results.reduce((sum, n) => sum + n, 0);
        }
        return written;
    }

    // Pending doses past the grace period become 'missed' — silently: no
    // notification for a missed dose, the next upcoming one is reminded as usual.
    // One conditional updateMany over the partial pending index.
    async markMissedDoses(now) {
        const cutoff = new Date(now.getTime() - MISSED_AFTER_MIN * 60 * 1000);
        const res = await DoseLog.updateMany(
            { status: 'pending', scheduledFor: { $lt: cutoff } },
            { $set: { status: 'missed', missedAt: now, missedSource: 'auto', reminderPending: false } }
        ).maxTimeMS(30000);
        return res.modifiedCount || 0;
    }

    // Fixed courses whose last day has passed everywhere on earth move to "Past".
    // Comparing against UTC-yesterday is conservative: the date has ended in every timezone.
    async completeFinishedSupplements(now) {
        const res = await UserSupplement.updateMany(
            { status: 'active', 'duration.endDate': { $lt: addDays(utcDate(now), -1) } },
            { $set: { status: 'completed', completedAt: now } }
        ).maxTimeMS(30000);
        return res.modifiedCount || 0;
    }

    // Tops up the 7-day dose window for supplements whose horizon is running low.
    // Selected by a partial index on materializedThrough — no scan over all users.
    async extendWindows(now, deadline) {
        const cutoff = addDays(utcDate(now), EXTEND_LEAD_DAYS);
        const supplements = await UserSupplement.find({
            status: 'active',
            materializationDone: false,
            materializedThrough: { $lt: cutoff },
        })
            .sort({ materializedThrough: 1 })
            .limit(EXTEND_BATCH)
            .lean();

        let extended = 0;
        for (let i = 0; i < supplements.length && Date.now() < deadline; i += EXTEND_CONCURRENCY) {
            const wave = supplements.slice(i, i + EXTEND_CONCURRENCY);
            const results = await Promise.allSettled(wave.map((s) => materializeSupplement(s, now)));
            results.forEach((r, j) => {
                if (r.status === 'fulfilled') extended += 1;
                else console.error(`[SupplementReminder] extend failed for ${wave[j]._id}:`, r.reason?.message);
            });
        }
        return extended;
    }
}

module.exports = new SupplementReminderService();
