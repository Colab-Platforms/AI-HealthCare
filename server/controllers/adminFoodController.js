/**
 * Admin review of the food DB (docs/FOOD_DB_FLOW.md section 8.4).
 * Mounted at /api/admin/foods behind protect + authorize('admin', 'superadmin').
 *
 * Every write drops the matcher's in-memory index so the change applies to the next scan.
 */
const Food = require('../models/Food');
const FoodFallbackLog = require('../models/FoodFallbackLog');
const { invalidateIndex } = require('../services/foodDb/foodMatcher');
const { tokens } = require('../services/foodDb/normalize');
const checks = require('../services/foodDb/foodChecks');
const V = require('../services/foodDb/vocab');

const LIST_PROJECTION = {
  foodId: 1, name: 1, aliases: 1, classification: 1, allergens: 1, tags: 1, serving: 1,
  nutritionPer100g: 1, glycemicIndex: 1, ingredients: 1, source: 1, dataQuality: 1, stats: 1,
  isActive: 1, mergedInto: 1, createdAt: 1, updatedAt: 1,
};
const SORTS = {
  '-hitCount': { 'stats.hitCount': -1, createdAt: -1 },
  '-createdAt': { createdAt: -1 },
  name: { name: 1 },
};
// Fields an admin may edit (PATCH). Everything else (ids, source, stats) is managed by the system.
const EDITABLE = ['name', 'aliases', 'description', 'classification', 'allergens', 'tags', 'serving',
  'nutritionPer100g', 'micronutrientsPer100g', 'glycemicIndex', 'ingredients', 'isActive'];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const searchTextOf = (name, aliases) => [...new Set(tokens([name, ...(aliases || [])].join(' ')))].join(' ');
const pageOf = (req) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  return { limit, page, skip: (page - 1) * limit };
};
const reviewed = (req, status, note) => ({
  'dataQuality.status': status,
  'dataQuality.reviewedBy': req.user._id,
  'dataQuality.reviewedAt': new Date(),
  ...(note !== undefined ? { 'dataQuality.reviewNote': note ? String(note).slice(0, 500) : null } : {}),
});

/** GET /api/admin/foods?status=ai_pending&q=&source=&sort=-hitCount&page=1&limit=25 */
exports.listFoods = async (req, res) => {
  try {
    const { limit, page, skip } = pageOf(req);
    const filter = {};
    const status = req.query.status ?? 'ai_pending';
    if (status && status !== 'all') {
      if (!V.DATA_STATUS.includes(status)) return res.status(400).json({ success: false, message: `status must be one of ${V.DATA_STATUS.join(', ')} or all` });
      filter['dataQuality.status'] = status;
    }
    if (req.query.source) filter['source.primary'] = String(req.query.source);
    if (req.query.flag) filter['dataQuality.flags'] = String(req.query.flag);
    if (req.query.active === 'true' || req.query.active === 'false') filter.isActive = req.query.active === 'true';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (q) filter.$or = [{ name: { $regex: escapeRegex(q), $options: 'i' } }, { aliases: { $regex: escapeRegex(q.toLowerCase()) } }, { foodId: q }];
    const sort = SORTS[req.query.sort] || SORTS['-hitCount'];

    const [items, total] = await Promise.all([
      Food.find(filter, LIST_PROJECTION).sort(sort).skip(skip).limit(limit).lean(),
      Food.countDocuments(filter),
    ]);
    return res.json({ success: true, total, page, limit, items });
  } catch (error) {
    console.error('[admin/foods] list failed:', error);
    return res.status(500).json({ success: false, message: 'Could not list foods' });
  }
};

/** GET /api/admin/foods/:foodId */
exports.getFood = async (req, res) => {
  const food = await Food.findOne({ foodId: req.params.foodId }).lean();
  if (!food) return res.status(404).json({ success: false, message: 'Food not found' });
  return res.json({ success: true, food });
};

/**
 * PATCH /api/admin/foods/:foodId  body: { ...editable fields, note? }
 * Saves the edit and marks the food verified. The same checks as the seed build apply; a failing
 * edit is refused with the list of problems.
 */
