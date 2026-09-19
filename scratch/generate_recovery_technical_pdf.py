# -*- coding: utf-8 -*-
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, ListFlowable, ListItem, Preformatted
)

OUT = "C:/Users/USER/Desktop/AI-HealthCare/scratch/Recovery-Score-Technical-Reference-v2.pdf"

NAVY = colors.HexColor("#171a2b")
ACCENT = colors.HexColor("#7c5cff")
GOOD = colors.HexColor("#12946b")
WARN = colors.HexColor("#a1670a")
BAD = colors.HexColor("#c8383f")
GREY = colors.HexColor("#565b78")
LIGHTBG = colors.HexColor("#f3f4fa")
CODEBG = colors.HexColor("#12162a")
BORDER = colors.HexColor("#dee1f0")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="DocTitle", fontSize=24, leading=30, textColor=NAVY, fontName="Helvetica-Bold", spaceAfter=6))
styles.add(ParagraphStyle(name="DocSubtitle", fontSize=12.5, leading=17, textColor=GREY, fontName="Helvetica"))
styles.add(ParagraphStyle(name="H1", fontSize=16, leading=21, textColor=NAVY, fontName="Helvetica-Bold", spaceBefore=16, spaceAfter=8))
styles.add(ParagraphStyle(name="H2", fontSize=12.5, leading=16, textColor=ACCENT, fontName="Helvetica-Bold", spaceBefore=11, spaceAfter=5))
styles.add(ParagraphStyle(name="Body", fontSize=10, leading=14.5, textColor=NAVY, fontName="Helvetica", spaceAfter=7))
styles.add(ParagraphStyle(name="Callout", fontSize=9.8, leading=14, textColor=NAVY, fontName="Helvetica-Oblique", spaceAfter=8, leftIndent=8))
styles.add(ParagraphStyle(name="TableHead", fontSize=9, leading=11.5, textColor=colors.white, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle(name="TableCell", fontSize=8.8, leading=12, textColor=NAVY, fontName="Helvetica"))
styles.add(ParagraphStyle(name="Small", fontSize=8.3, leading=11.5, textColor=GREY, fontName="Helvetica-Oblique"))
styles.add(ParagraphStyle(name="Footer", fontSize=8, textColor=GREY, alignment=1))
styles.add(ParagraphStyle(name="CodeBlock", fontSize=8.6, leading=12.5, fontName="Courier", textColor=colors.HexColor("#d7dcff"), backColor=CODEBG, borderPadding=8, leftIndent=0))
styles.add(ParagraphStyle(name="FileTag", fontSize=8.3, leading=11, fontName="Courier-Bold", textColor=ACCENT))

story = []

def h1(text):
    story.append(HRFlowable(width="100%", thickness=1.2, color=ACCENT, spaceBefore=2, spaceAfter=2))
    story.append(Paragraph(text, styles["H1"]))

def h2(text):
    story.append(Paragraph(text, styles["H2"]))

def body(text):
    story.append(Paragraph(text, styles["Body"]))

def filetag(text):
    story.append(Paragraph(text, styles["FileTag"]))
    story.append(Spacer(1, 2))

def code(text):
    # Paragraph (not Preformatted) so long code blocks can split across a
    # page boundary instead of silently overflowing past the bottom margin
    # when they start near the end of a page - Preformatted is treated as
    # unsplittable and just clips off-page with no error, which is why the
    # data-flow diagram was invisible in the earlier version of this PDF.
    lines = []
    for line in text.split('\n'):
        stripped = line.lstrip(' ')
        indent = len(line) - len(stripped)
        escaped = stripped.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        lines.append(('&nbsp;' * indent) + escaped)
    html = '<br/>'.join(lines)
    story.append(Paragraph(html, styles["CodeBlock"]))
    story.append(Spacer(1, 8))

def callout(text):
    story.append(Spacer(1, 3))
    story.append(Paragraph("NOTE: " + text, styles["Callout"]))
    story.append(Spacer(1, 3))

def bullets(items):
    story.append(ListFlowable(
        [ListItem(Paragraph(i, styles["Body"]), leftIndent=6, spaceAfter=4) for i in items],
        bulletType='bullet', start='-', leftIndent=14
    ))

def make_table(header, rows, col_widths, header_bg=NAVY):
    data = [[Paragraph(h, styles["TableHead"]) for h in header]] + \
           [[Paragraph(str(c), styles["TableCell"]) for c in r] for r in rows]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), header_bg),
        ('GRID', (0, 0), (-1, -1), 0.6, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(rows) + 1):
        if i % 2 == 0:
            style.append(('BACKGROUND', (0, i), (-1, i), LIGHTBG))
    t.setStyle(TableStyle(style))
    story.append(t)
    story.append(Spacer(1, 10))

