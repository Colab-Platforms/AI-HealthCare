const crypto = require('crypto');
const mongoose = require('mongoose');
const Plan = require('../models/Plan');
const Payment = require('../models/Payment');
const WebhookLog = require('../models/WebhookLog');
const User = require('../models/User');
const { getClient } = require('../services/razorpayService');
const { generateInvoiceNumber, streamInvoicePDF } = require('../services/invoiceService');

// GET /api/subscription/plans — public, used by the pricing page
exports.getPlans = async (req, res) => {
    try {
        const plans = await Plan.find({ isActive: true }).sort({ price: 1 });
        res.json({ success: true, plans });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/subscription/subscribe { planId }
// One-time-payment flow: creates a plain Razorpay Order (not a Subscription — the
// Subscriptions/recurring-payments product isn't activated on the account yet).
// Access does NOT auto-renew; the lifecycle cron reminds the user to renew manually
// before currentPeriodEnd. Does NOT grant access here — only the webhook does that.
exports.subscribe = async (req, res) => {
    try {
        const { planId } = req.body;
        if (!planId) {
            return res.status(400).json({ success: false, message: 'planId is required' });
        }

        const plan = await Plan.findById(planId);
        if (!plan || !plan.isActive) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }
        if (plan.key === 'free') {
            return res.status(400).json({ success: false, message: 'Free plan does not require checkout' });
        }

        const user = await User.findById(req.user._id);

        const razorpay = getClient();
        const order = await razorpay.orders.create({
            amount: plan.price * 100, // paise
            currency: 'INR',
            receipt: `sub_${user._id.toString().slice(-10)}_${Date.now()}`, // Razorpay caps receipt at 40 chars
            notes: {
                internal_user_id: user._id.toString(),
                internal_plan_key: plan.key,
                internal_billing_cycle: plan.billingCycle,
            },
        });

        res.json({
            success: true,
            razorpayOrderId: order.id,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            plan: { id: plan._id, name: plan.name, price: plan.price, billingCycle: plan.billingCycle },
        });
    } catch (error) {
        console.error('[Subscription] subscribe error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/subscription/payments — the caller's own payment history, newest first
exports.getMyPayments = async (req, res) => {
    try {
        const payments = await Payment.find({ user: req.user._id })
            .populate('plan', 'name key billingCycle')
            .sort({ createdAt: -1 })
            .limit(100);

        res.json({ success: true, payments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/subscription/invoice/:paymentId — downloads the PDF invoice for one of the caller's own payments
exports.getInvoice = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.paymentId)) {
            return res.status(400).json({ success: false, message: 'Invalid payment id' });
        }

        const payment = await Payment.findById(req.params.paymentId).populate('plan');
        if (!payment || payment.user.toString() !== req.user._id.toString()) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }
        if (payment.status !== 'paid' || !payment.invoiceNumber) {
            return res.status(400).json({ success: false, message: 'No invoice available for this payment' });
        }
        if (!payment.plan) {
            return res.status(410).json({ success: false, message: 'The plan for this invoice no longer exists' });
        }

        streamInvoicePDF(res, { payment, user: req.user, plan: payment.plan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/subscription/cancel
// One-time-payment flow: there's no Razorpay Subscription entity to cancel — this just
// stops the renewal reminder. Paid access is kept until currentPeriodEnd either way,
// since nothing was ever going to auto-charge again.
exports.cancelSubscription = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user.subscription || user.subscription.plan === 'free') {
            return res.status(400).json({ success: false, message: 'No active subscription to cancel' });
        }

        user.subscription.status = 'cancelled';
        user.subscription.autoRenew = false;
        user.subscription.statusUpdatedAt = new Date();
        await user.save();

        res.json({ success: true, message: 'Renewal reminders stopped. You will keep access until your current billing period ends.' });
    } catch (error) {
        console.error('[Subscription] cancel error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/subscription/webhook — no auth (Razorpay calls this directly), HMAC-verified
exports.handleWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const expected = crypto
            .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
            .update(req.rawBody)
            .digest('hex');

        if (!signature || signature !== expected) {
            console.warn('[Razorpay Webhook] Invalid signature — rejecting');
            return res.status(400).json({ success: false, message: 'Invalid signature' });
        }

        const event = req.body;
        const eventId = event.id || `${event.event}-${event.created_at}`;

        // Idempotency: if we've already recorded this exact event, ack and stop.
        try {
            await WebhookLog.create({ eventId, eventType: event.event });
        } catch (dupErr) {
            if (dupErr.code === 11000) {
                return res.json({ success: true, message: 'Already processed' });
            }
            throw dupErr;
        }

        const paymentEntity = event.payload?.payment?.entity;
        const notes = paymentEntity?.notes || {};
        const userId = notes.internal_user_id;

        if (!userId) {
            // Event we don't care about (e.g. unrelated payment) — ack so Razorpay stops retrying.
            return res.json({ success: true, message: 'Event ignored' });
        }

        const user = await User.findById(userId);
        if (!user) {
            console.warn('[Razorpay Webhook] No user matched for order', paymentEntity?.order_id);
            return res.json({ success: true, message: 'No matching user' });
        }

        const planKey = notes.internal_plan_key;
        const billingCycle = notes.internal_billing_cycle || 'monthly';
        const plan = planKey ? await Plan.findOne({ key: planKey, billingCycle, isActive: true }) : null;

        switch (event.event) {
            case 'payment.captured': {
                if (!plan) break; // can't credit access without knowing which plan was paid for

                const periodDays = billingCycle === 'yearly' ? 365 : 30;
                const periodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);

                user.subscription.status = 'active';
                user.subscription.statusUpdatedAt = new Date();
                user.subscription.plan = planKey;
                user.subscription.billingCycle = billingCycle;
                user.subscription.startDate = new Date();
                user.subscription.currentPeriodEnd = periodEnd;
                user.subscription.endDate = periodEnd;
                user.subscription.autoRenew = false; // one-time payment — no Razorpay auto-charge behind this
                user.subscription.renewalReminderSentAt = undefined;
                await user.save();

                const payment = await Payment.create({
                    user: user._id,
                    plan: plan._id,
                    razorpayOrderId: paymentEntity.order_id,
                    razorpayPaymentId: paymentEntity.id,
                    razorpayEventId: eventId,
                    amount: (paymentEntity.amount || 0) / 100,
                    status: 'paid',
                });
                payment.invoiceNumber = generateInvoiceNumber(payment);
                await payment.save();
                break;
            }

            case 'payment.failed':
                // No access was granted yet on the one-time-payment flow, so nothing to roll back —
                // just log it. The user simply sees the failure in the checkout modal and can retry.
                console.warn('[Razorpay Webhook] payment.failed for user', user._id.toString());
                break;

            default:
                // Unhandled event type — ack without action.
                break;
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[Razorpay Webhook] Processing error:', error);
        // Still ack 200 isn't right here — return 500 so Razorpay retries, since this is our bug, not a bad event.
        res.status(500).json({ success: false, message: error.message });
    }
};
