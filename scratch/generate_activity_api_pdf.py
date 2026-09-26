# -*- coding: utf-8 -*-
"""Generates a dev-facing PDF explaining the Activity API changes."""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    ListFlowable, ListItem, HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT

OUT = os.path.join(os.path.dirname(__file__), "Activity_API_Changes.pdf")

styles = getSampleStyleSheet()

NAVY = colors.HexColor("#1f2937")
ACCENT = colors.HexColor("#2563eb")
GREEN = colors.HexColor("#059669")
RED = colors.HexColor("#dc2626")
GRAY = colors.HexColor("#6b7280")
LIGHT = colors.HexColor("#f3f4f6")
CODE_BG = colors.HexColor("#0f172a")
CODE_FG = colors.HexColor("#e2e8f0")

styles.add(ParagraphStyle(name="DocTitle", fontName="Helvetica-Bold", fontSize=22, textColor=NAVY, spaceAfter=4))
styles.add(ParagraphStyle(name="DocSubtitle", fontName="Helvetica", fontSize=11, textColor=GRAY, spaceAfter=16))
styles.add(ParagraphStyle(name="H1", fontName="Helvetica-Bold", fontSize=15, textColor=NAVY, spaceBefore=18, spaceAfter=8))
styles.add(ParagraphStyle(name="H2", fontName="Helvetica-Bold", fontSize=12, textColor=ACCENT, spaceBefore=12, spaceAfter=6))
styles.add(ParagraphStyle(name="Body", fontName="Helvetica", fontSize=9.5, textColor=NAVY, leading=14))
styles.add(ParagraphStyle(name="BodySmall", fontName="Helvetica", fontSize=8.5, textColor=GRAY, leading=12))
styles.add(ParagraphStyle(name="CodeBlk", fontName="Courier", fontSize=8, textColor=CODE_FG, leading=11, backColor=CODE_BG,
                           leftIndent=8, rightIndent=8, spaceBefore=4, spaceAfter=4, borderPadding=8))
styles.add(ParagraphStyle(name="BulletBlk", fontName="Helvetica", fontSize=9.5, textColor=NAVY, leading=14, leftIndent=0))
styles.add(ParagraphStyle(name="TagOld", fontName="Helvetica-Bold", fontSize=9, textColor=RED))
styles.add(ParagraphStyle(name="TagNew", fontName="Helvetica-Bold", fontSize=9, textColor=GREEN))
styles.add(ParagraphStyle(name="Callout", fontName="Helvetica", fontSize=9.5, textColor=NAVY, leading=13,
                           backColor=colors.HexColor("#fef3c7"), borderPadding=8, leftIndent=4, rightIndent=4))

def code_block(text):
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = text.replace("\n", "<br/>").replace(" ", "&nbsp;")
    return Paragraph(text, styles["CodeBlk"])

def h1(t): return Paragraph(t, styles["H1"])
def h2(t): return Paragraph(t, styles["H2"])
def p(t): return Paragraph(t, styles["Body"])
def small(t): return Paragraph(t, styles["BodySmall"])
def hr():
    return HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#e5e7eb"), spaceBefore=6, spaceAfter=10)

def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(i, styles["BulletBlk"]), bulletColor=ACCENT) for i in items],
        bulletType="bullet", start="•", leftIndent=14, spaceBefore=2, spaceAfter=6
    )

def field_table(rows, col_widths):
    header = rows[0]
    data = rows
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.3),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t

def cell(t, style="BodySmall"):
    return Paragraph(t, ParagraphStyle(name="cell", parent=styles[style], fontSize=8.3, leading=11))

doc = SimpleDocTemplate(
    OUT, pagesize=A4,
    topMargin=18 * mm, bottomMargin=16 * mm, leftMargin=16 * mm, rightMargin=16 * mm,
    title="Activity API Changes", author="AI-HealthCare Backend Team"
)

story = []

# ---------------- Cover ----------------
story.append(Spacer(1, 10))
story.append(Paragraph("Activity API — What Changed", styles["DocTitle"]))
story.append(Paragraph("For mobile / app developers integrating the Activity Score &amp; Analytics endpoint", styles["DocSubtitle"]))
story.append(hr())

story.append(p(
    "<b>Endpoint:</b> <font face='Courier'>GET /api/wearable/activity/analytics</font> "
    "&nbsp;&nbsp;|&nbsp;&nbsp; <b>Branch:</b> Staging "
    "&nbsp;&nbsp;|&nbsp;&nbsp; <b>Files touched:</b> activityAnalyticsService.js, dailyHealthScoreService.js, "
    "exerciseGuidanceService.js, activityScoreInsightService.js (new)"
))
story.append(Spacer(1, 10))

