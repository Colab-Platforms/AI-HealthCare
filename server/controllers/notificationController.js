const Notification = require('../models/Notification');
const FCMToken = require('../models/FCMToken');

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
        const { token, platform = 'web', deviceLabel = 'Unknown Device' } = req.body;

        if (!token || typeof token !== 'string' || token.trim().length < 20) {
            return res.status(400).json({ success: false, message: 'Invalid FCM token' });
        }

        // Upsert: if token exists update lastUsedAt + reactivate, else create
        await FCMToken.findOneAndUpdate(
            { token: token.trim() },
            {
                userId: req.user._id,
                platform,
                deviceLabel,
                isActive: true,
                lastUsedAt: new Date()
            },
            { upsert: true, new: true }
        );

        res.json({ success: true, message: 'FCM token registered' });
    } catch (error) {
        console.error('Register FCM token error:', error);
        res.status(500).json({ success: false, message: 'Failed to register token' });
    }
};

// Deregister FCM token (on logout)
exports.deregisterFCMToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ success: false, message: 'Token required' });

        await FCMToken.findOneAndUpdate(
            { token, userId: req.user._id },
            { isActive: false }
        );

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
