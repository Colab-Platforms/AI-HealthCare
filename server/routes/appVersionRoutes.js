const express = require('express');
const router = express.Router();
const { apiLimiter } = require('../middleware/rateLimit');
const { reportVersion } = require('../controllers/appVersionController');

// Public, not protect-gated — called on every app launch (logged-in or not),
// and carries no user-specific data of its own.
router.post('/report', apiLimiter, reportVersion);

module.exports = router;
