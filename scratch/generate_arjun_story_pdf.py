# -*- coding: utf-8 -*-
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)

OUT = "C:/Users/USER/Desktop/AI-HealthCare/scratch/Arjun-Story-Recovery-Score-Simple.pdf"

NAVY = colors.HexColor("#171a2b")
ACCENT = colors.HexColor("#7c5cff")
GOOD = colors.HexColor("#12946b")
GOOD_BG = colors.HexColor("#e2f6ee")
WARN = colors.HexColor("#a1670a")
WARN_BG = colors.HexColor("#fbf0da")
BAD = colors.HexColor("#c8383f")
BAD_BG = colors.HexColor("#fbe6e6")
DARKBAD = colors.HexColor("#8f2530")
DARKBAD_BG = colors.HexColor("#f3d6d9")
GREY = colors.HexColor("#565b78")
LIGHTBG = colors.HexColor("#f3f4fa")
BORDER = colors.HexColor("#dee1f0")

BAND_COLORS = {
    "Optimal Recovery": (GOOD, GOOD_BG),
    "Low Recovery": (WARN, WARN_BG),
    "Very Low Recovery": (BAD, BAD_BG),
    "Moderate Recovery": (colors.HexColor("#3d6fd1"), colors.HexColor("#e3ecfb")),
}

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="DocTitle", fontSize=25, leading=31, textColor=NAVY, fontName="Helvetica-Bold", spaceAfter=6))
styles.add(ParagraphStyle(name="DocSubtitle", fontSize=13, leading=18, textColor=GREY, fontName="Helvetica"))
styles.add(ParagraphStyle(name="H1", fontSize=17, leading=22, textColor=NAVY, fontName="Helvetica-Bold", spaceBefore=16, spaceAfter=8))
styles.add(ParagraphStyle(name="StageTitle", fontSize=14, leading=18, textColor=NAVY, fontName="Helvetica-Bold", spaceAfter=3))
styles.add(ParagraphStyle(name="StageWhen", fontSize=9.5, leading=12, textColor=GREY, fontName="Helvetica-Oblique", spaceAfter=6))
styles.add(ParagraphStyle(name="Body", fontSize=10.4, leading=15.5, textColor=NAVY, fontName="Helvetica", spaceAfter=8))
styles.add(ParagraphStyle(name="Callout", fontSize=10.2, leading=15, textColor=NAVY, fontName="Helvetica-Oblique", spaceAfter=8, leftIndent=8))
styles.add(ParagraphStyle(name="ScoreNum", fontSize=32, leading=36, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle(name="BandLabel", fontSize=11, leading=14, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle(name="CardText", fontSize=9.6, leading=13.5, textColor=NAVY, fontName="Helvetica"))
styles.add(ParagraphStyle(name="CardBold", parent=styles["CardText"], fontName="Helvetica-Bold"))
styles.add(ParagraphStyle(name="TableHead", fontSize=9.3, leading=12, textColor=colors.white, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle(name="TableCell", fontSize=9.3, leading=13, textColor=NAVY, fontName="Helvetica"))
styles.add(ParagraphStyle(name="Small", fontSize=8.3, leading=11.5, textColor=GREY, fontName="Helvetica-Oblique"))
styles.add(ParagraphStyle(name="Footer", fontSize=8, textColor=GREY, alignment=1))

story = []

def h1(text):
    story.append(HRFlowable(width="100%", thickness=1.2, color=ACCENT, spaceBefore=2, spaceAfter=2))
    story.append(Paragraph(text, styles["H1"]))

def body(text):
    story.append(Paragraph(text, styles["Body"]))

def callout(text):
    story.append(Spacer(1, 3))
    story.append(Paragraph("POINT TO REMEMBER: " + text, styles["Callout"]))
    story.append(Spacer(1, 3))

def make_table(header, rows, col_widths, header_bg=NAVY):
    data = [[Paragraph(h, styles["TableHead"]) for h in header]] + \
           [[Paragraph(str(c), styles["TableCell"]) for c in r] for r in rows]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), header_bg),
        ('GRID', (0, 0), (-1, -1), 0.6, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 7), ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]
    for i in range(1, len(rows) + 1):
        if i % 2 == 0:
            style.append(('BACKGROUND', (0, i), (-1, i), LIGHTBG))
    t.setStyle(TableStyle(style))
    story.append(t)
    story.append(Spacer(1, 10))

