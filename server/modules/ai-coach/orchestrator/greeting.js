// Warm greeting for "hi" / "hello" (code only, no model call: instant).
//
//   Hii Rahul! Kaisa hai bhai? Is hafte steps badhe hain, bahut sahi ja raha hai!
//   Aaj ka din start hua hai, batau aaj kya karna hai?
//
// Product decisions (25 Nov):
// - Language: English unless the message or the chat so far is Hinglish / Hindi.
// - Tone: friendly by default; "bhai / tu" only when the user writes casually
//   ("bhai", "yaar", "bro", "tu"); 60+ users get "aap" + "ji".
// - First chat of the (IST) day: one TRUE compliment from their data (never a
//   made-up one), then an offer to plan the day. "yes" -> the day plan.
// - Later greetings that day: just "what can I help with?".

const IST_OFFSET_MS = 330 * 60 * 1000;
const istDay = (d) => new Date(new Date(d).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
const istHour = (d) => new Date(new Date(d).getTime() + IST_OFFSET_MS).getUTCHours();

const CASUAL_RE = /\b(bhai|bhaiya|bro|bruh|yaar|tu|tera|teri|kaisa hai|kya haal|kya scene)\b/i;
const SENIOR_AGE = 60;

function toneFor({ message, profileContext }) {
    const age = profileContext?.basic?.age;
    if (Number.isFinite(age) && age >= SENIOR_AGE) return 'respectful';
    if (CASUAL_RE.test(String(message || ''))) return 'casual';
    return 'friendly';
}

function salutation({ firstName, tone, hinglish, gender }) {
    const name = firstName ? ` ${firstName}` : '';
    if (!hinglish) {
        if (tone === 'respectful') return `Hello${name}! How are you today?`;
        if (tone === 'casual') return `Hey${name}! What's up?`;
        return `Hey${name}! How's it going?`;
    }
    if (tone === 'respectful') return `Namaste${firstName ? ` ${firstName} ji` : ''}! Aap kaise hain?`;
    if (tone === 'casual') {
        if (gender === 'male') return `Hii${name}! Kaisa hai bhai?`;
        if (gender === 'female') return `Hii${name}! Kaisi hai yaar?`;
        return `Hii${name}! Kya haal hai?`;
    }
    return `Hii${name}! Kaise ho?`;
}

// One compliment, only when the data really shows it. null otherwise.
function compliment(summary, { tone, hinglish }) {
    const w = summary?.thisWeek;
    const last = summary?.lastWeek;
    if (!w) return null;
    const aap = tone === 'respectful';
    if (w.stepDays >= 3 && last?.stepDays >= 3 && w.stepsAvg && last.stepsAvg && w.stepsAvg >= last.stepsAvg * 1.1) {
        if (!hinglish) return 'Your steps are up this week, nice work!';
        if (aap) return 'Is hafte aapke steps badhe hain, bahut badhiya!';
        return tone === 'casual' ? 'Is hafte steps badhe hain, bahut sahi ja raha hai!' : 'Is hafte steps badhe hain, bahut badhiya!';
    }
    if (w.stepGoalDays >= 5) {
        if (!hinglish) return `You hit your step goal on ${w.stepGoalDays} of ${w.stepDays} days this week, great going!`;
        return aap
            ? `Is hafte aapne ${w.stepGoalDays}/${w.stepDays} din step goal poora kiya, bahut badhiya!`
            : `Is hafte ${w.stepGoalDays}/${w.stepDays} din step goal poora kiya, kya baat hai!`;
    }
    if (w.sleepGoalNights >= 5) {
        if (!hinglish) return 'You slept well most nights this week, keep it up!';
        return aap ? 'Is hafte aapki neend achhi rahi, bahut badhiya!' : 'Is hafte neend achhi rahi, aise hi chalte raho!';
    }
    return null;
}

function dayPlanOffer({ tone, hinglish, morning }) {
    if (!hinglish) return morning ? 'Your day\'s just getting started. Want me to tell you what to focus on today?' : 'Want a quick plan for the rest of your day?';
    if (tone === 'respectful') return morning ? 'Aaj ka din shuru hua hai, kya main bataun aaj aapko kya karna chahiye?' : 'Kya main bataun aaj ke baaki din mein aapko kya karna chahiye?';
    if (tone === 'casual') return morning ? 'Aaj ka din start hua hai, batau aaj kya karna hai?' : 'Batau aaj ke baaki din mein kya karna hai?';
    return morning ? 'Aaj ka din shuru hua hai, bataun aaj kya karna hai?' : 'Bataun aaj ke baaki din mein kya karna hai?';
}

function isFirstChatToday(coachState, now) {
    return !coachState?.lastChatAt || istDay(coachState.lastChatAt) !== istDay(now);
}

/**
 * @returns { text, offer } offer = true when the reply ends with the day-plan offer
 */
function buildGreeting({ message, userName, profileContext, coachState, language, now = new Date(), progressSummary = null }) {
    const hinglish = language === 'hinglish' || language === 'hindi';
    const tone = toneFor({ message, profileContext });
    const firstName = String(userName || '').trim().split(/\s+/)[0];
    const parts = [salutation({ firstName, tone, hinglish, gender: profileContext?.basic?.gender })];

    if (!isFirstChatToday(coachState, now)) {
        parts.push(hinglish ? (tone === 'respectful' ? 'Batayiye, main kya madad karun?' : 'Batao, kya help karun?') : 'What can I help you with?');
        return { text: parts.join(' '), offer: false };
    }
    const praise = compliment(progressSummary, { tone, hinglish });
    if (praise) parts.push(praise);
    return { text: `${parts.join(' ')}\n${dayPlanOffer({ tone, hinglish, morning: istHour(now) < 12 })}`, offer: true };
}

// What "yes" to the offer means: a normal coaching request, routed like any
// message (recovery, sleep, fitness, nutrition), in the chat's language.
function dayPlanRequest(language) {
    return language === 'hinglish' || language === 'hindi'
        ? 'Aaj ka plan batao: activity ya workout, khana aur neend ke liye aaj kya karun, mere data ke hisaab se?'
        : 'Plan my day: what should I focus on today for activity or workout, food and sleep, based on my data?';
}

function offerDeclinedReply(language, tone = 'friendly') {
    if (!(language === 'hinglish' || language === 'hindi')) return 'Sure! Just ask whenever you need anything.';
    return tone === 'respectful' ? 'Theek hai! Jab bhi zaroorat ho, bata dijiye.' : 'Theek hai! Jab chahiye ho, bata dena.';
}

module.exports = { buildGreeting, dayPlanRequest, offerDeclinedReply, isFirstChatToday, toneFor, istDay };
