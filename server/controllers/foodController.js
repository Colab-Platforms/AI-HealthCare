/**
 * Food reference DB endpoints (docs/FOOD_DB_FLOW.md section 7).
 */
const { searchFoods, toSearchResult, getIndex } = require('../services/foodDb/foodMatcher');
const { resolveMeal, itemsFromSimpleText } = require('../services/foodDb/foodScan');
const { identifyFoods } = require('../services/foodDb/foodIdentifier');
const { makeAiFallback } = require('../services/foodDb/aiFoodFallback');
const Food = require('../models/Food');
const { uploadImage } = require('../services/cloudinary');
const QuickFoodCheck = require('../models/QuickFoodCheck');

const MAX_QUERY_LENGTH = 100;
const MAX_LIMIT = 20;
const MAX_ITEMS = 10;

/** Food DB scan replaces the AI-only quick check when FOOD_DB_SCAN_ENABLED=true. */
const isFoodDbScanEnabled = () => process.env.FOOD_DB_SCAN_ENABLED === 'true';

/**
 * GET /api/foods/search?q=<text>&limit=5
 * Used by manual food logging, the search box and the "Did you mean…?" picker.
 */
exports.searchFoods = async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) return res.status(400).json({ success: false, message: 'Query parameter "q" is required' });
    if (q.length > MAX_QUERY_LENGTH) {
      return res.status(400).json({ success: false, message: `Query must be at most ${MAX_QUERY_LENGTH} characters` });
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), MAX_LIMIT);

    // prefixLast: the user may still be typing the last word ("chicken biry").
    const ranked = await searchFoods(q, { limit, prefixLast: true, minScore: 0.4 });
    const results = ranked.map(toSearchResult);
    return res.json({ success: true, query: q, count: results.length, results });
  } catch (error) {
    console.error('[foods/search] failed:', error);
    return res.status(500).json({ success: false, message: 'Food search failed' });
  }
};

function validateItems(items) {
  if (!Array.isArray(items) || !items.length) return 'Body must contain a non-empty "items" array';
  if (items.length > MAX_ITEMS) return `At most ${MAX_ITEMS} items`;
  for (const it of items) {
    if (!it || typeof it !== 'object') return 'Each item must be an object';
    if (!it.foodId && (typeof it.name !== 'string' || !it.name.trim())) return 'Each item needs a "name" or a "foodId"';
    if (it.candidates != null && !Array.isArray(it.candidates)) return '"candidates" must be an array';
    if (it.estGrams != null && !(Number(it.estGrams) > 0)) return '"estGrams" must be a positive number';
  }
  return null;
}

/**
 * POST /api/foods/resolve
 * body: { items: [{ name, candidates?, portionText?, estGrams?, foodId? }] }
 * Resolves already-identified items (e.g. after the user picks a "Did you mean…?" option or edits a
 * portion) to nutrition + warnings. Does not save anything; does not call the AI for unmatched items.
 */
exports.resolve = async (req, res) => {
  try {
    const error = validateItems(req.body?.items);
    if (error) return res.status(400).json({ success: false, message: error });
    const items = req.body.items.map((it) => ({
      name: String(it.name || '').trim().toLowerCase(),
      candidates: (it.candidates || []).map((c) => String(c).trim().toLowerCase()).filter(Boolean).slice(0, 3),
      portionText: it.portionText ? String(it.portionText).slice(0, 60) : '',
      estGrams: it.estGrams != null ? Math.round(Number(it.estGrams)) : null,
      foodId: it.foodId ? String(it.foodId) : undefined,
    }));
    const { createdFoodIds, ...data } = await resolveMeal({ items, user: req.user });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[foods/resolve] failed:', error);
    return res.status(500).json({ success: false, message: 'Could not resolve the meal' });
  }
};

/**
 * Food DB version of POST /api/nutrition/quick-check (called from nutritionController.quickFoodCheck
 * when FOOD_DB_SCAN_ENABLED=true). Same request; response per docs/FOOD_DB_FLOW.md section 7.2.
 */
