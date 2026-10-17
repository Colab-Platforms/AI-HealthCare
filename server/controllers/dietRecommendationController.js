const PersonalizedDietPlan = require('../models/PersonalizedDietPlan');
const SupplementRecommendation = require('../models/SupplementRecommendation');
const HealthReport = require('../models/HealthReport');
const User = require('../models/User');
const dietRecommendationAI = require('../services/dietRecommendationAI');
const { resolveDietTargets, normalizeGoal } = require('../services/dietTargets');
const queueService = require('../services/queueService');
const cache = require('../utils/cache');
const { resolveDietaryPreference } = require('../utils/dietaryPreference');
const { reconcileFoodPreferences } = require('../utils/dietConstraints');
const { normalizePlanCalories } = require('../utils/mealPlanCalories');
const { slotCalorieRange } = require('../config/indianMealSlots');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');

/**
 * Why a user rejected a suggested meal, sent with a regenerate-meal request.
 *
 * The reason is optional: without one, regenerating is a one-off swap and the
 * dish can come back later. With one, the dish goes into `foodsToAvoid` and is
 * excluded from every future plan — so this is the difference between "give me
 * something else today" and "stop suggesting this".
 *
 * All values are treated the same way today; they are kept distinct so the
 * reasons can be reported on, and so "can't get it here" can later feed
 * availability per region rather than only per user.
 */
