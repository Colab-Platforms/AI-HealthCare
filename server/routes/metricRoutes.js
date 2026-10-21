const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const HealthMetric = require('../models/HealthMetric');
const ActivityLog = require('../models/ActivityLog');
const cache = require('../utils/cache');

// Helper function to add timeout to all queries for Vercel compatibility
const withTimeout = (query, timeoutMs = 30000) => {
    return query.maxTimeMS(timeoutMs);
};

// Get latest reading for each specified type (comma separated) - SPECIFIC ROUTE BEFORE PARAMETERIZED
router.get('/summary/latest', protect, async (req, res) => {
    try {
        const types = req.query.types ? req.query.types.split(',') : ['blood_sugar', 'hba1c', 'weight'];
        const summary = {};

        console.log('Fetching latest metrics for types:', types);

        for (const type of types) {
            const latest = await withTimeout(HealthMetric.findOne({ userId: req.user._id, type })
                .sort({ recordedAt: -1 }));
            if (latest) {
                summary[type] = latest;
                console.log(`Latest ${type}:`, latest.value);
            }
        }

        res.json(summary);
    } catch (error) {
        console.error('Error fetching metric summary:', error.message);
        res.status(500).json({
            message: 'Server error fetching metric summary',
            error: error.message
        });
    }
});

// Log a new health metric
router.post('/', protect, async (req, res) => {
    try {
        const { type, value, unit, readingContext, recordedAt, notes } = req.body;

        console.log('Logging metric:', { userId: req.user._id, type, value, unit, readingContext });

        // Validate required fields
        if (!type || value === undefined || !unit) {
            return res.status(400).json({
                message: 'Missing required fields: type, value, unit'
            });
        }

        // Create new metric
        const metric = new HealthMetric({
            userId: req.user._id,
            type,
            value: Number(value),
            unit,
            readingContext,
            recordedAt: recordedAt ? new Date(recordedAt) : Date.now(),
            notes
        });

        console.log('Saving metric to database...');
        const savedMetric = await metric.save({ maxTimeMS: 30000 });
        console.log('Metric saved successfully:', savedMetric._id);

        // Log activity for glucose readings
        if (type === 'blood_sugar') {
            try {
                await ActivityLog.create({
                    user: req.user._id,
                    action: `Logged glucose reading: ${value} ${unit}`,
                    category: 'glucose',
                    metadata: {
                        metricType: type,
                        value,
                        unit,
                        readingContext,
                        notes
                    },
                    timestamp: new Date()
                });
            } catch (activityErr) {
                console.error('Error logging activity:', activityErr.message);
                // Don't fail the request if activity logging fails
            }
        }

        // Clear dashboard cache to show latest values
        await cache.delete(`dashboard:${req.user._id}`);

        res.status(201).json(savedMetric);
    } catch (error) {
        console.error('Error logging metric:', error.message, error.stack);
        res.status(500).json({
            message: 'Server error saving health metric',
            error: error.message
        });
    }
});

