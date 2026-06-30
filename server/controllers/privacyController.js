const User = require('../models/User');
const ConsentLog = require('../models/ConsentLog');
const HealthReport = require('../models/HealthReport');
const MedicalDocument = require('../models/MedicalDocument');
const FoodLog = require('../models/FoodLog');
const HealthMetric = require('../models/HealthMetric');
const ActivityLog = require('../models/ActivityLog');
const ChatHistory = require('../models/ChatHistory');
const { ZipArchive } = require('archiver');

const CONSENT_VERSION = '1.0';

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
        const scheduledDeletion = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        await User.findByIdAndUpdate(req.user._id, {
            'dataRetention.scheduledDeletion':   scheduledDeletion,
            'dataRetention.deletionRequestedAt': new Date(),
            isActive: false, // soft-deactivate immediately
        });

        await ConsentLog.create({
            userId:    req.user._id,
            version:   CONSENT_VERSION,
            action:    'withdrawn',
            purposes:  ['health_processing', 'analytics', 'marketing'],
            ipAddress: req.ip,
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
   POST /api/privacy/cancel-deletion
   Cancel a pending account deletion request
───────────────────────────────────────────── */
exports.cancelAccountDeletion = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            'dataRetention.scheduledDeletion':   null,
            'dataRetention.deletionRequestedAt': null,
            isActive: true,
        });
        res.json({ success: true, message: 'Account deletion cancelled.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
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
        }).select('_id email').lean();

        if (!due.length) return;

        for (const u of due) {
            const uid = u._id;
            await Promise.all([
                HealthReport.deleteMany({ user: uid }),
                MedicalDocument.deleteMany({ userId: uid }),
                FoodLog.deleteMany({ userId: uid }),
                HealthMetric.deleteMany({ userId: uid }),
                ChatHistory.deleteMany({ userId: uid }),
                ActivityLog.deleteMany({ userId: uid }),
                ConsentLog.deleteMany({ userId: uid }),
            ]);
            await User.findByIdAndDelete(uid);
            console.log(`🗑️ [DPDPA] Deleted account: ${u.email}`);
        }
    } catch (err) {
        console.error('❌ Deletion cron error:', err.message);
    }
};