const MEAL_REJECTION_REASONS = ['not_available', 'dont_know_it', 'too_expensive', 'dont_like'];

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

    // Refuse to generate without a known diet type. Guessing non-veg here is
    // how vegetarian users got non-veg plans.
    const diet = resolveDietaryPreference(user);
    if (!diet.value) {
      return res.status(422).json({
        success: false,
        code: 'DIETARY_PREFERENCE_REQUIRED',
        message: 'Please set your diet type (vegetarian, vegan, eggetarian, jain or non-vegetarian) in your profile before generating a diet plan.'
      });
    }

    // Get latest health reports - ensure we use the correct field 'user'
    const healthReports = await HealthReport.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5);

    // Check if user has any reports
    const hasReports = healthReports.length > 0;

    // Extract lab report insights (only if reports exist)
    const labReportInsights = [];
    const deficiencies = [];
    const reportConditions = [];

    if (hasReports) {
      healthReports.forEach(report => {
        if (report.aiAnalysis?.deficiencies && Array.isArray(report.aiAnalysis.deficiencies)) {
          report.aiAnalysis.deficiencies.forEach(def => {
            deficiencies.push({
              nutrient: def.name || def,
              severity: def.severity || 'detected',
              reportId: report._id
            });
          });
        }

        if (report.aiAnalysis?.metrics) {
          Object.entries(report.aiAnalysis.metrics).forEach(([key, metric]) => {
            if (metric && typeof metric === 'object') {
              labReportInsights.push({
                parameter: key,
                value: metric.value || '',
                unit: metric.unit || '',
                status: metric.status || 'noted',
                reportId: report._id
              });

              if (metric.status !== 'normal') {
                reportConditions.push({
                  parameter: key,
                  status: metric.status,
                  value: metric.value
                });
              }
            }
          });
        }

        if (report.aiAnalysis?.keyFindings && Array.isArray(report.aiAnalysis.keyFindings)) {
          report.aiAnalysis.keyFindings.forEach(finding => {
            reportConditions.push({ finding });
          });
        }
      });
    }

    // Goal and targets come from one resolver (active HealthGoal first, the
    // User mirror second — see services/dietTargets) so every generation path
    // agrees with what the Nutrition screen shows. `bmiGoal` is the normalised
    // goal: "maintenance", "health_improvement" etc. no longer reach the prompt
    // as unrecognised strings.
    const targets = await resolveDietTargets(user);
    const bmiGoal = targets.goal;
    const targetWeight = user.nutritionGoal?.targetWeight;
    const currentWeight = user.profile?.weight || 70;
    const height = user.profile?.height || 170;
    const heightInMeters = height / 100;
    const currentBMI = currentWeight / (heightInMeters * heightInMeters);

    // Calculate user's nutrition goals or use saved ones
    let nutritionGoals = null;
    // --- Diabetes detection (Moved up to use in goal calculation) ---
    const diabetesProfile = user.profile?.diabetesProfile || {};
    const medicalHistoryConditions = user.profile?.medicalHistory?.conditions || [];
    const chronicConditions = user.profile?.chronicConditions || [];
    const fitnessProfile = user.profile?.fitnessProfile || {};

    const isDiabetic = !!(
      diabetesProfile.type ||
      medicalHistoryConditions.some(c => /diabet/i.test(c)) ||
      chronicConditions.some(c => /diabet/i.test(c))
    );

    const isPrediabetic = !!(
      diabetesProfile.type === 'Prediabetes' ||
      medicalHistoryConditions.some(c => /prediabet/i.test(c))
    );

    const diabetesInfo = isDiabetic || isPrediabetic ? {
      isDiabetic,
      isPrediabetic,
      diabetesType: diabetesProfile.type || 'Type 2',
      diabetesStatus: diabetesProfile.status || 'detected',
      hba1c: diabetesProfile.hba1c,
      fastingGlucose: diabetesProfile.fastingGlucose,
      postMealGlucose: diabetesProfile.postMealGlucose,
      onMedication: diabetesProfile.onMedication,
      medicationType: diabetesProfile.medicationType || [],
    } : null;

    nutritionGoals = targets;
    console.log(`[DietGeneration] Targets for ${userId}: goal=${targets.goal} kcal=${targets.calorieGoal} (source: ${targets.source})`);

    // The diet type is the authority over free-text tags: a stale "Jain" entry
    // left from an earlier vegetarian setting is dropped here when the user is
    // now non-veg/eggetarian, so it can neither reach the prompt nor be saved
    // into the plan's inputData.
    const { prefs: foodPreferences, dropped: droppedJain } = reconcileFoodPreferences(diet.value, user.foodPreferences);
    if (droppedJain.length) {
      console.warn(`[DietGeneration] User ${userId} is "${diet.value}" — ignoring stale Jain preference(s): ${droppedJain.join(', ')}`);
    }

    const { getAlcoholSummary, buildAlcoholContextForAI } = require('../utils/alcoholLog');
    const alcoholSummary = getAlcoholSummary(user.alcoholLog || {});
    const lifestyle = user.profile?.lifestyle || {};

    // Prepare user data for AI
    const userData = {
      age: user.profile?.age || 25,
      gender: user.profile?.gender || 'male',
      weight: currentWeight,
      height: height,
      currentBMI: currentBMI.toFixed(1),
      bmiGoal: bmiGoal,
      goal: bmiGoal,
      tdee: targets.tdee,
      targetWeight: targetWeight,
      region: user.foodPreferences?.region || 'other',  // ← Region
      country: user.foodPreferences?.country || 'India',  // ← Country
      state: user.foodPreferences?.state || null,  // ← State (null when not set; no default guess)
      city: user.foodPreferences?.city || null,  // ← City (null when not set; no default guess)
      dietaryPreference: diet.value,
      activityLevel: user.profile?.activityLevel || 'moderately_active',
      fitnessGoals: user.profile?.fitnessGoals || [],
      primaryFitnessGoal: fitnessProfile.primaryGoal || '',
      medicalConditions: [
        ...(user.profile?.medicalConditions || []),
        ...medicalHistoryConditions,
        ...chronicConditions
      ].filter((v, i, a) => v && a.indexOf(v) === i), // dedupe
      allergies: user.profile?.allergies || [],
      currentMedications: user.profile?.medicalHistory?.currentMedications || [],
      hasReports: hasReports,
      labReports: labReportInsights,
      reportConditions: reportConditions,
      deficiencies: deficiencies,
      diabetesInfo,            // ← full diabetes context
      healthParameters: {
        bmi: currentBMI,
        bloodPressure: user.profile?.bloodPressure
      },
      nutritionGoals: {
        dailyCalories: nutritionGoals.calorieGoal,
        protein: nutritionGoals.proteinGoal,
        carbs: nutritionGoals.carbsGoal,
        fats: nutritionGoals.fatGoal
      },
      foodPreferences, // reconciled against the diet type (see above)
      lifestyle,
      alcoholSummary,
      alcoholContext: buildAlcoholContextForAI(user.alcoholLog, lifestyle)
    };

    // Generate AI-powered diet plan
    // 3. Find the previous active plan to extract its meals for "Complete New" variety
    const previousPlan = await PersonalizedDietPlan.findOne({ userId, isActive: true }).sort({ createdAt: -1 });
    let avoidMealsList = [];
    if (previousPlan && previousPlan.mealPlan) {
      Object.values(previousPlan.mealPlan).forEach(meals => {
        if (Array.isArray(meals)) {
          meals.forEach(m => {
            const name = m.name || (m.foodItems && m.foodItems[0]?.name);
            if (name) avoidMealsList.push(name);
          });
        }
      });
    }

    // 4. Deactivate ALL previous active plans immediately so getActiveDietPlan only sees the new one
    await PersonalizedDietPlan.updateMany(
      { userId, isActive: true },
      { isActive: false }
    );
    
    // 5. Create a "generating" placeholder IMMEDIATELY
    const dietPlan = new PersonalizedDietPlan({
      userId: userId,
      status: 'generating',
      isActive: true, // Make it active so getActiveDietPlan finds it
      generatedAt: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      nutritionGoals: {
        dailyCalorieTarget: nutritionGoals.calorieGoal,
        macroTargets: {
          protein: nutritionGoals.proteinGoal,
          carbs: nutritionGoals.carbsGoal,
          fats: nutritionGoals.fatGoal
        }
      }
    });

    await dietPlan.save();

    // Prepare prompt extension for variety
    const isRegenerate = req.body?.isRegenerate || false;

    // Optional occasion/fasting context (e.g. Ramadan, Shravan month, a vrat/
    // upvas day) — null unless the client explicitly passes one for this
    // generation. Carried on userData so processDietInternal can persist it.
    const occasion = typeof req.body?.occasion === 'string' && req.body.occasion.trim()
      ? req.body.occasion.trim().slice(0, 100)
      : null;
    userData.occasion = occasion;

    // Location is NOT added here. The location block is built once, inside the
    // prompt (services/dietRecommendationAI buildLocationInstructions). This
    // method used to append its own STATE/CITY FOCUS lines as well, so the
    // prompt carried the location twice — the city got double weight, and that
    // is what turned dish names into "<City> Special ...".
    let promptEx = isRegenerate
      ? 'This is a REGENERATION request: give a fresh weekly menu with different sabzis, dals and preparations than before — but every dish must still be an ordinary, commonly cooked Indian home dish. Never choose an unusual dish just to be different.'
      : '';

    // Same-menu avoidance is a preference, not a ban. A hard "none of these 21
    // dishes" list used up the common home dishes first, which left only
    // unusual ones — each regeneration drifted further from ordinary food.
    if (avoidMealsList.length > 0) {
      promptEx += `\nPrevious plan (prefer different dishes where an equally ordinary alternative exists; an everyday staple may repeat if needed): ${[...new Set(avoidMealsList)].join(', ')}.`;
    }

    if (occasion) {
      promptEx += `\nOCCASION CONTEXT (HIGH PRIORITY): The user is currently observing "${occasion}". Adjust every meal suggestion to respect this occasion's typical dietary customs — for example fasting windows or time-restricted eating, satvik/vegetarian-only requirements, specific ingredients to avoid or favor, and appropriate meal timing (e.g. pre-dawn suhoor and post-sunset iftar for a Ramadan-style fast, or fruit/dairy/nuts-only options for a Hindu vrat/upvas day). Use general cultural and religious knowledge of this occasion. If a standard meal cannot reasonably fit the occasion, replace it with the closest appropriate alternative rather than ignoring the occasion.`;
    }
    console.log('[DietGeneration] Placeholder saved: ', dietPlan._id);

    // 4. INVALIDATE CACHE
    const cache = require('../utils/cache');
    await cache.delete(`diet_plan:${userId}`);
    await cache.delete(`dashboard:${userId}`);

    // 5. TRIGGER BACKGROUND GENERATION
    const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ID);
    const protocol = req.protocol || 'https';
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    if (isVercel) {
      // 🚀 ON VERCEL: Use QStash for reliable background processing (bypasses timeouts)
      await queueService.enqueueTask('process-diet', {
        userId,
        dietPlanId: dietPlan._id,
        userData,
        promptEx
      }, baseUrl);
    } else {
      // 💻 ON LOCAL: Use setImmediate
      setImmediate(() => processDietInternal(userId, dietPlan._id, userData, promptEx));
    }

    // ✅ SEND SUCCESS RESPONSE IMMEDIATELY
    res.status(200).json({ 
      success: true, 
      message: 'Diet plan generation started in background', 
      dietPlan,
      backgroundProcessing: true 
    });

  } catch (error) {
    console.error('❌ Generate diet plan error:', error);
    res.status(500).json({ success: false, message: 'Failed to initiate diet generation', error: error.message });
  }
};