# ============================================================
# COVER
# ============================================================
story.append(Spacer(1, 3*cm))
story.append(Paragraph("Recovery Score - Technical Reference", styles["DocTitle"]))
story.append(Paragraph("System architecture, data flow, formulas, and exact weightage used in production", styles["DocSubtitle"]))
story.append(Spacer(1, 1*cm))
story.append(HRFlowable(width="40%", thickness=2, color=ACCENT, hAlign="LEFT"))
story.append(Spacer(1, 0.4*cm))
story.append(Paragraph("For engineering / app-dev use. Companion to the plain-language \"Recovery Score Explained\" doc.", styles["Body"]))
story.append(Spacer(1, 6*cm))
story.append(Paragraph("Take Health - Internal Engineering Documentation", styles["Footer"]))
story.append(PageBreak())

# ============================================================
# 1. FILE MAP
# ============================================================
h1("1. File Map")
body("Every file involved in the Recovery feature, and what it owns:")
make_table(
    ["File", "Responsibility"],
    [
        ["server/services/recoveryScoreService.js", "Core scoring engine - all math lives here. Entry point: calculateRecoveryScore(userId, dateStr)."],
        ["server/services/recoveryBaselineService.js", "Shared helper - pulls N days of a metric, merges multi-device same-day readings, computes mean/SD."],
        ["server/services/recoveryRecommendationService.js", "Rule-based (not AI) lookup: band + activity load -> recommendation text + suggested activities."],
        ["server/services/recoveryPatternService.js", "Scans last 30 days for 2 pre-defined correlations (frequency count, not ML)."],
        ["server/services/recoveryAnalyticsService.js", "Read-side: serves daily/weekly/monthly/yearly views, personal baseline range, patterns."],
        ["server/config/activityCatalog.js", "Single source of truth for activity types + MET values; also powers recovery-friendly activity filtering."],
        ["server/models/RecoveryDailySummary.js", "One document per user per day - the persisted output of calculateRecoveryScore()."],
        ["server/models/StressDailySummary.js", "Source of avgHrvMs (real HRV, ms) - rolled up per day from raw StressSample."],
        ["server/models/HeartRateDailySummary.js", "Source of restingBpm.value (RHR) per day."],
        ["server/models/VitalsDailySummary.js", "Source of avgRespiratoryRate (RR) per day."],
        ["server/models/SleepSession.js", "Source of totalSleepMinutes, awakeMinutes, bedTime per night."],
        ["server/models/DailyActivityMetric.js", "Source of activeMinutes per day (drives the Activity modifier)."],
        ["server/controllers/wearableController.js", "getRecoveryAnalyticsData - the actual HTTP endpoint the app calls."],
    ],
    [7.2*cm, 10.8*cm]
)