exports.updateFood = async (req, res) => {
  try {
    const food = await Food.findOne({ foodId: req.params.foodId });
    if (!food) return res.status(404).json({ success: false, message: 'Food not found' });

    const body = req.body || {};
    const unknown = Object.keys(body).filter((k) => !EDITABLE.includes(k) && k !== 'note');
    if (unknown.length) return res.status(400).json({ success: false, message: `Not editable: ${unknown.join(', ')}` });

    for (const k of EDITABLE) if (body[k] !== undefined) food.set(k, body[k]);
    if (body.aliases !== undefined) food.aliases = [...new Set(body.aliases.map((a) => String(a).trim().toLowerCase()).filter(Boolean))];
    if (body.serving && !body.serving.units) food.serving.units = checks.servingUnits(food.serving.defaultUnit, food.serving.defaultGrams);
    food.searchText = searchTextOf(food.name, food.aliases);

    const n = food.nutritionPer100g.toObject ? food.nutritionPer100g.toObject() : food.nutritionPer100g;
    const problems = checks.rangeCheck(n, food.classification.category);
    const kc = checks.kcalCheck(n, 0.25);
    if (!kc.ok) problems.push(`calories ${n.calories} vs macros ${kc.calc}`);
    if (problems.length) return res.status(422).json({ success: false, message: 'Nutrition fails the checks', problems });

    food.set(reviewed(req, 'verified', body.note));
    food.dataQuality.checksPassed = true;
    food.dataQuality.estimatedFields = [];
    await food.save(); // runs the schema validation (enums, required fields)
    invalidateIndex();
    return res.json({ success: true, food: food.toObject() });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: 'Invalid food', problems: Object.values(error.errors).map((e) => e.message) });
    }
    console.error('[admin/foods] update failed:', error);
    return res.status(500).json({ success: false, message: 'Could not update the food' });
  }
};

/** POST /api/admin/foods/:foodId/approve  body: { note? } — values are fine as they are. */
exports.approveFood = async (req, res) => {
  const food = await Food.findOneAndUpdate(
    { foodId: req.params.foodId, mergedInto: null },
    { $set: { ...reviewed(req, 'verified', req.body?.note), isActive: true } },
    { new: true },
  ).lean();
  if (!food) return res.status(404).json({ success: false, message: 'Food not found (or merged)' });
  invalidateIndex();
  return res.json({ success: true, food });
};

/** POST /api/admin/foods/:foodId/reject  body: { note? } — never matched again; the name is never auto-saved again. */
exports.rejectFood = async (req, res) => {
  const food = await Food.findOneAndUpdate(
    { foodId: req.params.foodId },
    { $set: { ...reviewed(req, 'rejected', req.body?.note), isActive: false } },
    { new: true },
  ).lean();
  if (!food) return res.status(404).json({ success: false, message: 'Food not found' });
  invalidateIndex();
  return res.json({ success: true, food });
};

/**
 * POST /api/admin/foods/:foodId/merge  body: { targetFoodId, note? }
 * The food is a duplicate of `targetFoodId`: its name and aliases move to the target, and it is
 * kept inactive with mergedInto set (past scans that reference it still resolve).
 */
exports.mergeFood = async (req, res) => {
  try {
    const targetFoodId = String(req.body?.targetFoodId || '');
    if (!targetFoodId || targetFoodId === req.params.foodId) {
      return res.status(400).json({ success: false, message: 'targetFoodId is required and must differ from the food being merged' });
    }
    const [source, target] = await Promise.all([
      Food.findOne({ foodId: req.params.foodId }).lean(),
      Food.findOne({ foodId: targetFoodId, isActive: true, mergedInto: null }).lean(),
    ]);
    if (!source) return res.status(404).json({ success: false, message: 'Food not found' });
    if (!target) return res.status(404).json({ success: false, message: 'Target food not found or not active' });

    const aliases = [...new Set([...(target.aliases || []), source.name.toLowerCase(), ...(source.aliases || [])])]
      .filter((a) => a && a !== target.name.toLowerCase());
    await Food.updateOne({ foodId: target.foodId }, { $set: { aliases, searchText: searchTextOf(target.name, aliases) } });
    const merged = await Food.findOneAndUpdate(
      { foodId: source.foodId },
      { $set: { ...reviewed(req, 'rejected', req.body?.note ?? `merged into ${target.foodId}`), isActive: false, mergedInto: target.foodId } },
      { new: true },
    ).lean();
    invalidateIndex();
    return res.json({ success: true, food: merged, target: { foodId: target.foodId, name: target.name, aliases } });
  } catch (error) {
    console.error('[admin/foods] merge failed:', error);
    return res.status(500).json({ success: false, message: 'Could not merge the food' });
  }
};

/** GET /api/admin/foods/fallback-log?outcome=failed_checks&page=1 — AI results that were not saved. */
exports.listFallbackLog = async (req, res) => {
  try {
    const { limit, page, skip } = pageOf(req);
    const filter = req.query.outcome ? { outcome: String(req.query.outcome) } : {};
    const [items, total] = await Promise.all([
      FoodFallbackLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      FoodFallbackLog.countDocuments(filter),
    ]);
    return res.json({ success: true, total, page, limit, items });
  } catch (error) {
    console.error('[admin/foods] fallback log failed:', error);
    return res.status(500).json({ success: false, message: 'Could not list the fallback log' });
  }
};
