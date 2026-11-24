/**
 * Step 1 of the meal scan (docs/FOOD_DB_FLOW.md section 6): the ONLY LLM call on the happy path.
 * It names each dish and estimates its portion; it does NOT estimate nutrition.
 *
 * Uses the same provider as the rest of the nutrition feature (Gemini Flash via OpenRouter,
 * services/openrouterAI.js), at temperature 0 so the same photo gives the same names.
 *
 *   const { isFood, items } = await identifyFoods({ images, text, quantity, userId });
 *   // items: [{ name, candidates: [], portionText, estGrams }]
 */
const openrouterAI = require('../openrouterAI');

const MODEL = process.env.FOOD_ID_MODEL || openrouterAI.MODELS.GEMINI_FLASH;
const MAX_ITEMS = 10;
const MAX_CANDIDATES = 3;

const SYSTEM = 'You identify foods in meals for a nutrition-database lookup. You never estimate nutrition. Respond ONLY with valid JSON.';

function buildPrompt({ text, quantity, imageCount }) {
  const userNote = [
    text && text !== 'Food from image' ? `The user described it as: "${text}".` : '',
    quantity ? `The user said the quantity is: "${quantity}". Use this quantity instead of your own estimate.` : '',
  ].filter(Boolean).join(' ');

  const source = imageCount > 0
    ? `Look at the ${imageCount > 1 ? `${imageCount} photos (all of the same meal)` : 'photo'} and list every separate food item.`
    : 'List every separate food item in the user\'s description.';

  return `${source} ${userNote}

RULES
- One item per separate dish or food. Dal, rice and roti on one plate are 3 items.
- Never split one dish into its ingredients: chicken biryani is 1 item, not rice + chicken.
- "name": the common, generic name of the dish as people in India say it, in lowercase, e.g. "chicken biryani", "dal tadka", "plain rice", "roti", "aloo paratha", "cucumber raita". No brand names, no adjectives like "delicious" or "homemade".
- "candidates": up to ${MAX_CANDIDATES} other names this item could be (other spellings, the Hindi or English name, or the closest common dish). Empty array if none.
- "portionText": the amount as a person would say it: "2 roti", "1 bowl", "1 large plate", "1 glass", "3 pieces".
- "estGrams": your best estimate of the total edible grams of that item (a number). Typical sizes: 1 roti ≈ 40 g, 1 bowl of dal ≈ 180 g, 1 plate of rice ≈ 250 g, 1 glass ≈ 250 g, 1 idli ≈ 40 g, 1 samosa ≈ 60 g.
- Packaged food: name the product type, not the brand ("potato chips", "chocolate cookie").
- If there is no food or drink at all, return {"isFood": false, "items": []}.

Return exactly this JSON:
{"isFood": true, "items": [{"name": "", "candidates": [], "portionText": "", "estGrams": 0}]}`;
}

const cleanName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 80);

/** Validate and normalise the model's JSON. Exported for tests. */
function normalizeIdentification(raw) {
  const isFood = raw?.isFood !== false;
  const items = (Array.isArray(raw?.items) ? raw.items : [])
    .map((it) => {
      const name = cleanName(it?.name);
      if (!name) return null;
      const candidates = [...new Set((Array.isArray(it.candidates) ? it.candidates : [])
        .map(cleanName).filter((c) => c && c !== name))].slice(0, MAX_CANDIDATES);
      const est = Number(it.estGrams);
      return {
        name,
        candidates,
        portionText: String(it.portionText ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
        estGrams: Number.isFinite(est) && est > 0 ? Math.round(est) : null,
      };
    })
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
  return { isFood: isFood && items.length > 0, items };
}

/**
 * @param {object} args
 * @param {Array<{data: string, mediaType: string}>} [args.images]  base64 photos of one meal
 * @param {string} [args.text]       the user's description (optional with images)
 * @param {string} [args.quantity]   the user's stated quantity, if any
 * @param {string} [args.userId]     for usage logging
 */
async function identifyFoods({ images = [], text = '', quantity = '', userId = null }) {
  if (!images.length && !text) throw new Error('identifyFoods needs images or text');

  const content = [
    openrouterAI.buildTextPart(buildPrompt({ text, quantity, imageCount: images.length })),
    ...images.map((img) => openrouterAI.buildImagePart(img.data, img.mediaType)),
  ];

  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) { // one retry: the model occasionally returns broken JSON
    try {
      const reply = await openrouterAI.chatCompletion({
        model: MODEL,
        system: SYSTEM,
        messages: [{ role: 'user', content }],
        maxTokens: 800,
        temperature: 0,
        feature: 'food_identification',
        userId,
        timeoutMs: 45000,
      });
      return normalizeIdentification(openrouterAI.parseJsonResponse(reply));
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ [FoodIdentifier] attempt ${attempt + 1} failed: ${err.message}`);
    }
  }
  throw lastError;
}

module.exports = { identifyFoods, normalizeIdentification, buildPrompt };