story.append(Paragraph(
    "This document explains, in plain terms: what problem existed before, what was changed on the "
    "backend, and exactly where the new fields should be used on the app side. Read this before "
    "wiring up the Activity screen.",
    styles["Body"]
))
story.append(Spacer(1, 14))

# ---------------- 1. The problem ----------------
story.append(h1("1. The Problem We Fixed"))
story.append(p(
    "A user's daily activity can come from two places: a connected wearable device (Apple Watch, "
    "Fitbit, etc. via background sync) and a manually logged workout (<font face='Courier'>POST /api/exercise/log</font>). "
    "Both sources can describe the <b>same real-world workout</b> — e.g. the watch detects a 30-minute run via "
    "elevated heart rate AND the user separately logs the same run."
))
story.append(Spacer(1, 4))
story.append(Paragraph("Before this change, the Activity Score counted BOTH signals separately:", styles["Body"]))
story.append(bullets([
    "Device's <font face='Courier'>activeMinutes</font> → counted toward the score",
    "Manual's <font face='Courier'>cardioMinutes</font> → also counted toward the score, as a separate signal",
]))
story.append(Paragraph(
    "Result: the same 30-minute workout could inflate the score twice (once as \"device movement\", once as "
    "\"manual movement\") — a real double-counting bug.",
    styles["Callout"]
))

# ---------------- 2. Before vs After ----------------
story.append(h1("2. Before vs After"))

story.append(h2("2.1 Scoring logic"))
before_after = [
    [cell("<b>Signal</b>"), cell("<b>BEFORE</b>", "TagOld"), cell("<b>AFTER</b>", "TagNew")],
    [cell("Steps"), cell("Device only"), cell("Device only — unchanged")],
    [cell("Movement / Cardio minutes"),
     cell("Device <font face='Courier'>activeMinutes</font> AND manual "
          "<font face='Courier'>cardioMinutes</font> scored as two separate signals → could double-count "
          "the same workout."),
     cell("Merged into ONE signal: <font face='Courier'>movementMinutes</font>. Device wins if it reported "
          "anything that day; manual is used ONLY as a fallback when the device reported nothing. "
          "Never both.")],
    [cell("Strength sessions"), cell("Manual only, rolling 7-day count"), cell("Unchanged — manual only, rolling 7-day count")],
    [cell("Number of scoring signals"), cell("Up to 4 (steps, device-movement, manual-movement, strength)"),
     cell("Exactly 3 (steps, movementMinutes, strength) — this is WHY the same day's score changed "
          "after the fix (e.g. 75 → 66.7), it is the correct number now.")],
    [cell("Calories (weekly/monthly average)"),
     cell("<font face='Courier'>device.caloriesBurned + manual.caloriesBurned</font> — always <b>added</b>."),
     cell("Device-priority / manual-fallback, same rule as movement — <b>never added</b>, so a synced "
          "workout's calories aren't counted twice.")],
]
story.append(field_table(before_after, [80, 200, 210]))
story.append(Spacer(1, 8))

story.append(h2("2.2 Response shape"))
story.append(Paragraph(
    "Two fields were added to every daily entry, and are also present in the weekly/monthly "
    "<font face='Courier'>summary[]</font> buckets:",
    styles["Body"]
))
story.append(bullets([
    "<font face='Courier'>movementMinutes: {{ actual, goal, source }}</font> — the single number that fed "
    "the score's movement signal, and which source (<font face='Courier'>\"device\"</font> or "
    "<font face='Courier'>\"manual\"</font>) it came from.",
    "<font face='Courier'>insight: {{ band, headline, overallSummary, topGaps, recommendations, disclaimer }}</font> "
    "— a rule-based (non-AI) explanation of the score, same pattern as the existing Nutrition Insight.",
]))

