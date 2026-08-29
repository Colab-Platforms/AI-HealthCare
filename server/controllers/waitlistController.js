const WaitlistUserEmail = require('../models/WaitlistUserEmail');
const emailService = require('../services/emailService');
const crypto = require('crypto');

const RATE_LIMIT_KEY = 'waitlist_email';

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

        // Generate confirmation token
        const confirmationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Create waitlist entry
        const newEntry = new WaitlistUserEmail({
            email: email.toLowerCase(),
            name,
            position,
            confirmationToken,
            tokenExpiry,
            isConfirmed: false,
            emailSent: false,
            lastEmailAttempt: null,
            emailRetryCount: 0,
            maxRetries: 3,
            notes: []
        });

        await newEntry.save();

        // Send confirmation email
        const baseUrl = process.env.CLIENT_URL || (process.env.APP_URL && !process.env.APP_URL.includes('localhost') && !process.env.APP_URL.includes('192.168') ? process.env.APP_URL : 'https://take.health');
        const confirmationUrl = `${baseUrl}/waitlist/confirm/${confirmationToken}`;
        const emailContent = `
Dear ${name},

Thank you for joining our waitlist! We're thrilled to have you.

To confirm your email address, please click the link below:
${confirmationUrl}

This link expires in 24 hours.

Best regards,
Take Health Team
        `;

        try {
            await emailService.sendWaitlistConfirmation(email, name, confirmationUrl);

            // Mark email as sent
            newEntry.emailSent = true;
            newEntry.lastEmailAttempt = new Date();
            await newEntry.save();

        } catch (emailError) {
            console.error('[WaitlistController] Email send failed:', emailError.message);
            // Continue anyway - user can retry
        }

        return res.status(201).json({
            success: true,
            message: 'Successfully added to waitlist! Check your email to confirm.',
            data: {
                email: newEntry.email,
                name: newEntry.name,
                position,
                confirmationEmailSent: newEntry.emailSent
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
 * Confirm Email - Public endpoint
 * GET /api/waitlist/confirm/:token
 */
exports.confirmEmail = async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Confirmation token is required'
            });
        }

        // Find entry by token
        const entry = await WaitlistUserEmail.findOne({
            confirmationToken: token,
            tokenExpiry: { $gt: new Date() } // Token not expired
        });

        if (!entry) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired confirmation token'
            });
        }

        // Mark as confirmed
        entry.isConfirmed = true;
        entry.confirmationToken = null;
        entry.tokenExpiry = null;
        entry.confirmedAt = new Date();
        await entry.save();

        return res.status(200).json({
            success: true,
            message: 'Email confirmed successfully!',
            data: {
                email: entry.email,
                position: entry.position
            }
        });

    } catch (error) {
        console.error('[WaitlistController] Error confirming email:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to confirm email. Please try again later.'
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
        const confirmed = await WaitlistUserEmail.countDocuments({ isConfirmed: true });
        const unconfirmed = await WaitlistUserEmail.countDocuments({ isConfirmed: false });
        const emailFailed = await WaitlistUserEmail.countDocuments({
            emailSent: true,
            isConfirmed: false,
            emailRetryCount: { $gte: 3 }
        });

        return res.status(200).json({
            success: true,
            data: {
                total,
                confirmed,
                unconfirmed,
                emailFailed,
                conversionRate: total > 0 ? ((confirmed / total) * 100).toFixed(2) + '%' : '0%'
            }
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
 * Retry Failed Emails - Admin only
 * POST /api/waitlist/retry-failed-emails
 */
exports.retryFailedEmails = async (req, res) => {
    try {
        // Find entries that failed to send
        const failedEntries = await WaitlistUserEmail.find({
            isConfirmed: false,
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
                const baseUrl = process.env.CLIENT_URL || (process.env.APP_URL && !process.env.APP_URL.includes('localhost') && !process.env.APP_URL.includes('192.168') ? process.env.APP_URL : 'https://take.health');
                const confirmationUrl = `${baseUrl}/waitlist/confirm/${entry.confirmationToken}`;

                await emailService.sendWaitlistConfirmation(entry.email, entry.name, confirmationUrl);

                entry.emailRetryCount += 1;
                entry.lastEmailAttempt = new Date();
                await entry.save();
                retriedCount++;

            } catch (emailError) {
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
