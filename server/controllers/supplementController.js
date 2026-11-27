const supplementService = require('../services/supplementService');

const { SupplementError } = supplementService;

// Known failures carry their own status and a user-safe message; anything else is
// logged in full and answered generically — internals never reach the client.
const handle = (label, fn) => async (req, res) => {
    try {
        const data = await fn(req);
        res.status(data && data.__status ? data.__status : 200).json({ success: true, data: data && data.__status ? data.body : data, ...(data && data.__extra) });
    } catch (err) {
        if (err instanceof SupplementError) {
            return res.status(err.status).json({ success: false, message: err.message, ...(err.details && { errors: err.details }) });
        }
        console.error(`[Supplements] ${label} error:`, err);
        res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
    }
};

const created = (body, extra) => ({ __status: 201, body, __extra: extra });

exports.getCatalog = handle('getCatalog', () => supplementService.getCatalog());

// Adding a supplement is checked against the health profile (medicine
// interactions, allergy source, diet): additive profileAlerts / coach fields.
exports.createSupplement = handle('createSupplement', async (req) => {
    const dto = await supplementService.createSupplement(req.user._id, req.body);
    const { getActivityGuard } = require('../modules/health-profile/services/activityGuard/guardService');
    const guard = await getActivityGuard().checkSupplement(req.user, { name: dto.name, ingredients: [dto.strength, dto.form].filter((x) => typeof x === 'string') });
    return created(dto, { profileAlerts: guard.alerts, coach: guard.coach });
});

exports.listSupplements = handle('listSupplements', (req) =>
    supplementService.listSupplements(req.user._id, req.query.tab));

exports.getSupplement = handle('getSupplement', (req) =>
    supplementService.getSupplement(req.user._id, req.params.id, { calendarDays: req.query.calendarDays }));

exports.updateSupplement = handle('updateSupplement', (req) =>
    supplementService.updateSupplement(req.user._id, req.params.id, req.body));

exports.archiveSupplement = handle('archiveSupplement', (req) =>
    supplementService.archiveSupplement(req.user._id, req.params.id));

exports.getToday = handle('getToday', (req) =>
    supplementService.getToday(req.user._id, req.query.timezone));

exports.listDoses = handle('listDoses', (req) =>
    supplementService.listDoses(req.user._id, {
        from: req.query.from, to: req.query.to, supplementId: req.query.supplementId, timezone: req.query.timezone,
    }));

exports.takeDose = handle('takeDose', (req) =>
    supplementService.markTaken(req.user._id, req.params.doseId, {
        takenAt: req.body?.takenAt, takenTime: req.body?.takenTime,
    }));

exports.missDose = handle('missDose', (req) =>
    supplementService.markMissed(req.user._id, req.params.doseId));

exports.clearDose = handle('clearDose', (req) =>
    supplementService.clearDoseLog(req.user._id, req.params.doseId));

exports.getCustomStats = handle('getCustomStats', (req) =>
    supplementService.getCustomSupplementStats(req.query.limit));
