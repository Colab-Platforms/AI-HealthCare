// 3-tier score band used ONLY by the mobile Score Calendar's per-day dots
// (Health/Nutrition range endpoints) — separate from each feature's own
// single-day `band` (e.g. nutrition's excellent/good/fair/needs_attention,
// which drives headline copy elsewhere and is left untouched).
//
// "Not logged" (the calendar's 4th legend color) is NOT one of this
// function's return values — it isn't a score tier, it's the absence of
// data. The range endpoints that use this already only include days that
// have an actual logged row; a date missing from that array IS "not
// logged", and the client renders it that way. This function only ever
// classifies a day that has a real score.
//
// Thresholds are Oura's published Readiness Score tiers — the same reference
// recoveryScoreService.js already cites for its own band classification in
// this codebase (see that file's "4-tier band, thresholds matching Oura's
// published Readiness tiers" comment) — not an invented split:
//   Optimal: 85-100, Good: 70-84, Pay Attention (labeled "low" here to match
//   the calendar's legend): below 70.
function classifyCalendarBand(score) {
  if (score == null || Number.isNaN(score)) return null;
  if (score >= 85) return 'optimal';
  if (score >= 70) return 'good';
  return 'low';
}

module.exports = { classifyCalendarBand };
