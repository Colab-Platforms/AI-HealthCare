// Single source of truth for drink types + standard serving sizes, same
// pattern as activityCatalog.js — the app fetches this instead of hardcoding
// ml/ABV values, so adding a new drink type or adjusting a default never
// requires an app-store release.
//
// Sizes are real standard servings (UK/US bar/retail conventions), and
// defaultAbv values are widely-published typical averages for each category
// (not exact — any specific bottle varies, which is why every entry remains
// user-overridable before logging). "Other" intentionally has no sizes/defaults
// — see server/controllers/healthController.js's session-logging validation,
// which requires explicit volumeMl + abv when drinkType is 'other' rather than
// guessing a number for a completely unknown drink.
const DRINK_CATALOG = [
  // --- Beer & cider family ---
  { id: 'beer', label: 'Beer (Regular)', sizes: [
    { size: 'small', label: 'Small (330ml bottle)', volumeMl: 330, defaultAbv: 5 },
    { size: 'medium', label: 'Medium (500ml pint)', volumeMl: 500, defaultAbv: 5 },
    { size: 'large', label: 'Large (650ml)', volumeMl: 650, defaultAbv: 5 },
  ]},
  { id: 'light_beer', label: 'Light Beer', sizes: [
    { size: 'small', label: 'Small (330ml bottle)', volumeMl: 330, defaultAbv: 4 },
    { size: 'medium', label: 'Medium (500ml pint)', volumeMl: 500, defaultAbv: 4 },
    { size: 'large', label: 'Large (650ml)', volumeMl: 650, defaultAbv: 4 },
  ]},
  { id: 'craft_beer', label: 'Craft Beer / IPA', sizes: [
    { size: 'small', label: 'Small (330ml bottle)', volumeMl: 330, defaultAbv: 6.5 },
    { size: 'medium', label: 'Medium (500ml pint)', volumeMl: 500, defaultAbv: 6.5 },
    { size: 'large', label: 'Large (650ml)', volumeMl: 650, defaultAbv: 6.5 },
  ]},
  { id: 'cider', label: 'Cider', sizes: [
    { size: 'small', label: 'Small (330ml bottle)', volumeMl: 330, defaultAbv: 5 },
    { size: 'medium', label: 'Medium (500ml pint)', volumeMl: 500, defaultAbv: 5 },
    { size: 'large', label: 'Large (650ml)', volumeMl: 650, defaultAbv: 5 },
  ]},

  // --- Wine family ---
  { id: 'wine', label: 'Wine (Red/White)', sizes: [
    { size: 'small', label: 'Small pour (125ml)', volumeMl: 125, defaultAbv: 12.5 },
    { size: 'medium', label: 'Standard pour (175ml)', volumeMl: 175, defaultAbv: 12.5 },
    { size: 'large', label: 'Large pour (250ml)', volumeMl: 250, defaultAbv: 12.5 },
  ]},
  { id: 'champagne', label: 'Champagne / Sparkling Wine', sizes: [
    { size: 'small', label: 'Flute (100ml)', volumeMl: 100, defaultAbv: 12 },
    { size: 'medium', label: 'Standard flute (125ml)', volumeMl: 125, defaultAbv: 12 },
    { size: 'large', label: 'Large glass (150ml)', volumeMl: 150, defaultAbv: 12 },
  ]},
  { id: 'fortified_wine', label: 'Fortified Wine (Port/Sherry)', sizes: [
    { size: 'small', label: 'Small (50ml)', volumeMl: 50, defaultAbv: 19 },
    { size: 'medium', label: 'Standard (75ml)', volumeMl: 75, defaultAbv: 19 },
    { size: 'large', label: 'Large (100ml)', volumeMl: 100, defaultAbv: 19 },
  ]},

  // --- Spirits (all ~40% ABV — the international standard for distilled spirits) ---
  { id: 'vodka', label: 'Vodka', sizes: [
    { size: 'small', label: 'Single shot (30ml)', volumeMl: 30, defaultAbv: 40 },
    { size: 'medium', label: 'Large single (45ml)', volumeMl: 45, defaultAbv: 40 },
    { size: 'large', label: 'Double shot (60ml)', volumeMl: 60, defaultAbv: 40 },
  ]},
  { id: 'whisky', label: 'Whisky', sizes: [
    { size: 'small', label: 'Single shot (30ml)', volumeMl: 30, defaultAbv: 40 },
    { size: 'medium', label: 'Large single (45ml)', volumeMl: 45, defaultAbv: 40 },
    { size: 'large', label: 'Double shot (60ml)', volumeMl: 60, defaultAbv: 40 },
  ]},
  { id: 'rum', label: 'Rum', sizes: [
    { size: 'small', label: 'Single shot (30ml)', volumeMl: 30, defaultAbv: 40 },
    { size: 'medium', label: 'Large single (45ml)', volumeMl: 45, defaultAbv: 40 },
    { size: 'large', label: 'Double shot (60ml)', volumeMl: 60, defaultAbv: 40 },
  ]},
  { id: 'gin', label: 'Gin', sizes: [
    { size: 'small', label: 'Single shot (30ml)', volumeMl: 30, defaultAbv: 40 },
    { size: 'medium', label: 'Large single (45ml)', volumeMl: 45, defaultAbv: 40 },
    { size: 'large', label: 'Double shot (60ml)', volumeMl: 60, defaultAbv: 40 },
  ]},
  { id: 'tequila', label: 'Tequila', sizes: [
    { size: 'small', label: 'Single shot (30ml)', volumeMl: 30, defaultAbv: 40 },
    { size: 'medium', label: 'Large single (45ml)', volumeMl: 45, defaultAbv: 40 },
    { size: 'large', label: 'Double shot (60ml)', volumeMl: 60, defaultAbv: 40 },
  ]},
  { id: 'liqueur', label: 'Liqueur', sizes: [
    { size: 'small', label: 'Single shot (30ml)', volumeMl: 30, defaultAbv: 20 },
    { size: 'medium', label: 'Large single (45ml)', volumeMl: 45, defaultAbv: 20 },
    { size: 'large', label: 'Double shot (60ml)', volumeMl: 60, defaultAbv: 20 },
  ]},

  // --- Regional/other common types ---
  { id: 'sake', label: 'Sake', sizes: [
    { size: 'small', label: 'Small (90ml)', volumeMl: 90, defaultAbv: 15 },
    { size: 'medium', label: 'Standard (120ml)', volumeMl: 120, defaultAbv: 15 },
    { size: 'large', label: 'Large (180ml)', volumeMl: 180, defaultAbv: 15 },
  ]},
  { id: 'soju', label: 'Soju', sizes: [
    { size: 'small', label: 'Small (50ml)', volumeMl: 50, defaultAbv: 17 },
    { size: 'medium', label: 'Standard (75ml)', volumeMl: 75, defaultAbv: 17 },
    { size: 'large', label: 'Large (100ml)', volumeMl: 100, defaultAbv: 17 },
  ]},
  { id: 'hard_seltzer', label: 'Hard Seltzer / RTD Cocktail Can', sizes: [
    { size: 'small', label: 'Small can (250ml)', volumeMl: 250, defaultAbv: 5 },
    { size: 'medium', label: 'Standard can (355ml)', volumeMl: 355, defaultAbv: 5 },
    { size: 'large', label: 'Large can (500ml)', volumeMl: 500, defaultAbv: 5 },
  ]},
  { id: 'cocktail', label: 'Cocktail (Mixed Drink)', sizes: [
    { size: 'small', label: 'Small (150ml)', volumeMl: 150, defaultAbv: 15 },
    { size: 'medium', label: 'Standard (250ml)', volumeMl: 250, defaultAbv: 15 },
    { size: 'large', label: 'Large (350ml)', volumeMl: 350, defaultAbv: 15 },
  ]},

  // --- True catch-all — no sizes/defaults, forces manual volumeMl + abv entry ---
  { id: 'other', label: 'Other', sizes: [] },
];

const CATALOG_IDS = new Set(DRINK_CATALOG.map((c) => c.id));

function isValidDrinkType(id) {
  return CATALOG_IDS.has(id);
}

function getSizeDefaults(drinkType, size) {
  const category = DRINK_CATALOG.find((c) => c.id === drinkType);
  return category?.sizes.find((s) => s.size === size) || null;
}

module.exports = { DRINK_CATALOG, isValidDrinkType, getSizeDefaults };
