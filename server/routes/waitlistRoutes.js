const express = require('express');
const router = express.Router();
const { joinWaitlist } = require('../controllers/waitlistController');
const { authLimiter } = require('../middleware/rateLimit');

router.post('/', authLimiter, joinWaitlist);

module.exports = router;
