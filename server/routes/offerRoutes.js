const express = require('express');
const router = express.Router();
const shopifyOfferService = require('../services/shopifyOfferService');
const { protect } = require('../middleware/auth');
const { apiLimiter, offerRedeemLimiter } = require('../middleware/rateLimit');

const { OfferError } = shopifyOfferService;

router.use(protect);

const fail = (res, label, err) => {
    if (err instanceof OfferError) {
        return res.status(err.status).json({ success: false, code: err.code, message: err.message });
    }
    console.error(`[Offers] ${label} error:`, err);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
};

// GET /api/offers/shopify — has this user claimed the store offer? (to hide/show the Redeem screen)
router.get('/shopify', apiLimiter, async (req, res) => {
    try {
        res.json({ success: true, data: await shopifyOfferService.getStatusForUser(req.user._id) });
    } catch (err) {
        fail(res, 'status', err);
    }
});

// POST /api/offers/shopify/redeem  { "orderNumber": "TAKE11005" }
router.post('/shopify/redeem', offerRedeemLimiter, async (req, res) => {
    try {
        res.json({ success: true, data: await shopifyOfferService.redeemForUser(req.user._id, req.body?.orderNumber) });
    } catch (err) {
        fail(res, 'redeem', err);
    }
});

module.exports = router;
