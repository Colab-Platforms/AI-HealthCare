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
        const nutritionAI = require('../services/nutritionAI');

        // Parallel fetch for all required data
        const [user, glucoseReadings, hba1cReadings, foodLogs] = await Promise.all([
            withTimeout(User.findById(req.user._id)),
            withTimeout(HealthMetric.find({ userId: req.user._id, type: 'blood_sugar' }).sort({ recordedAt: -1 }).limit(10)),
            withTimeout(HealthMetric.find({ userId: req.user._id, type: 'hba1c' }).sort({ recordedAt: -1 }).limit(2)),
            withTimeout(FoodLog.find({
                userId: req.user._id,
                timestamp: {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    $lt: new Date(new Date().setHours(23, 59, 59, 999))
                }
            }))
        ]);

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

        const analysis = await nutritionAI.analyzeGlucoseTrends(user, glucoseReadings, foodLogs, hba1cReadings);
        res.json(analysis);
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
