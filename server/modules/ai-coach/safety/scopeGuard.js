// Scope and prompt-injection guard. The coach only talks about the user's own
// health, body, fitness, food, sleep, mood, medical reports and the take.health
// app. Three layers:
//   1. this file: deterministic prompt-injection patterns (no model involved);
//   2. classifier intent 'off_topic' (python, homework, politics, trivia...);
//   3. the answer prompt's own scope rule, for mixed messages.
// Layers 1-2 get a fixed, friendly reply with no answer-model call (fast, free).

const INJECTION_RE = /\b(ignore|disregard|forget|override|bypass) (all |the |your |any |previous |prior |above )*(instructions|rules|guidelines|prompt|system prompt|restrictions)\b|\b(system prompt|your instructions|your prompt|hidden prompt|initial prompt)\b|\b(you are now|act as|pretend (to be|you are)|roleplay as|developer mode|dan mode|jailbreak)\b|\b(apne|tumhare|tera|teri) (instructions|rules|prompt)\b/i;

function detectInjection(message) {
    return INJECTION_RE.test(String(message || ''));
}

function scopeReply(kind, { language = 'english', firstName = '' } = {}) {
    const hi = ['hinglish', 'hindi'].includes(language);
    const name = firstName ? `${hi ? '' : ' '}${firstName}` : '';
    if (kind === 'injection') {
        return hi
            ? 'Main apni settings change ya share nahi kar sakta, par tumhari health mein poori madad kar sakta hoon. Batao, aaj kya help chahiye?'
            : 'I can\'t change or share how I\'m set up, but I\'m happy to help with your health. What would you like help with today?';
    }
    return hi
        ? `Ye mere area se bahar hai${name ? ` ${name}` : ''} 🙂 Main tumhari health, khana, neend, fitness aur reports mein madad karta hoon. Waise, aaj ka din kaisa ja raha hai?`
        : `That's outside what I can help with${name} 🙂 I'm here for your health, food, sleep, fitness and reports. How's your day going so far?`;
}

module.exports = { detectInjection, scopeReply };