// Get AI analysis for glucose trends
router.get('/analysis/glucose', protect, async (req, res) => {
    try {
        const User = require('../models/User');
        const FoodLog = require('../models/FoodLog');
        const AIAnalysis = require('../models/AIAnalysis');
        const nutritionAI = require('../services/nutritionAI');

        // Fetch user profile
        const user = await withTimeout(User.findById(req.user._id));

        // Fetch recent glucose readings (past 14 days)
        const glucoseReadings = await withTimeout(HealthMetric.find({
            userId: req.user._id,
            type: 'blood_sugar'
        }).sort({ recordedAt: -1 }).limit(10));

        // Fetch hba1c for context
        const hba1cReadings = await withTimeout(HealthMetric.find({
            userId: req.user._id,
            type: 'hba1c'
        }).sort({ recordedAt: -1 }).limit(1));

        // Fetch today's food logs
        const foodLogs = await withTimeout(FoodLog.find({
            userId: req.user._id,
            timestamp: {
                $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                $lt: new Date(new Date().setHours(23, 59, 59, 999))
            }
        }));

        if (!glucoseReadings || glucoseReadings.length === 0) {
            return res.json({
                success: true,
                data: {
                    status: "No Data",
                    statusColor: "gray",
                    analysis: "Please log some glucose readings to get an AI analysis.",
                    spikeCause: "N/A",
                    immediateAction: "Log your first reading",
                    recommendations: ["Log your glucose regularly", "Track your meals"]
                }
            });
        }

        // --- Persistency / Token Saving Logic ---
        // Create a simple hash based on the latest readings to check if something changed
        const latestReading = glucoseReadings[0];
        const latestReadingId = latestReading._id.toString();
        const latestUpdate = latestReading.updatedAt || latestReading.recordedAt;
        const foodLogKey = foodLogs.length + (foodLogs[0]?.updatedAt?.toISOString() || '');
        const dataHash = `gl_${latestReadingId}_${latestUpdate}_${foodLogKey}`;

        // Check if we already have an analysis for this set of data
        const existingAnalysis = await AIAnalysis.findOne({
            userId: req.user._id,
            type: 'glucose_trends'
        });

        if (existingAnalysis && existingAnalysis.lastDataPointsHash === dataHash) {
            console.log('✅ AI Analysis: Returning cached result (Save tokens)');
            return res.json({
                success: true,
                data: existingAnalysis.analysisData
            });
        }

        // If no cached version or data has changed, generate new analysis
        console.log('🚀 AI Analysis: Generating fresh analysis via Claude API');
        const { getAlcoholSummary } = require('../utils/alcoholLog');
        const alcoholSummary = getAlcoholSummary(user.alcoholLog || {});
        const result = await nutritionAI.analyzeGlucoseTrends(user, glucoseReadings, foodLogs, hba1cReadings, alcoholSummary);

        if (result && result.success) {
            // Fill defaults if some fields are missing from AI
            const analysisData = {
                status: result.data.status || "Check Stats",
                statusColor: result.data.statusColor || "orange",
                analysis: result.data.analysis || "No summary provided.",
                spikeCause: result.data.spikeCause || "Unknown",
                immediateAction: result.data.immediateAction || "Monitor levels",
                recommendations: result.data.recommendations || []
            };

            // Update or create persistence record
            if (existingAnalysis) {
                existingAnalysis.lastDataPointsHash = dataHash;
                existingAnalysis.analysisData = analysisData;
                await existingAnalysis.save();
            } else {
                await AIAnalysis.create({
                    userId: req.user._id,
                    type: 'glucose_trends',
                    lastDataPointsHash: dataHash,
                    analysisData: analysisData
                });
            }

            return res.json({
                success: true,
                data: analysisData
            });
        }

        throw new Error("AI failed to provide valid analysis data");

    } catch (error) {
        console.error('Error in glucose analysis:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to generate glucose analysis',
            error: error.message
        });
    }
});


