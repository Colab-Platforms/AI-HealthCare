const { dayStr, daysBetween, result, noData } = require('./common');

const MAX_METRICS = 25;

// Lab reports: the latest completed report, its out-of-range values first,
// and what changed vs the previous report for the same test.
async function medicalLabSpecialist({ userId, now = new Date(), deps = {} }) {
    const latestReports = deps.latestReports || defaultLatestReports;
    const reports = await latestReports(userId, 2);
    if (!reports.length) {
        return noData('medical_lab', ['lab_reports'], 'No lab reports uploaded.');
    }

    const [latest, previous] = reports;
    const when = latest.reportDate || latest.createdAt;
    const findings = [];
    const ageDays = when ? daysBetween(now, when) : null;
    findings.push(`Latest report: ${latest.reportType || 'Health report'}${when ? ` dated ${dayStr(when)} (${ageDays} days ago)` : ''}.`);
    const summary = latest.aiAnalysis?.summary || latest.aiAnalysis?.doctorSummary;
    if (summary) findings.push(`Report summary: ${String(summary).slice(0, 600)}`);

    const metrics = toMetricList(latest.aiAnalysis?.metrics);
    const prevByName = new Map(toMetricList(previous?.aiAnalysis?.metrics).map((m) => [m.name.toLowerCase(), m]));
    // Out-of-range first: those are what a coaching answer needs.
    metrics.sort((a, b) => Number(isAbnormal(b)) - Number(isAbnormal(a)));
    for (const m of metrics.slice(0, MAX_METRICS)) {
        const prev = prevByName.get(m.name.toLowerCase());
        findings.push(`${m.name}: ${m.value}${m.unit ? ` ${m.unit}` : ''}`
            + `${m.normalRange ? ` (normal ${m.normalRange})` : ''}${m.status ? ` [${m.status}]` : ''}`
            + `${prev && prev.value !== '' ? `, previous ${prev.value}${prev.unit ? ` ${prev.unit}` : ''}` : ''}.`);
    }

    return result('medical_lab', {
        findings,
        data_used: ['lab_report_latest', ...(previous ? ['lab_report_previous'] : [])],
        missing_data: metrics.length ? [] : ['lab_metrics'],
        // An old report is weak evidence for "now".
        confidence: ageDays !== null && ageDays > 180 ? 'low' : 'moderate',
    });
}

function toMetricList(metrics) {
    if (!metrics || typeof metrics !== 'object') return [];
    return Object.entries(metrics).map(([name, m]) => ({
        name,
        value: m?.value ?? m?.result ?? '',
        unit: m?.unit ?? '',
        normalRange: m?.normalRange ?? '',
        status: m?.status ?? '',
    }));
}

const isAbnormal = (m) => /high|low|abnormal|critical|borderline/i.test(String(m.status));

async function defaultLatestReports(userId, limit) {
    const HealthReport = require('../../../models/HealthReport');
    return HealthReport.find({ user: userId, status: 'completed' })
        .sort({ reportDate: -1, createdAt: -1 })
        .limit(limit)
        .select('reportType reportDate createdAt aiAnalysis.summary aiAnalysis.doctorSummary aiAnalysis.metrics')
        .lean();
}

module.exports = { medicalLabSpecialist, toMetricList };
