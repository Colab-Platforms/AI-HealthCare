const ExcelJS = require('exceljs');
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
            canPostThreePerMonth
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
            signature: (signature || '').trim(),
            agreedToAgreement: agreedToAgreement === true,
            wantsUpdates: wantsUpdates === true,
            agreedToPolicies: agreedToPolicies === true
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

const BRAND_COLOR = 'FF4338CA';
const HEADER_TEXT_COLOR = 'FFFFFFFF';
const STRIPE_COLOR = 'FFF4F4FE';
const BORDER_COLOR = 'FFE2E4F0';

const EXPORT_COLUMNS = [
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Address', key: 'address', width: 30 },
    { header: 'Apt/Suite', key: 'aptSuite', width: 14 },
    { header: 'Instagram', key: 'instagramLink', width: 26 },
    { header: 'YouTube', key: 'youtubeLink', width: 26 },
    { header: 'X / Twitter', key: 'twitterLink', width: 26 },
    { header: 'Best Video', key: 'bestVideoLink', width: 30 },
    { header: 'Why Creator', key: 'whyCreator', width: 40 },
    { header: 'IG Creator/Business Acct', key: 'instagramIsCreatorAccount', width: 20 },
    { header: 'Can Post 3/Month', key: 'canPostThreePerMonth', width: 16 },
    { header: 'Follower Count', key: 'followerCount', width: 16 },
    { header: 'Content Category', key: 'contentCategory', width: 18 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Applied On', key: 'createdAt', width: 20 },
];

const STATUS_FILL = {
    approved: 'FFDCFCE7',
    rejected: 'FFFEE2E2',
    pending: 'FFFEF3C7',
};
const STATUS_FONT = {
    approved: 'FF15803D',
    rejected: 'FFB91C1C',
    pending: 'FF92400E',
};

/**
 * Export Creator Program applications as a formatted .xlsx workbook - Admin only
 * GET /api/creator/export
 */
exports.exportApplications = async (req, res) => {
    try {
        const status = req.query.status;
        const filter = {};
        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
            filter.status = status;
        }

        const applications = await CreatorResponse.find(filter).sort({ createdAt: -1 }).lean();

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Take Health';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Creator Applications', {
            views: [{ state: 'frozen', ySplit: 2 }],
        });

        sheet.columns = EXPORT_COLUMNS.map((col) => ({ key: col.key, width: col.width }));

        // Title band
        sheet.mergeCells(1, 1, 1, EXPORT_COLUMNS.length);
        const titleCell = sheet.getCell(1, 1);
        titleCell.value = `TAKE Creator Program Applications  •  ${applications.length} total  •  exported ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
        titleCell.font = { bold: true, size: 13, color: { argb: HEADER_TEXT_COLOR } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLOR } };
        sheet.getRow(1).height = 28;

        // Header row
        const headerRow = sheet.getRow(2);
        EXPORT_COLUMNS.forEach((col, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = col.header;
            cell.font = { bold: true, color: { argb: HEADER_TEXT_COLOR }, size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLOR } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top: { style: 'thin', color: { argb: BORDER_COLOR } },
                bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
                left: { style: 'thin', color: { argb: BORDER_COLOR } },
                right: { style: 'thin', color: { argb: BORDER_COLOR } },
            };
        });
        headerRow.height = 24;

        applications.forEach((app, index) => {
            const row = sheet.addRow({
                name: app.name || '',
                email: app.email || '',
                phone: app.phone || '',
                address: app.address || '',
                aptSuite: app.aptSuite || '',
                instagramLink: app.instagramLink || '',
                youtubeLink: app.youtubeLink || '',
                twitterLink: app.twitterLink || '',
                bestVideoLink: app.bestVideoLink || '',
                whyCreator: app.whyCreator || '',
                instagramIsCreatorAccount: app.instagramIsCreatorAccount === 'yes' ? 'Yes' : 'No',
                canPostThreePerMonth: app.canPostThreePerMonth === 'yes' ? 'Yes' : 'No',
                followerCount: app.followerCount ?? 0,
                contentCategory: app.contentCategory || '-',
                status: (app.status || 'pending').charAt(0).toUpperCase() + (app.status || 'pending').slice(1),
                createdAt: app.createdAt ? new Date(app.createdAt) : null,
            });

            row.height = 20;
            row.eachCell((cell, colNumber) => {
                cell.alignment = { vertical: 'middle', horizontal: colNumber === 13 ? 'right' : 'left', wrapText: colNumber === 10 };
                cell.border = {
                    bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
                    left: { style: 'thin', color: { argb: BORDER_COLOR } },
                    right: { style: 'thin', color: { argb: BORDER_COLOR } },
                };
                if (index % 2 === 1) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE_COLOR } };
                }
            });

            const createdAtCell = row.getCell('createdAt');
            createdAtCell.numFmt = 'dd mmm yyyy, hh:mm AM/PM';

            const statusKey = (app.status || 'pending').toLowerCase();
            const statusCell = row.getCell('status');
            statusCell.font = { bold: true, color: { argb: STATUS_FONT[statusKey] || STATUS_FONT.pending } };
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_FILL[statusKey] || STATUS_FILL.pending } };
            statusCell.alignment = { vertical: 'middle', horizontal: 'center' };

            ['instagramLink', 'youtubeLink', 'twitterLink', 'bestVideoLink'].forEach((key) => {
                const cell = row.getCell(key);
                if (cell.value) {
                    cell.value = { text: cell.value, hyperlink: cell.value };
                    cell.font = { ...(cell.font || {}), color: { argb: 'FF2563EB' }, underline: true };
                }
            });
        });

        sheet.autoFilter = {
            from: { row: 2, column: 1 },
            to: { row: 2, column: EXPORT_COLUMNS.length },
        };

        const filename = `creator-applications-${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('[CreatorController] Error exporting applications:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to export applications'
        });
    }
};
