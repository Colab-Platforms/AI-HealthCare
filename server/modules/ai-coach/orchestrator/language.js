// One language decision per message, used by every code path that writes
// text itself (gap questions, fixed replies, safety lines) and passed to the
// answer model. Before this (staging 24 Nov), the fast path used a 15-word
// regex while the answer model judged the language itself: "tired hoon, gym
// jaun?" got a Hinglish answer ending in an English question.
//
//   hindi     Devanagari script
//   hinglish  Hindi words in Latin letters (usually mixed with English)
//   english   otherwise
//   neutral   no signal at all ("ok", "haan", "72", "👍"): keep the
//             conversation's language (CoachState.lastLanguage)

const DEVANAGARI_RE = /[ऀ-ॿ]/;

// Common Hindi function words and verbs as people type them in chat. Words
// that are also English are left out so English messages don't flip to
// Hinglish: me, to, the, is, main (course), sir, lag (jet lag), mat (yoga mat), par, ya.
const HINGLISH_WORDS = [
    'hai', 'hain', 'hoon', 'hu', 'hun', 'tha', 'thi', 'ho', 'hua', 'hui', 'hoga', 'hogi',
    'kya', 'kyu', 'kyun', 'kyon', 'kaise', 'kaisa', 'kaisi', 'kab', 'kahan', 'kitna', 'kitni', 'kaun', 'kaunsa', 'kaunsi',
    'mujhe', 'mujhse', 'mera', 'meri', 'mere', 'mai', 'tum', 'tu', 'tera', 'teri', 'aap', 'aapka', 'aapki', 'apna', 'apni', 'hum', 'humko',
    'aaj', 'kal', 'abhi', 'raat', 'subah', 'shaam', 'din', 'roz',
    'nahi', 'nahin', 'nhi', 'nai', 'bhi', 'bas', 'aur', 'lekin', 'kuch', 'sab', 'thoda', 'zyada', 'bahut', 'bohot',
    'karna', 'karu', 'karun', 'karoon', 'kar', 'karo', 'kiya', 'kiye', 'karta', 'karti', 'karte', 'raha', 'rahi', 'rahe', 'gaya', 'gayi',
    'jaun', 'jau', 'jaana', 'jana', 'jaa', 'ja', 'khaun', 'khau', 'khana', 'khaana', 'khaya', 'khayi', 'piya', 'peena', 'sona', 'soya', 'soyi',
    'chahiye', 'sakta', 'sakti', 'sakte', 'lagta', 'lagti', 'dard', 'neend', 'thakan', 'thakaan', 'pait', 'sar',
    'bhai', 'yaar', 'acha', 'accha', 'achha', 'theek', 'thik', 'haan', 'haa', 'ji', 'batao', 'bata', 'bolo', 'dekho', 'samjhao',
    'wala', 'wali', 'wale', 'liye', 'ke', 'ki', 'ka', 'ko', 'se', 'mein', 'mei', 'pe',
];
const HINGLISH_RE = new RegExp(`\\b(${HINGLISH_WORDS.join('|')})\\b`, 'gi');
// Words that carry no language on their own: a message made only of these is neutral.
const NEUTRAL_RE = /^(ok|okay|k|kk|haan|haa|han|ha|ji|yes|no|nahi|nhi|hmm+|thanks|thank you|ty|done|sure|undo|\d+(\.\d+)?\s*(kg|cm|kcal|mg)?|[\p{P}\p{S}\s]*)$/iu;

const LANGUAGES = ['english', 'hindi', 'hinglish'];

function detectLanguage(message) {
    const text = String(message || '').trim();
    if (!text) return 'neutral';
    if (DEVANAGARI_RE.test(text)) return 'hindi';
    // Keep decimal points ("68.5 kg"); drop other punctuation.
    const cleaned = text.toLowerCase().replace(/[!?,]+|\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim();
    if (NEUTRAL_RE.test(cleaned)) return 'neutral';
    const words = cleaned.split(' ').filter(Boolean);
    const hits = (cleaned.match(HINGLISH_RE) || []).length;
    // One Hindi word in a short message ("gym jaun?") or two in a longer one.
    if (hits >= 2 || (hits >= 1 && words.length <= 6)) return 'hinglish';
    return 'english';
}

// Final language for this message. The classifier's answer is used when the
// message has a clear signal of its own; a neutral message keeps the
// conversation's language. Code detection beats the classifier only for
// Devanagari (unambiguous) and when the classifier failed (no language).
function resolveLanguage({ message, classifierLanguage = null, previous = null }) {
    const detected = detectLanguage(message);
    if (detected === 'neutral') return LANGUAGES.includes(previous) ? previous : (LANGUAGES.includes(classifierLanguage) ? classifierLanguage : 'english');
    if (detected === 'hindi') return 'hindi';
    if (LANGUAGES.includes(classifierLanguage)) return classifierLanguage;
    return detected;
}

const isHinglishOrHindi = (language) => language === 'hinglish' || language === 'hindi';

module.exports = { detectLanguage, resolveLanguage, isHinglishOrHindi, LANGUAGES };
