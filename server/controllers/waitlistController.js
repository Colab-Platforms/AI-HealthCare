const WaitlistUserEmail = require('../models/WaitlistUserEmail');
const emailService = require('../services/emailService');

/**
 * Join Waitlist - Public endpoint
 * POST /api/waitlist
 * Body: { email, name }
 */
exports.joinWaitlist = async (req, res) => {
    try {
        const { email, name } = req.body;

        // Validation
        if (!email || !name) {
            return res.status(400).json({
                success: false,
                message: 'Email and name are required'
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Check if already exists
        const existing = await WaitlistUserEmail.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'You are already on the waitlist',
                data: {
                    position: existing.position,
                    joinedAt: existing.createdAt
                }
            });
        }

        // Get current position (total count + 1)
        const totalCount = await WaitlistUserEmail.countDocuments();
        const position = totalCount + 1;

        // Create waitlist entry — joining is final, no confirmation step
        const newEntry = new WaitlistUserEmail({
            email: email.toLowerCase(),
            name,
            position,
            emailSent: false,
            lastEmailAttempt: null,
            emailRetryCount: 0,
            maxRetries: 3,
            notes: []
        });

        await newEntry.save();

        // Send welcome email (best-effort — failure doesn't block the join)
        try {
            await emailService.sendWaitlistConfirmation(email, name);
            newEntry.emailSent = true;
            newEntry.lastEmailAttempt = new Date();
            await newEntry.save();
        } catch (emailError) {
            console.error('[WaitlistController] Email send failed:', emailError.message);
        }

        return res.status(201).json({
            success: true,
            message: "You're on the waitlist!",
            data: {
                email: newEntry.email,
                name: newEntry.name,
                position
            }
        });

    } catch (error) {
        console.error('[WaitlistController] Error joining waitlist:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to join waitlist. Please try again later.'
        });
    }
};

/**
 * Get Waitlist Stats - Admin only
 * GET /api/waitlist/stats
 */
exports.getWaitlistStats = async (req, res) => {
    try {
        const total = await WaitlistUserEmail.countDocuments();
        const emailSent = await WaitlistUserEmail.countDocuments({ emailSent: true });
        const emailFailed = await WaitlistUserEmail.countDocuments({
            emailSent: false,
            emailRetryCount: { $gte: 3 }
        });

        return res.status(200).json({
            success: true,
            data: { total, emailSent, emailFailed }
        });

    } catch (error) {
        console.error('[WaitlistController] Error getting stats:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve stats'
        });
    }
};

/**
 * Retry Failed Welcome Emails - Admin only
 * POST /api/waitlist/retry-failed-emails
 */
exports.retryFailedEmails = async (req, res) => {
    try {
        const failedEntries = await WaitlistUserEmail.find({
            emailSent: false,
            emailRetryCount: { $lt: 3 }
        }).limit(50);

        if (!failedEntries.length) {
            return res.status(200).json({
                success: true,
                message: 'No failed emails to retry',
                data: { retriedCount: 0 }
            });
        }

        let retriedCount = 0;

        for (const entry of failedEntries) {
            try {
                await emailService.sendWaitlistConfirmation(entry.email, entry.name);
                entry.emailSent = true;
                entry.emailRetryCount += 1;
                entry.lastEmailAttempt = new Date();
                await entry.save();
                retriedCount++;
            } catch (emailError) {
                entry.emailRetryCount += 1;
                entry.lastEmailAttempt = new Date();
                await entry.save();
                console.error(`[WaitlistController] Retry failed for ${entry.email}:`, emailError.message);
            }
        }

        return res.status(200).json({
            success: true,
            message: `Retried ${retriedCount} emails`,
            data: { retriedCount }
        });

    } catch (error) {
        console.error('[WaitlistController] Error retrying emails:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to retry emails'
        });
    }
};
