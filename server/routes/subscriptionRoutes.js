const express = require('express');
const router = express.Router();
const {
    getPlans,
    subscribe,
    cancelSubscription,
    handleWebhook,
    getInvoice,
    getMyPayments,
    runInvoiceJob,
} = require('../controllers/subscriptionController');
const { protect } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');
const { verifyQStash } = require('../middleware/qstashAuth');

// Public — Razorpay calls this directly, must stay unauthenticated (verified via HMAC signature instead)
router.post('/webhook', handleWebhook);

// QStash background job — no user session, verified via QStash signature instead
router.post('/internal/invoice-job', verifyQStash, runInvoiceJob);

// Public — pricing page needs this before login
router.get('/plans', getPlans);

router.use(protect);
router.post('/subscribe', apiLimiter, subscribe);
router.post('/cancel', apiLimiter, cancelSubscription);
router.get('/invoice/:paymentId', getInvoice);
router.get('/payments', getMyPayments);

module.exports = router;