def score_card(day_label, when, story_text, score, band, msg, accent, accent_bg):
    story.append(Paragraph(day_label, styles["StageTitle"]))
    story.append(Paragraph(when, styles["StageWhen"]))
    story.append(Paragraph(story_text, styles["Body"]))

    left = [Paragraph(str(score), styles["ScoreNum"]), Paragraph("out of 100", styles["Small"])]
    right = [
        Paragraph(band.upper(), ParagraphStyle(name="bl_" + band, parent=styles["BandLabel"], textColor=accent)),
        Spacer(1, 4),
        Paragraph(msg, styles["CardText"]),
    ]
    card = Table([[left, right]], colWidths=[3.2*cm, 13.3*cm])
    card.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), accent_bg),
        ('BOX', (0, 0), (-1, -1), 1, accent),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (0, 0), 14), ('LEFTPADDING', (1, 0), (1, 0), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ('TOPPADDING', (0, 0), (-1, -1), 12), ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(card)
    story.append(Spacer(1, 14))

# ============================================================
# COVER
# ============================================================
story.append(Spacer(1, 3*cm))
story.append(Paragraph("Arjun's Story", styles["DocTitle"]))
story.append(Paragraph("Watching Recovery Score work across 90 real days - no code, no formulas, just the story", styles["DocSubtitle"]))
story.append(Spacer(1, 1*cm))
story.append(HRFlowable(width="40%", thickness=2, color=ACCENT, hAlign="LEFT"))
story.append(Spacer(1, 0.4*cm))
story.append(Paragraph("For designers and anyone who wants to see the feature in action, not just described.", styles["Body"]))
story.append(Spacer(1, 6*cm))
story.append(Paragraph("Take Health - Internal Product Documentation", styles["Footer"]))
story.append(PageBreak())

# ============================================================
# INTRO
# ============================================================
h1("Meet Arjun")
body("""Arjun wears his Apple Watch every day. Over 90 days, his body went through three very different
phases - and we ran our real Recovery Score system on his real (simulated) data for each one, exactly
as it would run for a real user. Here's what he actually would have seen on his phone at five different
moments.""")

make_table(
    ["Time period", "What was happening"],
    [
        ["Day 90 to Day 31 (60 days)", "A calm, healthy stretch. Normal sleep, normal heart rate, no stress."],
        ["Day 30 to Day 15 (15 days)", "A busy period at work. Sleep got shorter, heart rate crept up a little."],
        ["Day 14 to Day 1 (14 days)", "Arjun caught an illness. Clearly disrupted sleep and heart signals."],
        ["Today", "Arjun is starting to feel a bit better - but is he really back to normal?"],
    ],
    [5*cm, 11.5*cm]
)

story.append(PageBreak())

# ============================================================
# STAGE 1
# ============================================================
h1("Five Moments in Arjun's Journey")

score_card(
    "Moment 1: An Unusually Great Day",
    "Day -40, deep in the healthy period",
    "This particular day, Arjun happened to sleep especially well and his body was in top form - even "
    "better than his own already-healthy normal.",
    100, "Optimal Recovery",
    "Arjun's body is clearly primed. The app would encourage a harder workout today if he had one planned.",
    *BAND_COLORS["Optimal Recovery"]
)

score_card(
    "Moment 2: A Perfectly Normal Healthy Day",
    "Day -45, also in the healthy period",
    "This is an ordinary day during the SAME healthy stretch - nothing wrong at all, just an average day "
    "for Arjun.",
    65, "Low Recovery",
    "Surprising, right? An average, totally fine day scored 65, not 90+.",
    *BAND_COLORS["Low Recovery"]
)

callout("""This is the single most important thing to understand about Recovery Score: "Optimal" doesn't
mean "healthy." It means "better than your own typical day." A perfectly normal, nothing-wrong day for
YOU will usually land in the middle of the scale, not at the top - because the app is comparing today
to your own best days too, not just to "is something wrong." Designers: don't assume a "fine" day should
always show green. Most days for most people will land in the Moderate/Low range - that's expected and
correct, not something to fix.""")

story.append(PageBreak())

score_card(
    "Moment 3: Work Stress Builds Up",
    "Day -20",
    "Arjun has been sleeping less and his heart rate has been a little higher than usual for a couple of "
    "weeks now.",
    49, "Very Low Recovery",
    "The app can already see the shift happening, even though Arjun hasn't gotten sick yet.",
    *BAND_COLORS["Very Low Recovery"]
)

score_card(
    "Moment 4: Arjun Gets Sick",
    "Day -5, mid-illness",
    "Arjun's sleep is badly disrupted and his heart rate is clearly elevated - classic signs of the body "
    "fighting something off.",
    44, "Very Low Recovery",
    "The app recommends rest, not training, and the message tone stays calm and non-alarming.",
    *BAND_COLORS["Very Low Recovery"]
)

score_card(
    "Moment 5: Today - Is Arjun Actually Better?",
    "Today",
    "Arjun's heart rate signals have improved slightly compared to how bad they were during the illness. "
    "A simpler app might see this small improvement and excitedly report a much higher score.",
    63, "Low Recovery",
    "Take Health's app instead says: better than a few days ago, but still below his real normal - "
    "\"Take it easier today.\"",
    *BAND_COLORS["Low Recovery"]
)

callout("""Why didn't Today score much higher, given the improvement? Because the app doesn't just look
at "better than yesterday" - it also checks "how does this compare to my TRUE, long-term normal?" Arjun's
long-term normal (from the healthy 60-day stretch) is still far above where he is now. The app
deliberately holds the score back rather than let a small improvement look like a full recovery. This is
the app being honest instead of falsely encouraging.""")

story.append(PageBreak())

# ============================================================
# THE LOGIC, IN PLAIN WORDS
# ============================================================
h1("The Logic Behind It - In Plain Words")
body("Here is everything the app actually does, with no formulas - just five simple ideas working together:")

make_table(
    ["#", "Idea", "In plain words"],
    [
        ["1", "Compare to YOUR normal, not everyone's",
         "A resting heart rate of 68 is great for one person and concerning for another. The app learns what's normal specifically for you."],
        ["2", "Look at two time windows, not one",
         "\"How am I doing lately\" (last 2 weeks) AND \"what's my real, deeper normal\" (last 3 months). Comparing both is what caught Arjun's false-improvement moment."],
        ["3", "Combine multiple body signals",
         "Heart rhythm, breathing, sleep quality, and recent activity load - all blended into one number, so no single noisy reading dominates the result."],
        ["4", "A safety net, separate from the score",
         "Fixed medical reference ranges are checked independently of your personal history - so a chronically low reading never hides behind a \"looks fine for you\" score."],
        ["5", "An honesty check on the final number",
         "If the deeper 3-month picture is still clearly off, the app won't let a short-term uptick be reported as full recovery - exactly what happened in Arjun's \"Today\" moment."],
    ],
    [1*cm, 4.3*cm, 11.2*cm]
)

h1("What This Means for Designers")
body("A few practical takeaways for building the UI around this feature:")
make_table(
    ["Design consideration", "Why"],
    [
        ["Most days will land in the middle of the scale (Moderate/Low), not the extremes.",
         "As shown in Moment 2 - \"normal\" doesn't mean \"top score.\" Don't design around users seeing green every day."],
        ["The score and the message can occasionally feel slightly cautious even when a user feels fine.",
         "This is deliberate - see Moment 5. The copy should always explain WHY (\"still below your usual range\"), never just show a number with no context."],
        ["New users won't see a score at all for their first several days.",
         "The app needs real history to compare against - it will show a \"Building your baseline\" state instead of guessing."],
        ["A capped/held-back score should be explainable, not just shown.",
         "Users may ask \"why is this lower than I expected\" - the UI should have room for a one-line reason, exactly like Arjun's Moment 5 message."],
    ],
    [7.5*cm, 9*cm]
)

story.append(Spacer(1, 0.5*cm))
story.append(HRFlowable(width="100%", thickness=0.8, color=BORDER))
story.append(Spacer(1, 0.3*cm))
story.append(Paragraph(
    "This document uses real output from Take Health's actual Recovery Score system, run against a "
    "simulated 90-day account created for testing. Companion documents: \"Recovery Score Explained\" "
    "(industry background) and \"Recovery Score Technical Reference\" (engineering detail).",
    styles["Small"]
))

doc = SimpleDocTemplate(
    OUT, pagesize=A4,
    topMargin=2.2*cm, bottomMargin=2*cm, leftMargin=2*cm, rightMargin=2*cm,
    title="Arjun's Story - Recovery Score", author="Take Health"
)
doc.build(story)
print("PDF created:", OUT)
