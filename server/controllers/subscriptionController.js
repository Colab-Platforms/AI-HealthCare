const crypto = require('crypto');
const mongoose = require('mongoose');
const Plan = require('../models/Plan');
const Payment = require('../models/Payment');
const WebhookLog = require('../models/WebhookLog');
const User = require('../models/User');
const { getClient } = require('../services/razorpayService');
const { generateInvoiceNumber, streamInvoicePDF } = require('../services/invoiceService');
const emailService = require('../services/emailService');
const { PAST_DUE_GRACE_DAYS } = require('../services/subscriptionLifecycleService');

// Single greppable tag for the whole payment flow (Render logs: search "[Payment]")
// so one transaction can be traced end-to-end from the subscribe click to the
// webhook that actually grants the plan.
const logPayment = (stage, data = {}) => console.log(`[Payment] ${stage}`, JSON.stringify(data));

// GET /api/subscription/plans — public, used by the pricing page
exports.getPlans = async (req, res) => {
    try {
        const plans = await Plan.find({ isActive: true }).sort({ price: 1 });
        res.json({ success: true, plans });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Razorpay requires a finite total_count of billing cycles even for an "indefinite"
// subscription — set far enough out (~10 years) that it never matters in practice;
// the subscription still auto-charges every cycle until the user cancels.
const TOTAL_COUNT_BY_CYCLE = { monthly: 120, quarterly: 40, yearly: 10 };

// POST /api/subscription/subscribe { planId }
// Autopay flow: creates a real Razorpay Subscription (not a one-time Order), so
// Razorpay auto-charges the user's saved payment method every billing cycle without
// them returning to checkout. Access is granted only by the webhook (subscription.charged),
// never here — this just hands the frontend a subscription id to open Razorpay Checkout with.
exports.subscribe = async (req, res) => {
    try {
        const { planId } = req.body;
        if (!planId) {
            return res.status(400).json({ success: false, message: 'planId is required' });
        }

        logPayment('subscribe:start', { userId: req.user._id.toString(), planId });

        const plan = await Plan.findById(planId);
        if (!plan || !plan.isActive) {
            logPayment('subscribe:plan_not_found', { planId });
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }
        if (plan.key === 'free') {
            return res.status(400).json({ success: false, message: 'Free plan does not require checkout' });
        }
        if (!plan.razorpayPlanId) {
            logPayment('subscribe:plan_not_synced', { planKey: plan.key, billingCycle: plan.billingCycle });
            return res.status(500).json({ success: false, message: 'Plan is not synced with the payment gateway yet' });
        }

        const user = await User.findById(req.user._id);
        const razorpay = getClient();

        // Reuse the Razorpay customer across re-subscribes/plan changes instead of creating a new one each time.
        let customerId = user.subscription.razorpayCustomerId;
        if (!customerId) {
            // fail_existing: '0' — return the existing Razorpay customer instead of
            // erroring when one already exists for this email/contact (e.g. our DB
            // record was reset/lost but the customer still exists on Razorpay's side).
            const customer = await razorpay.customers.create({
                name: user.name,
                email: user.email,
                contact: user.phone || undefined,
                notes: { internal_user_id: user._id.toString() },
                fail_existing: '0',
            });
            customerId = customer.id;
            user.subscription.razorpayCustomerId = customerId;
            await user.save();
            logPayment('subscribe:customer_created', { userId: user._id.toString(), customerId });
        } else {
            logPayment('subscribe:customer_reused', { userId: user._id.toString(), customerId });
        }

        const totalCount = TOTAL_COUNT_BY_CYCLE[plan.billingCycle] || 120;

        const subscription = await razorpay.subscriptions.create({
            plan_id: plan.razorpayPlanId,
            customer_notify: 1,
            total_count: totalCount,
            notes: {
                internal_user_id: user._id.toString(),
                internal_plan_key: plan.key,
                internal_billing_cycle: plan.billingCycle,
            },
        });

        logPayment('subscribe:razorpay_subscription_created', {
            userId: user._id.toString(),
            razorpaySubscriptionId: subscription.id,
            planKey: plan.key,
            billingCycle: plan.billingCycle,
        });

        res.json({
            success: true,
            razorpaySubscriptionId: subscription.id,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            plan: { id: plan._id, name: plan.name, price: plan.price, billingCycle: plan.billingCycle },
        });
    } catch (error) {
        console.error('[Payment] subscribe:error', { userId: req.user?._id?.toString(), message: error.message, details: error.error || error });
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
// Must cancel the actual Razorpay Subscription (cancel_at_cycle_end) — if we only
// flipped local flags, Razorpay would keep auto-charging the user's saved payment
// method every cycle regardless of what our DB says. Access is kept until currentPeriodEnd.
exports.cancelSubscription = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user.subscription || user.subscription.plan === 'free') {
            return res.status(400).json({ success: false, message: 'No active subscription to cancel' });
        }

        if (user.subscription.razorpaySubscriptionId) {
            try {
                const razorpay = getClient();
                await razorpay.subscriptions.cancel(user.subscription.razorpaySubscriptionId, { cancel_at_cycle_end: 1 });
            } catch (gatewayError) {
                console.error('[Payment] cancel:gateway_error', { userId: user._id.toString(), message: gatewayError.message, details: gatewayError.error || gatewayError });
                return res.status(502).json({ success: false, message: 'Could not cancel with the payment provider — please try again.' });
            }
        }

        user.subscription.status = 'cancelled';
        user.subscription.autoRenew = false;
        user.subscription.statusUpdatedAt = new Date();
        await user.save();

        logPayment('cancel:success', { userId: user._id.toString() });
        res.json({ success: true, message: 'Auto-renewal stopped. You will keep access until your current billing period ends.' });
    } catch (error) {
        console.error('[Payment] cancel:error', { userId: req.user?._id?.toString(), message: error.message });
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

        logPayment('webhook:received', { eventType: req.body?.event, hasSignature: !!signature });

        if (!signature || signature !== expected) {
            console.warn('[Payment] webhook:invalid_signature', { eventType: req.body?.event });
            return res.status(400).json({ success: false, message: 'Invalid signature' });
        }

        const event = req.body;
        const eventId = event.id || `${event.event}-${event.created_at}`;

        // Idempotency: if we've already recorded this exact event, ack and stop.
        try {
            await WebhookLog.create({ eventId, eventType: event.event });
        } catch (dupErr) {
            if (dupErr.code === 11000) {
                logPayment('webhook:duplicate', { eventId, eventType: event.event });
                return res.json({ success: true, message: 'Already processed' });
            }
            throw dupErr;
        }

        const paymentEntity = event.payload?.payment?.entity;
        const subscriptionEntity = event.payload?.subscription?.entity;
        // Notes are set by us on both the one-time Order (legacy) and the recurring
        // Subscription (current) — whichever entity this event carries has them.
        const notes = subscriptionEntity?.notes || paymentEntity?.notes || {};
        const userId = notes.internal_user_id;

        if (!userId) {
            // Event we don't care about (e.g. unrelated payment) — ack so Razorpay stops retrying.
            logPayment('webhook:ignored_no_notes', { eventId, eventType: event.event });
            return res.json({ success: true, message: 'Event ignored' });
        }

        const user = await User.findById(userId);
        if (!user) {
            console.warn('[Payment] webhook:no_matching_user', { userId, entityId: paymentEntity?.order_id || subscriptionEntity?.id });
            return res.json({ success: true, message: 'No matching user' });
        }

        const planKey = notes.internal_plan_key;
        const billingCycle = notes.internal_billing_cycle || 'monthly';
        const plan = planKey ? await Plan.findOne({ key: planKey, billingCycle, isActive: true }) : null;

        if (planKey && !plan) {
            console.warn('[Payment] webhook:plan_not_resolved', { userId, planKey, billingCycle, eventType: event.event });
        }

        logPayment('webhook:matched', { userId, eventType: event.event, planKey, billingCycle });

        switch (event.event) {
            // Legacy one-time-Order flow — kept so any in-flight old-style payment still gets credited.
            case 'payment.captured': {
                if (!plan) break; // can't credit access without knowing which plan was paid for

                const periodDays = billingCycle === 'yearly' ? 365 : billingCycle === 'quarterly' ? 90 : 30;
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
                logPayment('webhook:plan_applied', { userId: user._id.toString(), planKey, billingCycle, via: 'payment.captured' });
                break;
            }

            // Recurring autopay flow — fires on the very first charge and every renewal after.
            case 'subscription.charged': {
                if (!plan || !subscriptionEntity) break;

                // Razorpay is the authority on the period boundary — use its timestamps
                // rather than computing +N days ourselves, so clock drift can't cause
                // an early/late downgrade.
                const periodEnd = new Date(subscriptionEntity.current_end * 1000);

                user.subscription.status = 'active';
                user.subscription.statusUpdatedAt = new Date();
                user.subscription.plan = planKey;
                user.subscription.billingCycle = billingCycle;
                if (!user.subscription.startDate) user.subscription.startDate = new Date();
                user.subscription.currentPeriodEnd = periodEnd;
                user.subscription.endDate = periodEnd;
                user.subscription.autoRenew = true;
                user.subscription.razorpaySubscriptionId = subscriptionEntity.id;
                user.subscription.renewalReminderSentAt = undefined;
                await user.save();

                const payment = await Payment.create({
                    user: user._id,
                    plan: plan._id,
                    razorpaySubscriptionId: subscriptionEntity.id,
                    razorpayPaymentId: paymentEntity?.id,
                    razorpayEventId: eventId,
                    amount: (paymentEntity?.amount || 0) / 100,
                    status: 'paid',
                });
                payment.invoiceNumber = generateInvoiceNumber(payment);
                await payment.save();
                logPayment('webhook:plan_applied', { userId: user._id.toString(), planKey, billingCycle, via: 'subscription.charged' });
                break;
            }

            // A scheduled recurring charge failed (bank decline, expired card, etc.) — Razorpay
            // will retry a few times on its own before giving up (subscription.halted below).
            // Start our own short grace window immediately rather than waiting for that.
            case 'payment.failed':
            case 'subscription.pending': {
                if (user.subscription.status !== 'past_due') {
                    user.subscription.status = 'past_due';
                    user.subscription.statusUpdatedAt = new Date();
                    await user.save();
                    console.warn('[Payment] webhook:past_due', { userId: user._id.toString(), eventType: event.event });

                    emailService.sendEmail({
                        to: user.email,
                        subject: 'Payment failed — action needed to keep your take.health plan',
                        html: `<p>Hi ${user.name || 'there'},</p>
                               <p>We couldn't process your renewal payment for the ${user.subscription.plan} plan.
                               Please update your payment method within ${PAST_DUE_GRACE_DAYS} days to avoid losing access to paid features.</p>`,
                    }).catch((emailErr) => console.error('[Payment] webhook:past_due_email_failed', { userId: user._id.toString(), message: emailErr.message }));
                }
                break;
            }

            // Razorpay exhausted its own retry schedule and gave up — hard-stop immediately
            // rather than waiting for the lifecycle cron's grace-period sweep to catch it.
            case 'subscription.halted': {
                user.subscription.plan = 'free';
                user.subscription.status = 'expired';
                user.subscription.autoRenew = false;
                user.subscription.statusUpdatedAt = new Date();
                await user.save();
                console.warn('[Payment] webhook:halted_downgraded', { userId: user._id.toString() });
                break;
            }

            // User (or we, via cancelSubscription) cancelled — access remains until currentPeriodEnd,
            // matching cancel_at_cycle_end; no further auto-charges will occur.
            case 'subscription.cancelled': {
                user.subscription.status = 'cancelled';
                user.subscription.autoRenew = false;
                user.subscription.statusUpdatedAt = new Date();
                await user.save();
                logPayment('webhook:cancelled', { userId: user._id.toString() });
                break;
            }

            // total_count cycles reached (the ~10-year cap) — extremely unlikely to ever fire
            // for a real user, but if it does, treat like a graceful non-renewal.
            case 'subscription.completed': {
                user.subscription.autoRenew = false;
                user.subscription.statusUpdatedAt = new Date();
                await user.save();
                console.warn('[Payment] webhook:completed', { userId: user._id.toString() });
                break;
            }

            default:
                // Unhandled event type — ack without action.
                logPayment('webhook:unhandled_event', { eventType: event.event });
                break;
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[Payment] webhook:processing_error', { message: error.message, stack: error.stack });
        // Still ack 200 isn't right here — return 500 so Razorpay retries, since this is our bug, not a bad event.
        res.status(500).json({ success: false, message: error.message });
    }
};
