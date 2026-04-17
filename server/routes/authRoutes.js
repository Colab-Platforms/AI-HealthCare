const express = require('express');
const router = express.Router();
const {
    register, requestRegistrationOtp, registerDoctor, login, getProfile, updateProfile,
    getSubscription, createAdmin, uploadProfilePicture,
    verifyEmail, resendVerificationCode
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/register', register);
router.post('/register-otp', requestRegistrationOtp);
router.post('/register/doctor', registerDoctor);
router.post('/login', login);
router.post('/logout', protect, require('../controllers/authController').logout);
router.post('/verify-email', verifyEmail);
router.post('/resend-verify-code', resendVerificationCode);
router.post('/forgot-password', require('../controllers/authController').forgotPassword);
router.post('/verify-reset-code', require('../controllers/authController').verifyResetCode);
router.post('/reset-password', require('../controllers/authController').resetPassword);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/upload-profile-picture', protect, upload.single('profilePicture'), uploadProfilePicture);
router.get('/subscription', protect, getSubscription);
router.post('/admin/create', protect, authorize('admin'), createAdmin);

module.exports = router;