# ============================================================
# 2. DATA FLOW
# ============================================================
h1("2. End-to-End Data Flow")
code("""Apple Watch / HealthKit
      |
      v
POST /wearables/sync-os-health  (wearableController.syncOsHealthData)
      |
      v
wearableIngestService.js
   applyStressSamples()  -> StressDailySummary.avgHrvMs      (running avg, per day)
   applyHeartRateSamples() -> HeartRateDailySummary.restingBpm
   applyVitalsSamples()  -> VitalsDailySummary.avgRespiratoryRate
   applySleepSessions()  -> SleepSession (totalSleepMinutes, awakeMinutes, bedTime)
   (DailyActivityMetric updated by the existing activity-sync path)
      |
      v
Triggered on write:  scoreRecompute.triggerRecoveryScoreRecompute(userId, date)
      |
      v
recoveryScoreService.calculateRecoveryScore(userId, dateStr)
   1. buildHrvEngine()        -> today's HRV vs 14-day & 90-day baseline
   2. buildRhrEngine()        -> today's RHR vs 14-day & 90-day baseline
   3. buildRrEngine()         -> today's RR vs 14-day baseline
   4. buildSleepEngine()      -> Duration + Efficiency + Regularity
   5. buildActivityModifier() -> 7-day vs 28-day load ratio
   6. Combine -> Physiology -> RecoveryBase -> +Activity modifier
   7. computeBaselineDrift()  -> flags depressed long-term baseline
   8. Apply Recovery Ceiling if drifted
   9. buildSafetyWarnings()   -> independent absolute-threshold check
   10. buildRecommendation()  -> rule-based text + suggested activities
      |
      v
RecoveryDailySummary.findOneAndUpdate()   (upsert, one doc per user per day)
      |
      v
GET /wearables/recovery/analytics?range=...  (recoveryAnalyticsService.getRecoveryAnalytics)
      |
      v
Mobile app""")

# ============================================================
# 3. BASELINE MATH
# ============================================================
h1("3. Baseline Calculation - The Core Primitive")
filetag("server/services/recoveryBaselineService.js")
body("Every engine (HRV, RHR, RR) calls the same function to get a baseline:")
code("""getWindowStats(Model, userId, valuePath, dateStr, windowDays)

1. Query window: [dateStr - windowDays, dateStr)  <- TODAY IS EXCLUDED
2. If a user has multiple devices reporting the same day, average them
   (point measurements like bpm/ms are averaged, never summed)
3. Compute sample mean and sample standard deviation (n-1 denominator):

   mean = sum(values) / n
   sd   = sqrt( sum((v - mean)^2) / (n - 1) )     [sd = null if n < 2]

Returns: { mean, sd, n }""")

h2("Two windows, used together")
make_table(
    ["Window", "Constant", "Used for"],
    [
        ["Recent", "RECENT_WINDOW_DAYS = 14", "\"How does today compare to my last two weeks\" - matches Oura's public 14-day convention."],
        ["Long-term", "LONG_WINDOW_DAYS = 90", "\"How does today compare to my deeper, more stable normal\" - protects against a temporarily bad recent window looking like full recovery."],
    ],
    [3.2*cm, 5*cm, 9.8*cm]
)

h2("Z-score -> T-score conversion")
code("""z = (today_value - baseline_mean) / baseline_sd

T = clamp( 50 + 10*z , 0, 100 )     // standard psychometric T-score:
                                     // mean=50, SD=10. NOT an invented scale.
                                     // Same transform used in clinical
                                     // instruments (e.g. MMPI).""")
callout("z requires sd > 0 (at least 2 valid baseline days). With fewer, the function returns null "
        "and that sub-score is excluded from the weighted average below (see Section 6).")

story.append(PageBreak())

# ============================================================
# 4. PER-METRIC LOGIC
# ============================================================
h1("4. Per-Metric Engine Logic")

h2("4.1 HRV Engine  -  buildHrvEngine()")
body("Source: StressDailySummary.avgHrvMs. Direction: higher HRV vs. baseline = better (no sign flip).")
code("""recentZ = zScore(todayHrv, baseline14.mean, baseline14.sd)
longZ   = zScore(todayHrv, baseline90.mean, baseline90.sd)

recentScore = TScore(recentZ)
longScore   = TScore(longZ)

HRVScore = 0.40 * recentScore + 0.60 * longScore
           (renormalized if either side is null - see Section 6)""")
