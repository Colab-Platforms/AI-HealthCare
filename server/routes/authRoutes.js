const express = require('express');
const router = express.Router();
const {
    register, requestRegistrationOtp, registerDoctor, login, getProfile, updateProfile,
    getSubscription, createAdmin, uploadProfilePicture,
    verifyEmail, resendVerificationCode
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { authLimiter } = require('../middleware/rateLimit');

router.post('/register', authLimiter, register);
router.post('/register-otp', authLimiter, requestRegistrationOtp);
router.post('/register/doctor', authLimiter, registerDoctor);
router.post('/login', authLimiter, login);
router.post('/logout', protect, require('../controllers/authController').logout);
router.post('/verify-email', authLimiter, verifyEmail);
router.post('/resend-verify-code', authLimiter, resendVerificationCode);
router.post('/forgot-password', authLimiter, require('../controllers/authController').forgotPassword);
router.post('/verify-reset-code', authLimiter, require('../controllers/authController').verifyResetCode);
router.post('/reset-password', authLimiter, require('../controllers/authController').resetPassword);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/upload-profile-picture', protect, upload.single('profilePicture'), uploadProfilePicture);
router.get('/subscription', protect, getSubscription);
router.post('/admin/create', protect, authorize('admin'), createAdmin);

module.exports = router;
