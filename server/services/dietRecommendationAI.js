const axios = require('axios');
const { robustJsonParse } = require('../utils/aiParser');
const UsageLog = require('../models/UsageLog');
const { reconcileFoodPreferences, buildAvoidTerms } = require('../utils/dietConstraints');
const { checkMeal, sanitizeMealName } = require('../utils/mealGuard');
const { rescaleMealToCalories } = require('../utils/mealPlanCalories');
const {
  MEAL_TYPES,
  SLOT_GUIDANCE,
  slotCalorieRange,
  buildSlotBudgetInstructions,
} = require('../config/indianMealSlots');
const { buildCatalogInstructions, buildSlotCatalogInstructions } = require('../config/indianMealCatalog');
const { buildGoalInstructions } = require('./dietTargets');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
// 🚨 USER SPECIFIC MODEL - The user insists on using 'claude-sonnet-4-6'
const CLAUDE_MODEL = 'claude-sonnet-4-6';
const CLAUDE_HAIKU_MODEL = 'claude-haiku-4-5';

// Low on purpose. This is a constraint-heavy structured task whose failure mode
// is the model getting creative: at 0.7/0.8 it reached for novelty ("completely
// different dishes") and produced restaurant or invented names instead of
// ordinary home food. Variety comes from the 7-day structure and the reference
// dishes, not from sampling noise.
const PLAN_TEMPERATURE = 0.4;
const SINGLE_MEAL_TEMPERATURE = 0.5;

// Bounds the cost of repairing a bad plan: each repair is one small model call.
const MAX_REPAIRS_PER_PLAN = 6;
const REPAIR_CONCURRENCY = 3;

/**
 * Build the location block of the diet prompt.
 *
 * Ordering is deliberate, broadest first: country, then region, then state,
 * then city.
 *
 * `region` is only a fallback for when no state or city is known. It is derived
 * from `state` (see config/indiaRegions), so once a state is present the region
 * line is redundant — and it used to be actively harmful. The old code emitted
 * "focus on diverse Indian cuisine from all regions" whenever region was
 * 'other', which is both the schema default and what an unmapped or misspelt
 * state resolves to. That line told the model to range over the whole country
 * while the STATE FOCUS line below told it the opposite, and the contradiction
 * is what produced Andhra breakfasts for users in Rajasthan.
 *
 * The STATE is the cuisine signal; the CITY is only a tie-breaker. Calling the
 * city "the most specific cuisine signal" made the model brand dishes with it
 * ("Jaipur Special Kachori"), so the city line now forbids exactly that.
 *
 * With no location at all we say nothing rather than inviting the model to
 * pick from anywhere: it should fall back on the signals we do trust, namely
 * dietary preference and the user's own preferred foods.
 *
 * Extracted and exported so this is unit-testable without calling the model.
 *
 * @param {{country?: string, region?: string, state?: string, city?: string}} location
 * @returns {string} prompt fragment, '' when there is nothing useful to say
 */
function buildLocationInstructions({ country, region, state, city } = {}) {
  let instructions = '';
  const userCountry = country || 'India';
  const userRegion = region || 'other';
  const userState = typeof state === 'string' ? state.trim() : '';
  const userCity = typeof city === 'string' ? city.trim() : '';

  const hasSpecificLocation = Boolean(userState || userCity);
  const useRegionFallback = !hasSpecificLocation && userRegion !== 'other';

  if (userCountry === 'India') {
    if (useRegionFallback) {
      instructions = `\n- REGION FOCUS: Prioritize ${userRegion} Indian cuisine and regional specialties. Include traditional ${userRegion} dishes.`;
    }
  } else {
    instructions = `\n- COUNTRY FOCUS: User is from ${userCountry}. Suggest cuisine popular in ${userCountry} that aligns with their dietary preferences.`;
    if (useRegionFallback) {
      instructions += `\n- REGION PREFERENCE: User prefers ${userRegion} style cuisine if available in ${userCountry}.`;
    }
  }

  // State beats region because "south" spans Kerala and Tamil Nadu, whose
  // staples differ enough that the broader hint alone is misleading.
  if (userState) {
    instructions += `\n- STATE FOCUS (primary cuisine signal): User is from ${userState}, ${userCountry}. Prefer everyday home-style dishes, staple grains, and local ingredients specific to ${userState}. Where a ${userState} dish and a generic ${userCountry} dish both fit the calorie and preference constraints, choose the ${userState} one.`;
  }

  if (userCity) {
    instructions += `\n- CITY FOCUS (tie-breaker only): User is from ${userCity}, ${userState ? `${userState}, ` : ''}${userCountry}. Use it only to choose between equally suitable everyday dishes. NEVER put the city or state name in a dish name or description, and do not make a dish more elaborate or "special" because of it.`;
  }

  return instructions;
}

