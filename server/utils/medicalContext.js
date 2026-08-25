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

  const allConditions = [
    ...(medical.conditions || []),
    ...(profile.chronicConditions || [])
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  const isDiabetic = profile.isDiabetic === 'yes' ||
    allConditions.some(c => c.toLowerCase().includes('diabet'));

  // Diabetes gets its own dedicated instruction below — keep it out of the
  // generic conditions line so the model doesn't produce two overlapping (and
  // sometimes garbled, e.g. "HighDibetics") warnings for the same thing.
  const otherConditions = allConditions.filter(c => !c.toLowerCase().includes('diabet'));

  const allergies = profile.allergies || [];

  if (!isDiabetic && otherConditions.length === 0 && allergies.length === 0) {
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

  return `\n\nUSER MEDICAL CONTEXT:
${lines.join('\n')}

MEDICAL WARNING RULES (STRICT):
- Do NOT add a medical warning for every meal by default. Most ordinary meals should get ZERO medical warnings even when the user has a condition on file — only flag genuinely significant, above-average risk for THAT SPECIFIC meal.
- Maximum 1 warning per condition/allergy, and at most 2 medical warnings total in the whole "warnings" array (allergy warnings take priority, then diabetes, then other conditions).
- Never fabricate or combine condition names. If unsure a condition applies, do not mention it.
- Each medical warning must name the specific condition and the specific reason (e.g. "You have diabetes — this dessert has ~35g of sugar in one serving").`;
}

module.exports = { buildMedicalContextForAI };
