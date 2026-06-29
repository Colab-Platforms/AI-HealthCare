const gamificationService = require('../services/gamificationService');

exports.getProfile = async (req, res) => {
  try {
    const profile = await gamificationService.getProfile(req.user._id);
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error('Gamification Get Profile Error:', error);
    res.status(500).json({ success: false, message: 'Server Error in Gamification Profile' });
  }
};

exports.awardPoints = async (req, res) => {
  try {
    const { actionType, description, subType } = req.body;
    const result = await gamificationService.awardPoints(req.user._id, actionType, description, subType);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Award Points Error:', error);
    res.status(500).json({ success: false, message: 'Error awarding points' });
  }
};

exports.checkBadges = async (req, res) => {
  try {
    await gamificationService.checkAndAwardBadges(req.user._id);
    const profile = await gamificationService.getProfile(req.user._id);
    res.status(200).json({ success: true, message: 'Badge check complete', badges: profile.badges, allBadges: profile.allBadges });
  } catch (error) {
    console.error('Check Badges Error:', error);
    res.status(500).json({ success: false, message: 'Error checking badges' });
  }
};