callout("60% weight on the long-term window is deliberate: a single depressed recent window "
        "should not be able to quickly redefine what counts as \"healthy.\"")

h2("4.2 RHR Engine  -  buildRhrEngine()")
body("Source: HeartRateDailySummary.restingBpm.value. Direction: LOWER RHR vs. baseline = better (sign flipped).")
code("""recentZ = zScore(todayRhr, baseline14.mean, baseline14.sd)
longZ   = zScore(todayRhr, baseline90.mean, baseline90.sd)

recentScore = TScore( -recentZ )      // note the sign flip
longScore   = TScore( -longZ )

RHRScore = 0.40 * recentScore + 0.60 * longScore""")

h2("4.3 Respiratory Rate Engine  -  buildRrEngine()")
body("Source: VitalsDailySummary.avgRespiratoryRate. Direction: deviation in EITHER direction is bad "
     "(only a 14-day window is used - RR is treated as a stability check, not a trend metric).")
code("""z = zScore(todayRr, baseline14.mean, baseline14.sd)

RRScore = TScore( -abs(z) )     // deviation either way lowers the score""")

h2("4.4 Sleep Engine  -  buildSleepEngine()")
body("Source: SleepSession (totalSleepMinutes, awakeMinutes, bedTime). Three real sub-components:")
make_table(
    ["Sub-component", "Formula", "Weight"],
    [
        ["Duration", "100 - abs(hoursSlept - 8) * 15, clamped 0-100", "0.45"],
        ["Efficiency", "totalSleepMinutes / (totalSleepMinutes + awakeMinutes) * 100", "0.30"],
        ["Regularity", "100 - (SD of bedtime-minutes over last 14 nights / 120) * 100", "0.15"],
        ["Continuity (NOT built)", "Would need a per-night wake-event COUNT - HealthKit sleep stages only give total awakeMinutes, not how many separate times the user woke.", "0.10 (unused - renormalized away)"],
    ],
    [3.5*cm, 9.5*cm, 5*cm]
)
code("""SleepScore = weightedAverage([
  { score: durationScore,   weight: 0.45 },
  { score: efficiencyScore, weight: 0.30 },
  { score: regularityScore, weight: 0.15 },
])   // renormalized over whichever of the 3 are available""")

h2("4.5 Activity Modifier  -  buildActivityModifier()")
body("Source: DailyActivityMetric.activeMinutes. This is a MODIFIER (added/subtracted at the end), "
     "not a weighted component - it never earns bonus points, only applies a penalty for overload.")
code("""acuteLoad   = avg(activeMinutes, last 7 days)
chronicLoad = avg(activeMinutes, last 28 days)
loadRatio   = acuteLoad / chronicLoad

if loadRatio > 1.2:
    modifier = -min(12, round((loadRatio - 1.2) * 20))     // capped at -12
else:
    modifier = 0     // underactivity never gets a bonus, only ever neutral""")

story.append(PageBreak())

# ============================================================
# 5. WEIGHTAGE - full hierarchy
# ============================================================
h1("5. Weightage - Full Hierarchy")
body("Three levels of combination, each independently renormalized if a piece is missing (Section 6).")

code("""LEVEL 1 - Physiology
  Physiology = 0.50 * HRVScore + 0.40 * RHRScore + 0.10 * RRScore

LEVEL 2 - Recovery Base
  RecoveryBase = 0.70 * Physiology + 0.30 * SleepScore

LEVEL 3 - Final Score
  RecoveryRaw = RecoveryBase + ActivityModifier
  RecoveryScore = clamp(round(RecoveryRaw), 0, 100)
  RecoveryScore = min(RecoveryScore, RECOVERY_CEILING) IF baseline is drifted (Section 8)""")