# ---------------- 3. New response shape ----------------
story.append(PageBreak())
story.append(h1("3. New Response Shape — Daily"))
story.append(Paragraph("<font face='Courier'>GET /api/wearable/activity/analytics?range=daily&amp;date=2026-09-25</font>", styles["Body"]))
story.append(Spacer(1, 4))
story.append(code_block(
'''{
  "success": true,
  "range": "daily",
  "startDate": "2026-09-25",
  "endDate": "2026-09-25",
  "hasWearableConnected": true,
  "goals": {
    "steps": 7500,
    "activeMinutes": 21.4,
    "cardioMinutes": 21.4,
    "strengthSessionsPerWeek": 2
  },
  "days": [
    {
      "date": "2026-09-25",
      "device": {
        "steps": 8000,
        "activeMinutes": 52,
        "caloriesBurned": 650
      },
      "manual": {
        "cardioMinutes": 0,
        "totalExerciseMinutes": 45,
        "sessionsCount": 1,
        "caloriesBurned": 280,
        "strengthSessionsLast7Days": 1
      },
      "movementMinutes": { "actual": 52, "goal": 21.4, "source": "device" },
      "goals": { "steps": 7500, "activeMinutes": 21.4, "cardioMinutes": 21.4, "strengthSessionsPerWeek": 2 },
      "activityScore": 83.3,
      "calendarBand": "good",
      "insight": {
        "band": "good",
        "headline": "Good activity day",
        "overallSummary": "Good activity day - your Activity Score is 83/100. Short on Strength.",
        "topGaps": [
          { "signal": "strengthSessions", "label": "Strength", "source": "manual",
            "message": "Strength was 50% of your target (1 vs 2)." }
        ],
        "recommendations": [
          { "action": "Get in a logged strength/resistance session - gym, bodyweight training, or resistance bands",
            "estimatedPointGain": 16.7 }
        ],
        "disclaimer": "This is a wellness insight based on your logged activity, not medical or fitness-coaching advice."
      }
    }
  ]
}'''
))

story.append(h2("Important: insight is NOT always present"))
story.append(Paragraph(
    "<font face='Courier'>insight</font> is only computed for a true single-day lookup "
    "(<font face='Courier'>?date=</font> or a one-day range). For a multi-day range (e.g. a full "
    "calendar month), each day in <font face='Courier'>days[]</font> will have "
    "<font face='Courier'>activityScore</font> and <font face='Courier'>calendarBand</font> only — "
    "<font face='Courier'>insight</font> will be <font face='Courier'>undefined</font>. This is deliberate "
    "(performance — the calendar view only needs the score dot, not 30 rule-based computations per request). "
    "<b>Do not assume insight exists — always check for it before rendering.</b>",
    styles["Callout"]
))

# ---------------- 4. Weekly/monthly ----------------
story.append(h1("4. Response Shape — Weekly / Monthly / Yearly"))
story.append(Paragraph(
    "Same call with <font face='Courier'>range=weekly</font> / <font face='Courier'>monthly</font> / "
    "<font face='Courier'>yearly</font> returns <font face='Courier'>summary[]</font> instead of "
    "<font face='Courier'>days[]</font>. Each bucket's <font face='Courier'>insight</font> is built from that "
    "period's AVERAGES, not any single day — read it as \"on an average day this period\".",
    styles["Body"]
))
story.append(code_block(
'''{
  "success": true,
  "range": "weekly",
  "startDate": "2026-09-21",
  "endDate": "2026-09-26",
  "hasWearableConnected": true,
  "goals": { "steps": 7500, "activeMinutes": 21.4, "cardioMinutes": 21.4, "strengthSessionsPerWeek": 2 },
  "summary": [
    {
      "period": "2026-W39",
      "daysLogged": 5,
      "avgSteps": 7200,
      "avgActiveMinutes": 18,
      "avgCardioMinutes": 30,
      "avgCaloriesBurned": 950,
      "avgActivityScore": 62,
      "insight": { "band": "low", "headline": "...", "overallSummary": "...", "topGaps": [ ], "recommendations": [ ] }
    }
  ]
}'''
))

