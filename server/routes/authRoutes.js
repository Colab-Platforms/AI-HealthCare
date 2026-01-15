const express = require('express');
const router = express.Router();
const { register, registerDoctor, login, getProfile, updateProfile, getSubscription, createAdmin } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

router.post('/register', register);
router.post('/register/doctor', registerDoctor);
router.post('/login', login);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.get('/subscription', protect, getSubscription);
router.post('/admin/create', protect, authorize('admin'), createAdmin);

module.exports = router;