exports.handleDbQuickCheck = async (req, res, { imageInputs, foodDescription, additionalContext, quantity, analysisTier, searchKey }) => {
  try {
    const text = [foodDescription, additionalContext].filter((c) => c && c !== 'Food from image').join('. ');
    const userId = req.user._id;

    // 1. Items: typed single food → straight from the DB; otherwise the small identification call.
    //    Photos upload to Cloudinary in parallel.
    const uploads = Promise.all(imageInputs.map((img) => uploadImage(`data:${img.mediaType};base64,${img.data}`, 'food_scans')
      .catch((err) => { console.error('☁️ [FoodScan] Cloudinary upload error:', err.message); return null; })));
    let items = !imageInputs.length ? itemsFromSimpleText(await getIndex(), foodDescription, quantity) : null;
    if (!items) {
      const identified = await identifyFoods({ images: imageInputs, text, quantity, userId });
      if (!identified.isFood) {
        await uploads;
        return res.status(400).json({ success: false, message: 'Could not detect food in image', error: 'UNABLE_TO_DETECT_FOOD' });
      }
      items = identified.items;
    }

    // 2. Match, nutrition, warnings.
    const [cloudinaryUrls, { createdFoodIds, ...result }] = await Promise.all([
      uploads,
      resolveMeal({ items, user: req.user, aiFallback: makeAiFallback({ userId }) }),
    ]);
    if (!result.dishes.length) {
      return res.status(422).json({ success: false, message: 'Could not work out the nutrition for this meal', error: 'UNRESOLVED_FOOD', unresolved: result.unresolved });
    }
    if (analysisTier === 'basic') result.warnings = []; // same tier gating as the AI flow: basic had no warnings

    // 3. Save, as the AI flow did (meal history, "log this meal").
    let imageUrls = cloudinaryUrls.filter(Boolean);
    if (!imageUrls.length && imageInputs.length && imageInputs[0].data.length < 200000) {
      imageUrls = [`data:${imageInputs[0].mediaType};base64,${imageInputs[0].data}`];
    }
    const scanType = imageInputs.length > 1 ? 'multi_image' : (imageInputs.length === 1 ? 'image' : 'text');
    const foodCheck = await QuickFoodCheck.create({
      userId,
      analysisTier,
      foodName: result.foodName || foodDescription || 'Analyzed Food',
      searchDescription: (searchKey || '').trim().toLowerCase(),
      quantity: result.quantity,
      calories: result.calories,
      protein: result.protein,
      carbs: result.carbs,
      fats: result.fats,
      fiber: result.fiber,
      nutrition: result.nutrition,
      warnings: result.warnings,
      imageUrl: imageUrls[0] || null,
      imageUrls,
      dishes: result.dishes.map((d) => ({
        name: d.name,
        quantity: d.quantity,
        ingredients: d.ingredients,
        nutrition: d.nutrition,
        foodId: d.foodId || undefined,
        grams: d.grams ?? undefined,
        matchScore: d.matchScore,
        source: d.source,
        dataStatus: d.dataStatus || undefined,
        glycemicIndex: d.glycemicIndex ?? undefined,
        allergens: d.allergens,
      })),
      source: result.source,
      scanType,
      timestamp: new Date(),
    });

    // Admins reviewing an ai_pending food can open the scan (photo) that created it.
    if (createdFoodIds.length) {
      Food.updateMany({ foodId: { $in: createdFoodIds }, 'source.createdFromScanId': null },
        { $set: { 'source.createdFromScanId': foodCheck._id } })
        .catch((err) => console.error('[FoodScan] could not link new foods to the scan:', err.message));
    }

    return res.json({
      success: true,
      analysisTier,
      data: {
        _id: foodCheck._id,
        ...result,
        imageUrl: foodCheck.imageUrl,
        imageUrls: foodCheck.imageUrls,
        scanType,
        timestamp: foodCheck.timestamp,
      },
      message: 'Analysis complete',
    });
  } catch (error) {
    console.error('❌ [FoodScan] failed:', error);
    return res.status(500).json({ success: false, message: 'Failed to analyze food', error: error.message });
  }
};

exports.isFoodDbScanEnabled = isFoodDbScanEnabled;
