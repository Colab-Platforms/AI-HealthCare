const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: [
            'food_reminder',      // Remind to log food
            'sleep_reminder',     // Remind to log sleep
            'macro_update',       // Macro consumption update
            'diet_adherence',     // Whether following recommended diet
            'health_insight',     // General health insights
            'report_comparison',  // Report comparison available
            'goal_progress',      // Progress toward fitness goal
            'diet_ready',         // Personalized diet plan generated
            'gamification_points', // Points earned
            'gamification_tier',   // Tier upgraded
            'gamification_badge',  // Badge unlocked
            'supplement_reminder'  // Supplement dose due soon
        ],
        required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    icon: { type: String, default: '' },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    read: { type: Boolean, default: false },
    actionUrl: String, // Where clicking the notification should navigate
    metadata: mongoose.Schema.Types.Mixed, // Additional data (e.g., macro values)
    // Result of the actual FCM push attempt for this record, written right
    // after dispatchPush resolves — without this, "push never arrived" was
    // only diagnosable by reading live Render logs at the exact minute it
    // happened (see the debugging history that led here). successCount/total
    // are per-device (one user can have several tokens); error is the first
    // FCM error code hit when successCount is 0. Absent on older records and
    // on notification types that never push (e.g. nothing to diagnose there).
    pushDelivery: {
        successCount: Number,
        total: Number,
        error: String
    },
    expiresAt: Date // Auto-expire notifications
}, {
    timestamps: true
});

// Index for efficient queries
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Serves the reminder cron's once-a-day dedupe seed:
//   find({ type: { $in: [...] }, createdAt: { $gte: startOfToday } })
// Without it that query collection-scans every notification ever written.
notificationSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
