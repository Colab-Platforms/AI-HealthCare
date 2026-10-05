const User = require('../models/User');
const dietRecommendationAI = require('../services/dietRecommendationAI');

// Get user food preferences
exports.getFoodPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('foodPreferences');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      data: user.foodPreferences || {
        preferredFoods: [],
        foodsToAvoid: [],
        dietaryRestrictions: [],
        dietaryDo: [],
        dietaryDont: []
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
    const { city, preferredFoods, foodsToAvoid, dietaryRestrictions, dietaryDo, dietaryDont, mealPreferences } = req.body;
    console.log('[UserPrefs] Saving for user:', req.user._id, { 
      prefCount: preferredFoods?.length, 
      mealPrefKeys: Object.keys(mealPreferences || {}) 
    });

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.foodPreferences = {
      region: user.foodPreferences?.region,
      country: user.foodPreferences?.country,
      city: city !== undefined ? city : user.foodPreferences?.city,
      preferredFoods: preferredFoods || [],
      foodsToAvoid: foodsToAvoid || [],
      dietaryRestrictions: dietaryRestrictions || [],
      dietaryDo: dietaryDo || [],
      dietaryDont: dietaryDont || [],
      mealPreferences: mealPreferences || {
        breakfast: [],
        lunch: [],
        snacks: [],
        dinner: []
      },
      lastUpdated: new Date()
    };
    
    user.markModified('foodPreferences');
    await user.save();
    console.log('[UserPrefs] Successfully saved for user:', req.user._id);

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
    const user = await User.findById(req.user._id)
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

// Save FCM token — called by Android/iOS app on login/launch
exports.saveFcmToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'FCM token required' });

    await User.findByIdAndUpdate(req.user._id, { fcmToken: token });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Public unsubscribe link (clicked from marketing/announcement emails, no auth —
// the user isn't logged in from their inbox). Reuses the existing
// privacySettings.marketingEnabled flag rather than inventing a parallel one.
exports.unsubscribeMarketing = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(
      id,
      { $set: { 'privacySettings.marketingEnabled': false } },
      { new: true }
    ).select('email');

    const message = user
      ? "You've been unsubscribed from marketing emails. You can still log in and change this anytime in Privacy Settings."
      : "This unsubscribe link is invalid.";

    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Unsubscribed</title></head>
      <body style="font-family: 'Segoe UI', Arial, sans-serif; background:#f4f4f7; padding:60px 20px; text-align:center;">
        <div style="max-width:420px; margin:0 auto; background:#ffffff; border-radius:16px; padding:32px; color:#1a1a2e;">
          <h2 style="margin:0 0 12px 0;">Take</h2>
          <p style="margin:0; color:#4a4a58;">${message}</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('Something went wrong. Please try again later.');
  }
};

module.exports = exports;
