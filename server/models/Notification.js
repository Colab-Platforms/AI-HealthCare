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
            'goal_progress'       // Progress toward fitness goal
        ],
        required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    icon: { type: String, default: '🔔' }, // Emoji icon
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    read: { type: Boolean, default: false },
    actionUrl: String, // Where clicking the notification should navigate
    metadata: mongoose.Schema.Types.Mixed, // Additional data (e.g., macro values)
    expiresAt: Date // Auto-expire notifications
}, {
    timestamps: true
});

// Index for efficient queries
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

module.exports = mongoose.model('Notification', notificationSchema);