make_table(
    ["Constant", "Value", "File", "Status"],
    [
        ["HRV weight (within Physiology)", "0.50", "recoveryScoreService.js", "Placeholder - directionally matches Whoop's public HRV-dominant disclosure"],
        ["RHR weight (within Physiology)", "0.40", "recoveryScoreService.js", "Placeholder"],
        ["RR weight (within Physiology)", "0.10", "recoveryScoreService.js", "Placeholder - matches Polar's public \"breathing rate smallest weight\" disclosure"],
        ["Physiology weight (within RecoveryBase)", "0.70", "recoveryScoreService.js", "Placeholder"],
        ["Sleep weight (within RecoveryBase)", "0.30", "recoveryScoreService.js", "Placeholder"],
        ["HRV recent/long split", "0.40 / 0.60", "buildHrvEngine()", "Placeholder"],
        ["RHR recent/long split", "0.40 / 0.60", "buildRhrEngine()", "Placeholder"],
        ["Sleep sub-weights", "0.45 / 0.30 / 0.15", "buildSleepEngine()", "Placeholder"],
    ],
    [5.5*cm, 2.3*cm, 4.7*cm, 5.5*cm]
)
callout("Every row above is labeled \"Placeholder\" on purpose - no wearable brand publishes a validated "
        "weighting (confirmed via a 2025 peer-reviewed comparison study). These are our starting-point "
        "judgment calls, directionally grounded in what brands DO disclose, not empirically fitted to "
        "our own users yet. Updating them later means changing these constants only - the surrounding "
        "logic (z-score, renormalization, ceiling) does not need to change.")

# ============================================================
# 6. MISSING-DATA HANDLING
# ============================================================
h1("6. Missing-Data Handling - weightedAverage()")
body("Every weighted combination in this system (Physiology, RecoveryBase, Sleep) goes through the same "
     "helper, which renormalizes over only the parts that are actually available:")
code("""function weightedAverage(parts):
    available = parts.filter(p => p.score != null)
    if available.length == 0: return null
    totalWeight = sum(p.weight for p in available)
    return sum(p.score * (p.weight / totalWeight) for p in available)

Example: HRV missing, only RHR (0.40) and RR (0.10) available -> renormalized to:
    RHR effective weight = 0.40 / 0.50 = 0.80
    RR  effective weight = 0.10 / 0.50 = 0.20""")
callout("Renormalization happens WITHIN each domain independently (Physiology, then RecoveryBase) - "
        "a metric missing inside Physiology never borrows weight from Sleep or vice versa.")

h2("The \"Day 1\" edge case (fixed bug)")
body("A reading existing today is not the same as having a baseline to score it against - with zero "
     "baseline history, z-score/T-score both return null, which can cascade to Physiology = null and "
     "RecoveryBase = null. Left unguarded, RecoveryRaw = null + activityModifier coerces to 0 in "
     "JavaScript, showing a brand-new user \"Recovery: 0/100\" on their very first day.")
code("""if (recoveryBase == null):
    save({ recoveryScore: null, ... })
    return { recoveryScore: null, status: 'insufficient_baseline', confidence, ... }""")

story.append(PageBreak())

# ============================================================
# 7. BANDS
# ============================================================
h1("7. Score Bands  -  classifyRecoveryBand()")
code("""if score >= 85: 'optimal'    "Optimal Recovery"
if score >= 70: 'moderate'   "Moderate Recovery"
if score >= 50: 'low'        "Low Recovery"
else:           'very_low'   "Very Low Recovery" """)
body("Thresholds (85 / 70 / 50) match Oura's published Readiness tiers exactly, extended to 4 tiers "
     "for the product design's \"Moderate Recovery\" copy.")

# ============================================================
# 8. SAFETY FLOOR + CEILING + DRIFT
# ============================================================
h1("8. Safety Floor, Baseline Drift, and Recovery Ceiling")

