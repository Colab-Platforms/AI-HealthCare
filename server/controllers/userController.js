const User = require('../models/User');
const dietRecommendationAI = require('../services/dietRecommendationAI');

// Get user food preferences
exports.getFoodPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('foodPreferences');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      data: user.foodPreferences || {
        preferredFoods: [],
        foodsToAvoid: [],
        dietaryRestrictions: []
      }
    });
  } catch (error) {
    console.error('Get food preferences error:', error);
    res.status(500).json({ success: false, message: 'Failed to get food preferences' });
  }
};

// Save user food preferences
exports.saveFoodPreferences = async (req, res) => {
  try {
    const { preferredFoods, foodsToAvoid, dietaryRestrictions } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.foodPreferences = {
      preferredFoods: preferredFoods || [],
      foodsToAvoid: foodsToAvoid || [],
      dietaryRestrictions: dietaryRestrictions || [],
      lastUpdated: new Date()
    };

    await user.save();

    res.json({
      success: true,
      message: 'Food preferences saved successfully',
      data: user.foodPreferences
    });
  } catch (error) {
    console.error('Save food preferences error:', error);
    res.status(500).json({ success: false, message: 'Failed to save food preferences' });
  }
};

// Analyze user food choices with AI
exports.analyzeFoodChoices = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('foodPreferences profile nutritionGoal');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.foodPreferences || !user.foodPreferences.preferredFoods || user.foodPreferences.preferredFoods.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please add your preferred foods first'
      });
    }

    // Call AI service to analyze food preferences
    const analysis = await dietRecommendationAI.analyzeFoodPreferences(user);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Analyze food choices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze food choices',
      error: error.message
    });
  }
};

module.exports = exports;
