const express = require('express');
const router = express.Router();
const gamificationController = require('../controllers/gamificationController');
const { protect } = require('../middleware/auth');

router.get('/profile', protect, gamificationController.getProfile);
router.post('/award-points', protect, gamificationController.awardPoints);
router.post('/check-badges', protect, gamificationController.checkBadges);

module.exports = router;