// Diet rule placed in the SYSTEM prompt so the model treats it as a hard
// constraint, not one line among many in the user message. Null diet means the
// caller failed to resolve it; that must never reach generation.
const DIET_SYSTEM_RULES = {
  vegetarian: 'STRICT VEGETARIAN: Every dish must be 100% vegetarian. NEVER include meat, poultry, fish, seafood or eggs. Dairy is allowed.',
  vegan: 'STRICT VEGAN: Every dish must be 100% vegan. NEVER include meat, poultry, fish, seafood, eggs, dairy or honey.',
  jain: 'STRICT JAIN: Every dish must be Jain vegetarian food — NEVER meat, poultry, fish, seafood or eggs. Dairy is allowed. Jain rules also apply (see the JAIN FOOD rule).',
  eggetarian: 'EGGETARIAN: Every dish must be vegetarian, but eggs are allowed. NEVER include meat, poultry or fish.',
  'non-vegetarian': 'The user is NON-VEGETARIAN: meat, poultry, fish and eggs are allowed.',
  other: 'Diet type is unspecified: do not assume a diet beyond the user\'s listed restrictions.',
};

function dietSystemRule(dietaryPreference) {
  const rule = DIET_SYSTEM_RULES[dietaryPreference];
  if (!rule) throw new Error(`Diet type is required for generation (got "${dietaryPreference}")`);
  return rule;
}

const JAIN_SYSTEM_RULE =
  'JAIN FOOD (strict, non-negotiable): vegetarian only. NO onion, garlic, potato, carrot, radish, beetroot, turnip, sweet potato, arbi/colocasia, yam, fresh ginger or mushroom — not in any dish, gravy, chutney, masala or garnish. Use dried ginger (sonth), hing (asafoetida) and green chilli for flavour instead.';

// Dish-naming and routine rules shared by whole-plan and single-meal prompts, so
// the two paths cannot drift apart again (the single-meal prompt used to have
// no naming rule at all, which is where the odd names came from).
const NAMING_RULE =
  '"name" is the ordinary name of the dish as an Indian home would say it, e.g. "Moong Dal Chilla with Mint Chutney" or "Roti, Lauki Sabzi and Dal". NEVER add a place, "Style", "Special", "Authentic", "Homestyle", "Healthy", "Fit" or "Delight"; never use the user\'s city or state in the name or description. If a regional name needs a gloss, one short parenthesis of at most 3 words is allowed. Keep it under 60 characters.';
const GENUINE_RULE =
  'Every dish must be simple, genuine Indian home cooking that is cooked on an ordinary day. No restaurant-only, festival-only, continental, western or fusion dishes (no pasta, burgers, avocado toast, quinoa, salmon, smoothie bowls, etc.).';
const INGREDIENTS_RULE =
  '"ingredients": list EVERY ingredient actually used (4-10 items) including onion, garlic, potato, oil/ghee/butter, nuts and dairy if present — it is used to verify the dish against the user\'s exclusions, so do not omit any.';

/**
 * Everything derived from the user's diet type and free-text preferences that
 * generation and validation must agree on. Computed in one place so the prompt
 * and the guard can never disagree about what is forbidden.
 *
 * Stale Jain tags are dropped here too (see utils/dietConstraints): the
 * controllers already clean preferences, but this is the enforcement point, so
 * a caller that forgets cannot reintroduce the bug.
 */
function deriveConstraints(userData = {}) {
  const diet = userData.dietaryPreference;
  const { prefs, jain, dropped } = reconcileFoodPreferences(diet, userData.foodPreferences);
  const avoidTerms = buildAvoidTerms({
    foodsToAvoid: prefs.foodsToAvoid || [],
    dietaryDont: prefs.dietaryDont || [],
    dietaryRestrictions: prefs.dietaryRestrictions || [],
    allergies: userData.allergies || [],
  });
  if (dropped.length) {
    console.warn(`[DietAI] Ignored stale Jain preference(s) for a "${diet}" user: ${dropped.join(', ')}`);
  }
  return {
    diet,
    prefs,
    jain,
    avoidTerms,
    location: { city: userData.city, state: userData.state },
  };
}

function buildPreferenceContext(prefs, jain) {
  const f = prefs || {};
  const lines = [];
  if (f.mealPreferences?.breakfast?.length) lines.push(`- Breakfast Favorites: ${f.mealPreferences.breakfast.join(', ')}`);
  if (f.mealPreferences?.lunch?.length) lines.push(`- Lunch Favorites: ${f.mealPreferences.lunch.join(', ')}`);
  if (f.mealPreferences?.snacks?.length) lines.push(`- Snack Preferences: ${f.mealPreferences.snacks.join(', ')}`);
  if (f.mealPreferences?.dinner?.length) lines.push(`- Dinner Favorites: ${f.mealPreferences.dinner.join(', ')}`);
  if (f.preferredFoods?.length) lines.push(`- General Preferred Foods: ${f.preferredFoods.join(', ')}`);
  if (f.foodsToAvoid?.length) lines.push(`- MUST AVOID (user dislikes): ${f.foodsToAvoid.join(', ')}`);
  if (f.dietaryRestrictions?.length) lines.push(`- Dietary Restrictions: ${f.dietaryRestrictions.join(', ')}`);
  if (f.dietaryDo?.length) lines.push(`- USER MUST DO / INCLUDE: ${f.dietaryDo.join(', ')}`);
  if (f.dietaryDont?.length) lines.push(`- USER MUST NOT DO / EXCLUDE: ${f.dietaryDont.join(', ')}`);
  if (jain) lines.push('- JAIN FOOD: yes (strict — see the Jain rule)');
  return lines.length ? `\nUser Food Preferences:\n${lines.join('\n')}` : '';
}

