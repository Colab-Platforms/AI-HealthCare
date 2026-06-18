const UsageLog = require('../models/UsageLog');
const { MODEL_PRICING } = require('../models/UsageLog');

// Helper: date range from period string
const getPeriodRange = (period = 'month') => {
    const now = new Date();
    const from = new Date();
    if (period === 'today')       from.setHours(0, 0, 0, 0);
    else if (period === '7d')     from.setDate(now.getDate() - 7);
    else if (period === '30d')    from.setDate(now.getDate() - 30);
    else if (period === 'month')  { from.setDate(1); from.setHours(0, 0, 0, 0); }
    else if (period === 'year')   { from.setMonth(0, 1); from.setHours(0, 0, 0, 0); }
    else if (period === 'all')    return {};
    return { createdAt: { $gte: from, $lte: now } };
};

// Compute exact cache savings using per-model pricing
// Savings = tokens that were served from cache × (full input price − cache read price)
const calcCacheSavings = (modelBreakdown) => {
    let savingsUsd = 0;
    for (const { model, cacheReadTokens } of modelBreakdown) {
        if (!cacheReadTokens) continue;
        const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-sonnet-4-6'];
        // Savings per token = what it would have cost at full input rate minus what we paid at cache-read rate
        savingsUsd += (cacheReadTokens * (pricing.input - pricing.cacheRead)) / 1_000_000;
    }
    return parseFloat(savingsUsd.toFixed(4));
};

// ── GET /admin/usage/summary?period=month ─────────────────────────────────
exports.getSummary = async (req, res) => {
    try {
        const match = getPeriodRange(req.query.period);

        // Main aggregate — totals
        const [agg] = await UsageLog.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    totalCalls:        { $sum: 1 },
                    successCalls:      { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
                    errorCalls:        { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
                    totalInputTokens:  { $sum: '$inputTokens' },
                    totalOutputTokens: { $sum: '$outputTokens' },
                    totalCacheRead:    { $sum: '$cacheReadTokens' },
                    totalCacheWrite:   { $sum: '$cacheWriteTokens' },
                    totalTokens:       { $sum: '$totalTokens' },
                    totalCostUsd:      { $sum: '$costUsd' },
                    avgDurationMs:     { $avg: '$durationMs' },
                    uniqueUsers:       { $addToSet: { $cond: [{ $ifNull: ['$userId', false] }, '$userId', '$$REMOVE'] } },
                }
            },
            {
                $project: {
                    _id: 0,
                    totalCalls: 1, successCalls: 1, errorCalls: 1,
                    totalInputTokens: 1, totalOutputTokens: 1,
                    totalCacheRead: 1, totalCacheWrite: 1, totalTokens: 1,
                    totalCostUsd: { $round: ['$totalCostUsd', 6] },
                    avgDurationMs: { $round: ['$avgDurationMs', 0] },
                    uniqueUserCount: { $size: '$uniqueUsers' },
                    errorRate: {
                        $cond: [
                            { $eq: ['$totalCalls', 0] }, 0,
                            { $multiply: [{ $divide: ['$errorCalls', '$totalCalls'] }, 100] }
                        ]
                    },
                    cacheHitRate: {
                        $cond: [
                            { $eq: [{ $add: ['$totalCacheRead', '$totalInputTokens'] }, 0] }, 0,
                            {
                                $multiply: [
                                    {
                                        $divide: [
                                            '$totalCacheRead',
                                            { $add: ['$totalCacheRead', '$totalInputTokens'] }
                                        ]
                                    },
                                    100
                                ]
                            }
                        ]
                    }
                }
            }
        ]);

        // Per-model cache breakdown for accurate savings (different models have different pricing)
        const modelBreakdown = await UsageLog.aggregate([
            { $match: { ...match, status: 'success', cacheReadTokens: { $gt: 0 } } },
            {
                $group: {
                    _id: '$model',
                    cacheReadTokens: { $sum: '$cacheReadTokens' }
                }
            },
            { $project: { _id: 0, model: '$_id', cacheReadTokens: 1 } }
        ]);

        const summary = agg || {
            totalCalls: 0, successCalls: 0, errorCalls: 0,
            totalInputTokens: 0, totalOutputTokens: 0,
            totalCacheRead: 0, totalCacheWrite: 0, totalTokens: 0,
            totalCostUsd: 0, avgDurationMs: 0, uniqueUserCount: 0,
            errorRate: 0, cacheHitRate: 0
        };

        summary.cacheSavingsUsd = calcCacheSavings(modelBreakdown);
        summary.cacheHitRate    = parseFloat((summary.cacheHitRate  || 0).toFixed(1));
        summary.errorRate       = parseFloat((summary.errorRate     || 0).toFixed(1));

        res.json({ success: true, period: req.query.period || 'month', summary });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── GET /admin/usage/cost-over-time?period=month&granularity=day ──────────
