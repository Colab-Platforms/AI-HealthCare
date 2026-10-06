// Single source of truth for the user's diet type.
//
// Before this file, four code paths each picked the diet type their own way:
// the profile, the health goal, the stored plan's inputData, or a hardcoded
// 'non-vegetarian'. The silent default is the bug: a missing value became
// non-veg with no trace. This resolver never guesses. It returns null when the
// value is unknown, so the caller can ask the user instead of generating food
// they may not eat.

const ALLOWED = ['vegetarian', 'vegan', 'eggetarian', 'non-vegetarian', 'other'];

function normalize(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase().replace(/_/g, '-');
  return ALLOWED.includes(v) ? v : null;
}

/**
 * Resolve the diet type for generation.
 * Order: current profile (what the user last set) -> plan.inputData (fallback
 * for a user whose profile has no valid value). The profile wins on purpose:
 * a plan saved under the old silent-default bug may hold 'non-vegetarian', and
 * regeneration must follow what the user now says. Returns null if neither is valid.
 *
 * @param {Object} user - user document or lean object (uses profile.dietaryPreference)
 * @param {Object} [plan] - optional PersonalizedDietPlan (uses inputData.dietaryPreference)
 * @returns {{ value: string|null, source: 'profile'|'plan'|null }}
 */
function resolveDietaryPreference(user, plan = null) {
  const fromProfile = normalize(user?.profile?.dietaryPreference);
  if (fromProfile) return { value: fromProfile, source: 'profile' };

  const fromPlan = normalize(plan?.inputData?.dietaryPreference);
  if (fromPlan) return { value: fromPlan, source: 'plan' };

  return { value: null, source: null };
}

module.exports = { resolveDietaryPreference, normalizeDietaryPreference: normalize, DIET_TYPES: ALLOWED };