h2("8.1 Safety Floor - buildSafetyWarnings()  (independent of the score)")
code("""SAFETY_FLOOR = {
  hrvMsLow: 20,      // below this is low for any healthy adult
  rhrBpmHigh: 100,   // resting tachycardia range
  rhrBpmLow: 40,     // bradycardia range
  spo2Low: 92,       // WHO / pulse-oximetry hypoxia reference
}
// These fire regardless of personal baseline - a score can look "fine"
// relative to a chronically-unhealthy personal history while still
// tripping an absolute warning.""")

h2("8.2 Baseline Drift - computeBaselineDrift()")
code("""hrvDrifted = hrv.longTermZ <= -DRIFT_Z_THRESHOLD     // today still far below 90-day mean
rhrDrifted = rhr.longTermZ >=  DRIFT_Z_THRESHOLD     // today still far above 90-day mean

baselineStatus = (hrvDrifted or rhrDrifted) ? 'depressed_recent_baseline' : 'stable'

DRIFT_Z_THRESHOLD = 1.5     // PLACEHOLDER - not calibrated""")

h2("8.3 Recovery Ceiling")
code("""if baselineStatus == 'depressed_recent_baseline' and recoveryScore > RECOVERY_CEILING_WHEN_DRIFTED:
    recoveryScore = RECOVERY_CEILING_WHEN_DRIFTED
    ceilingApplied = true

RECOVERY_CEILING_WHEN_DRIFTED = 69     // PLACEHOLDER - sits just under
                                        // the Moderate band so a capped
                                        // day reads as "Low," not merely
                                        // "less than Optimal."
""")
callout("The Ceiling only ever caps DOWN, never raises a score, and only engages when the long-term "
        "z-scores (already computed for Physiology, no extra query) indicate the drift condition.")

story.append(PageBreak())

# ============================================================
# 9. RECOMMENDATION + PATTERNS + ACTIVITY FILTER
# ============================================================
h1("9. Recommendation, Pattern Detection, and Activity Filtering")

h2("9.1 Recommendation Engine (rule-based, NOT AI)")
filetag("server/services/recoveryRecommendationService.js")
body("A fixed lookup table keyed on band.key, with one dynamic override:")
code("""BAND_COPY = {
  optimal:  { headline: "Great day to push", movement: "30-45 min, moderate-high" },
  moderate: { headline: "Moderate day",      movement: "20-30 min, light-moderate" },
  low:      { headline: "Take it easier",    movement: "10-20 min, light" },
  very_low: { headline: "Prioritize rest",   movement: "0-15 min, very light" },
}
if activity.loadRatio > 1.2:
    summary = "Your recent activity has been higher than usual. " + copy.summary""")

h2("9.2 Pattern Detection (frequency count, NOT machine learning)")
filetag("server/services/recoveryPatternService.js")
body("Scans the last 30 days for exactly 2 pre-defined correlations. A pattern is only surfaced if it "
     "occurred at least MIN_OCCURRENCES=3 times - otherwise it's noise, not a pattern.")
code("""Pattern 1: 2 consecutive high-activity days (> 1.3x the user's own 30-day average)
         followed by a 'low' or 'very_low' band day.

Pattern 2: A night under 390 minutes (6h30m) followed by a 'low' or 'very_low' band day.""")

h2("9.3 Recovery-Friendly Activity Filter")
filetag("server/config/activityCatalog.js -> getRecoveryFriendlyActivities(bandKey)")
body("Uses the published ACSM/CDC MET-intensity classification (light &lt;3.0, moderate 3.0-5.9, "
     "vigorous &gt;=6.0 METs) as the ONLY thresholds - not an invented split:")
code("""metRangeForBand(bandKey):
    optimal  -> MET >= 6.0            (vigorous)
    moderate -> 3.0 <= MET < 6.0      (moderate)
    low / very_low -> MET < 3.0       (light)

Returns the 4 lowest-MET catalog entries within that range, sorted ascending.""")
callout("Two catalog entries (Stretching/Mobility, Slow Walk - both 2.5 MET, sourced from the 2024 "
        "Adult Compendium of Physical Activities) were added specifically because the Light bucket "
        "(&lt;3.0 MET) previously only contained Yoga.")

