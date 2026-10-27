const Notification = require('../models/Notification');
const {
    normalizeToken,
    upsertToken,
    deactivateToken,
    syncLegacyField,
    clearLegacyField
} = require('../services/fcmTokenService');

// Get all notifications for current user
exports.getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50);

        const unreadCount = await Notification.countDocuments({
            userId: req.user._id,
            read: false
        });

        res.json({
            success: true,
            notifications,
            unreadCount
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ success: false, message: 'Failed to get notifications' });
    }
};

// Get unread count only
exports.getUnreadCount = async (req, res) => {
    try {
        const unreadCount = await Notification.countDocuments({
            userId: req.user._id,
            read: false
        });

        res.json({ success: true, unreadCount });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ success: false, message: 'Failed to get unread count' });
    }
};

// Mark a notification as read
exports.markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.json({ success: true, notification });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
    }
};

// Mark all as read
exports.markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.user._id, read: false },
            { read: true }
        );

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({ success: false, message: 'Failed to mark all as read' });
    }
};

// Delete a notification
exports.deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete notification' });
    }
};

// Register FCM token for current user's device
exports.registerFCMToken = async (req, res) => {
    try {
        const { platform, deviceLabel } = req.body;
        const token = normalizeToken(req.body.token);

        if (!token) {
            return res.status(400).json({ success: false, message: 'Invalid FCM token' });
        }

        await upsertToken(req.user._id, token, { platform, deviceLabel });

        // Legacy single-token field, kept in sync so anything still reading
        // user.fcmToken directly (e.g. the profile response) reflects reality.
        syncLegacyField(req.user._id, token);

        res.json({ success: true, message: 'FCM token registered' });
    } catch (error) {
        console.error('Register FCM token error:', error);
        res.status(500).json({ success: false, message: 'Failed to register token' });
    }
};

// Deregister FCM token (on logout)
exports.deregisterFCMToken = async (req, res) => {
    try {
        const token = normalizeToken(req.body.token);
        if (!token) return res.status(400).json({ success: false, message: 'Token required' });

        await deactivateToken(token, req.user._id);

        // Only clear the legacy field if it was this token — a user can have
        // several active devices, and deregistering one shouldn't blank the
        // field for the others.
        clearLegacyField(req.user._id, token);

        res.json({ success: true, message: 'FCM token deregistered' });
    } catch (error) {
        console.error('Deregister FCM token error:', error);
        res.status(500).json({ success: false, message: 'Failed to deregister token' });
    }
};

// Clear all notifications
exports.clearAll = async (req, res) => {
    try {
        await Notification.deleteMany({ userId: req.user._id });
        res.json({ success: true, message: 'All notifications cleared' });
    } catch (error) {
        console.error('Clear all error:', error);
        res.status(500).json({ success: false, message: 'Failed to clear notifications' });
    }
};
