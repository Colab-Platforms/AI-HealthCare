const express = require('express');
const router = express.Router();
const {
    register, requestRegistrationOtp, registerDoctor, login, googleAuth, getProfile, updateProfile,
    getSubscription, createAdmin, uploadProfilePicture,
    verifyEmail, resendVerificationCode,
    requestPhoneLoginOtp, loginWithPhoneOtp, requestPhoneVerificationOtp, verifyPhone
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { authLimiter, sensitiveActionLimiter } = require('../middleware/rateLimit')

router.post('/register', authLimiter, register);
router.post('/register-otp', authLimiter, requestRegistrationOtp);
router.post('/register/doctor', authLimiter, registerDoctor);
router.post('/login', authLimiter, login);
router.post('/phone/login-otp', authLimiter, requestPhoneLoginOtp);
router.post('/phone/login', authLimiter, loginWithPhoneOtp);
router.post('/phone/verify-otp', protect, sensitiveActionLimiter, requestPhoneVerificationOtp);
router.post('/phone/verify', protect, sensitiveActionLimiter, verifyPhone);
router.post('/google', authLimiter, googleAuth);
router.post('/logout', protect, require('../controllers/authController').logout);
router.post('/refresh', require('../controllers/authController').refresh);
router.post('/verify-email', authLimiter, verifyEmail);
router.post('/resend-verify-code', authLimiter, resendVerificationCode);
router.post('/forgot-password', authLimiter, require('../controllers/authController').forgotPassword);
router.post('/verify-reset-code', authLimiter, require('../controllers/authController').verifyResetCode);
router.post('/reset-password', authLimiter, require('../controllers/authController').resetPassword);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/change-password', protect, sensitiveActionLimiter, require('../controllers/authController').changePassword);
router.post('/upload-profile-picture', protect, upload.single('profilePicture'), uploadProfilePicture);
router.get('/subscription', protect, getSubscription);
router.post('/admin/create', protect, authorize('superadmin'), createAdmin);

module.exports = router;