story.append(PageBreak())

# ============================================================
# 10. API RESPONSE SHAPE
# ============================================================
h1("10. API Response Shape")
filetag("GET /wearables/recovery/analytics?range=daily")
code("""{
  "success": true,
  "range": "daily",
  "entries": [{
    "date": "2026-09-24",
    "recoveryScore": 69,
    "band": { "key": "low", "label": "Low Recovery" },
    "confidence": "good",
    "baselineStatus": "depressed_recent_baseline",
    "warnings": [{ "code": "hrv_below_reference_range", "message": "..." }],
    "components": { "hrv": 59, "restingHeartRate": 61, "respiratoryRate": 47,
                     "sleepContribution": 96, "strainContribution": 100 },
    "metricDetails": { "physiology": {...}, "hrv": {...}, "rhr": {...},
                        "rr": {...}, "sleep": {...}, "activity": {...},
                        "ceilingApplied": true },
    "recommendation": { "headline": "...", "primaryRecommendation": {...},
                         "recommendedActivities": [...] }
  }],
  "personalBaselineRange": { "low": 68, "high": 83 },
  "patterns": [{ "text": "...", "basis": "Observed 4 times in the last 30 days" }]
}""")
callout("All Phase 2 fields (band, confidence, warnings, baselineStatus, metricDetails, recommendation, "
        "personalBaselineRange, patterns) are strictly additive. A client reading only date/recoveryScore/"
        "components sees no behavior change; they'll simply be undefined on rows computed before this shipped.")

# ============================================================
# 11. CONSTANTS REFERENCE
# ============================================================
h1("11. Full Constants Reference")
make_table(
    ["Constant", "Value", "Location"],
    [
        ["RECENT_WINDOW_DAYS", "14", "recoveryScoreService.js"],
        ["LONG_WINDOW_DAYS", "90", "recoveryScoreService.js"],
        ["ACUTE_LOAD_WINDOW_DAYS", "7", "recoveryScoreService.js"],
        ["CHRONIC_LOAD_WINDOW_DAYS", "28", "recoveryScoreService.js"],
        ["DRIFT_Z_THRESHOLD", "1.5", "recoveryScoreService.js"],
        ["RECOVERY_CEILING_WHEN_DRIFTED", "69", "recoveryScoreService.js"],
        ["SAFETY_FLOOR.hrvMsLow", "20 ms", "recoveryScoreService.js"],
        ["SAFETY_FLOOR.rhrBpmHigh / Low", "100 / 40 bpm", "recoveryScoreService.js"],
        ["SAFETY_FLOOR.spo2Low", "92%", "recoveryScoreService.js"],
        ["Activity overload threshold", "loadRatio > 1.2", "buildActivityModifier()"],
        ["Activity modifier cap", "-12", "buildActivityModifier()"],
        ["Confidence tiers", "&lt;7 / 7-13 / 14-27 / 28-59 / 60+ days", "confidenceFromBaselineDays()"],
        ["Pattern MIN_OCCURRENCES", "3 (in last 30 days)", "recoveryPatternService.js"],
        ["Recovery-friendly suggestion count", "4 activities", "activityCatalog.js"],
    ],
    [6*cm, 5.5*cm, 6.5*cm]
)

story.append(Spacer(1, 0.5*cm))
story.append(HRFlowable(width="100%", thickness=0.8, color=BORDER))
story.append(Spacer(1, 0.3*cm))
story.append(Paragraph(
    "Companion document: \"Recovery Score Explained\" (plain-language, non-technical). "
    "This document is the engineering reference - update it whenever a constant or formula changes.",
    styles["Small"]
))

doc = SimpleDocTemplate(
    OUT, pagesize=A4,
    topMargin=2*cm, bottomMargin=1.8*cm, leftMargin=2*cm, rightMargin=2*cm,
    title="Recovery Score Technical Reference", author="Take Health Engineering"
)
doc.build(story)
print("PDF created:", OUT)