/**
 * 🚀 INTERNAL BACKGROUND DIET PROCESSOR
 */
async function processDietInternal(userId, dietPlanId, userData, promptEx) {
  console.log(`🔄 [BG-DIET] Starting generation for ${dietPlanId}...`);
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    let aiDietPlan;
    try {
      aiDietPlan = await dietRecommendationAI.generatePersonalizedDietPlan(userData, promptEx);
      if (!aiDietPlan || typeof aiDietPlan !== 'object') throw new Error('Invalid AI response');
    } catch (aiError) {
      console.error('[BG-DIET] AI Error:', aiError.message);

      // Fallback: reactivate last good plan instead of leaving user empty-handed
      // Only fall back to a plan built for the SAME diet type. Otherwise a
      // vegetarian user whose generation failed could be reactivated onto an
      // older non-veg plan, which is exactly the harm this fix prevents.
      const lastGoodPlan = await PersonalizedDietPlan.findOne({
        userId,
        status: 'completed',
        'inputData.dietaryPreference': userData.dietaryPreference,
        _id: { $ne: dietPlanId }
      }).sort({ generatedAt: -1 });

      if (lastGoodPlan) {
        console.log(`[BG-DIET] Fallback: reactivating plan ${lastGoodPlan._id}`);
        await PersonalizedDietPlan.findByIdAndUpdate(lastGoodPlan._id, {
          isActive: true,
          isFallback: true,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
      }

      await PersonalizedDietPlan.findByIdAndUpdate(dietPlanId, { status: 'failed', isActive: false });
      return;
    }

    // Land every day on the user's target, in BOTH directions (see
    // utils/mealPlanCalories). This only scaled days DOWN and only past +10%, so
    // an under-calorie plan for a user on a surplus goal was passed straight
    // through. Days too far off to scale honestly are logged, not faked.
    const calorieCap = userData.nutritionGoals.dailyCalories;
    if (calorieCap && aiDietPlan.mealPlan) {
      const { scaled, unfixable } = normalizePlanCalories(aiDietPlan.mealPlan, calorieCap);
      if (scaled.length) console.log(`[BG-DIET] Scaled day(s) ${scaled.map(i => i + 1).join(', ')} onto the ${calorieCap} kcal target`);
      if (unfixable.length) console.warn(`[BG-DIET] Day(s) ${unfixable.map(i => i + 1).join(', ')} are too far from ${calorieCap} kcal to scale honestly (goal: ${userData.bmiGoal})`);
      aiDietPlan.dailyCalorieTarget = calorieCap;
    }

    const finalData = {
      ...aiDietPlan,
      status: 'completed',
      inputData: {
        age: userData.age,
        gender: userData.gender,
        weight: userData.weight,
        height: userData.height,
        currentBMI: userData.currentBMI,
        bmiGoal: userData.bmiGoal,
        targetWeight: userData.targetWeight,
        dietaryPreference: userData.dietaryPreference,
        occasion: userData.occasion || null,
        activityLevel: userData.activityLevel,
        fitnessGoals: userData.fitnessGoals,
        medicalConditions: userData.medicalConditions,
        allergies: userData.allergies,
        dietaryDo: userData.foodPreferences?.dietaryDo || [],
        dietaryDont: userData.foodPreferences?.dietaryDont || [],
        hasReports: userData.hasReports,
        lifestyle: userData.lifestyle,
        alcoholSummary: userData.alcoholSummary
      },
      nutritionGoals: {
        dailyCalorieTarget: userData.nutritionGoals.dailyCalories,
        macroTargets: {
          protein: userData.nutritionGoals.protein,
          carbs: userData.nutritionGoals.carbs,
          fats: userData.nutritionGoals.fats
        }
      }
    };

    const updatedPlan = await PersonalizedDietPlan.findByIdAndUpdate(dietPlanId, finalData, { new: true });
    
    // Deactivate older plans
    await PersonalizedDietPlan.updateMany(
      { userId, isActive: true, _id: { $ne: updatedPlan._id } },
      { isActive: false }
    );

    // Notifications & Email
    await notificationService.createNotification(userId, {
      type: 'diet_ready',
      title: 'Diet Plan Ready!',
      message: 'Your personalized AI diet plan has been generated.',
      icon: '',
      priority: 'high',
      actionUrl: '/diet-plan'
    });

    try { await emailService.sendDietPlanComplete(user.email, user.name); }
    catch (e) { console.warn('[BG-DIET] Email fail:', e.message); }

    await cache.delete(`diet_plan:${userId}`);
    await cache.delete(`dashboard:${userId}`);
    console.log(`✅ [BG-DIET] Done for ${userId}`);

  } catch (error) {
    console.error('[BG-DIET] Fatal error:', error.message);
    await PersonalizedDietPlan.findByIdAndUpdate(dietPlanId, { status: 'failed' });
  }
}

/**
 * 📡 QStash Webhook Endpoint for Diet (Production/Vercel)
 */
exports.processDietBG = async (req, res) => {
  try {
    const { userId, dietPlanId, userData, promptEx, isAutoTrigger } = req.body;
    
    // Handle auto-trigger from report analysis (no plan created yet)
    if (isAutoTrigger && !dietPlanId) {
      console.log(`🔔 QStash auto-diet callback received for user ${userId}`);
      const { generateDietAfterReport } = require('./dietRecommendationController');
      if (generateDietAfterReport) {
        await generateDietAfterReport(userId);
      }
      return res.status(200).json({ success: true, message: 'Auto diet plan generated' });
    }

    console.log(`🔔 QStash diet callback received for plan ${dietPlanId}`);
    await processDietInternal(userId, dietPlanId, userData, promptEx);
    res.status(200).json({ success: true, message: 'Diet plan generated successfully' });

  } catch (err) {
    console.error('QStash Diet Callback Error:', err.message);
    if (!res.headersSent) res.status(500).end();
  }
};

/**
 * Regenerate a single meal slot (one meal type, one day) instead of the
 * whole 7-day plan. Keeps every other meal untouched.
 */
exports.regenerateMealSlot = async (req, res) => {
  try {
    const { planId } = req.params;
    const { mealType, dayIndex, reason } = req.body;
    const userId = req.user._id;

    if (!['breakfast', 'lunch', 'dinner'].includes(mealType)) {
      return res.status(400).json({ success: false, message: 'mealType must be breakfast, lunch, or dinner' });
    }
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) {
      return res.status(400).json({ success: false, message: 'dayIndex must be an integer between 0 and 6' });
    }
    if (reason !== undefined && !MEAL_REJECTION_REASONS.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: `reason must be one of: ${MEAL_REJECTION_REASONS.join(', ')}`
      });
    }

    const dietPlan = await PersonalizedDietPlan.findOne({ _id: planId, userId });
    if (!dietPlan) {
      return res.status(404).json({ success: false, message: 'Diet plan not found' });
    }
    if (dietPlan.status !== 'completed') {
      return res.status(409).json({ success: false, message: `Plan is currently "${dietPlan.status}" — wait for it to finish before regenerating a meal.` });
    }

    // One regeneration in flight at a time, with the same 10-minute self-heal
    // window as whole-plan generation (see getActiveDietPlan) — a stuck slot
    // from a crashed background job should not permanently block new requests.
    if (dietPlan.pendingMealRegeneration?.status === 'generating') {
      const ageMs = Date.now() - new Date(dietPlan.pendingMealRegeneration.requestedAt).getTime();
      if (ageMs < 10 * 60 * 1000) {
        return res.status(409).json({ success: false, message: 'A meal regeneration is already in progress for this plan.' });
      }
    }

    const otherMealTypes = ['breakfast', 'lunch', 'dinner'].filter(t => t !== mealType);
    const otherCaloriesSum = otherMealTypes.reduce((sum, t) => {
      const item = dietPlan.mealPlan?.[t]?.[dayIndex];
      return sum + (item?.calories || 0);
    }, 0);
    const dailyTarget = dietPlan.nutritionGoals?.dailyCalorieTarget || dietPlan.dailyCalorieTarget || 2000;
    // Clamped to what this slot can reasonably be: when the other two meals of
    // the day are themselves off, "whatever is left" could ask for a 1,400 kcal
    // breakfast. The day-level reconciliation (utils/mealPlanCalories) evens out
    // the remainder.
    const slotRange = slotCalorieRange(mealType, dailyTarget);
    const remainingCalories = Math.min(
      slotRange.max,
      Math.max(300, slotRange.min, Math.round(dailyTarget - otherCaloriesSum))
    );

    // Avoid-list scoped to this meal type across the whole week — small prompt,
    // still gives variety across days (see design discussion: whole-plan avoid
    // list would be unnecessarily large and irrelevant to what's being replaced).
    //
    // The slot being replaced is included rather than skipped: the user asked
    // for something else, so handing back the same dish is the one outcome that
    // definitely fails. It used to be excluded, which left that possible.
    const avoidNames = (dietPlan.mealPlan?.[mealType] || [])
      .map((m) => m?.name)
      .filter(Boolean);

    // With a `reason`, the rejected dish is remembered rather than just swapped:
    // without this, the same unavailable dish comes back in next week's plan and
    // the user rejects it again forever. `foodsToAvoid` already feeds the prompt
    // as a hard exclusion (see dietRecommendationAI), so this reuses the
    // existing mechanism instead of adding a parallel one.
    // Checked before any write below, so a refused request leaves no trace.
    const diet = resolveDietaryPreference(req.user, dietPlan);
    if (!diet.value) {
      return res.status(422).json({
        success: false,
        code: 'DIETARY_PREFERENCE_REQUIRED',
        message: 'Please set your diet type in your profile before regenerating a meal.'
      });
    }
    if (diet.source === 'plan') {
      console.warn(`[DietPlan] User ${userId} has no profile diet type; regenerating from plan inputData ("${diet.value}")`);
    }

    // Diet type decides whether a stored "Jain" tag still applies (see
    // utils/dietConstraints) — read from the user's CURRENT preferences, not the
    // plan's snapshot, so switching to non-veg takes effect on the next swap.
    const { prefs: currentPrefs } = reconcileFoodPreferences(diet.value, req.user.foodPreferences);

    const rejectedName = dietPlan.mealPlan?.[mealType]?.[dayIndex]?.name;
    let foodsToAvoid = currentPrefs.foodsToAvoid || [];

    if (reason && rejectedName) {
      const alreadyAvoided = foodsToAvoid.some(
        (f) => typeof f === 'string' && f.trim().toLowerCase() === rejectedName.trim().toLowerCase()
      );

      if (!alreadyAvoided) {
        foodsToAvoid = [...foodsToAvoid, rejectedName];
        // Targeted $addToSet rather than a read-modify-save: req.user comes from
        // a cached .lean() read (see middleware/auth), so it is not a live
        // document, and two quick rejections would otherwise race and lose one.
        // The post('updateOne') hook in models/User.js drops the cached copy.
        await User.updateOne(
          { _id: userId },
          { $addToSet: { 'foodPreferences.foodsToAvoid': rejectedName } }
        );
        console.log(`[DietPlan] User ${userId} rejected "${rejectedName}" (${reason}) — added to foodsToAvoid`);
      }
    }

    await PersonalizedDietPlan.findByIdAndUpdate(planId, {
      pendingMealRegeneration: { mealType, dayIndex, status: 'generating', requestedAt: new Date() }
    });

    // The user's current goal, so a swap for a bulking user is not answered with
    // a diet dish (and vice versa). One extra indexed lookup per swap.
    const targets = await resolveDietTargets(req.user);

    const userData = {
      dietaryPreference: diet.value,
      // Current profile first; the plan's snapshot only if the profile is empty.
      allergies: req.user.profile?.allergies?.length ? req.user.profile.allergies : dietPlan.inputData?.allergies,
      medicalConditions: dietPlan.inputData?.medicalConditions,
      // Carries the dish just rejected, so the replacement can't be the same one.
      foodPreferences: { ...currentPrefs, foodsToAvoid },
      country: req.user.foodPreferences?.country,
      region: req.user.foodPreferences?.region,
      state: req.user.foodPreferences?.state,
      // Was missing: the whole-plan path passes city, so regenerating a single
      // meal used to silently drop the most specific location signal we have.
      city: req.user.foodPreferences?.city,
      goal: targets.goal,
      tdee: targets.tdee,
      dailyCalories: dailyTarget,
    };

    const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ID);
    const baseUrl = `${req.protocol || 'https'}://${req.get('host')}`;
    const jobPayload = { planId, mealType, dayIndex, remainingCalories, userData, avoidNames };

    if (isVercel) {
      await queueService.enqueueTask('process-meal-regen', jobPayload, baseUrl);
    } else {
      setImmediate(() => processMealRegenInternal(jobPayload));
    }

    res.json({
      success: true,
      message: 'Meal regeneration started',
      pendingMealRegeneration: { mealType, dayIndex, status: 'generating' }
    });
  } catch (error) {
    console.error('Regenerate meal slot error:', error);
    res.status(500).json({ success: false, message: 'Failed to start meal regeneration', error: error.message });
  }
};

