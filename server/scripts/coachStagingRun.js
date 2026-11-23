/**
 * Runs Coach V2 for real (staging DB + the real Claude API) for one user and
 * one or more messages, printing the streamed answer, the route, specialist
 * statuses, the gap question, profile saves, token usage and timings.
 * Costs a few cents per message (Haiku 5.5 + Sonnet 5.5). Run from server/:
 *
 *   node scripts/coachStagingRun.js "I'm feeling tired today, and I've to go to the gym today"
 *   node scripts/coachStagingRun.js "hi" "no injuries" "undo"        # several turns, one conversation
 *   --email=<address>   default coach-test@example.invalid (scripts/createCoachTestUser.js)
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
    const deps = {
        client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
        getProfileContext,
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
            input: { userId: user._id, userName: user.name, message, history: [...history], now: new Date() },
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
        console.log(`  classified:   intent=${final.classification?.intent} topics=[${(final.classification?.topics || []).join(', ')}] language=${final.classification?.language}`);
        if (final.specialistResults) {
            console.log(`  specialists:  ${final.specialistResults.map((s) => `${s.specialist}=${s.status} (${s.ms}ms)`).join(', ')}`);
        }
        if (final.gapQuestion) console.log(`  gap question: ${final.gapQuestion.field}${final.gapQuestion.blocking ? ' (blocking)' : ''}`);
        for (const e of events) console.log(`  event:        ${JSON.stringify(e)}`);
        for (const u of final.usage || []) {
            console.log(`  usage:        ${u.feature} ${u.model} in=${u.usage?.input_tokens} out=${u.usage?.output_tokens} cacheRead=${u.usage?.cache_read_input_tokens || 0} cacheWrite=${u.usage?.cache_creation_input_tokens || 0}${u.stopReason ? ` stop=${u.stopReason}` : ''}`);
        }
        console.log(`  timing:       first word ${firstToken === null ? '-' : `${(firstToken / 1000).toFixed(2)}s`}, total ${(total / 1000).toFixed(2)}s`);
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
