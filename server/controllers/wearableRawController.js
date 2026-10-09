// Read-only raw-data endpoints — see wearableRawDataService.js header for
// why these exist and why they're deliberately separate from
// wearableController.js (ingestion/analytics) and from recovery scoring.

const { getRawMetrics, getRawScores, WearableRawDataInputError } = require('../services/wearableRawDataService');

exports.getRawMetricsData = async (req, res) => {
  try {
    const { startDate, endDate, types } = req.query;
    const data = await getRawMetrics(req.user._id, { startDate, endDate, types });
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    if (error instanceof WearableRawDataInputError) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.getRawScoresData = async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;
    const data = await getRawScores(req.user._id, { startDate, endDate, category });
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    if (error instanceof WearableRawDataInputError) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};