async function processMealRegenInternal({ planId, mealType, dayIndex, remainingCalories, userData, avoidNames }) {
  try {
    const newMeal = await dietRecommendationAI.regenerateSingleMeal({ mealType, remainingCalories, userData, avoidNames });
    if (!newMeal || typeof newMeal.calories !== 'number') {
      throw new Error('AI did not return a valid meal');
    }

    // NOTE: Mongoose strips `undefined` values out of update objects before
    // sending them to MongoDB, so `pendingMealRegeneration: undefined` here
    // would silently do nothing — $unset is the correct way to clear a field.
    await PersonalizedDietPlan.findByIdAndUpdate(planId, {
      $set: { [`mealPlan.${mealType}.${dayIndex}`]: newMeal },
      $unset: { pendingMealRegeneration: '' }
    });

    const plan = await PersonalizedDietPlan.findById(planId).select('userId');
    if (plan) cache.delete(`dashboard:${plan.userId}`);
  } catch (error) {
    console.error('[MealRegen] Failed:', error.message);
    await PersonalizedDietPlan.findByIdAndUpdate(planId, {
      'pendingMealRegeneration.status': 'failed'
    }).catch(() => {});
  }
}

// QStash callback counterpart to processMealRegenInternal — same auth pattern as process-diet-bg.
exports.processMealRegenBG = async (req, res) => {
  try {
    await processMealRegenInternal(req.body);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('QStash Meal-Regen Callback Error:', err.message);
    if (!res.headersSent) res.status(500).end();
  }
};