function buildDietaryConstraintSystem(prefs) {
  return [
    prefs?.dietaryDo?.length
      ? `The user MUST follow these dietary requirements: ${prefs.dietaryDo.join('; ')}.`
      : '',
    prefs?.dietaryDont?.length
      ? `The user MUST NOT consume or be given these items or instructions: ${prefs.dietaryDont.join('; ')}. These are hard exclusions and override favorites, regional cuisine, and general preferences.`
      : '',
  ].filter(Boolean).join(' ');
}

const NUTRIENT_FIELDS_JSON = '"calories": 0, "protein": 0, "carbs": 0, "fats": 0, "fiber": 0, "sugar": 0, "sodium": 0, "saturatedFat": 0, "vitaminA": 0, "vitaminC": 0, "vitaminD": 0, "vitaminB12": 0, "iron": 0, "calcium": 0, "potassium": 0, "magnesium": 0, "omega3": 0';

/**
 * Build the whole-plan prompts. Pure: no model call, no I/O, so the exact text
 * that drives the output can be asserted in tests.
 *
 * @param {object} userData
 * @param {string} [promptExtension]
 * @returns {{prompt: string, systemPrompt: string, constraints: object, dailyCalories: number}}
 */
function buildPlanPrompts(userData, promptExtension = '') {
  const { age, gender, weight, height, currentBMI, bmiGoal, activityLevel, nutritionGoals, medicalConditions, allergies, diabetesInfo, alcoholContext, alcoholSummary, lifestyle, country, region, state, city, dietaryPreference, goal, tdee } = userData;
  const isDiabetic = !!diabetesInfo;
  const dailyCalories = nutritionGoals?.dailyCalories || 2000;
  const alcoholLine = alcoholContext || 'No alcohol tracker data';
  const elevatedNote = alcoholSummary?.bingePattern || (alcoholSummary?.today >= 3)
    ? 'User logged several drinks recently — prefer lighter dinner options and avoid suggesting alcohol pairings; do not make medical claims.'
    : '';

  const constraints = deriveConstraints(userData);
  const { prefs, jain, avoidTerms } = constraints;

  const prefContext = buildPreferenceContext(prefs, jain);
  const dietaryConstraintSystem = buildDietaryConstraintSystem(prefs);
  const diabeticAlcoholNote = isDiabetic
    ? 'Diabetic user: do not suggest alcohol; keep meals steady and practical without medical claims about glucose and alcohol.'
    : '';

  const dietTypeInstructions = {
    'vegetarian': 'STRICT VEGETARIAN: Every meal must be 100% vegetarian. NEVER include meat, poultry, fish, or eggs. Dairy is allowed.',
    'vegan': 'STRICT VEGAN: Every meal must be 100% vegan. NEVER include meat, poultry, fish, eggs, dairy, or any animal-derived ingredient.',
    'jain': 'STRICT JAIN: Every meal must be Jain vegetarian food. NEVER include meat, poultry, fish, or eggs. Dairy is allowed.',
    'eggetarian': 'EGGETARIAN: Every meal must be vegetarian, but eggs are allowed. NEVER include meat, poultry, or fish.',
    'non-vegetarian': 'NON-VEGETARIAN: User eats meat, poultry, fish, and eggs — include them in lunch and dinner alongside vegetarian options for variety; breakfast stays a light tiffin (eggs are fine, heavy meat curries are not).',
    'other': ''
  };
  const dietTypeInstruction = dietTypeInstructions[dietaryPreference] || '';

  const regionCountryInstructions = buildLocationInstructions({ country, region, state, city });
  const goalInstruction = buildGoalInstructions({
    goal: goal || bmiGoal,
    calories: dailyCalories,
    tdee,
    protein: nutritionGoals?.protein,
  });
  const slotBudget = buildSlotBudgetInstructions(dailyCalories);
  const catalog = buildCatalogInstructions({ state, region, diet: dietaryPreference, jain, avoidTerms });

  const mealShape = (portion) => `{"name": "Meal Name", "description": "one short line", "portionSize": "${portion}", "ingredients": ["..."], ${NUTRIENT_FIELDS_JSON}}`;

  const prompt = `Indian Clinical Nutritionist. Generate a 100% accurate JSON meal plan with 7 daily options per meal (one for each day of the week).
STRUCTURE:
{
  "dailyCalorieTarget": ${dailyCalories},
  "mealPlan": {
    "breakfast": [
      ${mealShape('1 bowl / 2 pieces / 200g')},
      ... 7 items total
    ],
    "lunch": [
      ${mealShape('1 plate / 1.5 bowl / 350g')},
      ... 7 items total
    ],
    "dinner": [
      ${mealShape('1 bowl / 150g')},
      ... 7 items total
    ]
  }
}
NUTRIENT PRECISION (MANDATORY): Every meal object must include real, non-zero-unless-genuinely-absent estimates (from USDA/IFCT) for fiber, sugar, sodium, saturatedFat, and all 8 listed vitamins/minerals — the same rigor as calories/protein/carbs/fats. These feed the app's Diet Quality Score; do not default them to 0 as a shortcut. Units: vitaminA/vitaminD/vitaminB12 in mcg, vitaminC/iron/calcium/potassium/magnesium in mg, omega3/saturatedFat/sugar/fiber in g, sodium in mg.
USER DATA:
- Profile: ${age}y ${gender}, Weight: ${weight}kg, Height: ${height}cm, BMI: ${currentBMI}
- ${goalInstruction}
- Activity: ${activityLevel}
- Medical Conditions: ${medicalConditions?.join(', ') || 'None'}
- Allergies: ${allergies?.join(', ') || 'None'}
- Diabetes Status: ${isDiabetic ? `Positive (${diabetesInfo.diabetesType})` : 'Negative'}
- Alcohol / Lifestyle: ${alcoholLine}
- Profile alcohol flag: ${lifestyle?.alcohol ? `Yes (${lifestyle.alcoholFrequency || 'unspecified'})` : 'No or not set'}
- Macro Targets: Protein ${nutritionGoals?.protein}g, Carbs ${nutritionGoals?.carbs}g, Fats ${nutritionGoals?.fats}g
- Dietary Type: ${dietaryPreference}${prefContext}${regionCountryInstructions}

REQUIREMENTS:
1. CRITICAL CALORIE RULE: Each breakfast+lunch+dinner COMBO (same array index across all three meals) MUST total exactly ${dailyCalories} kcal ± 50 kcal. So breakfast[0].calories + lunch[0].calories + dinner[0].calories = target. Same for index 1, 2, 3, 4, 5, 6. This is the user's goal target — follow the GOAL line above: never push a day toward the wrong side of the target. ${slotBudget}
2. PRECISE PORTIONS: Use measurements like "1.5 Bowl (250g)", "2 Medium Roti (80g)", etc. Include both visual quantity AND approximate weight.
3. OUTPUT EXACTLY 7 meal options per meal type (breakfast, lunch, dinner) — no dish repeated within a meal type. Variety means a different sabzi, dal, grain or preparation on each day — NOT an exotic dish. Never make a dish unusual just to be different.
4. MANDATORY DIETARY TYPE RULE: ${dietTypeInstruction}${jain ? `\n   ${JAIN_SYSTEM_RULE}` : ''}
5. MANDATORY USER DO RULE: Follow every item in the user's "USER MUST DO / INCLUDE" list. This can contain ingredients, preparation methods, cultural or religious requirements, meal timing rules, or any other personal requirement. Apply it wherever relevant without inventing details.
6. MANDATORY USER DON'T RULE: Never include or recommend anything in the user's "USER MUST NOT DO / EXCLUDE" list. Treat explicit user exclusions as hard constraints, including ingredients inside sauces, spice mixes, garnishes, and composite dishes. If a user DON'T conflicts with a favorite, restriction, regional dish, or general preference, the DON'T wins. For example, if the user says "no onion" or "no tomatoes", do not use onion or tomato in any meal or ingredient.
7. PREFERENCE RULE: If the user listed Breakfast Favorites, build at least 4 of the 7 breakfast options around them where a favourite is a normal dish for that meal; same for Lunch and Dinner favorites. A favourite that does not belong in that meal (e.g. a rice-and-curry dish as a breakfast) is NOT forced into it — use it at lunch or dinner instead. General Preferred Foods should appear across at least 5 days in total. NEVER suggest foods from their "MUST AVOID" list.
8. If alcohol intake is elevated per user log, prefer lighter dinners and fewer empty calories — no medical claims.
9. ${elevatedNote} ${diabeticAlcoholNote}
10. DISH NAMING (MANDATORY): ${NAMING_RULE} Put any regional or cultural context in "description" instead — and even there never name the user's city or state.
11. GENUINE INDIAN ROUTINE (MANDATORY): ${GENUINE_RULE}
   ${SLOT_GUIDANCE.breakfast}
   ${SLOT_GUIDANCE.lunch}
   ${SLOT_GUIDANCE.dinner}
12. ${INGREDIENTS_RULE}
${catalog ? `13. ${catalog}\n` : ''}${promptExtension ? `14. ${promptExtension}\n` : ''}
JSON output ONLY. No markdown. Exact calorie math is mandatory.`;

  const systemPrompt = `Expert Indian Clinical Dietitian. Generate scientifically accurate 7-day meal plans made of what a typical Indian household actually cooks and eats at breakfast, lunch and dinner — simple, genuine, ordinary home food in the right portions for the time of day. The user's state is the primary cuisine signal; the city is only a tie-breaker and never appears in a dish name. The user's goal decides whether the day lands under, on or over their maintenance calories — never the other way round. Each day must have a different meal, but never at the cost of a dish being unusual. Strict calorie compliance per day combo is mandatory. ${dietSystemRule(dietaryPreference)} ${jain ? JAIN_SYSTEM_RULE : ''} ${dietaryConstraintSystem}`;

  return { prompt, systemPrompt, constraints, dailyCalories };
}

