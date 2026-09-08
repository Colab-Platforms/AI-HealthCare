const express = require('express');
const router = express.Router();
const { createTicket, createPublicTicket, getMyTickets, getAllTickets, respondToTicket, aiChat } = require('../controllers/supportController');
const { protect, authorize } = require('../middleware/auth');
const { aiLimiter, sensitiveActionLimiter } = require('../middleware/rateLimit');
const upload = require('../middleware/upload');

// Public route — raise a ticket without logging in
router.post('/public', sensitiveActionLimiter, upload.single('attachment'), createPublicTicket);

// User routes
router.use(protect);
router.post('/', createTicket);
router.get('/my-tickets', getMyTickets);
router.post('/ai-chat', aiLimiter, aiChat);

// Admin routes
router.use(authorize('admin', 'superadmin'));
router.get('/', getAllTickets);
router.patch('/:ticketId/respond', respondToTicket);

module.exports = router;