/**
 * Has the user changed what the plan was built for?
 *
 * Changing the diet type or goal in the profile never touched the stored plan,
 * so a user who moved from vegetarian/Jain to non-veg, or from maintain to
 * bulk, kept seeing the old plan and reasonably concluded the setting was
 * ignored. Never throws: a failed check must not break loading the plan.
 *
 * @returns {Promise<{isStale: boolean, reasons: {code: string, from?: any, to?: any}[]}>}
 */
async function buildPlanStaleness(plan, user) {
  const reasons = [];
  try {
    if (!plan || plan.status !== 'completed') return { isStale: false, reasons };

    const currentDiet = resolveDietaryPreference(user).value;
    const planDiet = plan.inputData?.dietaryPreference;
    if (currentDiet && planDiet && currentDiet !== planDiet) {
      reasons.push({ code: 'DIET_CHANGED', from: planDiet, to: currentDiet });
    }

    const targets = await resolveDietTargets(user);
    const planGoal = plan.inputData?.bmiGoal ? normalizeGoal(plan.inputData.bmiGoal) : null;
    if (planGoal && planGoal !== targets.goal) {
      reasons.push({ code: 'GOAL_CHANGED', from: planGoal, to: targets.goal });
    }

    const planKcal = plan.nutritionGoals?.dailyCalorieTarget;
    if (planKcal && targets.calorieGoal && Math.abs(planKcal - targets.calorieGoal) / targets.calorieGoal > 0.05) {
      reasons.push({ code: 'CALORIES_CHANGED', from: planKcal, to: targets.calorieGoal });
    }
  } catch (err) {
    console.warn('[DietPlan] Staleness check failed:', err.message);
  }
  return { isStale: reasons.length > 0, reasons };
}

