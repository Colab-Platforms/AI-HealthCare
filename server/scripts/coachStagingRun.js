/**
 * Runs Coach V2 for real (staging DB + the real Claude API) for one user and
 * one or more messages, printing the streamed answer, the route, specialist
 * statuses, the gap question, profile saves, token usage and timings.
 * Costs a few cents per message (Haiku 5.5 + Sonnet 5.5). Run from server/:
 *
 *   node scripts/coachStagingRun.js "I'm feeling tired today, and I've to go to the gym today"
 *   node scripts/coachStagingRun.js "hi" "no injuries" "undo"        # several turns, one conversation
 *   --email=<address>   default coach-test@example.invalid (scripts/createCoachTestUser.js)
 *   --verbose           also print the exact per-message data the model saw
 *   --days-later=N      pretend N days have passed (tests follow-ups: symptoms, stale weight...)
 *
 * Staging only. Writes what the real chat would write: HealthProfile changes
 * from chat, CoachState. No UsageLog rows.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

if (process.env.USE_STAGING_DB !== 'true' || !process.env.MONGODB_URI_STAGING) {
    console.error('Refusing to run: needs USE_STAGING_DB=true and MONGODB_URI_STAGING (staging only).');
    process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant')) {
    console.error('ANTHROPIC_API_KEY is not set.');
    process.exit(1);
}

const mongoose = require('mongoose');

const args = process.argv.slice(2);
const EMAIL = (args.find((a) => a.startsWith('--email=')) || '--email=coach-test@example.invalid').slice(8).trim().toLowerCase();
const MESSAGES = args.filter((a) => !a.startsWith('--'));
const VERBOSE = args.includes('--verbose');
const DAYS_LATER = Number((args.find((a) => a.startsWith('--days-later=')) || '--days-later=0').slice(13)) || 0;
const nowFor = () => new Date(Date.now() + DAYS_LATER * 86400000);

async function main() {
    if (!MESSAGES.length) {
        console.error('Give at least one message, e.g. node scripts/coachStagingRun.js "how did I sleep?"');
        process.exit(1);
    }
    const connectDB = require('../config/db');
    await connectDB();
    if (!/staging$/i.test(mongoose.connection.name)) {
        console.error(`Refusing to continue: "${mongoose.connection.name}" is not a staging database.`);
        process.exit(1);
    }

    const User = require('../models/User');
    const user = await User.findOne({ email: EMAIL }).select('_id name').lean();
    if (!user) {
        console.error(`No user ${EMAIL}. Create it: node scripts/createCoachTestUser.js`);
        process.exit(1);
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const { runCoach } = require('../modules/ai-coach/orchestrator/mainCoachGraph');
    const { getProfileContext } = require('../modules/health-profile/services/profileContextService');
    const { mongoRepo } = require('../modules/ai-coach/orchestrator/coachStateRepo');
    const { createProfileTools } = require('../modules/ai-coach/tools/profileTools');
    const { getTargets } = require('../modules/ai-coach/context/targets');
    const { getFreshness } = require('../modules/ai-coach/context/freshness');
    const { createSymptomTools } = require('../modules/ai-coach/tools/symptomTools');
    const { createMealPrefTools } = require('../modules/ai-coach/tools/mealPrefTools');
    const { createFoodLogTools } = require('../modules/ai-coach/tools/foodLogTools');
    const deps = {
        mealPrefTools: createMealPrefTools(),
        foodLogTools: createFoodLogTools(),
        client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
        getProfileContext,
        getTargets,
        getFreshness,
        symptomTools: createSymptomTools(),
        coachStateRepo: mongoRepo,
        profileTools: createProfileTools(),
        specialistDeps: {},
        logger: console,
    };

    const history = [];
    for (const message of MESSAGES) {
        console.log(`\n════════ USER: ${message}`);
        process.stdout.write('──────── COACH: ');
        const started = Date.now();
        let firstToken = null;
        const events = [];
        let reply = '';
        const final = await runCoach({
            input: { userId: user._id, userName: user.name, message, history: [...history], now: nowFor(), startedAt: started },
            deps,
            onEvent: (e) => {
                if (e.type === 'token') {
                    if (firstToken === null) firstToken = Date.now() - started;
                    reply += e.text;
                    process.stdout.write(e.text);
                } else {
                    events.push(e);
                }
            },
        });
        const total = Date.now() - started;
        console.log('\n');
        console.log(`  route:        ${final.route}${final.classification?.source ? ` (classifier: ${final.classification.source})` : ''}`);
        console.log(`  classified:   intent=${final.classification?.intent} topics=[${(final.classification?.topics || []).join(', ')}] language=${final.classification?.language}`
            + `${final.classification?.lookbackDays ? ` lookbackDays=${final.classification.lookbackDays}` : ''}`
            + `${final.classification?.ruleMatches?.length ? ` rules=[${final.classification.ruleMatches.join(', ')}]` : ''}`);
        if (final.specialistResults) {
            console.log(`  specialists:  ${final.specialistResults.map((s) => `${s.specialist}=${s.status} (${s.ms}ms)`).join(', ')}`);
        }
        if (final.checkIn) console.log(`  question:     ${final.checkIn.kind} (${final.checkIn.key})${final.checkIn.blocking ? ' BLOCKING' : ''}`);
        if (final.symptomChanges?.length) console.log(`  symptoms:     ${final.symptomChanges.map((c) => `${c.name} -> ${c.status}`).join(', ')}`);
        for (const e of events) console.log(`  event:        ${JSON.stringify(e)}`);
        for (const u of final.usage || []) {
            console.log(`  usage:        ${u.feature} ${u.model} in=${u.usage?.input_tokens} out=${u.usage?.output_tokens} cacheRead=${u.usage?.cache_read_input_tokens || 0} cacheWrite=${u.usage?.cache_creation_input_tokens || 0}${u.stopReason ? ` stop=${u.stopReason}` : ''}`);
        }
        console.log(`  timing:       first word ${firstToken === null ? '-' : `${(firstToken / 1000).toFixed(2)}s`}, total ${(total / 1000).toFixed(2)}s`);
        const t = final.timings || {};
        const ms = (v) => (typeof v === 'number' ? `${v}ms` : '-');
        console.log(`  breakdown:    [${t.path || '-'} path] prepare ${ms(t.prepareMs)} [classify ${ms(t.classifyMs)} | prefetch ${ms(t.prefetchMs)} | profile ${ms(t.profileMs)} | targets ${ms(t.targetsMs)}]`
            + ` -> extra specialists ${ms(t.extraSpecialistsMs)} (reused ${t.specialistsReused ?? 0}, fetched after ${t.specialistsFetchedAfter ?? 0})`
            + ` -> Sonnet first token ${ms(t.answerFirstTokenMs)}`
            + (t.classifierWaitAfterAnswerMs != null ? ` (classifier finished ${ms(t.classifierWaitAfterAnswerMs)} after the answer)` : ''));
        if (VERBOSE && final.dataBlock) {
            console.log('  ── data the model saw ──');
            console.log(final.dataBlock.split('\n').map((l) => `  | ${l}`).join('\n'));
        }
        history.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
    }
}

main()
    .catch((err) => {
        console.error('\nFailed:', err.status ? `${err.status} ${err.message}` : err.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect().catch(() => {});
        process.exit(process.exitCode || 0);
    });