/**
 * Normalise names in place (strip "- X Style", the user's city/state). Done
 * before auditing so decoration the model adds anyway is fixed for free instead
 * of costing a repair call.
 */
function prepareMealPlan(mealPlan, constraints) {
  for (const slot of MEAL_TYPES) {
    for (const meal of mealPlan?.[slot] || []) {
      if (meal && typeof meal.name === 'string') meal.name = sanitizeMealName(meal.name, constraints.location);
    }
  }
}

/**
 * Audit every meal in a plan against the hard and soft rules.
 *
 * @returns {{slot: string, index: number, meal: object, hard: string[], soft: string[]}[]}
 */
function auditMealPlan(mealPlan, constraints, dailyTarget) {
  const issues = [];
  for (const slot of MEAL_TYPES) {
    const seen = new Set();
    (mealPlan?.[slot] || []).forEach((meal, index) => {
      const { hard, soft } = checkMeal({
        meal, slot, diet: constraints.diet, jain: constraints.jain,
        avoidTerms: constraints.avoidTerms, location: constraints.location, dailyTarget,
      });
      const key = typeof meal?.name === 'string' ? meal.name.trim().toLowerCase() : '';
      if (key) {
        if (seen.has(key)) soft.push('repeats a dish already used for this meal type');
        seen.add(key);
      }
      if (hard.length || soft.length) issues.push({ slot, index, meal, hard, soft });
    });
  }
  return issues;
}

