const express = require('express');
const router = express.Router();
const {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const { Receiver } = require('@upstash/qstash');
const notificationService = require('../services/notificationService');

/**
 * POST /api/notifications/cron-tick
 * Called by an Upstash QStash Schedule every few minutes (production/serverless).
 * Not user-authenticated — verified via QStash signature instead.
 */
router.post('/cron-tick', async (req, res) => {
    try {
        const receiver = new Receiver({
            currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
            nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY
        });
        await receiver.verify({
            signature: req.headers['upstash-signature'],
            body: JSON.stringify(req.body || {})
        });

        await notificationService.checkAndSendUserNotifications();
        res.json({ success: true });
    } catch (error) {
        console.error('Notification cron-tick error:', error.message);
        // Non-200 so QStash retries
        res.status(500).json({ success: false, error: error.message });
    }
});

// All routes below require authentication
router.use(protect);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/:id/read', markAsRead);
router.put('/mark-all-read', markAllAsRead);
router.delete('/:id', deleteNotification);
router.delete('/', clearAll);

module.exports = router;