exports.getCostOverTime = async (req, res) => {
    try {
        const match       = getPeriodRange(req.query.period);
        const granularity = req.query.granularity || 'day'; // day | week | month

        const dateGroup =
            granularity === 'month' ? { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }
          : granularity === 'week'  ? { year: { $year: '$createdAt' }, week:  { $week:  '$createdAt' } }
          :                           { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } };

        // Build date string expression in JS so MongoDB receives a resolved constant, not a variable ref
        const dateExpr =
            granularity === 'month'
                ? { $concat: [{ $toString: '$_id.year' }, '-', { $toString: '$_id.month' }] }
          : granularity === 'week'
                ? { $concat: [{ $toString: '$_id.year' }, '-W', { $toString: '$_id.week' }] }
                : {
                    $concat: [
                        { $toString: '$_id.year' }, '-',
                        {
                            $cond: [
                                { $lte: ['$_id.month', 9] },
                                { $concat: ['0', { $toString: '$_id.month' }] },
                                { $toString: '$_id.month' }
                            ]
                        },
                        '-',
                        {
                            $cond: [
                                { $lte: ['$_id.day', 9] },
                                { $concat: ['0', { $toString: '$_id.day' }] },
                                { $toString: '$_id.day' }
                            ]
                        }
                    ]
                };

        const data = await UsageLog.aggregate([
            { $match: match },
            {
                $group: {
                    _id:    dateGroup,
                    cost:   { $sum: '$costUsd' },
                    calls:  { $sum: 1 },
                    tokens: { $sum: '$totalTokens' },
                    inputTokens:  { $sum: '$inputTokens' },
                    outputTokens: { $sum: '$outputTokens' },
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } },
            {
                $project: {
                    _id: 0,
                    date: dateExpr,
                    cost:         { $round: ['$cost', 6] },
                    calls:        1,
                    tokens:       1,
                    inputTokens:  1,
                    outputTokens: 1,
                }
            }
        ]);

        res.json({ success: true, granularity, data });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── GET /admin/usage/by-feature?period=month ──────────────────────────────
exports.getByFeature = async (req, res) => {
    try {
        const match = getPeriodRange(req.query.period);

        const data = await UsageLog.aggregate([
            { $match: match },
            {
                $group: {
                    _id:          '$feature',
                    calls:        { $sum: 1 },
                    successCalls: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
                    errors:       { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
                    totalCost:    { $sum: '$costUsd' },
                    inputTokens:  { $sum: '$inputTokens' },
                    outputTokens: { $sum: '$outputTokens' },
                    totalTokens:  { $sum: '$totalTokens' },
                    avgTokens:    { $avg: '$totalTokens' },
                    avgDurationMs: { $avg: '$durationMs' },
                }
            },
            {
                $project: {
                    _id: 0,
                    feature:      '$_id',
                    calls:        1,
                    successCalls: 1,
                    errors:       1,
                    totalCost:    { $round: ['$totalCost', 6] },
                    inputTokens:  1,
                    outputTokens: 1,
                    totalTokens:  1,
                    avgTokens:    { $round: ['$avgTokens', 0] },
                    avgDurationMs: { $round: ['$avgDurationMs', 0] },
                    errorRate: {
                        $cond: [
                            { $eq: ['$calls', 0] }, 0,
                            { $round: [{ $multiply: [{ $divide: ['$errors', '$calls'] }, 100] }, 1] }
                        ]
                    }
                }
            },
            { $sort: { totalCost: -1 } }
        ]);

        const grandTotal = data.reduce((s, d) => s + d.totalCost, 0);
        const withPct = data.map(d => ({
            ...d,
            costPct: grandTotal > 0 ? parseFloat(((d.totalCost / grandTotal) * 100).toFixed(1)) : 0
        }));

        res.json({ success: true, data: withPct });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── GET /admin/usage/by-model?period=month ────────────────────────────────
exports.getByModel = async (req, res) => {
    try {
        const match = getPeriodRange(req.query.period);

        const data = await UsageLog.aggregate([
            { $match: match },
            {
                $group: {
                    _id:              '$model',
                    calls:            { $sum: 1 },
                    errors:           { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
                    totalCost:        { $sum: '$costUsd' },
                    inputTokens:      { $sum: '$inputTokens' },
                    outputTokens:     { $sum: '$outputTokens' },
                    cacheReadTokens:  { $sum: '$cacheReadTokens' },
                    cacheWriteTokens: { $sum: '$cacheWriteTokens' },
                    totalTokens:      { $sum: '$totalTokens' },
                    avgDurationMs:    { $avg: '$durationMs' },
                }
            },
            {
                $project: {
                    _id: 0,
                    model:            '$_id',
                    calls:            1,
                    errors:           1,
                    totalCost:        { $round: ['$totalCost', 6] },
                    inputTokens:      1,
                    outputTokens:     1,
                    cacheReadTokens:  1,
                    cacheWriteTokens: 1,
                    totalTokens:      1,
                    avgDurationMs:    { $round: ['$avgDurationMs', 0] },
                }
            },
            { $sort: { totalCost: -1 } }
        ]);

        const grandTotal = data.reduce((s, d) => s + d.totalCost, 0);

        // Attach live pricing and percentage for each model row
        const withMeta = data.map(d => {
            const pricing = MODEL_PRICING[d.model] || MODEL_PRICING['claude-sonnet-4-6'];
            return {
                ...d,
                costPct: grandTotal > 0 ? parseFloat(((d.totalCost / grandTotal) * 100).toFixed(1)) : 0,
                pricing: {
                    inputPerMToken:      pricing.input,
                    outputPerMToken:     pricing.output,
                    cacheReadPerMToken:  pricing.cacheRead,
                    cacheWritePerMToken: pricing.cacheWrite,
                }
            };
        });

        res.json({ success: true, data: withMeta });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── GET /admin/usage/by-user?period=month&limit=20 ────────────────────────
exports.getByUser = async (req, res) => {
    try {
        const match = getPeriodRange(req.query.period);
        const topN  = Math.min(100, parseInt(req.query.limit) || 20);

        const data = await UsageLog.aggregate([
            { $match: { ...match, userId: { $ne: null } } },
            {
                $group: {
                    _id:         '$userId',
                    calls:       { $sum: 1 },
                    errors:      { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
                    totalCost:   { $sum: '$costUsd' },
                    totalTokens: { $sum: '$totalTokens' },
                    inputTokens: { $sum: '$inputTokens' },
                    outputTokens:{ $sum: '$outputTokens' },
                    firstUsed:   { $min: '$createdAt' },
                    lastUsed:    { $max: '$createdAt' },
                }
            },
            { $sort: { totalCost: -1 } },
            { $limit: topN },
            {
                $lookup: {
                    from:         'users',
                    localField:   '_id',
                    foreignField: '_id',
                    as:           'user'
                }
            },
            // preserveNullAndEmptyArrays keeps rows where userId has no matching user doc
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 0,
                    userId:       '$_id',
                    name:         { $ifNull: ['$user.name',  'Deleted User'] },
                    email:        { $ifNull: ['$user.email', 'unknown'] },
                    calls:        1,
                    errors:       1,
                    totalCost:    { $round: ['$totalCost',   6] },
                    totalTokens:  1,
                    inputTokens:  1,
                    outputTokens: 1,
                    firstUsed:    1,
                    lastUsed:     1,
                }
            }
        ]);

        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── GET /admin/usage/logs?page=1&limit=50&feature=&status=&model=&userId= ──
exports.getLogs = async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(200, parseInt(req.query.limit) || 50);
        const filter = {};

        if (req.query.feature) filter.feature = req.query.feature;
        if (req.query.status)  filter.status  = req.query.status;
        if (req.query.model)   filter.model   = req.query.model;
        if (req.query.userId)  filter.userId  = req.query.userId;

        const periodMatch = getPeriodRange(req.query.period);
        Object.assign(filter, periodMatch);

        const [logs, total] = await Promise.all([
            UsageLog.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('userId', 'name email')
                .lean(),
            UsageLog.countDocuments(filter)
        ]);

        res.json({
            success: true,
            logs,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── GET /admin/usage/cache-stats?period=month ─────────────────────────────
exports.getCacheStats = async (req, res) => {
    try {
        const match = getPeriodRange(req.query.period);

        // Group by model so we can apply the correct per-model pricing for savings
        const modelRows = await UsageLog.aggregate([
            { $match: { ...match, status: 'success' } },
            {
                $group: {
                    _id:              '$model',
                    inputTokens:      { $sum: '$inputTokens' },
                    cacheReadTokens:  { $sum: '$cacheReadTokens' },
                    cacheWriteTokens: { $sum: '$cacheWriteTokens' },
                    totalCost:        { $sum: '$costUsd' },
                    calls:            { $sum: 1 },
                }
            }
        ]);

        if (!modelRows.length) return res.json({ success: true, data: {} });

        let totalInputTokens  = 0;
        let totalCacheRead    = 0;
        let totalCacheWrite   = 0;
        let totalCost         = 0;
        let totalCalls        = 0;
        let savingsUsd        = 0;

        for (const row of modelRows) {
            const pricing = MODEL_PRICING[row._id] || MODEL_PRICING['claude-sonnet-4-6'];

            totalInputTokens  += row.inputTokens;
            totalCacheRead    += row.cacheReadTokens;
            totalCacheWrite   += row.cacheWriteTokens;
            totalCost         += row.totalCost;
            totalCalls        += row.calls;

            // Savings = tokens served from cache × (full input price − cache read price)
            savingsUsd += (row.cacheReadTokens * (pricing.input - pricing.cacheRead)) / 1_000_000;
        }

        const cacheHitRate = totalInputTokens + totalCacheRead > 0
            ? parseFloat(((totalCacheRead / (totalInputTokens + totalCacheRead)) * 100).toFixed(1))
            : 0;

        // Per-model breakdown for transparency
        const byModel = modelRows.map(row => {
            const pricing = MODEL_PRICING[row._id] || MODEL_PRICING['claude-sonnet-4-6'];
            return {
                model:            row._id,
                cacheReadTokens:  row.cacheReadTokens,
                cacheWriteTokens: row.cacheWriteTokens,
                savingsUsd: parseFloat(
                    ((row.cacheReadTokens * (pricing.input - pricing.cacheRead)) / 1_000_000).toFixed(6)
                ),
                inputPricePerM:     pricing.input,
                cacheReadPricePerM: pricing.cacheRead,
            };
        });

        res.json({
            success: true,
            data: {
                totalCacheReadTokens:  totalCacheRead,
                totalCacheWriteTokens: totalCacheWrite,
                totalInputTokens,
                cacheHitRate,
                savingsUsd:   parseFloat(savingsUsd.toFixed(4)),
                totalCalls,
                byModel,
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── GET /admin/usage/budget?monthly= ──────────────────────────────────────
exports.getBudgetStatus = async (req, res) => {
    try {
        const budget = parseFloat(req.query.monthly)
            || parseFloat(process.env.MONTHLY_AI_BUDGET_USD)
            || 100;

        // Use all-time for total credit tracking (budget is a one-time top-up, not monthly)
        const match = getPeriodRange('all');

        const [agg] = await UsageLog.aggregate([
            { $match: match },
            {
                $group: {
                    _id:          null,
                    spent:        { $sum: '$costUsd' },
                    calls:        { $sum: 1 },
                    successCalls: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
                    errorCalls:   { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
                    totalTokens:  { $sum: '$totalTokens' },
                }
            }
        ]);

        const spent     = parseFloat((agg?.spent || 0).toFixed(6));
        const remaining = parseFloat((budget - spent).toFixed(6));
        const pct       = budget > 0 ? parseFloat(((spent / budget) * 100).toFixed(1)) : 0;

        res.json({
            success: true,
            budget,
            spent,
            remaining,
            percentUsed:  pct,
            calls:        agg?.calls        || 0,
            successCalls: agg?.successCalls || 0,
            errorCalls:   agg?.errorCalls   || 0,
            totalTokens:  agg?.totalTokens  || 0,
            alert: pct >= 90 ? 'critical' : pct >= 75 ? 'warning' : 'ok',
            projectedMonthlySpend: 0
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