# ---------------- 5. Field cheat sheet ----------------
story.append(PageBreak())
story.append(h1("5. Field-by-Field Cheat Sheet — What To Use Where"))
field_rows = [
    [cell("<b>Field</b>"), cell("<b>Where to use it on the app</b>"), cell("<b>Notes</b>")],
    [cell("<font face='Courier'>activityScore</font>"), cell("Ring/gauge on the Activity screen, calendar dot value"),
     cell("Single source of truth — same number the Health Score uses internally. Never recompute on device.")],
    [cell("<font face='Courier'>calendarBand</font>"), cell("Color of the calendar dot: optimal/good/low"),
     cell("optimal &gt;=85, good &gt;=70, low below 70")],
    [cell("<font face='Courier'>movementMinutes.actual/.goal</font>"), cell("Progress bar for \"Movement\" / \"Cardio\" tile"),
     cell("This IS the number that fed the score — do not also show device.activeMinutes and manual.cardioMinutes "
          "as if they were two separate progress bars, that recreates the double-count visually.")],
    [cell("<font face='Courier'>movementMinutes.source</font>"), cell("Small badge/icon: \"from your watch\" vs \"from your logged workout\""),
     cell("Purely informational, does not affect the number shown.")],
    [cell("<font face='Courier'>device.steps</font>"), cell("Steps tile"),
     cell("Always device-only. If <font face='Courier'>hasWearableConnected</font> is false, treat as \"no data\", not \"0 steps\".")],
    [cell("<font face='Courier'>manual.strengthSessionsLast7Days</font>"), cell("Strength tile actual value"),
     cell("Rolling 7-day count, not \"did they train today\" — a rest day is expected and correct.")],
    [cell("<font face='Courier'>goals.*</font>"), cell("Target values / max of progress bars"),
     cell("Personalized by age + goal type. Same for every day in the response — fetch once, do not expect it to change per day.")],
    [cell("<font face='Courier'>insight.overallSummary</font>"), cell("Headline text at the top of the Activity detail screen"),
     cell("Human-readable one-liner, safe to render directly.")],
    [cell("<font face='Courier'>insight.topGaps[]</font>"), cell("\"Where you fell short\" list/cards"),
     cell("Up to 3 items, worst signal first. Each has a ready-to-render <font face='Courier'>message</font>.")],
    [cell("<font face='Courier'>insight.recommendations[]</font>"), cell("\"What to do next\" cards, sorted best-impact first"),
     cell("<font face='Courier'>estimatedPointGain</font> is a real computed number — safe to show as \"+X points\".")],
    [cell("<font face='Courier'>insight.disclaimer</font>"), cell("Small print under any insight card"),
     cell("Must be shown wherever insight text is shown — not medical/coaching advice.")],
    [cell("<font face='Courier'>hasWearableConnected</font>"), cell("Whether to show a \"connect a device\" prompt"),
     cell("Top-level field, applies to the whole response, not per-day.")],
]
story.append(field_table(field_rows, [95, 170, 225]))

# ---------------- 6. Do / Don't ----------------
story.append(h1("6. Do / Don't for the App Team"))
story.append(h2("Do"))
story.append(bullets([
    "Render <font face='Courier'>movementMinutes</font> as ONE progress bar, using its own "
    "<font face='Courier'>source</font> for the badge.",
    "Always null-check <font face='Courier'>insight</font> before rendering (see Section 3).",
    "Treat <font face='Courier'>activityScore</font> as read-only, coming from the backend.",
    "Cache-bust: this endpoint is server-side cached for 5 minutes per user/range/date — if you log a "
    "new workout and immediately re-fetch, the score may take up to 5 minutes to reflect it.",
]))
story.append(h2("Don't"))
story.append(bullets([
    "Don't add <font face='Courier'>device.activeMinutes</font> and <font face='Courier'>manual.cardioMinutes</font> "
    "together in the UI — that recreates the exact bug this change fixed.",
    "Don't add <font face='Courier'>device.caloriesBurned</font> and <font face='Courier'>manual.caloriesBurned</font> "
    "together for a period total — use the backend's <font face='Courier'>avgCaloriesBurned</font> instead, "
    "which already applies the same device-priority rule.",
    "Don't assume <font face='Courier'>insight</font> is always present.",
]))

# ---------------- 7. Known limitation ----------------
story.append(h1("7. Known Limitation (Not Yet Fixed)"))
story.append(Paragraph(
    "If a workout is synced from a wearable (e.g. Apple Watch) via "
    "<font face='Courier'>POST /api/exercise/log</font> (rather than the OS-level background sync), it is "
    "currently still labeled <font face='Courier'>source: \"manual\"</font> in the response, because the "
    "backend has no explicit signal telling it the log came from a device. The NUMBERS are correct either way "
    "(no double-counting) — only the <font face='Courier'>source</font> label can be misleading in this one case. "
    "A fix is planned (either the app sending an explicit <font face='Courier'>origin</font> field, or routing "
    "device workouts through the OS-sync endpoint instead). Do not build UI logic that depends on "
    "<font face='Courier'>source</font> being 100% accurate for Apple Watch strength/cardio sessions until this "
    "is resolved.",
    styles["Callout"]
))

story.append(Spacer(1, 16))
story.append(hr())
story.append(small("Generated for internal use — AI-HealthCare backend team. Reflects the Staging branch as of the date this PDF was produced."))

doc.build(story)
print("PDF written to:", OUT)
