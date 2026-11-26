// How old the user's slow-changing numbers are, and how active they've been:
// input for "your weight still shows 56 kg from 3 weeks ago, update it?"
// style check-ins. Indexed "latest one" reads, all in parallel (~7 small queries).
//
//   weight   newest of: HealthMetric weight, BodyCompositionSample weight
//   glucose  newest HealthMetric blood_sugar
//   report   newest analysed HealthReport (+ whether it had out-of-range values)
//   vault    VaultReport files uploaded AFTER the newest analysed report
//            (vault files are storage only: nothing reads their contents)
//   activity days with food logged / workouts in the last 14 days

const DAY = 86400000;

async function defaultLoad(userId, now) {
    const HealthMetric = require('../../../models/HealthMetric');
    const BodyCompositionSample = require('../../../models/BodyCompositionSample');
    const HealthReport = require('../../../models/HealthReport');
    const VaultReport = require('../../../models/VaultReport');
    const NutritionSummary = require('../../../models/NutritionSummary');
    const ExerciseLog = require('../../../models/ExerciseLog');
    const since14 = new Date(now.getTime() - 14 * DAY);

    const [weightLog, weightDevice, glucose, report] = await Promise.all([
        HealthMetric.findOne({ userId, type: 'weight' }).sort({ recordedAt: -1 }).select('value recordedAt').lean(),
        BodyCompositionSample.findOne({ user: userId, weightKg: { $ne: null } }).sort({ timestamp: -1 }).select('weightKg timestamp').lean(),
        HealthMetric.findOne({ userId, type: 'blood_sugar' }).sort({ recordedAt: -1 }).select('value recordedAt').lean(),
        HealthReport.findOne({ user: userId, status: 'completed' }).sort({ createdAt: -1 }).select('createdAt reportDate reportType aiAnalysis.metrics').lean(),
    ]);
    const [vaultFiles, foodDays, workouts] = await Promise.all([
        VaultReport.find({ userId, status: 'active', createdAt: { $gt: report?.createdAt || new Date(0), $gte: new Date(now.getTime() - 30 * DAY) } })
            .sort({ createdAt: -1 }).limit(3).select('_id title createdAt').lean(),
        NutritionSummary.countDocuments({ userId, date: { $gte: since14 }, totalCalories: { $gt: 0 } }),
        ExerciseLog.countDocuments({ userId, timestamp: { $gte: since14 } }),
    ]);

    const weights = [
        weightLog && { at: weightLog.recordedAt, value: weightLog.value },
        weightDevice && { at: weightDevice.timestamp, value: weightDevice.weightKg },
    ].filter(Boolean).sort((a, b) => new Date(b.at) - new Date(a.at));
    const abnormal = report?.aiAnalysis?.metrics && typeof report.aiAnalysis.metrics === 'object'
        ? Object.entries(report.aiAnalysis.metrics).filter(([, m]) => /high|low|abnormal|critical|borderline/i.test(String(m?.status || ''))).map(([k]) => k)
        : [];

    return {
        weight: weights[0] || null,
        glucose: glucose ? { at: glucose.recordedAt, value: glucose.value } : null,
        report: report ? { at: report.reportDate || report.createdAt, type: report.reportType || 'report', abnormal } : null,
        vaultFiles: vaultFiles.map((v) => ({ id: String(v._id), title: v.title, at: v.createdAt })),
        activity: { foodDays14: foodDays, workouts14: workouts },
    };
}

async function getFreshness(userId, { now = new Date(), load = defaultLoad } = {}) {
    return load(userId, now);
}

module.exports = { getFreshness };
