const HealthReport = require('../models/HealthReport');
const FCMToken     = require('../models/FCMToken');
const NudgeLog     = require('../models/NudgeLog');
const User         = require('../models/User');
const { sendToUser } = require('./fcmService');
const { makeAnthropicRequest, CLAUDE_HAIKU_MODEL } = require('./aiService');

const BATCH_SIZE  = 50;
const BATCH_DELAY = 2 * 60 * 1000; // 2 minutes between batches

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── AI nudge message generator ──────────────────────────────────────────────
const generateNudgeMessage = async (userName, triggerType, reportData) => {
  try {
    const { reportType, abnormalMetrics, oldScore, newScore } = reportData;

    let context = '';
    if (triggerType === 'followup_3d') {
      const metricList = abnormalMetrics.slice(0, 3)
        .map(m => `${m.name} (${m.value} ${m.unit}, status: ${m.status})`)
        .join(', ');
      context = `3 days ago the user uploaded a ${reportType} report. Abnormal metrics: ${metricList}.`;
    } else if (triggerType === 'score_drop') {
      context = `User's health score dropped from ${oldScore} to ${newScore} in their latest report.`;
    } else if (triggerType === 'inactivity_7d') {
      context = `User has not opened the app or logged any health data in 7+ days.`;
    }

    const prompt = `You are a warm, friendly health coach. Write a short push notification for a health app.

User name: ${userName}
Situation: ${context}

Rules:
- Title: max 50 chars, friendly, personal (use first name)
- Body: max 100 chars, specific, actionable, empathetic
- NO medical diagnoses, NO scary language
- Sound like a caring friend, not a robot
- Use 1 relevant emoji in body only

Return ONLY valid JSON: {"title": "...", "body": "..."}`;

    const raw = await makeAnthropicRequest(
      [{ role: 'user', content: prompt }],
      200, CLAUDE_HAIKU_MODEL, { feature: 'nudge_generation' }
    );

    const match = raw.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.title && parsed.body) return parsed;
    }
  } catch (e) {
    console.error('Nudge AI generation failed:', e.message);
  }

  // Fallback messages
  const fallbacks = {
    followup_3d:   { title: `${userName}, check your progress 💪`, body: "3 days since your last report — see how your metrics are doing!" },
    score_drop:    { title: `${userName}, let's bounce back 🌱`,   body: "Your health score dipped. Small steps today make a big difference!" },
    inactivity_7d: { title: `We miss you, ${userName}! 👋`,        body: "Log your health today — consistency is the key to better health." },
  };
  return fallbacks[triggerType] || fallbacks.inactivity_7d;
};

// ── Eligibility checks ───────────────────────────────────────────────────────

// Get abnormal metrics from a report
const getAbnormalMetrics = (report) => {
  const metrics = report.aiAnalysis?.metrics || {};
  return Object.entries(metrics)
    .filter(([, m]) => m?.status === 'high' || m?.status === 'low')
    .map(([name, m]) => ({ name, value: m.value ?? m.result ?? '', unit: m.unit ?? '', status: m.status }));
};

// Users who uploaded a report 3 days ago with abnormal metrics and no followup nudge yet
const getFollowupEligible = async () => {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const fourDaysAgo  = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

  const reports = await HealthReport.find({
    status: 'completed',
    reportDate: { $gte: fourDaysAgo, $lte: threeDaysAgo },
  }).select('user reportType reportDate aiAnalysis').lean();

  const eligible = [];
  for (const report of reports) {
    const abnormal = getAbnormalMetrics(report);
    if (!abnormal.length) continue;

    // Check not already nudged for this report
    const alreadySent = await NudgeLog.exists({
      userId: report.user, reportId: report._id, type: 'followup_3d',
    });
    if (alreadySent) continue;

    // Check FCM token exists
    const hasToken = await FCMToken.exists({ userId: report.user, isActive: true });
    if (!hasToken) continue;

    eligible.push({ userId: report.user, reportId: report._id, reportType: report.reportType, abnormalMetrics: abnormal });
  }
  return eligible;
};

// Users whose latest health score dropped 5+ points
const getScoreDropEligible = async () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recentReports = await HealthReport.find({
    status: 'completed',
    reportDate: { $gte: sevenDaysAgo },
    'aiAnalysis.healthScore': { $exists: true },
  }).sort({ user: 1, reportDate: -1 }).select('user reportDate aiAnalysis').lean();

  // Group by user — take latest two
  const byUser = {};
  for (const r of recentReports) {
    const uid = String(r.user);
    if (!byUser[uid]) byUser[uid] = [];
    if (byUser[uid].length < 2) byUser[uid].push(r);
  }

  const eligible = [];
  for (const [uid, reports] of Object.entries(byUser)) {
    if (reports.length < 2) continue;
    const [latest, prev] = reports;
    const drop = (prev.aiAnalysis?.healthScore || 0) - (latest.aiAnalysis?.healthScore || 0);
    if (drop < 5) continue;

    const alreadySent = await NudgeLog.exists({ userId: uid, reportId: latest._id, type: 'score_drop' });
    if (alreadySent) continue;

    const hasToken = await FCMToken.exists({ userId: uid, isActive: true });
    if (!hasToken) continue;

    eligible.push({
      userId: uid, reportId: latest._id,
      oldScore: prev.aiAnalysis.healthScore,
      newScore: latest.aiAnalysis.healthScore,
    });
  }
  return eligible;
};

