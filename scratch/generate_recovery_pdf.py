# -*- coding: utf-8 -*-
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, ListFlowable, ListItem
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

OUT = "C:/Users/USER/Desktop/AI-HealthCare/scratch/Recovery-Score-Explained.pdf"

# ---------- Palette ----------
NAVY = colors.HexColor("#171a2b")
ACCENT = colors.HexColor("#7c5cff")
GOOD = colors.HexColor("#12946b")
WARN = colors.HexColor("#a1670a")
BAD = colors.HexColor("#c8383f")
GREY = colors.HexColor("#565b78")
LIGHTBG = colors.HexColor("#f3f4fa")
BORDER = colors.HexColor("#dee1f0")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="DocTitle", fontSize=26, leading=32, textColor=NAVY, fontName="Helvetica-Bold", spaceAfter=6))
styles.add(ParagraphStyle(name="DocSubtitle", fontSize=13, leading=18, textColor=GREY, fontName="Helvetica"))
styles.add(ParagraphStyle(name="H1", fontSize=17, leading=22, textColor=NAVY, fontName="Helvetica-Bold", spaceBefore=18, spaceAfter=8))
styles.add(ParagraphStyle(name="H2", fontSize=13, leading=17, textColor=ACCENT, fontName="Helvetica-Bold", spaceBefore=12, spaceAfter=6))
styles.add(ParagraphStyle(name="Body", fontSize=10.3, leading=15.5, textColor=NAVY, fontName="Helvetica", spaceAfter=8))
styles.add(ParagraphStyle(name="BodyBold", parent=styles["Body"], fontName="Helvetica-Bold"))
styles.add(ParagraphStyle(name="Callout", fontSize=10.3, leading=15, textColor=NAVY, fontName="Helvetica-Oblique", spaceAfter=8, leftIndent=10, borderColor=ACCENT, borderWidth=0, backColor=LIGHTBG))
styles.add(ParagraphStyle(name="TableHead", fontSize=9.5, leading=12, textColor=colors.white, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle(name="TableCell", fontSize=9.3, leading=13, textColor=NAVY, fontName="Helvetica"))
styles.add(ParagraphStyle(name="TableCellBold", parent=styles["TableCell"], fontName="Helvetica-Bold"))
styles.add(ParagraphStyle(name="Small", fontSize=8.5, leading=12, textColor=GREY, fontName="Helvetica-Oblique"))
styles.add(ParagraphStyle(name="Footer", fontSize=8, textColor=GREY, alignment=TA_CENTER))

story = []

def h1(text):
    story.append(HRFlowable(width="100%", thickness=1.2, color=ACCENT, spaceBefore=2, spaceAfter=2))
    story.append(Paragraph(text, styles["H1"]))

def h2(text):
    story.append(Paragraph(text, styles["H2"]))

def body(text):
    story.append(Paragraph(text, styles["Body"]))

def callout(text):
    story.append(Spacer(1, 4))
    story.append(Paragraph("TIP:  " + text, styles["Callout"]))
    story.append(Spacer(1, 4))

def bullets(items):
    story.append(ListFlowable(
        [ListItem(Paragraph(i, styles["Body"]), leftIndent=6, spaceAfter=4) for i in items],
        bulletType='bullet', start='•', leftIndent=14
    ))

def make_table(header, rows, col_widths, header_bg=NAVY):
    data = [[Paragraph(h, styles["TableHead"]) for h in header]] + \
           [[Paragraph(str(c), styles["TableCell"]) for c in r] for r in rows]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), header_bg),
        ('GRID', (0, 0), (-1, -1), 0.6, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
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
story.append(Spacer(1, 3.5*cm))
story.append(Paragraph("Recovery Score", styles["DocTitle"]))
story.append(Paragraph("How it works, what it's based on, and how it compares to Whoop, Oura, and Garmin", styles["DocSubtitle"]))
story.append(Spacer(1, 1*cm))
story.append(HRFlowable(width="40%", thickness=2, color=ACCENT, hAlign="LEFT"))
story.append(Spacer(1, 0.5*cm))
story.append(Paragraph("A plain-language guide  -  no coding background needed.", styles["Body"]))
story.append(Paragraph("Prepared for the Take Health product & app team.", styles["Small"]))
story.append(Spacer(1, 6*cm))
story.append(Paragraph("Take Health - Internal Product Documentation", styles["Footer"]))
story.append(PageBreak())

# ============================================================
# SECTION 1  -  What is Recovery Score
# ============================================================
h1("1. What Is a Recovery Score?")
body("""Think of Recovery Score as a daily "battery level" for your body  -  a single number from 0 to 100
that answers one question: <b>how ready is your body for today?</b>""")
body("""It isn't a mood guess or a fitness-app gimmick. It's built from real signals your Apple Watch (or
other wearable) collects overnight and during the day  -  your heart, your breathing, your sleep, and
how hard you pushed yourself yesterday. The app combines these into one number, plus a plain-English
explanation of what that number means and why.""")
callout("""Every major wearable brand  -  Whoop's "Recovery", Oura's "Readiness", Garmin's "Body Battery"  - 
is really answering the same question, just with a different name and their own private formula.""")

# ============================================================
# SECTION 2  -  The Science
# ============================================================
h1("2. The Four Signals  -  and What Each One Actually Means")
body("""Take Health's Recovery Score is built from four real, measurable body signals. Here's what each
one is and why it matters  -  in plain terms, no jargon.""")

make_table(
    ["Signal", "What it actually is", "Why it matters"],
    [
        ["Heart Rate Variability (HRV)",
         "The tiny variation in time between each heartbeat (measured in milliseconds).",
         "A well-rested, well-recovered body has MORE variation between beats. It's the single strongest signal science has found for daily readiness."],
        ["Resting Heart Rate (RHR)",
         "Your heart rate while you're completely at rest, usually measured overnight.",
         "When your body is fighting stress, illness, or fatigue, your heart works a little harder even at rest  -  RHR creeps up."],
        ["Respiratory Rate (RR)",
         "How many breaths you take per minute while sleeping.",
         "It normally stays very steady night to night. An unexpected shift up or down is often an early stress or illness signal."],
        ["Sleep",
         "How long you slept, how efficiently (vs. tossing and turning), and how consistent your sleep schedule is.",
         "Sleep is when the body actually does most of its physical repair work."],
        ["Yesterday's Activity",
         "How much you moved and exercised in the last few days.",
         "A hard workout yesterday is expected to lower today's recovery a bit  -  that's normal, not a bad sign."],
    ],
    [4.3*cm, 6.3*cm, 6.4*cm]
)

h2("The Most Important Idea: \"Normal\" Is Different for Everyone")
body("""A resting heart rate of 68 might be perfectly healthy for one person and unusually high for
another. So instead of comparing everyone to one fixed number, Take Health compares you <b>only to
your own recent history</b>  -  this is called your <b>personal baseline</b>.""")

# ============================================================
# SECTION 3  -  Baseline explained simply
# ============================================================
h1("3. Your Personal Baseline  -  Explained Simply")
body("""Imagine you check your own resting heart rate every single day for a few months. Over time,
you'd notice it usually sits in a certain range  -  say, 55 to 62 beats per minute. That range is
YOUR "normal." Take Health calculates this automatically, using two time windows:""")

make_table(
    ["Window", "What it covers", "What it's used for"],
    [
        ["Recent Baseline (14 days)", "Your last two weeks of data.",
         "Shows how you're doing lately  -  did last night look normal for you recently?"],
        ["Long-Term Baseline (90 days)", "Your last three months of data.",
         "Shows your deeper, more stable \"true normal\"  -  protects against being fooled by a temporarily bad patch."],
    ],
    [4.6*cm, 5.6*cm, 6.8*cm]
)

callout("""Why two windows and not one? Imagine someone was unwell for two weeks and their HRV dropped.
If we only compared today to that recent bad two-week window, a small improvement would look like
"amazing progress"  -  even though they're still far from their real, long-term healthy normal.
Comparing against BOTH windows catches this. This exact idea is publicly described by Oura
(14-day vs. long-term) and Polar (28-day baseline).""")

# ============================================================
# SECTION 4  -  Industry comparison
# ============================================================
h1("4. How Other Brands Do It")
body("""None of the major wearable brands publish their exact formula  -  it's treated as a trade secret
industry-wide. This isn't unique to us; it's confirmed by independent research. What IS publicly known
is which signals each brand uses and roughly how they're compared:""")

make_table(
    ["Brand", "What they call it", "Publicly known approach"],
    [
        ["Whoop", "Recovery Score",
         "Uses HRV, resting heart rate, respiratory rate, and sleep. Whoop has confirmed HRV carries the most weight, but the exact percentages are never published."],
        ["Oura", "Readiness Score",
         "Compares HRV, resting heart rate, temperature, sleep, and activity  -  each against a 14-day recent average vs. a longer-term reference. Same two-window idea Take Health uses."],
        ["Garmin (powered by Firstbeat)", "Body Battery / HRV Status",
         "The only brand with real published science behind it (Firstbeat has 20+ years of published research). Requires about 3 weeks of data before it will even show a status  -  it won't guess with too little history."],
        ["Take Health", "Recovery Score",
         "Uses HRV, resting heart rate, respiratory rate, sleep, and recent activity load  -  compared against your own 14-day and 90-day personal baseline, exactly like the industry pattern above."],
    ],
    [3.7*cm, 3.3*cm, 10*cm]
)

h2("An Honest Note")
body("""Because no company publishes its real formula, an independent 2025 research study found that
the SAME night's data can score 20+ points differently between Oura and Whoop. There is no single
"correct" formula in this industry  -  every brand, including us, is making a reasonable, evidence-informed
judgment call. Where we differ from most competitors is that we say so plainly, instead of presenting
our numbers as scientifically certain.""")

story.append(PageBreak())

# ============================================================
# SECTION 5  -  Our Weightage
# ============================================================
h1("5. The Weightage  -  Who Gets How Much Say in the Final Score")
body("""Here is exactly how Take Health combines the signals into one final number. Every step below
uses real values from your data  -  nothing here is randomly generated.""")

h2("Step 1  -  Physiology (your body's internal signals)")
make_table(
    ["Signal", "Weight", "Why"],
    [
        ["Heart Rate Variability (HRV)", "50%", "The strongest individual predictor of recovery, per Whoop's own public disclosure and academic research."],
        ["Resting Heart Rate (RHR)", "40%", "Second-strongest signal  -  a direct, simple marker of how hard your heart is working at rest."],
        ["Respiratory Rate (RR)", "10%", "A supporting/confirming signal, not a primary driver  -  matches Polar's public description of breathing rate as their smallest-weighted input."],
    ],
    [6*cm, 2.5*cm, 8.5*cm]
)

h2("Step 2  -  Combining Physiology with Sleep")
make_table(
    ["Component", "Weight", "Why"],
    [
        ["Physiology (Step 1 result)", "70%", "Your heart/breathing signals are the most direct readiness indicators."],
        ["Sleep (duration, efficiency, schedule consistency)", "30%", "Important, but treated as supporting evidence rather than the main driver."],
    ],
    [7*cm, 2.5*cm, 7.5*cm]
)

h2("Step 3  -  Yesterday's Activity (a modifier, not a full component)")
body("""Unlike the signals above, activity doesn't get its own fixed percentage. Instead, it only ever
<b>subtracts</b> from the score  -  and only when your recent activity has clearly been heavier than your
usual pattern. Being very inactive never adds bonus points; it stays neutral.""")

h2("Full Worked Example")
make_table(
    ["Step", "Calculation", "Result"],
    [
        ["HRV sub-score", "based on today vs. your 14-day and 90-day baseline", "e.g. 45 / 100"],
        ["RHR sub-score", "based on today vs. your 14-day and 90-day baseline", "e.g. 70 / 100"],
        ["RR sub-score", "based on today vs. your 14-day baseline", "e.g. 65 / 100"],
        ["Physiology", "(50% x HRV) + (40% x RHR) + (10% x RR)", "55.0"],
        ["Sleep sub-score", "based on duration + efficiency + consistency", "e.g. 88 / 100"],
        ["Recovery Base", "(70% x Physiology) + (30% x Sleep)", "64.9"],
        ["Activity adjustment", "small penalty if recent load is above your usual pattern", "e.g. -3"],
        ["FINAL RECOVERY SCORE", "Recovery Base + Activity adjustment", "<b>62 -> \"Low Recovery\"</b>"],
    ],
    [4.3*cm, 8*cm, 4.7*cm]
)

callout("""Important honesty note: the exact percentages above (50/40/10, 70/30) are Take Health's own
starting-point judgment calls  -  grounded in the same signals and general direction the big brands
publicly describe, but not yet proven correct specifically for our users. No competitor has proven
theirs either (see Section 4). Once we have real usage data, these numbers can be fine-tuned  -  the
structure and logic will not need to change, only the specific percentages.""")

# ============================================================
# SECTION 6  -  Score bands
# ============================================================
h1("6. What the Final Number Means")
make_table(
    ["Score Range", "Label", "What it suggests"],
    [
        ["85 - 100", "Optimal Recovery", "Your body is well-rested and primed  -  a good day for harder training if planned."],
        ["70 - 84", "Moderate Recovery", "Normal day. Light-to-moderate activity is fine."],
        ["50 - 69", "Low Recovery", "Your signals suggest easing up  -  lighter movement, more rest."],
        ["0 - 49", "Very Low Recovery", "Clearly below your normal range  -  today favors rest over training."],
    ],
    [3.5*cm, 4*cm, 9.5*cm]
)
body("""These exact cut-offs (85 / 70 / 50) are not invented  -  they match Oura's own publicly stated
Readiness tiers (85+ = Optimal, 70-84 = Good, under 70 = Pay Attention), extended to four tiers to match
Take Health's product design.""")

# ============================================================
# SECTION 7  -  What makes this trustworthy
# ============================================================
h1("7. Built-In Safety Nets  -  What Makes This Different")

h2("A) The Safety Floor (independent of your personal score)")
body("""There's one real weakness in EVERY brand's approach, including ours: comparing you only to
"your own normal" can't catch the case where your own normal has been unhealthy the whole time you've
been measured. So Take Health adds a second, completely separate check using fixed medical reference
ranges (the same ones doctors use)  -  regardless of your personal history:""")
bullets([
    "HRV below 20ms",
    "Resting heart rate above 100 or below 40 bpm",
    "Blood oxygen (SpO2) below 92%",
])
body("""If any of these trigger, you'll see a plain warning  -  even on a day your personal score looks
fine. The wording is always careful and non-alarming (e.g. \"outside the typical range for adults\"),
never a diagnosis.""")

h2("B) The Recovery Ceiling")
body("""If your recent trend looks like it's improving, but your longer 90-day history is still clearly
below your genuine healthy normal, the app caps the score rather than letting a short-term uptick look
like full recovery. This directly solves the exact "false improvement" problem described in Section 3.""")

h2("C) Honest \"Not Enough Data Yet\" Handling")
body("""A brand-new user's very first day never shows a misleading \"0\"  -  it correctly shows
\"Building your baseline\" until there's enough history to compare against, matching how Garmin
requires about three weeks before showing any HRV status at all.""")

story.append(PageBreak())

# ============================================================
# SECTION 8  -  Roadmap
# ============================================================
h1("8. What's Already Built vs. What Comes Next")
make_table(
    ["Already Live", "Still To Calibrate", "Genuinely Not Possible Yet"],
    [
        ["HRV, RHR, RR, Sleep, Activity  -  all 5 signals",
         "Exact weight percentages (needs real usage data)",
         "Sleep \"Continuity\"  -  exact count of night-time wake-ups (Apple Watch doesn't expose this yet)"],
        ["Personal 14-day & 90-day baselines",
         "Recovery Ceiling threshold",
         ""],
        ["Safety-floor medical warnings",
         "",
         ""],
        ["Recommendations + activity suggestions",
         "",
         ""],
        ["Pattern detection (e.g. \"low activity after 2 hard days\")",
         "",
         ""],
    ],
    [6.4*cm, 5.6*cm, 4.1*cm]
)

body("""<b>In short:</b> the mechanism is complete and reflects the same general approach used by the
established players in this space  -  grounded in the same real signals, the same personal-baseline
philosophy, and additional safety checks most competitors don't disclose having. The specific tuning
numbers are placeholders by design, waiting on real user data before being called final.""")

story.append(Spacer(1, 0.6*cm))
story.append(HRFlowable(width="100%", thickness=0.8, color=BORDER))
story.append(Spacer(1, 0.3*cm))
story.append(Paragraph(
    "Sources: WHOOP for Developers - Polar Nightly Recharge documentation - Oura Readiness Score blog - "
    "Firstbeat Stress &amp; Recovery whitepaper - Garmin HRV Status blog - \"Readiness, recovery, and strain: "
    "an evaluation of composite health scores in consumer wearables\" (2025 peer-reviewed study).",
    styles["Small"]
))

doc = SimpleDocTemplate(
    OUT, pagesize=A4,
    topMargin=2.2*cm, bottomMargin=2*cm, leftMargin=2*cm, rightMargin=2*cm,
    title="Recovery Score Explained", author="Take Health"
)
doc.build(story)
print("PDF created:", OUT)
