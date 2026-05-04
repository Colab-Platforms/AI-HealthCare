const express = require('express');
const router = express.Router();
const { createTicket, getMyTickets, getAllTickets, respondToTicket } = require('../controllers/supportController');
const { protect, authorize } = require('../middleware/auth');

// User routes
router.use(protect);
router.post('/', createTicket);
router.get('/my-tickets', getMyTickets);

// Admin routes
router.use(authorize('admin', 'superadmin'));
router.get('/', getAllTickets);
router.patch('/:ticketId/respond', respondToTicket);

module.exports = router;