// Users inactive for 7+ days (no FCM lastUsedAt update = no app open)
const getInactivityEligible = async () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Tokens not used in 7-14 days (still active but dormant)
  const dormantTokens = await FCMToken.find({
    isActive: true,
    lastUsedAt: { $gte: fourteenDaysAgo, $lte: sevenDaysAgo },
  }).select('userId').lean();

  const userIds = [...new Set(dormantTokens.map(t => String(t.userId)))];
  const eligible = [];

  for (const userId of userIds) {
    const alreadySent = await NudgeLog.findOne({ userId, type: 'inactivity_7d' })
      .sort({ sentAt: -1 }).select('sentAt').lean();

    // Don't send inactivity nudge more than once per 7 days
    if (alreadySent && (Date.now() - new Date(alreadySent.sentAt).getTime()) < 7 * 24 * 60 * 60 * 1000) continue;

    eligible.push({ userId });
  }
  return eligible;
};

// ── Send nudge to one user ───────────────────────────────────────────────────
const sendNudge = async ({ userId, reportId, type, reportData, userName }) => {
  try {
    const { title, body } = await generateNudgeMessage(userName, type, reportData || {});

    const result = await sendToUser(userId, { title, body, data: { type, reportId: String(reportId || '') } });

    await NudgeLog.create({ userId, reportId, type, title, body, delivered: result.success });
    console.log(`📬 Nudge [${type}] → ${userName}: ${result.success ? 'delivered' : 'failed'}`);
  } catch (e) {
    // Duplicate nudge — ignore
    if (e.code === 11000) return;
    console.error(`Nudge send error (${type}, user ${userId}):`, e.message);
  }
};

// ── Process a batch of eligible users ────────────────────────────────────────
const processBatch = async (items, type) => {
  for (const item of items) {
    await sendNudge({ ...item, type });
    await sleep(200); // 200ms between individual sends within batch
  }
};

// ── Main runner — called by cron ─────────────────────────────────────────────
const runNudgeCron = async () => {
  console.log('🔔 Nudge cron started:', new Date().toISOString());

  try {
    // Collect all eligible users across all trigger types
    const [followups, scoreDrops, inactive] = await Promise.all([
      getFollowupEligible(),
      getScoreDropEligible(),
      getInactivityEligible(),
    ]);

    console.log(`📊 Eligible — followup:${followups.length} scoreDrop:${scoreDrops.length} inactive:${inactive.length}`);

    // Fetch user names in one query
    const allUserIds = [...new Set([
      ...followups.map(u => u.userId),
      ...scoreDrops.map(u => u.userId),
      ...inactive.map(u => u.userId),
    ])];

    const users = await User.find({ _id: { $in: allUserIds } }).select('name').lean();
    const nameMap = {};
    users.forEach(u => { nameMap[String(u._id)] = u.name?.split(' ')[0] || 'there'; });

    // Tag each item with userName
    const tag = items => items.map(i => ({ ...i, userName: nameMap[String(i.userId)] || 'there' }));

    const allItems = [
      ...tag(followups).map(i => ({ ...i, reportData: { reportType: i.reportType, abnormalMetrics: i.abnormalMetrics } })),
      ...tag(scoreDrops).map(i => ({ ...i, reportData: { oldScore: i.oldScore, newScore: i.newScore } })),
      ...tag(inactive).map(i => ({ ...i, reportData: {} })),
    ];

    if (!allItems.length) {
      console.log('✅ No users eligible for nudge today.');
      return;
    }

    // Process in batches of BATCH_SIZE with delay between batches
    for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
      const batch = allItems.slice(i, i + BATCH_SIZE);
      console.log(`📤 Sending batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allItems.length / BATCH_SIZE)} (${batch.length} users)`);
      await processBatch(batch, batch[0]?.type);

      if (i + BATCH_SIZE < allItems.length) {
        console.log(`⏳ Waiting ${BATCH_DELAY / 60000} min before next batch...`);
        await sleep(BATCH_DELAY);
      }
    }

    console.log('✅ Nudge cron complete:', new Date().toISOString());
  } catch (e) {
    console.error('❌ Nudge cron error:', e.message);
  }
};

module.exports = { runNudgeCron, generateNudgeMessagePublic: generateNudgeMessage };
