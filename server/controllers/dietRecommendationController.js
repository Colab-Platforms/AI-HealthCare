const PersonalizedDietPlan = require('../models/PersonalizedDietPlan');
const SupplementRecommendation = require('../models/SupplementRecommendation');
const HealthReport = require('../models/HealthReport');
const User = require('../models/User');
const dietRecommendationAI = require('../services/dietRecommendationAI');

/**
 * Generate personalized diet plan based on comprehensive health data
 */
exports.generatePersonalizedDietPlan = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user profile
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get latest health reports
    const healthReports = await HealthReport.find({ userId })
      .sort({ uploadDate: -1 })
      .limit(5);

    // Extract lab report insights
    const labReportInsights = [];
    const deficiencies = [];

    healthReports.forEach(report => {
      if (report.analysis?.deficiencies) {
        report.analysis.deficiencies.forEach(def => {
          deficiencies.push({
            nutrient: def.name || def,
            severity: def.severity || 'detected',
            reportId: report._id
          });
        });
      }

      if (report.analysis?.keyFindings) {
        report.analysis.keyFindings.forEach(finding => {
          labReportInsights.push({
            parameter: finding.parameter || finding,
            value: finding.value || '',
            unit: finding.unit || '',
            status: finding.status || 'noted',
            reportId: report._id
          });
        });
      }
    });

    // Prepare user data for AI
    const userData = {
      age: user.profile?.age || user.age,
      gender: user.profile?.gender || user.gender,
      weight: user.profile?.weight,
      height: user.profile?.height,
      dietaryPreference: user.profile?.dietaryPreference || 'non-vegetarian',
      activityLevel: user.profile?.activityLevel || 'moderate',
      fitnessGoals: user.profile?.fitnessGoals || [],
      medicalConditions: user.profile?.medicalConditions || [],
      allergies: user.profile?.allergies || [],
      labReports: labReportInsights,
      healthParameters: {
        bmi: user.profile?.bmi,
        bloodPressure: user.profile?.bloodPressure
      }
    };

    // Generate AI-powered diet plan
    const aiDietPlan = await dietRecommendationAI.generatePersonalizedDietPlan(userData);

    // Deactivate old diet plans
    await PersonalizedDietPlan.updateMany(
      { userId, isActive: true },
      { isActive: false }
    );

    // Save new diet plan
    const dietPlan = new PersonalizedDietPlan({
      userId,
      inputData: {
        age: userData.age,
        gender: userData.gender,
        weight: userData.weight,
        height: userData.height,
        dietaryPreference: userData.dietaryPreference,
        activityLevel: userData.activityLevel,
        fitnessGoals: userData.fitnessGoals,
        medicalConditions: userData.medicalConditions,
        allergies: userData.allergies
      },
      labReportInsights,
      ...aiDietPlan
    });

    await dietPlan.save();

    res.json({
      success: true,
      message: 'Personalized diet plan generated successfully',
      dietPlan
    });

  } catch (error) {
    console.error('Generate diet plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate diet plan',
      error: error.message
    });
  }
};

/**
 * Get active personalized diet plan
 */
exports.getActiveDietPlan = async (req, res) => {
  try {
    const userId = req.user._id;

    const dietPlan = await PersonalizedDietPlan.findOne({
      userId,
      isActive: true,
      validUntil: { $gt: new Date() }
    }).sort({ generatedAt: -1 });

    if (!dietPlan) {
      return res.json({
        success: true,
        message: 'No active diet plan found',
        dietPlan: null
      });
    }

    res.json({
      success: true,
      dietPlan
    });

  } catch (error) {
    console.error('Get diet plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch diet plan',
      error: error.message
    });
  }
};

/**
 * Generate supplement recommendations
 */
exports.generateSupplementRecommendations = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user profile
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get latest health reports
    const healthReports = await HealthReport.find({ userId })
      .sort({ uploadDate: -1 })
      .limit(5);

    // Extract deficiencies
    const deficiencies = [];
    healthReports.forEach(report => {
      if (report.analysis?.deficiencies) {
        report.analysis.deficiencies.forEach(def => {
          deficiencies.push({
            nutrient: def.name || def,
            severity: def.severity || 'detected',
            labValue: def.value || '',
            reportId: report._id
          });
        });
      }
    });

    if (deficiencies.length === 0) {
      return res.json({
        success: true,
        message: 'No deficiencies detected',
        recommendations: null
      });
    }

    // Prepare user data for AI
    const userData = {
      deficiencies,
      age: user.profile?.age || user.age,
      gender: user.profile?.gender || user.gender,
      dietaryPreference: user.profile?.dietaryPreference || 'non-vegetarian',
      medicalConditions: user.profile?.medicalConditions || [],
      currentMedications: user.profile?.currentMedications || []
    };

    // Generate AI-powered supplement recommendations
    const aiRecommendations = await dietRecommendationAI.generateSupplementRecommendations(userData);

    // Deactivate old recommendations
    await SupplementRecommendation.updateMany(
      { userId, isActive: true },
      { isActive: false }
    );

    // Save new recommendations
    const recommendations = new SupplementRecommendation({
      userId,
      deficiencies,
      ...aiRecommendations
    });

    await recommendations.save();

    res.json({
      success: true,
      message: 'Supplement recommendations generated successfully',
      recommendations
    });

  } catch (error) {
    console.error('Generate supplement recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate supplement recommendations',
      error: error.message
    });
  }
};

/**
 * Get active supplement recommendations
 */
exports.getActiveSupplementRecommendations = async (req, res) => {
  try {
    const userId = req.user._id;

    const recommendations = await SupplementRecommendation.findOne({
      userId,
      isActive: true
    }).sort({ generatedAt: -1 });

    if (!recommendations) {
      return res.json({
        success: true,
        message: 'No active supplement recommendations found',
        recommendations: null
      });
    }

    res.json({
      success: true,
      recommendations
    });

  } catch (error) {
    console.error('Get supplement recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch supplement recommendations',
      error: error.message
    });
  }
};

/**
 * Rate diet plan
 */
exports.rateDietPlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const { rating, feedback } = req.body;
    const userId = req.user._id;

    const dietPlan = await PersonalizedDietPlan.findOne({
      _id: planId,
      userId
    });

    if (!dietPlan) {
      return res.status(404).json({
        success: false,
        message: 'Diet plan not found'
      });
    }

    dietPlan.userRating = rating;
    dietPlan.userFeedback = feedback;
    await dietPlan.save();

    res.json({
      success: true,
      message: 'Thank you for your feedback!'
    });

  } catch (error) {
    console.error('Rate diet plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit rating',
      error: error.message
    });
  }
};

/**
 * Track supplement usage
 */
exports.trackSupplementUsage = async (req, res) => {
  try {
    const { recommendationId } = req.params;
    const { supplementName, dosage, notes } = req.body;
    const userId = req.user._id;

    const recommendation = await SupplementRecommendation.findOne({
      _id: recommendationId,
      userId
    });

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        message: 'Recommendation not found'
      });
    }

    recommendation.userStartedTaking.push({
      supplementName,
      startDate: new Date(),
      dosage,
      notes
    });

    await recommendation.save();

    res.json({
      success: true,
      message: 'Supplement usage tracked successfully'
    });

  } catch (error) {
    console.error('Track supplement usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track supplement usage',
      error: error.message
    });
  }
};
