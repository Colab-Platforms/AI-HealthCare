// Builds the Sonnet 5.5 request and streams the answer.
//
// Prompt layout, for prompt caching (prefix match):
//   system[0]  coach rules           identical for every user    -> cached
//   system[1]  the user's profile    identical until it changes  -> cached
//   messages   recent chat + the new message
//   messages   final { role: 'system' } with this message's data (specialist
//              findings, the gap question, facts to confirm). Volatile, so it
//              goes last and never breaks the cached prefix; as a system
//              message it carries operator authority and is never mistaken
//              for something the user said.

const { MODELS, EFFORT, MAX_TOKENS, RESPONDER_THINKING, RESPONDER_FALLBACK, HISTORY_TURNS } = require('../config');
const { describeFact } = require('../tools/profileTools');

const COACH_RULES = `You are take.health Coach, a warm, knowledgeable health coach inside the take.health app (users in India).

How to answer:
- Answer exactly what the latest message asks. Match length to the question: greetings 1-2 sentences, simple questions 2-4 sentences, plans or detailed explanations under about 150 words.
- Use the user's own data from "Data for this message" when it helps the answer, with the real numbers ("you slept 5h 12m, about 1h 50m less than usual"). Never invent numbers. If data the answer needs is missing, say it is not available instead of guessing, and never treat missing data as zero.
- Personalise with the profile (conditions, medicines, allergies, injuries, diet, goals). Never suggest a food the user is allergic to or an exercise that conflicts with a listed injury or condition.
- Reply in the user's language: English, Hindi, or Hinglish (Hindi in Latin letters) if they wrote Hinglish.

Safety:
- You are not a doctor. Do not diagnose, do not say what caused a symptom with certainty, and do not give medicine names to start or stop or any medicine doses. For those, suggest a doctor, in one short sentence.
- If a symptom could be serious, say clearly to see a doctor.
- Facts marked "unconfirmed" came from an earlier chat and are not confirmed; don't rely on them for safety decisions.

Format:
- Plain text only: no markdown (no **, no #). Use "•" bullets or numbered lists when listing.
- No unrequested extras, no repeated disclaimers, at most one short question of your own.
- If "Data for this message" gives a question to ask or facts to confirm, end the reply with it, worded naturally, as the last line.
- Never call yourself TakeHealth; your name is take.health Coach.`;

function profileBlock(name, ctx) {
    if (!ctx) return `User: ${name || 'the user'}\nProfile: not available.`;
    return `User: ${name || 'the user'}\nProfile (completeness ${ctx.completeness?.percent ?? '?'}%):\n${ctx.summary}`;
}

function findingsBlock(results) {
    const lines = [];
    for (const r of results || []) {
        const title = r.specialist.replace('_', ' ');
        if (r.status === 'completed' || r.status === 'no_data') {
            lines.push(`[${title}] ${r.findings.join(' ')}${r.missing_data?.length ? ` (missing: ${r.missing_data.join(', ')})` : ''}`);
        } else {
            lines.push(`[${title}] Data unavailable right now (${r.status}). Don't guess it.`);
        }
    }
    return lines.join('\n');
}

/**
 * @returns { system, messages } for client.messages.stream
 */
function buildRequest({ message, history = [], userName, profileContext, classification = {}, specialistResults = [], gapQuestion = null, confirmFacts = [], savedFacts = [], undoneCount = 0 }) {
    const hinglish = ['hinglish', 'hindi'].includes(classification.language);
    const turns = history.slice(-HISTORY_TURNS * 2)
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
        .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
    // The API needs the first message to be from the user.
    while (turns.length && turns[0].role !== 'user') turns.shift();

    const data = [`Today (UTC): ${new Date().toISOString().slice(0, 10)}`];
    if (classification.timeframe && classification.timeframe !== 'unspecified') data.push(`The user means: ${classification.timeframe}`);
    if (classification.symptoms?.length) data.push(`Symptoms mentioned: ${classification.symptoms.join(', ')}`);
    const f = findingsBlock(specialistResults);
    if (f) data.push(`User's data:\n${f}`);
    if (savedFacts.length) {
        data.push(`Just saved to their profile: ${savedFacts.map((s) => describeFact(s, hinglish)).join('; ')}. Mention it in a few words and that they can say "undo" to remove it.`);
    }
    if (undoneCount) data.push(`You just removed ${undoneCount} item(s) you had saved, as the user asked. Confirm briefly.`);
    if (gapQuestion) {
        data.push(gapQuestion.blocking
            ? `Before advising, you need one fact. Do NOT give the recommendation yet: explain briefly why you need it and ask: "${gapQuestion.question}"`
            : `After answering, ask this one question as the last line: "${gapQuestion.question}"`);
    }
    if (confirmFacts.length) {
        data.push(`The user mentioned: ${confirmFacts.map((c) => describeFact(c, hinglish)).join('; ')}. As the last line, ask if you should save this to their profile (yes / no).`);
    }

    return {
        system: [
            { type: 'text', text: COACH_RULES, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: profileBlock(userName, profileContext), cache_control: { type: 'ephemeral' } },
        ],
        messages: [
            ...turns,
            { role: 'user', content: message },
            { role: 'system', content: `Data for this message:\n${data.join('\n')}` },
        ],
    };
}

/**
 * Streams the answer. onToken(text) for each chunk. Returns { text, usage, stopReason, model }.
 * Throws on API errors (the caller falls back to the old chat).
 */
async function streamAnswer({ client, request, onToken, signal }) {
    const stream = client.beta.messages.stream({
        model: MODELS.responder,
        max_tokens: MAX_TOKENS.responder,
        thinking: RESPONDER_THINKING,
        output_config: { effort: EFFORT.responder },
        ...RESPONDER_FALLBACK,
        ...request,
    }, { signal });

    let text = '';
    for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            text += event.delta.text;
            onToken(event.delta.text);
        }
    }
    const final = await stream.finalMessage();
    return { text, usage: final.usage || {}, stopReason: final.stop_reason, model: final.model || MODELS.responder };
}

module.exports = { buildRequest, streamAnswer, COACH_RULES };
