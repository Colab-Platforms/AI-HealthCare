const NotificationPreference = require('../models/NotificationPreference');
const User = require('../models/User');
const notificationService = require('../services/notificationService');

// Get user's notification preferences
exports.getPreferences = async (req, res) => {
    try {
        console.log('📋 Getting preferences for user:', req.user?._id);
        
        if (!req.user || !req.user._id) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        let preferences = await NotificationPreference.findOne({ userId: req.user._id });
        
        // If preferences don't exist, create default ones
        if (!preferences) {
            console.log('📝 Creating default preferences for user:', req.user._id);
            preferences = await NotificationPreference.create({
                userId: req.user._id
            });
        }

        console.log('✅ Preferences retrieved:', preferences._id);
        res.json({
            success: true,
            preferences
        });
    } catch (error) {
        console.error('❌ Get preferences error:', error);
        res.status(500).json({ success: false, message: 'Failed to get preferences', error: error.message });
    }
};

// Update notification preferences
exports.updatePreferences = async (req, res) => {
    try {
        const { mealReminders, sleepReminder, macroUpdate, dietAdherence, glucoseAlerts, wearableSync, goalNotifications, healthInsights, reportNotifications, medicationReminders, appointmentReminders, timezone, quietHours, notificationChannel } = req.body;

        let preferences = await NotificationPreference.findOne({ userId: req.user._id });

        if (!preferences) {
            preferences = new NotificationPreference({ userId: req.user._id });
        }

        // Update only provided fields
        if (mealReminders) preferences.mealReminders = { ...preferences.mealReminders, ...mealReminders };
        if (sleepReminder) preferences.sleepReminder = { ...preferences.sleepReminder, ...sleepReminder };
        if (macroUpdate) preferences.macroUpdate = { ...preferences.macroUpdate, ...macroUpdate };
        if (dietAdherence) preferences.dietAdherence = { ...preferences.dietAdherence, ...dietAdherence };
        if (glucoseAlerts) preferences.glucoseAlerts = { ...preferences.glucoseAlerts, ...glucoseAlerts };
        if (wearableSync) preferences.wearableSync = { ...preferences.wearableSync, ...wearableSync };
        if (goalNotifications) preferences.goalNotifications = { ...preferences.goalNotifications, ...goalNotifications };
        if (healthInsights) preferences.healthInsights = { ...preferences.healthInsights, ...healthInsights };
        if (reportNotifications) preferences.reportNotifications = { ...preferences.reportNotifications, ...reportNotifications };
        if (medicationReminders) preferences.medicationReminders = medicationReminders;
        if (appointmentReminders) preferences.appointmentReminders = { ...preferences.appointmentReminders, ...appointmentReminders };
        if (timezone) preferences.timezone = timezone;
        if (quietHours) preferences.quietHours = { ...preferences.quietHours, ...quietHours };
        if (notificationChannel) preferences.notificationChannel = { ...preferences.notificationChannel, ...notificationChannel };

        await preferences.save();

        // ✅ OPTIMIZED: Invalidate cache when preferences change
        notificationService.invalidateCache();

        res.json({
            success: true,
            message: 'Preferences updated successfully',
            preferences
        });
    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({ success: false, message: 'Failed to update preferences' });
    }
};

// Update specific meal time
exports.updateMealTime = async (req, res) => {
    try {
        const { mealType, time } = req.body; // mealType: 'breakfast', 'lunch', 'snack', 'dinner'

        if (!['breakfast', 'lunch', 'snack', 'dinner'].includes(mealType)) {
            return res.status(400).json({ success: false, message: 'Invalid meal type' });
        }

        let preferences = await NotificationPreference.findOne({ userId: req.user._id });

        if (!preferences) {
            preferences = new NotificationPreference({ userId: req.user._id });
        }

        preferences.mealReminders[mealType] = time;
        await preferences.save();

        // ✅ OPTIMIZED: Invalidate cache
        notificationService.invalidateCache();

        res.json({
            success: true,
            message: `${mealType} time updated to ${time}`,
            preferences
        });
    } catch (error) {
        console.error('Update meal time error:', error);
        res.status(500).json({ success: false, message: 'Failed to update meal time' });
    }
};

// Update sleep schedule
exports.updateSleepSchedule = async (req, res) => {
    try {
        const { time, targetSleepHours } = req.body;

        let preferences = await NotificationPreference.findOne({ userId: req.user._id });

        if (!preferences) {
            preferences = new NotificationPreference({ userId: req.user._id });
        }

        if (time) preferences.sleepReminder.time = time;
        if (targetSleepHours) preferences.sleepReminder.targetSleepHours = targetSleepHours;

        await preferences.save();

        // ✅ OPTIMIZED: Invalidate cache
        notificationService.invalidateCache();

        res.json({
            success: true,
            message: 'Sleep schedule updated',
            preferences
        });
    } catch (error) {
        console.error('Update sleep schedule error:', error);
        res.status(500).json({ success: false, message: 'Failed to update sleep schedule' });
    }
};

// Toggle notification type
exports.toggleNotificationType = async (req, res) => {
    try {
        const { type, enabled } = req.body; // type: 'mealReminders', 'sleepReminder', etc.

        let preferences = await NotificationPreference.findOne({ userId: req.user._id });

        if (!preferences) {
            preferences = new NotificationPreference({ userId: req.user._id });
        }

        if (preferences[type]) {
            preferences[type].enabled = enabled;
        }

        await preferences.save();

        // ✅ OPTIMIZED: Invalidate cache
        notificationService.invalidateCache();

        res.json({
            success: true,
            message: `${type} ${enabled ? 'enabled' : 'disabled'}`,
            preferences
        });
    } catch (error) {
        console.error('Toggle notification type error:', error);
        res.status(500).json({ success: false, message: 'Failed to toggle notification type' });
    }
};

// Get all users' preferences (for admin)
exports.getAllPreferences = async (req, res) => {
    try {
        const preferences = await NotificationPreference.find()
            .populate('userId', 'name email')
            .limit(100);

        res.json({
            success: true,
            count: preferences.length,
            preferences
        });
    } catch (error) {
        console.error('Get all preferences error:', error);
        res.status(500).json({ success: false, message: 'Failed to get preferences' });
    }
};