function describeIssues(issues) {
  return issues
    .map((i) => `${i.slot}[${i.index}] "${i.meal?.name}": ${[...i.hard, ...i.soft].join('; ')}`)
    .join('\n');
}

class DietRecommendationAI {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  async makeAIRequest(payload, modelOverride = null) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const primaryModel = modelOverride || CLAUDE_MODEL;
    const MAX_RETRIES = 5;
    const RETRY_DELAYS = [8000, 20000, 40000, 60000, 90000];
    const startTime = Date.now();

    const headers = {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      'Connection': 'close'
    };

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Use Sonnet for all attempts; Haiku only as absolute last resort
      const currentModel = (attempt === MAX_RETRIES - 1 && !modelOverride) ? CLAUDE_HAIKU_MODEL : (modelOverride || primaryModel);

      console.log(`🔄 DietAI | Model: ${currentModel} | Attempt: ${attempt + 1}/${MAX_RETRIES} | Tokens: ${payload.max_tokens}`);

      try {
        const response = await axios.post(ANTHROPIC_API_URL, {
          model: currentModel,
          max_tokens: payload.max_tokens,
          system: payload.system || '',
          messages: payload.messages.filter(m => m.role !== 'system'),
          temperature: payload.temperature || 0.3
        }, {
          headers,
          timeout: 300000
        });

        if (response.data && response.data.content && response.data.content[0]) {
          if (attempt > 0) console.log(`✅ DietAI | Succeeded on attempt ${attempt + 1} with ${currentModel}`);
          const usage = response.data?.usage || {};
          UsageLog.create({
            userId:           payload.userId || null,
            feature:          'diet_plan',
            model:            currentModel,
            inputTokens:      usage.input_tokens               || 0,
            outputTokens:     usage.output_tokens              || 0,
            cacheReadTokens:  usage.cache_read_input_tokens    || 0,
            cacheWriteTokens: usage.cache_creation_input_tokens || 0,
            durationMs:       Date.now() - startTime,
            status:           'success',
          }).catch(e => console.error('UsageLog save failed:', e.message));
          return response.data.content[0].text;
        }
        throw new Error('Invalid response');
      } catch (error) {
        const status = error.response?.status;
        const isOverloaded = status === 529;
        const isRateLimit = status === 429;
        const isRetryable = isOverloaded || isRateLimit;

        console.error(`❌ Diet AI Request Error (attempt ${attempt + 1}):`, error.response?.data?.error?.message || error.message);

        if (isRetryable && attempt < MAX_RETRIES - 1) {
          const delay = RETRY_DELAYS[attempt];
          console.log(`⏳ DietAI | ${isOverloaded ? 'Overloaded' : 'Rate limited'} — retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      }
    }
  }

  /**
   * One whole-plan model call. Resolves to the parsed object, or null when the
   * response held no JSON at all (the caller treats that as "no plan").
   */
  async requestPlan(systemPrompt, prompt, retryNote = '') {
    const aiResponse = await this.makeAIRequest({
      // Raised from 8000 when `ingredients` joined the per-meal shape (~60 tokens
      // x 21 meals); a truncated plan fails parsing and loses everything.
      max_tokens: 9500,
      system: systemPrompt,
      messages: [{ role: 'user', content: retryNote ? `${prompt}\n\n${retryNote}` : prompt }],
      temperature: PLAN_TEMPERATURE
    });
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return robustJsonParse(jsonMatch[0]);
  }

  /**
   * Generate the 7-day plan, then validate it and repair only what is wrong.
   *
   * Pipeline: generate -> sanitize names -> audit -> (if badly off, one full
   * retry that names every problem) -> targeted single-meal repair of whatever
   * remains -> fail only on HARD violations. A soft problem that survives
   * repair (a regional exception to the slot rules) is kept: better than
   * discarding an otherwise correct plan.
   */
  async generatePersonalizedDietPlan(userData, promptExtension = '') {
    const { prompt, systemPrompt, constraints, dailyCalories } = buildPlanPrompts(userData, promptExtension);

    let parsed = await this.requestPlan(systemPrompt, prompt);
    if (!parsed) return null;
    if (!parsed.mealPlan) return parsed;

    // Warn in logs if AI returned fewer than 7 items (helps diagnose future issues)
    const counts = MEAL_TYPES.map(m => (parsed.mealPlan[m] || []).length);
    const minCount = Math.min(...counts);
    if (minCount < 7) console.warn(`[DietAI] Warning: AI returned only ${minCount} items per meal type (expected 7). Model: check logs.`);

    prepareMealPlan(parsed.mealPlan, constraints);
    let issues = auditMealPlan(parsed.mealPlan, constraints, dailyCalories);

    if (issues.length > MAX_REPAIRS_PER_PLAN) {
      // Too much wrong to patch meal by meal: tell the model exactly what, once.
      console.warn(`[DietAI] ${issues.length} meal(s) failed validation — retrying the whole plan once.`);
      const second = await this.requestPlan(systemPrompt, prompt, `REJECTED: these dishes broke the rules and must not appear again. Replace each with a simple, ordinary Indian home dish for that meal:\n${describeIssues(issues)}`);
      if (second?.mealPlan) {
        prepareMealPlan(second.mealPlan, constraints);
        const secondIssues = auditMealPlan(second.mealPlan, constraints, dailyCalories);
        if (secondIssues.length < issues.length) {
          parsed = second;
          issues = secondIssues;
        }
      }
    }

    if (issues.length) {
      issues = await this.repairMealPlan(parsed.mealPlan, issues, userData, dailyCalories);
    }

    const hard = issues.filter(i => i.hard.length);
    if (hard.length) {
      throw new Error(`Generated meal plan still violated hard constraints after repair: ${describeIssues(hard)}`);
    }
    if (issues.length) {
      console.warn(`[DietAI] Keeping ${issues.length} soft-flagged meal(s) after repair:\n${describeIssues(issues)}`);
    }
    return parsed;
  }

  /**
   * Replace the flagged meals one slot at a time, in place, with bounded
   * concurrency. Hard violations are repaired first so the cap never leaves a
   * safety problem unfixed while spending calls on cosmetics.
   *
   * @returns {Promise<object[]>} issues that remain (unrepaired or over the cap)
   */
  async repairMealPlan(mealPlan, issues, userData, dailyCalories) {
    const ordered = [...issues].sort((a, b) => b.hard.length - a.hard.length);
    const toRepair = ordered.slice(0, MAX_REPAIRS_PER_PLAN);
    const remaining = ordered.slice(MAX_REPAIRS_PER_PLAN);

    const repairOne = async (issue) => {
      const { slot, index } = issue;
      const others = MEAL_TYPES.filter(s => s !== slot)
        .reduce((sum, s) => sum + (Number(mealPlan[s]?.[index]?.calories) || 0), 0);
      const { min, max } = slotCalorieRange(slot, dailyCalories);
      const remainingCalories = Math.min(max, Math.max(min, Math.round(dailyCalories - others)));
      const avoidNames = (mealPlan[slot] || []).map(m => m?.name).filter(Boolean);

      try {
        const replacement = await this.regenerateSingleMeal({ mealType: slot, remainingCalories, userData, avoidNames });
        if (replacement && typeof replacement === 'object') {
          mealPlan[slot][index] = replacement;
          return null;
        }
      } catch (err) {
        console.warn(`[DietAI] Repair of ${slot}[${index}] failed: ${err.message}`);
      }
      return issue;
    };

    for (let i = 0; i < toRepair.length; i += REPAIR_CONCURRENCY) {
      const results = await Promise.all(toRepair.slice(i, i + REPAIR_CONCURRENCY).map(repairOne));
      results.filter(Boolean).forEach(r => remaining.push(r));
    }
    return remaining;
  }

  /**
   * Generate diet plan using Haiku model (for auto-triggered background tasks)
   * Uses Haiku directly to reduce API load when triggered after report analysis
   */
  async generatePersonalizedDietPlanLight(userData, promptExtension = '') {
    return this.generatePersonalizedDietPlan(userData, promptExtension);
  }

  /**
   * Regenerate ONE meal slot (one meal type, one day) instead of the whole
   * 7-day plan. `remainingCalories` is the target for this single meal —
   * the caller computes it as dailyCalorieTarget minus whatever the OTHER
   * two meals for that same day already total, so the day's combo-calorie
   * rule stays intact without regenerating the meals we're keeping.
   * `avoidNames` should be that meal type's dish names across the whole
   * week (not the whole plan) — keeps the prompt small and the exclusion
   * relevant to what's actually being replaced.
   */
  async regenerateSingleMeal({ mealType, remainingCalories, userData, avoidNames = [] }) {
    const { dietaryPreference, allergies, medicalConditions, country, region, state, city } = userData;

    const dietTypeInstruction = dietSystemRule(dietaryPreference);
    const constraints = deriveConstraints(userData);
    const { prefs, jain, avoidTerms } = constraints;

    // Same location block as whole-plan generation, rather than a second,
    // weaker phrasing. The old inline version dropped `city` entirely and fell
    // back to "Focus on diverse Indian cuisine" — the instruction to range over
    // the whole country that this feature exists to remove.
    const locationBlock = buildLocationInstructions({ country, region, state, city });

    // `prefs` (not the raw foodPreferences) so a stale Jain tag left over from
    // an earlier diet type never reaches this prompt either.
    const favorites = prefs?.mealPreferences?.[mealType];
    const favoritesLine = favorites?.length ? `User's ${mealType} favorites (use one only if it is a normal ${mealType} dish and the calorie budget allows): ${favorites.join(', ')}.` : '';
    const avoidLine = avoidNames.length ? `Do NOT suggest any of these — already used this week or just rejected: ${avoidNames.join(', ')}.` : '';

    // Dishes the user has permanently rejected (see MEAL_REJECTION_REASONS).
    // The whole-plan prompt already treats this as a hard exclusion; without it
    // here, the replacement for a rejected meal could be something the user has
    // already told us they can't get.
    const permanentlyAvoided = prefs?.foodsToAvoid || [];
    const neverLine = permanentlyAvoided.length
      ? `NEVER suggest these — the user has excluded them permanently: ${permanentlyAvoided.join(', ')}.`
      : '';
    const exclusionLines = [
      prefs?.dietaryDont?.length ? `User exclusions (hard — also inside sauces, masalas, garnishes): ${prefs.dietaryDont.join('; ')}.` : '',
      prefs?.dietaryRestrictions?.length ? `Dietary restrictions: ${prefs.dietaryRestrictions.join(', ')}.` : '',
      prefs?.dietaryDo?.length ? `User must-do: ${prefs.dietaryDo.join('; ')}.` : '',
    ].filter(Boolean).join(' ');

    const goalLine = userData.goal || userData.bmiGoal
      ? buildGoalInstructions({
          goal: userData.goal || userData.bmiGoal,
          calories: userData.dailyCalories || userData.nutritionGoals?.dailyCalories || remainingCalories,
          tdee: userData.tdee,
        })
      : '';
    const catalogLine = buildSlotCatalogInstructions(mealType, { state, region, diet: dietaryPreference, jain, avoidTerms });

    // Must request every field in mealOptionSchema (models/PersonalizedDietPlan).
    // The replacement is written with $set on the whole array element, so any
    // field missing here is not just absent from the new meal — it is deleted
    // from the slot. This prompt used to ask for 8 of the 21 fields, so every
    // regeneration silently stripped fiber, sodium and all 8 micronutrients from
    // that meal, and the Diet Quality Score then read zeros for it.
    const prompt = `Indian Clinical Nutritionist. Generate ONE ${mealType} option as JSON.
STRUCTURE:
{ "name": "Meal Name", "description": "one line", "portionSize": "1 bowl (200g)", "ingredients": ["..."], ${NUTRIENT_FIELDS_JSON}, "benefits": "one line" }

NUTRIENT PRECISION (MANDATORY): Include real, non-zero-unless-genuinely-absent estimates (from USDA/IFCT) for fiber, sugar, sodium, saturatedFat, and all 8 listed vitamins/minerals — the same rigor as calories/protein/carbs/fats. These feed the app's Diet Quality Score; do not default them to 0 as a shortcut. Units: vitaminA/vitaminD/vitaminB12 in mcg, vitaminC/iron/calcium/potassium/magnesium in mg, omega3/saturatedFat/sugar/fiber in g, sodium in mg.

REQUIREMENTS:
1. CRITICAL: calories must equal ${remainingCalories} kcal, within ±30 kcal. This is fixed by the OTHER two meals already planned for this day — do not deviate.
2. Dietary Type: ${dietTypeInstruction}${jain ? ` ${JAIN_SYSTEM_RULE}` : ''}
3. Allergies — NEVER include: ${allergies?.join(', ') || 'None'}
4. Medical conditions to keep in mind: ${medicalConditions?.join(', ') || 'None'}
5. LOCATION:${locationBlock || ' not specified — rely on the dietary preference and favourites below.'}
6. ${neverLine}
7. ${favoritesLine}
8. ${avoidLine}
9. Must be a genuinely different dish from anything just listed as already-used — but still an ordinary, commonly cooked dish, never an exotic one.
10. ${SLOT_GUIDANCE[mealType] || ''}
11. DISH NAMING (MANDATORY): ${NAMING_RULE}
12. ${GENUINE_RULE}
13. ${INGREDIENTS_RULE}
14. ${exclusionLines}
15. ${goalLine}
16. ${catalogLine}

JSON output ONLY. No markdown. Exact calorie match is mandatory.`;

    const systemPrompt = `Expert Indian Clinical Dietitian. Generate one precise, calorie-accurate, genuine Indian home meal suggestion as strict JSON. ${dietTypeInstruction} ${jain ? JAIN_SYSTEM_RULE : ''}`;

    // One retry that names the rejected dish and why. Hard problems (diet, Jain,
    // exclusions) fail the call if they persist; soft ones (slot, naming) are
    // accepted after the retry, with the name already cleaned.
    let retryNote = '';
    let lastMeal = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const aiResponse = await this.makeAIRequest({
        // Raised from 500 when the structure grew from 8 fields to the full 21:
        // a truncated response fails robustJsonParse and the whole regeneration
        // reports as failed, so the headroom is worth more than the tokens.
        max_tokens: 1400,
        system: systemPrompt,
        messages: [{ role: 'user', content: retryNote ? `${prompt}\n\n${retryNote}` : prompt }],
        temperature: SINGLE_MEAL_TEMPERATURE
      });

      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const meal = robustJsonParse(jsonMatch[0]);
      if (meal && typeof meal.name === 'string') meal.name = sanitizeMealName(meal.name, constraints.location);

      const { hard, soft } = checkMeal({
        meal, slot: mealType, diet: dietaryPreference, jain, avoidTerms,
        location: constraints.location, slotTarget: remainingCalories,
      });
      if (hard.length === 0 && soft.length === 0) return rescaleMealToCalories(meal, remainingCalories);

      lastMeal = { meal, hard, soft };
      console.warn(`[DietAI] Guard flagged single meal "${meal?.name}" (attempt ${attempt}): ${[...hard, ...soft].join('; ')}`);
      retryNote = `REJECTED: "${meal?.name}" — ${[...hard, ...soft].join('; ')}. Suggest a different, simple, ordinary Indian ${mealType} dish.`;
    }

    if (lastMeal.hard.length) {
      throw new Error(`Regenerated ${mealType} still violated the ${dietaryPreference} diet or the user's exclusions after retry: ${lastMeal.hard.join('; ')}`);
    }
    return rescaleMealToCalories(lastMeal.meal, remainingCalories);
  }



  async generateSupplementRecommendations(userData) {
    const { deficiencies, age, gender } = userData;
    const prompt = `Suggest supplements for: ${deficiencies.map(d => d.nutrient).join(', ')}. JSON: {"supplements": [{"name": ""}]}`;
    try {
      const aiResponse = await this.makeAIRequest({
        max_tokens: 1000,
        system: "Expert Clinical Dietitian.",
        messages: [{ role: 'user', content: prompt }]
      }, CLAUDE_HAIKU_MODEL);
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      return jsonMatch ? robustJsonParse(jsonMatch[0]) : { supplements: [] };
    } catch (error) { return { supplements: [] }; }
  }

  async analyzeFoodPreferences(user) {
    const prompt = `Analyze: ${JSON.stringify(user.foodPreferences)}. JSON {"overallScore": 85}`;
    try {
      const aiResponse = await this.makeAIRequest({
        max_tokens: 1500,
        system: "Nutrition Engine.",
        messages: [{ role: 'user', content: prompt }]
      }, CLAUDE_HAIKU_MODEL);
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      return jsonMatch ? robustJsonParse(jsonMatch[0]) : null;
    } catch (error) { return null; }
  }
}

// Every caller does `require(...)` then calls methods on the instance, so the
// singleton export stays exactly as it was; the pure helpers are hung off it so
// tests can reach them without instantiating the class or hitting the API.
const dietRecommendationAI = new DietRecommendationAI();
dietRecommendationAI.buildLocationInstructions = buildLocationInstructions;
dietRecommendationAI.buildPlanPrompts = buildPlanPrompts;
dietRecommendationAI.deriveConstraints = deriveConstraints;
dietRecommendationAI.auditMealPlan = auditMealPlan;
dietRecommendationAI.prepareMealPlan = prepareMealPlan;

module.exports = dietRecommendationAI;