// Get history for a specific type (generic handler for metrics and wearables)
router.get('/history/:type', protect, async (req, res) => {
    try {
        const { type } = req.params;
        const days = parseInt(req.query.days) || 30;
        
        let history = [];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        if (type === 'steps' || type === 'sleep') {
            const WearableData = require('../models/WearableData');
            const wearables = await withTimeout(WearableData.find({ user: req.user._id }));
            
            // Format to match what frontend expects
            for (let i = 0; i <= days; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                const dStr = d.toISOString().split('T')[0];
                
                let value = 0;
                for (const w of wearables) {
                    if (type === 'steps') {
                        const daily = w.dailyMetrics?.find(m => m.date && new Date(m.date).toISOString().split('T')[0] === dStr);
                        if (daily) value += daily.steps || 0;
                    } else if (type === 'sleep') {
                        const sleepDay = w.sleepData?.find(s => s.date && new Date(s.date).toISOString().split('T')[0] === dStr);
                        if (sleepDay) value += (sleepDay.totalSleepMinutes || 0) / 60;
                    }
                }
                if (value > 0) {
                    history.push({ 
                        date: dStr, 
                        value: parseFloat(value.toFixed(1)),
                        steps: type === 'steps' ? value : undefined,
                        sleep: type === 'sleep' ? value : undefined
                    });
                }
            }
        } else {
            // Map types if needed (mobile uses 'glucose', server uses 'blood_sugar')
            const mappedType = type === 'glucose' ? 'blood_sugar' : type;
            
            const data = await withTimeout(HealthMetric.find({
                userId: req.user._id,
                type: mappedType,
                recordedAt: { $gte: startDate }
            }).sort({ recordedAt: 1 }));
            
            history = data.map(m => ({
                _id: m._id,
                date: m.recordedAt,
                value: m.value,
                systolic: m.systolic,
                diastolic: m.diastolic,
                unit: m.unit
            }));

            // Weight also arrives via a device/smart-scale sync, written to
            // BodyCompositionSample rather than HealthMetric — without this, a
            // user who only ever weighed in through a connected device saw an
            // empty history here despite having real weigh-ins on file (same
            // gap /history/:type/weekly below already accounts for).
            if (mappedType === 'weight') {
                const BodyCompositionSample = require('../models/BodyCompositionSample');
                const deviceRows = await withTimeout(BodyCompositionSample.find({
                    user: req.user._id,
                    timestamp: { $gte: startDate },
                    weightKg: { $ne: null },
                }));
                history.push(...deviceRows.map(r => ({
                    _id: r._id,
                    date: r.timestamp,
                    value: r.weightKg,
                    unit: 'kg',
                })));
                history.sort((a, b) => new Date(a.date) - new Date(b.date));
            }
        }

        res.json(history.reverse()); // Newest first
    } catch (error) {
        console.error(`Error fetching ${req.params.type} history:`, error.message);
        res.status(500).json({ message: 'Server error fetching history', error: error.message });
    }
});

// Weekly-bucketed history (e.g. the Weight screen's "W1..W8" chart) — the
// plain /history/:type route returns one row per logged reading, which left
// the client to group them into weeks itself; every client ended up doing
// that differently (or not at all, and faking a flat line instead). Bucketing
// here means every client gets the same weeks, and a week with zero readings
// comes back as average:null instead of silently missing or reusing another
// week's number.
router.get('/history/:type/weekly', protect, async (req, res) => {
    try {
        const { type } = req.params;
        const weeks = Math.min(parseInt(req.query.weeks) || 8, 52);
        const mappedType = type === 'glucose' ? 'blood_sugar' : type;

        // Each bucket is a 7-day window ending today, oldest first (W1) to
        // most recent (W{weeks}, "this week").
        const now = new Date();
        const todayEnd = new Date(now);
        todayEnd.setUTCHours(23, 59, 59, 999);
        const rangeStart = new Date(todayEnd);
        rangeStart.setUTCDate(rangeStart.getUTCDate() - (weeks * 7 - 1));
        rangeStart.setUTCHours(0, 0, 0, 0);

        let readings = (await withTimeout(HealthMetric.find({
            userId: req.user._id,
            type: mappedType,
            recordedAt: { $gte: rangeStart, $lte: todayEnd },
        }))).map((r) => ({ recordedAt: r.recordedAt, value: r.value, unit: r.unit, source: 'manual' }));

        // Weight also comes from a smart-scale/wearable sync (BodyCompositionSample),
        // a separate collection from the manual HealthMetric logs above — a user who
        // weighed in only via device, never the app's manual log, used to show zero
        // history here even with real weigh-ins on file. Device readings win over a
        // manual log on the same day (same pattern as sleep/activity elsewhere: the
        // device reading is the more reliable one when both exist).
        if (mappedType === 'weight') {
            const BodyCompositionSample = require('../models/BodyCompositionSample');
            const deviceRows = await withTimeout(BodyCompositionSample.find({
                user: req.user._id,
                timestamp: { $gte: rangeStart, $lte: todayEnd },
                weightKg: { $ne: null },
            }));
            const deviceReadings = deviceRows.map((r) => ({ recordedAt: r.timestamp, value: r.weightKg, unit: 'kg', source: 'device' }));

            const dayKey = (d) => d.toISOString().split('T')[0];
            const byDay = new Map();
            for (const r of readings) byDay.set(dayKey(r.recordedAt), r);
            for (const r of deviceReadings) byDay.set(dayKey(r.recordedAt), r); // device overwrites manual for the same day
            readings = [...byDay.values()];
        }

        readings.sort((a, b) => a.recordedAt - b.recordedAt);

        const buckets = [];
        for (let i = 0; i < weeks; i++) {
            const weekStart = new Date(rangeStart);
            weekStart.setUTCDate(weekStart.getUTCDate() + i * 7);
            const weekEnd = new Date(weekStart);
            weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
            weekEnd.setUTCHours(23, 59, 59, 999);

            const inWeek = readings.filter((r) => r.recordedAt >= weekStart && r.recordedAt <= weekEnd);
            const average = inWeek.length
                ? Math.round((inWeek.reduce((sum, r) => sum + r.value, 0) / inWeek.length) * 10) / 10
                : null;

            buckets.push({
                weekLabel: `W${i + 1}`,
                weekStart: weekStart.toISOString().split('T')[0],
                weekEnd: weekEnd.toISOString().split('T')[0],
                average,
                count: inWeek.length,
                unit: inWeek[0]?.unit ?? null,
            });
        }

        res.json({ type: mappedType, weeks: buckets });
    } catch (error) {
        console.error(`Error fetching weekly ${req.params.type} history:`, error.message);
        res.status(500).json({ message: 'Server error fetching weekly history', error: error.message });
    }
});

