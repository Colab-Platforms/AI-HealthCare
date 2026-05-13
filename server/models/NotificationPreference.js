const mongoose = require('mongoose');

const notificationPreferenceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    // Meal reminders - user's preferred meal times
    mealReminders: {
        enabled: { type: Boolean, default: true },
        breakfast: { type: String, default: '08:00' }, // HH:MM format
        lunch: { type: String, default: '13:00' },
        snack: { type: String, default: '16:00' },
        dinner: { type: String, default: '19:00' }
    },
    // Sleep reminders
    sleepReminder: {
        enabled: { type: Boolean, default: true },
        time: { type: String, default: '22:00' }, // HH:MM format
        targetSleepHours: { type: Number, default: 8 }
    },
    // Macro updates
    macroUpdate: {
        enabled: { type: Boolean, default: true },
        time: { type: String, default: '18:00' } // HH:MM format
    },
    // Diet adherence check
    dietAdherence: {
        enabled: { type: Boolean, default: true },
        time: { type: String, default: '20:00' } // HH:MM format
    },
    // Glucose alerts (for diabetic users)
    glucoseAlerts: {
        enabled: { type: Boolean, default: true },
        lowThreshold: { type: Number, default: 70 }, // mg/dL
        highThreshold: { type: Number, default: 180 }, // mg/dL
        checkingFrequency: { type: String, enum: ['immediate', 'hourly', 'daily'], default: 'immediate' }
    },
    // Wearable sync notifications
    wearableSync: {
        enabled: { type: Boolean, default: true },
        notifyOnSync: { type: Boolean, default: true }
    },
    // Goal achievement notifications
    goalNotifications: {
        enabled: { type: Boolean, default: true },
        notifyOnMilestone: { type: Boolean, default: true }
    },
    // Health insights
    healthInsights: {
        enabled: { type: Boolean, default: true },
        frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'daily' },
        time: { type: String, default: '09:00' } // HH:MM format
    },
    // Report notifications
    reportNotifications: {
        enabled: { type: Boolean, default: true },
        notifyOnUpload: { type: Boolean, default: true },
        notifyOnAnalysis: { type: Boolean, default: true }
    },
    // Medication reminders
    medicationReminders: {
        enabled: { type: Boolean, default: true },
        times: [{ type: String }] // Array of HH:MM times
    },
    // Doctor appointment reminders
    appointmentReminders: {
        enabled: { type: Boolean, default: true },
        reminderBefore: { type: Number, default: 24 } // hours before appointment
    },
    // General notification settings
    timezone: { type: String, default: 'UTC' },
    quietHours: {
        enabled: { type: Boolean, default: false },
        startTime: { type: String }, // HH:MM format
        endTime: { type: String } // HH:MM format
    },
    notificationChannel: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
        sms: { type: Boolean, default: false }
    }
}, { timestamps: true });

// ✅ OPTIMIZED: Add indexes for faster queries
notificationPreferenceSchema.index({ userId: 1 }); // Fast user lookup
notificationPreferenceSchema.index({ 'mealReminders.enabled': 1 }); // Fast enabled status check
notificationPreferenceSchema.index({ 'sleepReminder.enabled': 1 });
notificationPreferenceSchema.index({ 'macroUpdate.enabled': 1 });
notificationPreferenceSchema.index({ 'dietAdherence.enabled': 1 });
notificationPreferenceSchema.index({ 'healthInsights.enabled': 1 });

module.exports = mongoose.model('NotificationPreference', notificationPreferenceSchema);
