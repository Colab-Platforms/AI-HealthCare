const { TIMEOUTS } = require('../config');
const { recoverySpecialist } = require('./recovery');
const { sleepSpecialist } = require('./sleep');
const { fitnessSpecialist } = require('./fitness');
const { nutritionSpecialist } = require('./nutrition');
const { medicalLabSpecialist } = require('./medicalLab');

const REGISTRY = {
    recovery: recoverySpecialist,
    sleep: sleepSpecialist,
    fitness: fitnessSpecialist,
    nutrition: nutritionSpecialist,
    medical_lab: medicalLabSpecialist,
};

const timeoutAfter = (ms) => new Promise((resolve) => {
    const t = setTimeout(() => resolve({ timedOut: true }), ms);
    if (t.unref) t.unref();
});

// Runs the named specialists in parallel. Each one gets its own time limit;
// a slow or failing one comes back as status 'timeout' / 'error' and the
// answer is built from the rest. Never throws.
async function runSpecialists(names, { userId, now = new Date(), deps = {}, timeoutMs = TIMEOUTS.specialist, logger = console } = {}) {
    const unique = [...new Set(names)].filter((n) => REGISTRY[n]);
    return Promise.all(unique.map(async (name) => {
        const started = Date.now();
        try {
            const out = await Promise.race([REGISTRY[name]({ userId, now, deps: deps[name] || {} }), timeoutAfter(timeoutMs)]);
            if (out?.timedOut) {
                logger.warn(`[AICoach] specialist ${name} timed out after ${timeoutMs}ms`);
                return { specialist: name, status: 'timeout', findings: [], data_used: [], missing_data: [name], confidence: 'low', ms: Date.now() - started };
            }
            return { ...out, ms: Date.now() - started };
        } catch (err) {
            // Message only: never log the user's data.
            logger.error(`[AICoach] specialist ${name} failed: ${err.message}`);
            return { specialist: name, status: 'error', findings: [], data_used: [], missing_data: [name], confidence: 'low', ms: Date.now() - started };
        }
    }));
}

module.exports = { runSpecialists, SPECIALIST_NAMES: Object.keys(REGISTRY) };
