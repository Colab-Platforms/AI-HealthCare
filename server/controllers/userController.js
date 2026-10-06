const User = require('../models/User');
const dietRecommendationAI = require('../services/dietRecommendationAI');
const { deriveRegionFromState, canonicalizeStateName } = require('../config/indiaRegions');

/**
 * Merge a food-preferences request body onto the stored preferences.
 *
 * Spreads `existing` rather than rebuilding the object field by field. The old
 * version listed only region/country/city, so `state` — absent from the literal
 * — was silently reset to its schema default on every save: a user who set
 * their state and later just added a liked food lost it, and their next diet
 * plan quietly went back to generic. Any field added to the schema in future is
 * now carried through by default instead of being dropped.
 *
 * `state` is the single location input the client sends; `region` is derived
 * from it and never trusted from the body. Collecting both let them disagree
 * ("south" + "Rajasthan") and both went into the diet prompt.
 *
 * Exported for unit testing — it is pure, so the merge rules can be pinned down
 * without a database.
 *
 * @param {object} existing stored foodPreferences (plain object or nested doc)
 * @param {object} body request body
 * @returns {object} the full foodPreferences object to assign
 */
function buildFoodPreferencesUpdate(existing, body = {}) {
  const current = existing || {};
  const {
    state, city, country, preferredFoods, foodsToAvoid,
    dietaryRestrictions, dietaryDo, dietaryDont, mealPreferences
  } = body;

  const nextState = state !== undefined ? canonicalizeStateName(state) : current.state;

  return {
    ...current,
    country: country !== undefined ? country : current.country,
    state: nextState || null,
    // Only recompute from a state we actually have. Users who set the old
    // Region dropdown before `state` existed have a real region and no state;
    // deriving unconditionally would reset them to 'other' and throw away the
    // only location signal they ever gave us.
    region: nextState ? deriveRegionFromState(nextState) : current.region || 'other',
    city: city !== undefined ? city : current.city,
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
}

exports.buildFoodPreferencesUpdate = buildFoodPreferencesUpdate;

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
    const { state, city, country, preferredFoods, foodsToAvoid, dietaryRestrictions, dietaryDo, dietaryDont, mealPreferences } = req.body;
    console.log('[UserPrefs] Saving for user:', req.user._id, {
      prefCount: preferredFoods?.length,
      mealPrefKeys: Object.keys(mealPreferences || {})
    });

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.foodPreferences = buildFoodPreferencesUpdate(user.foodPreferences, {
      state, city, country, preferredFoods, foodsToAvoid,
      dietaryRestrictions, dietaryDo, dietaryDont, mealPreferences
    });
    
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
