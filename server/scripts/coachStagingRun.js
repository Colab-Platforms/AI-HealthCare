/**
 * Runs Coach V2 for real (staging DB + the real Claude API) for a test user,
 * printing the streamed answer, the route, specialist statuses, the question
 * asked, profile / food saves, token usage and timings.
 * Costs a few cents per message (Haiku 5.5 + Sonnet 5.5). Run from server/:
 *
 *   node scripts/coachStagingRun.js "I'm feeling tired today, and I've to go to the gym today"
 *   node scripts/coachStagingRun.js "hi" "no injuries" "undo"        # several turns, one conversation
 *   node scripts/coachStagingRun.js --chat --persona=b               # interactive chat in the terminal
 *
 *   --persona=a|b       test persona from createCoachTestUser.js (a = Rahul 24, b = Sushila 67)
 *   --email=<address>   any staging test user (overrides --persona)
 *   --chat              type messages one by one; history is kept like the app. Commands:
 *                         /data       data block the model saw for the last answer
 *                         /details    toggle full details after each answer
 *                         /days N     pretend N days have passed (0 = real time)
 *                         /opener     run the coach-screen opener now
 *                         /reset      clear coach memory + symptoms and the chat history
 *                         /user a|b   switch persona (new chat)
 *                         /help, exit
 *   --verbose           also print the exact per-message data the model saw
 *   --days-later=N      pretend N days have passed (tests follow-ups: symptoms, stale weight...)
 *   --opener            first call the coach-screen opener (POST /api/coach/opener logic);
 *                       its text goes into the history like the app would save it
 *
 * Staging only. Writes what the real chat would write: HealthProfile changes
 * from chat, food logs, symptoms, CoachState. No UsageLog rows.
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
const { PERSONAS } = require('./lib/coachSeedPersonas');

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const PERSONA = (flag('persona') || 'a').toLowerCase();
const EMAIL = (flag('email') || PERSONAS[PERSONA]?.email || PERSONAS.a.email).trim().toLowerCase();
const MESSAGES = args.filter((a) => !a.startsWith('--'));
const CHAT = args.includes('--chat');
const OPENER = args.includes('--opener');
let VERBOSE = args.includes('--verbose');
let daysLater = Number(flag('days-later')) || 0;
const nowFor = () => new Date(Date.now() + daysLater * 86400000);
const ms = (v) => (typeof v === 'number' ? `${v}ms` : '-');
const sec = (v) => (typeof v === 'number' ? `${(v / 1000).toFixed(2)}s` : '-');

async function main() {
    if (!MESSAGES.length && !OPENER && !CHAT) {
        console.error('Give at least one message, or --chat. E.g. node scripts/coachStagingRun.js --chat --persona=b');
        process.exit(1);
    }
    const connectDB = require('../config/db');
    await connectDB();
    if (!/staging$/i.test(mongoose.connection.name)) {
        console.error(`Refusing to continue: "${mongoose.connection.name}" is not a staging database.`);
        process.exit(1);
    }

    const deps = buildDeps();
    let user = await loadUser(EMAIL);
    const history = [];
    let last = null;

    if (OPENER) await runOpener(deps, user, history);

    if (!CHAT) {
        for (const message of MESSAGES) last = await send(deps, user, history, message, { full: true });
        return;
    }

    // ── interactive chat ─────────────────────────────────────────────────────
    // Async iteration queues lines typed (or pasted / piped) while an answer is
    // still streaming; rl.question() would drop them.
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    const prompt = () => { rl.setPrompt(`\n${daysLater ? `[+${daysLater}d] ` : ''}You: `); rl.prompt(); };
    printChatHeader(user);
    for (const message of MESSAGES) last = await send(deps, user, history, message, { full: VERBOSE });
    prompt();
    for await (const raw of rl) {
        const line = raw.trim();
        if (!process.stdin.isTTY && line) console.log(line); // echo piped input
        if (!line) { prompt(); continue; }
        if (/^(exit|quit|\/exit|\/quit)$/i.test(line)) break;
        if (line.startsWith('/')) {
            const [cmd, arg] = line.split(/\s+/);
            if (cmd === '/help') printChatHeader(user);
            else if (cmd === '/data') console.log(last?.dataBlock ? last.dataBlock.split('\n').map((l) => `  | ${l}`).join('\n') : '  (no model answer yet, or it was a fixed reply)');
            else if (cmd === '/details') { VERBOSE = !VERBOSE; console.log(`  details ${VERBOSE ? 'on' : 'off'}`); }
            else if (cmd === '/days') { daysLater = Number(arg) || 0; console.log(`  now = ${nowFor().toISOString().slice(0, 16)} UTC (${daysLater} day(s) ahead). Use /reset afterwards: future dates are written to coach memory.`); }
            else if (cmd === '/opener') await runOpener(deps, user, history);
            else if (cmd === '/reset') { await resetCoach(user); history.length = 0; last = null; }
            else if (cmd === '/user') {
                const key = String(arg || '').toLowerCase();
                if (!PERSONAS[key]) console.log('  /user a  or  /user b');
                else {
                    user = await loadUser(PERSONAS[key].email);
                    history.length = 0; last = null;
                    printChatHeader(user);
                }
            } else console.log('  unknown command, /help for the list');
            prompt();
            continue;
        }
        last = await send(deps, user, history, line, { full: VERBOSE });
        prompt();
    }
    rl.close();
}

function buildDeps() {
    const Anthropic = require('@anthropic-ai/sdk');
    const { getProfileContext } = require('../modules/health-profile/services/profileContextService');
    const { mongoRepo } = require('../modules/ai-coach/orchestrator/coachStateRepo');
    const { createProfileTools } = require('../modules/ai-coach/tools/profileTools');
    const { getTargets } = require('../modules/ai-coach/context/targets');
    const { getFreshness } = require('../modules/ai-coach/context/freshness');
    const { createSymptomTools } = require('../modules/ai-coach/tools/symptomTools');
    const { createMealPrefTools } = require('../modules/ai-coach/tools/mealPrefTools');
    const { createFoodLogTools } = require('../modules/ai-coach/tools/foodLogTools');
    const { createActivityLogTools } = require('../modules/ai-coach/tools/activityLogTools');
    // Keep in step with chatHandler.defaultDeps (the real route).
    return {
        mealPrefTools: createMealPrefTools(),
        foodLogTools: createFoodLogTools(),
        activityLogTools: createActivityLogTools(),
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
}

async function loadUser(email) {
    const User = require('../models/User');
    const user = await User.findOne({ email }).select('_id name email profile.age profile.gender').lean();
    if (!user) {
        console.error(`No user ${email}. Create it: node scripts/createCoachTestUser.js --persona=a|b`);
        process.exit(1);
    }
    return user;
}

function printChatHeader(user) {
    console.log(`\n═══ Coach chat: ${user.name} (${user.profile?.age ?? '?'}, ${user.profile?.gender ?? '?'}) <${user.email}>`);
    console.log('    /data  /details  /days N  /opener  /reset  /user a|b  /help  exit');
}

async function resetCoach(user) {
    const CoachState = require('../modules/ai-coach/models/CoachState');
    const SymptomLog = require('../modules/ai-coach/models/SymptomLog');
    const [cs, sy] = await Promise.all([CoachState.deleteMany({ user: user._id }), SymptomLog.deleteMany({ user: user._id })]);
    console.log(`  coach memory cleared (${cs.deletedCount} state, ${sy.deletedCount} symptoms), chat history cleared`);
}

async function runOpener(deps, user, history) {
    const { createOpenerService } = require('../modules/ai-coach/opener/openerService');
    const { progressSpecialist } = require('../modules/ai-coach/specialists/progress');
    const opener = createOpenerService({
        coachStateRepo: deps.coachStateRepo,
        symptomTools: deps.symptomTools,
        getProfileContext: deps.getProfileContext,
        progress: ({ userId, now }) => progressSpecialist({ userId, now }),
        logger: console,
    });
    const t0 = Date.now();
    const out = await opener.buildOpener({ userId: user._id, userName: user.name, now: nowFor() });
    console.log(`\n════════ OPENER (${Date.now() - t0} ms): ${out.opener ? '' : `none (${out.reason})`}`);
    if (out.opener) {
        console.log(out.opener.text);
        console.log(`  language: ${out.opener.language}  question: ${JSON.stringify(out.opener.question)}`);
        history.push({ role: 'assistant', content: out.opener.text });
    }
}

async function send(deps, user, history, message, { full }) {
    const { runCoach } = require('../modules/ai-coach/orchestrator/mainCoachGraph');
    if (!CHAT) console.log(`\n════════ USER: ${message}`);
    process.stdout.write(CHAT ? 'Coach: ' : '──────── COACH: ');
    const started = Date.now();
    let firstToken = null;
    const events = [];
    let reply = '';
    let final;
    try {
        final = await runCoach({
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
    } catch (err) {
        // In the app this falls back to the old chat; here just report it and keep the session.
        console.log(`\n  ERROR: ${err.status ? `${err.status} ` : ''}${err.message}`);
        if (!CHAT) throw err;
        return null;
    }
    const total = Date.now() - started;

    console.log('\n');
    if (full) printDetails(final, events, firstToken, total);
    else printSummary(final, events, firstToken);
    history.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
    return final;
}

// One line under each chat answer.
function printSummary(final, events, firstToken) {
    const t = final.timings || {};
    const parts = [`${final.route}`, `${t.path || '-'} path`, `first word ${sec(firstToken)}`];
    if (final.checkIn) parts.push(`asked: ${final.checkIn.kind}${final.checkIn.blocking ? ' (blocking)' : ''}`);
    if (final.symptomChanges?.length) parts.push(`symptoms: ${final.symptomChanges.map((c) => `${c.name}->${c.status}`).join(', ')}`);
    for (const e of events) {
        if (e.type === 'profile_saved') parts.push(`saved: ${e.items.map((i) => `${i.target}=${i.none ? 'none' : i.value}`).join(', ')}`);
        else if (e.type === 'profile_undone') parts.push(`undone: ${e.count}`);
        else if (e.type === 'profile_confirm') parts.push('asked to save to profile');
        else if (e.type === 'food_log_confirm') parts.push(`meal shown: ${e.entry.nutrition.calories} kcal`);
        else if (e.type === 'food_logged') parts.push(`meal saved: ${e.nutrition.calories} kcal`);
        else if (e.type === 'meal_pref_saved') parts.push('meal pattern saved');
    }
    console.log(`  · ${parts.join(' · ')}`);
}

function printDetails(final, events, firstToken, total) {
    const c = final.classification || {};
    console.log(`  route:        ${final.route}${c.source ? ` (classifier: ${c.source})` : ''}`);
    console.log(`  classified:   intent=${c.intent} topics=[${(c.topics || []).join(', ')}] language=${c.language}`
        + `${c.lookbackDays ? ` lookbackDays=${c.lookbackDays}` : ''}`
        + `${c.ruleMatches?.length ? ` rules=[${c.ruleMatches.join(', ')}]` : ''}`);
    if (final.specialistResults) {
        console.log(`  specialists:  ${final.specialistResults.map((s) => `${s.specialist}=${s.status} (${s.ms}ms)`).join(', ')}`);
    }
    if (final.checkIn) console.log(`  question:     ${final.checkIn.kind} (${final.checkIn.key})${final.checkIn.blocking ? ' BLOCKING' : ''}`);
    if (final.symptomChanges?.length) console.log(`  symptoms:     ${final.symptomChanges.map((x) => `${x.name} -> ${x.status}`).join(', ')}`);
    for (const e of events) console.log(`  event:        ${JSON.stringify(e)}`);
    for (const u of final.usage || []) {
        console.log(`  usage:        ${u.feature} ${u.model} in=${u.usage?.input_tokens} out=${u.usage?.output_tokens} cacheRead=${u.usage?.cache_read_input_tokens || 0} cacheWrite=${u.usage?.cache_creation_input_tokens || 0}${u.stopReason ? ` stop=${u.stopReason}` : ''}`);
    }
    console.log(`  timing:       first word ${sec(firstToken)}, total ${sec(total)}`);
    const t = final.timings || {};
    console.log(`  breakdown:    [${t.path || '-'} path] prepare ${ms(t.prepareMs)} [classify ${ms(t.classifyMs)} | prefetch ${ms(t.prefetchMs)} | profile ${ms(t.profileMs)} | targets ${ms(t.targetsMs)}]`
        + ` -> extra specialists ${ms(t.extraSpecialistsMs)} (reused ${t.specialistsReused ?? 0}, fetched after ${t.specialistsFetchedAfter ?? 0})`
        + ` -> Sonnet first token ${ms(t.answerFirstTokenMs)}`
        + (t.classifierWaitAfterAnswerMs != null ? ` (classifier finished ${ms(t.classifierWaitAfterAnswerMs)} after the answer)` : '')
        + (t.droppedPausedRequest ? ' [dropped paused request]' : ''));
    if (VERBOSE && final.dataBlock) {
        console.log('  ── data the model saw ──');
        console.log(final.dataBlock.split('\n').map((l) => `  | ${l}`).join('\n'));
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
