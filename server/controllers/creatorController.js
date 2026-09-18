const CreatorResponse = require('../models/CreatorResponse');

/**
 * Submit a Creator Program application - Public endpoint
 * POST /api/creator
 */
exports.submitApplication = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            address,
            aptSuite,
            instagramLink,
            youtubeLink,
            twitterLink,
            bestVideoLink,
            whyCreator,
            instagramIsCreatorAccount,
            canPostThreePerMonth,
            followerCount,
            contentCategory,
            signature,
            agreedToAgreement,
            wantsUpdates,
            agreedToPolicies
        } = req.body;

        const requiredFields = {
            name,
            email,
            phone,
            address,
            bestVideoLink,
            whyCreator,
            instagramIsCreatorAccount,
            canPostThreePerMonth,
            signature
        };

        const missingField = Object.entries(requiredFields).find(
            ([, value]) => typeof value !== 'string' || !value.trim()
        );

        if (missingField) {
            return res.status(400).json({
                success: false,
                message: `${missingField[0]} is required`
            });
        }

        if (followerCount === undefined || followerCount === null || Number.isNaN(Number(followerCount))) {
            return res.status(400).json({
                success: false,
                message: 'Follower count is required and must be a number'
            });
        }

        if (!['yes', 'no'].includes(instagramIsCreatorAccount) || !['yes', 'no'].includes(canPostThreePerMonth)) {
            return res.status(400).json({
                success: false,
                message: 'Please answer the yes/no questions in the Your Content section'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        if (agreedToAgreement !== true) {
            return res.status(400).json({
                success: false,
                message: 'You must agree to the Creator Program Agreement'
            });
        }

        if (agreedToPolicies !== true) {
            return res.status(400).json({
                success: false,
                message: 'You must agree to the policy consent'
            });
        }

        const entry = new CreatorResponse({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            address: address.trim(),
            aptSuite: (aptSuite || '').trim(),
            instagramLink: (instagramLink || '').trim(),
            youtubeLink: (youtubeLink || '').trim(),
            twitterLink: (twitterLink || '').trim(),
            bestVideoLink: bestVideoLink.trim(),
            whyCreator: whyCreator.trim(),
            instagramIsCreatorAccount,
            canPostThreePerMonth,
            followerCount: Number(followerCount),
            contentCategory: (contentCategory || '').trim(),
            signature: signature.trim(),
            agreedToAgreement,
            wantsUpdates: wantsUpdates === true,
            agreedToPolicies
        });

        await entry.save();

        return res.status(201).json({
            success: true,
            message: 'Application submitted successfully',
            data: {
                id: entry._id,
                name: entry.name,
                email: entry.email
            }
        });

    } catch (error) {
        if (error.name === 'ValidationError') {
            const firstError = Object.values(error.errors)[0];
            return res.status(400).json({
                success: false,
                message: firstError ? firstError.message : 'Invalid application data'
            });
        }

        console.error('[CreatorController] Error submitting application:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to submit application. Please try again later.'
        });
    }
};

/**
 * List Creator Program applications - Admin only
 * GET /api/creator
 */
exports.listApplications = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const status = req.query.status;

        const filter = {};
        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
            filter.status = status;
        }

        const [applications, total] = await Promise.all([
            CreatorResponse.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            CreatorResponse.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            data: applications,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('[CreatorController] Error listing applications:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve applications'
        });
    }
};
