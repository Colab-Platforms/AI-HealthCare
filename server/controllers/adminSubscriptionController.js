const mongoose = require('mongoose');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Plan = require('../models/Plan');
const { streamInvoicePDF } = require('../services/invoiceService');

// GET /api/admin/subscriptions/payments/:paymentId/invoice — support use case, any admin can pull any user's invoice
exports.getPaymentInvoice = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.paymentId)) {
            return res.status(400).json({ success: false, message: 'Invalid payment id' });
        }

        const payment = await Payment.findById(req.params.paymentId).populate('plan').populate('user', 'name email');
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }
        if (payment.status !== 'paid' || !payment.invoiceNumber) {
            return res.status(400).json({ success: false, message: 'No invoice available for this payment' });
        }
        if (!payment.plan || !payment.user) {
            return res.status(410).json({ success: false, message: 'The plan or user for this invoice no longer exists' });
        }

        streamInvoicePDF(res, { payment, user: payment.user, plan: payment.plan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/admin/subscriptions — paginated list of paid subscribers, filterable by plan/status
exports.getSubscribers = async (req, res) => {
    try {
        const { plan, status, search, page = 1, limit = 20 } = req.query;

        const filter = { 'subscription.plan': { $ne: 'free' } };
        if (plan) filter['subscription.plan'] = plan;
        if (status) filter['subscription.status'] = status;
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const [users, total] = await Promise.all([
            User.find(filter)
                .select('name email subscription createdAt')
                .sort({ 'subscription.startDate': -1 })
                .skip(skip)
                .limit(Number(limit)),
            User.countDocuments(filter),
        ]);

        res.json({ success: true, users, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/admin/subscriptions/payments — paginated payment history across all users
exports.getPayments = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;

        const filter = {};
        if (status) filter.status = status;

        const skip = (Number(page) - 1) * Number(limit);
        const [payments, total] = await Promise.all([
            Payment.find(filter)
                .populate('user', 'name email')
                .populate('plan', 'name key billingCycle')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Payment.countDocuments(filter),
        ]);

        res.json({ success: true, payments, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/admin/subscriptions/revenue — revenue totals by plan, for paid payments only
exports.getRevenueSummary = async (req, res) => {
    try {
        const summary = await Payment.aggregate([
            { $match: { status: 'paid' } },
            {
                $group: {
                    _id: '$plan',
                    totalRevenue: { $sum: '$amount' },
                    paymentCount: { $sum: 1 },
                },
            },
            { $lookup: { from: 'plans', localField: '_id', foreignField: '_id', as: 'plan' } },
            { $unwind: '$plan' },
            {
                $project: {
                    _id: 0,
                    planName: '$plan.name',
                    planKey: '$plan.key',
                    billingCycle: '$plan.billingCycle',
                    totalRevenue: 1,
                    paymentCount: 1,
                },
            },
        ]);

        const totalRevenue = summary.reduce((sum, s) => sum + s.totalRevenue, 0);

        res.json({ success: true, totalRevenue, byPlan: summary });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// PATCH /api/admin/subscriptions/:userId/override — manually set a user's plan/status
// (support/comp access). Does NOT touch Razorpay — this is a local override only, so it
// will be superseded by the next real webhook event for that user's actual subscription.
exports.overrideSubscription = async (req, res) => {
    try {
        const { plan, status, currentPeriodEnd } = req.body;

        if (plan) {
            const planExists = await Plan.exists({ key: plan });
            if (!planExists) {
                return res.status(400).json({ success: false, message: `Unknown plan key: ${plan}` });
            }
        }

        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (plan) user.subscription.plan = plan;
        if (status) {
            user.subscription.status = status;
            user.subscription.statusUpdatedAt = new Date();
        }
        if (currentPeriodEnd) {
            user.subscription.currentPeriodEnd = new Date(currentPeriodEnd);
            user.subscription.endDate = user.subscription.currentPeriodEnd;
        }
        await user.save();

        console.log(`[Admin Override] ${req.user.email} set user ${user.email} subscription to`, { plan, status, currentPeriodEnd });

        res.json({ success: true, subscription: user.subscription });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
