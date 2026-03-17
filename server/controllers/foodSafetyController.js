const FoodAdulteration = require('../models/FoodAdulteration');
const foodSafetyService = require('../services/foodSafetyService');

// Get all food safety records
exports.getFoodSafetyAll = async (req, res) => {
  try {
    const records = await FoodAdulteration.find().sort({ lastUpdated: -1 });
    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch food safety data',
      error: error.message
    });
  }
};

// Search for specific food safety info
exports.searchFoodSafety = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const records = await FoodAdulteration.find({
      foodName: { $regex: query, $options: 'i' }
    });

    // If not found in DB, we could optionally trigger a real-time AI search here
    // but for now let's just return what's in the DB.

    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message
    });
  }
};

// Manually trigger a sync (for testing or admin use)
exports.triggerSync = async (req, res) => {
  try {
    const result = await foodSafetyService.syncFoodSafetyDatabase();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Sync failed',
      error: error.message
    });
  }
};

// Get safety info for a specific food item
exports.getFoodSafetyByName = async (req, res) => {
  try {
    const { name } = req.params;
    const record = await FoodAdulteration.findOne({ 
      foodName: { $regex: new RegExp(`^${name}$`, 'i') } 
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'No safety data found for this food'
      });
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch food safety info',
      error: error.message
    });
  }
};