/**
 * Get active personalized diet plan
 */
exports.getActiveDietPlan = async (req, res) => {
  try {
    const userId = req.user._id;

    const dietPlan = await PersonalizedDietPlan.findOne({
      userId,
      isActive: true,
      validUntil: { $gt: new Date() },
      status: { $ne: 'failed' } // Don't return failed plans
    }).sort({ generatedAt: -1 });

    // 🔧 AUTO-RECOVER: If diet plan stuck in 'generating' for >10 minutes, mark as failed
    if (dietPlan && dietPlan.status === 'generating') {
      const ageMs = Date.now() - new Date(dietPlan.generatedAt || dietPlan.createdAt).getTime();
      const TEN_MINUTES = 10 * 60 * 1000;
      if (ageMs > TEN_MINUTES) {
        console.warn(`⚠️ [Recovery] Diet plan ${dietPlan._id} stuck in generating for ${Math.round(ageMs / 60000)}min. Marking as failed.`);
        await PersonalizedDietPlan.findByIdAndUpdate(dietPlan._id, {
          status: 'failed',
          isActive: false
        });
        return res.json({
          success: true,
          message: 'Diet plan generation timed out. Please try generating again.',
          dietPlan: null
        });
      }
    }

    // Same self-heal idea, scoped to a single stuck meal-regeneration —
    // clears it so a crashed background job doesn't block future requests.
    if (dietPlan?.pendingMealRegeneration?.status === 'generating') {
      const ageMs = Date.now() - new Date(dietPlan.pendingMealRegeneration.requestedAt).getTime();
      if (ageMs > 10 * 60 * 1000) {
        console.warn(`⚠️ [Recovery] Meal regen stuck for plan ${dietPlan._id}. Marking as failed.`);
        await PersonalizedDietPlan.findByIdAndUpdate(dietPlan._id, { 'pendingMealRegeneration.status': 'failed' });
        dietPlan.pendingMealRegeneration.status = 'failed';
      }
    }

    if (!dietPlan) {
      return res.json({
        success: true,
        message: 'No active diet plan found',
        dietPlan: null
      });
    }

    // Safety net alongside the background regenerate triggered on profile save
    // (see authController.js) — if that fire-and-forget trigger ever failed to
    // fire, this still tells the client the stored plan was built for a diet
    // type the user has since changed, instead of silently serving old meals.
    // Computed at read time, not stored, so it can never itself go stale.
    const currentDiet = resolveDietaryPreference(req.user).value;
    const isStale = !!(currentDiet && dietPlan.inputData?.dietaryPreference && dietPlan.inputData.dietaryPreference !== currentDiet);

    res.json({
      success: true,
      dietPlan,
      // `isStale` / `staleReason` are the original diet-type-only flag, kept
      // as-is for clients already reading it. `staleness` is the superset: it
      // also covers a changed goal or calorie target, with the old/new values.
      isStale,
      ...(isStale ? { staleReason: 'dietary_preference_changed' } : {}),
      staleness: await buildPlanStaleness(dietPlan, req.user)
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
 * Get diet plan history
 */
exports.getDietPlanHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const history = await PersonalizedDietPlan.find({ userId })
      .sort({ generatedAt: -1 })
      .limit(10)
      .select('generatedAt createdAt isActive inputData nutritionGoals foodType status');

    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Get diet plan history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch diet plan history',
      error: error.message
    });
  }
};