// Specific logging routes for mobile apps that append /type to the URL
router.post('/blood-pressure', protect, async (req, res) => {
    try {
        const { systolic, diastolic, recordedAt } = req.body;
        const metric = new HealthMetric({
            userId: req.user._id,
            type: 'blood_pressure',
            value: systolic, // Primary value
            systolic,
            diastolic,
            unit: 'mmHg',
            recordedAt: recordedAt ? new Date(recordedAt) : Date.now()
        });
        const saved = await metric.save();
        await cache.delete(`dashboard:${req.user._id}`);
        res.status(201).json(saved);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/glucose', protect, async (req, res) => {
    try {
        const { value, unit, type, recordedAt } = req.body;
        const metric = new HealthMetric({
            userId: req.user._id,
            type: 'blood_sugar',
            value: Number(value),
            unit: unit || 'mg/dL',
            readingContext: type || 'fasting',
            recordedAt: recordedAt ? new Date(recordedAt) : Date.now()
        });
        const saved = await metric.save();
        await cache.delete(`dashboard:${req.user._id}`);
        res.status(201).json(saved);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/hba1c', protect, async (req, res) => {
    try {
        const { value, recordedAt } = req.body;
        const metric = new HealthMetric({
            userId: req.user._id,
            type: 'hba1c',
            value: Number(value),
            unit: '%',
            recordedAt: recordedAt ? new Date(recordedAt) : Date.now()
        });
        const saved = await metric.save();
        await cache.delete(`dashboard:${req.user._id}`);
        res.status(201).json(saved);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get metrics by type - PARAMETERIZED ROUTE AFTER SPECIFIC ROUTES
router.get('/:type', protect, async (req, res) => {
    try {
        const { type } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        console.log('Fetching metrics:', { userId: req.user._id, type, limit });

        const metrics = await withTimeout(HealthMetric.find({ userId: req.user._id, type })
            .sort({ recordedAt: -1 })
            .limit(limit));

        console.log(`Found ${metrics.length} ${type} metrics`);
        res.json(metrics);
    } catch (error) {
        console.error(`Error fetching ${req.params.type} metrics:`, error.message);
        res.status(500).json({
            message: 'Server error fetching health metrics',
            error: error.message
        });
    }
});

// Delete a specific health metric by ID
router.delete('/:id', protect, async (req, res) => {
    try {
        const metricId = req.params.id;
        
        // Find and delete the metric only if it belongs to the authenticated user
        const metric = await HealthMetric.findOneAndDelete({
            _id: metricId,
            userId: req.user._id
        });

        if (!metric) {
            return res.status(404).json({ message: 'Metric not found or unauthorized' });
        }

        // Clear dashboard cache
        await cache.delete(`dashboard:${req.user._id}`);

        res.json({ success: true, message: 'Metric deleted successfully', deletedId: metricId });
    } catch (error) {
        console.error('Error deleting metric:', error.message);
        res.status(500).json({
            message: 'Server error deleting metric',
            error: error.message
        });
    }
});

module.exports = router;
