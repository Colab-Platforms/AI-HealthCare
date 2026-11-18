/**
 * Builds a short, AI-prompt-ready block describing a user's diabetes status,
 * other medical conditions, and allergies — used to personalize food-analysis
 * warnings (e.g. "You have diabetes — this dessert is high in sugar").
 *
 * Returns '' when the user has nothing relevant on file, so callers can
 * always safely interpolate the result without an extra null check.
 */
function buildMedicalContextForAI(user) {
  const profile = user?.profile || {};
  const medical = profile.medicalHistory || {};

  // Onboarding multi-select ("Diabetes", "Hypertension", ... plus free-text "Other") —
  // previously ignored, so conditions picked there never reached the AI.
  const onboardingConditions = (profile.healthConditions || [])
    .filter(c => c && c !== 'None of these' && c !== 'Other');
  if (profile.healthConditionOther && String(profile.healthConditionOther).trim()) {
    onboardingConditions.push(String(profile.healthConditionOther).trim());
  }

  // De-duplicate case-insensitively across all sources
  const seen = new Set();
  const allConditions = [
    ...(medical.conditions || []),
    ...(profile.chronicConditions || []),
    ...onboardingConditions
  ].map(c => String(c || '').trim()).filter(c => {
    const k = c.toLowerCase();
    if (!c || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const isDiabetic = profile.isDiabetic === 'yes' ||
    allConditions.some(c => c.toLowerCase().includes('diabet'));

  // Diabetes gets its own dedicated instruction below — keep it out of the
  // generic conditions line so the model doesn't produce two overlapping (and
  // sometimes garbled, e.g. "HighDibetics") warnings for the same thing.
  const otherConditions = allConditions.filter(c => !c.toLowerCase().includes('diabet'));

  const prefs = user?.foodPreferences || {};
  const dedupe = (arr) => [...new Set((arr || []).map(v => String(v || '').trim()).filter(Boolean))];
  const allergies = dedupe(profile.allergies);
  // Intolerances / restrictions the user listed (kept separate from allergies — lower severity)
  const allergyKeys = new Set(allergies.map(a => a.toLowerCase()));
  const restrictions = dedupe(prefs.dietaryRestrictions).filter(r => !allergyKeys.has(r.toLowerCase()));
  const medications = dedupe(medical.currentMedications);

  if (!isDiabetic && otherConditions.length === 0 && allergies.length === 0 &&
      restrictions.length === 0 && medications.length === 0) {
    return '';
  }

  const lines = [];
  if (isDiabetic) {
    lines.push(`- Diabetic: Yes — ONLY warn if this meal is notably high in sugar, refined carbs, or fast-digesting starches (e.g. a sweet/dessert, sugary drink, large portion of white rice/maida). Do not warn about routine home-cooked meals just because they contain some carbohydrate.`);
  }
  if (otherConditions.length > 0) {
    lines.push(`- Other Medical Conditions (use these EXACT names, never merge, invent, or paraphrase them into a new label): ${otherConditions.join(', ')} — ONLY warn if this specific meal is clearly and significantly problematic for one of these (e.g. very high sodium for hypertension, high saturated/trans fat for a heart condition). Do not warn for mild or typical amounts.`);
  }
  if (allergies.length > 0) {
    lines.push(`- Allergies: ${allergies.join(', ')} — if any dish or ingredient contains or plausibly contains one of these, add a CRITICAL allergy warning as the FIRST item in "warnings". This is the one case where you should always warn, regardless of severity.`);
  }

  if (restrictions.length > 0) {
    lines.push(`- Food Intolerances / Dietary Restrictions: ${restrictions.join(', ')} — if a dish clearly contains one of these, add a warning naming it.`);
  }
  if (medications.length > 0) {
    lines.push(`- Current Medications: ${medications.join(', ')} — ONLY warn about a well-known food-drug interaction with this specific meal (e.g. grapefruit with statins, high vitamin K with warfarin, high-potassium foods with certain BP drugs). Never invent interactions.`);
  }

  return `\n\nUSER MEDICAL CONTEXT:
${lines.join('\n')}

MEDICAL WARNING RULES (STRICT):
- Do NOT add a medical warning for every meal by default. Most ordinary meals should get ZERO medical warnings even when the user has a condition on file — only flag genuinely significant, above-average risk for THAT SPECIFIC meal.
- Check the meal against EVERY item listed above (allergies, diabetes, each other condition, restrictions, medications) and warn for each one that is genuinely affected.
- Maximum 1 warning per condition/allergy, and at most 4 medical warnings total in the whole "warnings" array (priority: allergies, then diabetes, then other conditions, then restrictions/medications). If several conditions share the same cause (e.g. high sodium affecting both hypertension and a heart condition), merge them into ONE warning that names both.
- Never fabricate or combine condition names. If unsure a condition applies, do not mention it.
- Each medical warning must name the specific condition and the specific reason (e.g. "You have diabetes — this dessert has ~35g of sugar in one serving").`;
}

module.exports = { buildMedicalContextForAI };