/**
 * Get specific diet plan by ID
 */
exports.getDietPlanById = async (req, res) => {
  try {
    const { planId } = req.params;
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

    res.json({
      success: true,
      dietPlan
    });
  } catch (error) {
    console.error('Get diet plan by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch diet plan',
      error: error.message
    });
  }
};

/**
 * Get diet plan generation status
 */
exports.getDietPlanStatus = async (req, res) => {
  try {
    const { planId } = req.params;
    const userId = req.user._id;

    const dietPlan = await PersonalizedDietPlan.findOne({
      _id: planId,
      userId
    }).select('status generatedAt');

    if (!dietPlan) {
      return res.status(404).json({
        success: false,
        message: 'Diet plan not found'
      });
    }

    res.json({
      success: true,
      status: dietPlan.status,
      generatedAt: dietPlan.generatedAt
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
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

    // Get latest health reports - using correct field name 'user'
    const healthReports = await HealthReport.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5);

    // Extract deficiencies
    const deficiencies = [];
    healthReports.forEach(report => {
      if (report.aiAnalysis?.deficiencies) {
        report.aiAnalysis.deficiencies.forEach(def => {
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
      dietaryPreference: resolveDietaryPreference(user).value,
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

/**
 * 🚀 AUTO-GENERATE DIET PLAN AFTER REPORT ANALYSIS
 * Called internally (no req/res) after a health report is successfully analyzed
 */
exports.generateDietAfterReport = async (userId) => {
  console.log(`[AutoDiet] Starting auto diet generation for user ${userId}...`);
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // --- Diabetes detection ---
    const diabetesProfile = user.profile?.diabetesProfile || {};
    const medicalHistoryConditions = user.profile?.medicalHistory?.conditions || [];
    const chronicConditions = user.profile?.chronicConditions || [];
    const isDiabetic = !!(
      diabetesProfile.type ||
      medicalHistoryConditions.some(c => /diabet/i.test(c)) ||
      chronicConditions.some(c => /diabet/i.test(c))
    );
    const isPrediabetic = !!(
      diabetesProfile.type === 'Prediabetes' ||
      medicalHistoryConditions.some(c => /prediabet/i.test(c))
    );

    const currentWeight = user.profile?.weight || 70;
    const height = user.profile?.height || 170;
    const heightInMeters = height / 100;
    const currentBMI = currentWeight / (heightInMeters * heightInMeters);

    // Same resolver as the interactive path. This used to fall back to a flat
    // 2000 (1800 diabetic) with the goal ignored, so a plan auto-generated after
    // a report upload could contradict the user's weight-loss or gain goal.
    const nutritionGoals = await resolveDietTargets(user);
    const bmiGoal = nutritionGoals.goal;

    const diabetesInfo = isDiabetic || isPrediabetic ? {
      isDiabetic,
      isPrediabetic,
      diabetesType: diabetesProfile.type || 'Type 2'
    } : null;

    // Get latest report data
    const healthReports = await HealthReport.find({ user: userId }).sort({ createdAt: -1 }).limit(3);
    const deficiencies = [];
    healthReports.forEach(r => {
      if (r.aiAnalysis?.deficiencies && Array.isArray(r.aiAnalysis.deficiencies)) {
        r.aiAnalysis.deficiencies.forEach(d => deficiencies.push({ nutrient: d.name || d, severity: d.severity || 'detected' }));
      }
    });
    const { getAlcoholSummary, buildAlcoholContextForAI } = require('../utils/alcoholLog');
    const alcoholSummary = getAlcoholSummary(user.alcoholLog || {});
    const lifestyle = user.profile?.lifestyle || {};

    // Background path: no user is waiting to see an error, so skip rather than
    // guess. The user gets a plan once they set a diet type.
    const diet = resolveDietaryPreference(user);
    if (!diet.value) {
      console.warn(`[AutoDiet] Skipped for user ${userId}: no diet type set in profile`);
      return;
    }

    const userData = {
      age: user.profile?.age || 25,
      gender: user.profile?.gender || 'male',
      weight: currentWeight,
      height,
      currentBMI: currentBMI.toFixed(1),
      bmiGoal,
      goal: bmiGoal,
      tdee: nutritionGoals.tdee,
      dietaryPreference: diet.value,
      activityLevel: user.profile?.activityLevel || 'moderately_active',
      fitnessGoals: user.profile?.fitnessGoals || [],
      region: user.foodPreferences?.region || 'other',
      country: user.foodPreferences?.country || 'India',
      state: user.foodPreferences?.state || null,
      city: user.foodPreferences?.city || null,
      medicalConditions: user.profile?.medicalConditions || [],
      allergies: user.profile?.allergies || [],
      // Was built above and never passed on, so diabetic users got no diabetes
      // context in auto-generated plans.
      diabetesInfo,
      deficiencies,
      nutritionGoals: {
        dailyCalories: nutritionGoals.calorieGoal,
        protein: nutritionGoals.proteinGoal,
        carbs: nutritionGoals.carbsGoal,
        fats: nutritionGoals.fatGoal
      },
      // Reconciled against the diet type, so a stale Jain tag cannot leak in.
      foodPreferences: reconcileFoodPreferences(diet.value, user.foodPreferences).prefs,
      lifestyle,
      alcoholSummary,
      alcoholContext: buildAlcoholContextForAI(user.alcoholLog, lifestyle)
    };

    // Deactivate old plans
    await PersonalizedDietPlan.updateMany({ userId, isActive: true }, { isActive: false });

    // Create generating placeholder
    const dietPlan = new PersonalizedDietPlan({
      userId,
      status: 'generating',
      isActive: true,
      generatedAt: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      nutritionGoals: {
        dailyCalorieTarget: nutritionGoals.calorieGoal,
        macroTargets: { protein: nutritionGoals.proteinGoal, carbs: nutritionGoals.carbsGoal, fats: nutritionGoals.fatGoal }
      }
    });
    await dietPlan.save();
    await cache.delete(`diet_plan:${userId}`);
    await cache.delete(`dashboard:${userId}`);

    // Generate in background
    await processDietInternal(userId, dietPlan._id, userData, 'Generate based on the user latest health report findings.');
    console.log(`[AutoDiet] Completed for user ${userId}`);
  } catch (error) {
    console.error(`[AutoDiet] Failed for user ${userId}:`, error.message);
  }
};

