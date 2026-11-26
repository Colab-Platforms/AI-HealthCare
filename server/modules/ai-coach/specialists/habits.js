// Smoking and alcohol trackers ("is hafte kitni cigarette?", "how much did I
// drink this week?"). Reuses the summaries the old chat already used
// (utils/alcoholLog.js), so the coach answers from the logs instead of guessing.

const { result, noData } = require('./common');

async function habitsSpecialist({ userId, deps = {} }) {
    const loadUser = deps.loadUser || (async (id) => require('../../../models/User')
        .findById(id).select('alcoholLog smokeLog profile.lifestyle').lean());
    const { buildAlcoholContextForAI, buildSmokeContextForAI } = require('../../../utils/alcoholLog');

    const user = await loadUser(userId);
    if (!user) return noData('habits', ['smoke_log', 'alcohol_log'], 'No smoking or alcohol logs.');
    const findings = [
        `Alcohol: ${buildAlcoholContextForAI(user.alcoholLog || {}, user.profile?.lifestyle || {})}`,
        buildSmokeContextForAI(user.smokeLog || {}),
    ];
    return result('habits', { findings, data_used: ['alcohol_log', 'smoke_log'], confidence: 'high' });
}

module.exports = { habitsSpecialist };
