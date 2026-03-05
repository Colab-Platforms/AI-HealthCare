const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const HealthMetric = require('../models/HealthMetric');

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
        const result = await nutritionAI.analyzeGlucoseTrends(user, glucoseReadings, foodLogs, hba1cReadings);

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

module.exports = router;
