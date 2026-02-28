const express = require('express');
const router = express.Router();
const { register, registerDoctor, login, getProfile, updateProfile, getSubscription, createAdmin, uploadProfilePicture } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/register', register);
router.post('/register/doctor', registerDoctor);
router.post('/login', login);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/upload-profile-picture', protect, upload.single('profilePicture'), uploadProfilePicture);
router.get('/subscription', protect, getSubscription);
router.post('/admin/create', protect, authorize('admin'), createAdmin);

module.exports = router;
