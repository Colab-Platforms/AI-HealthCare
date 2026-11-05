// Hard checks on LLM-written insight text. The prompt asks for all of this,
// but a prompt is a request, not a guarantee — live samples still slipped in
// "thirty minutes", "crushed", em dashes, and messages with no action at all.
// Anything that fails here is sent back to the model with the exact problems
// listed, and never saved if it keeps failing.

// Digits, percentages, number words. "one" is excluded on purpose: it is an
// everyday pronoun ("no one", "one more walk") far more often than a figure.
const NUMBER_PATTERN = /\d|%|\b(zero|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|half an hour|a dozen)\b/i;

// Phrases that read as generic AI coach-speak rather than a person.
const AI_PHRASES = [
  ['great sign', /\bgreat sign\b/i],
  ['momentum', /\bmomentum\b/i],
  ['crushed/crushing', /\bcrush(ed|ing)?\b/i],
  ['keep it up', /\bkeep it up\b|\bkeep up the\b/i],
  ['prioritize', /\bprioriti[sz]/i],
  ['consistency is key', /\bconsistency is key\b/i],
  ['journey', /\bjourney\b/i],
  ["it's important to", /\b(it's|it is) important to\b/i],
  ['remember to', /\bremember to\b/i],
  ["don't forget", /\bdon'?t forget\b/i],
  ['well done', /\bwell done\b/i],
  ['amazing', /\bamazing\b/i],
  ['em/en dash', /[—–]/],
  ['exclamation mark', /!/],
  ['the word today/yesterday', /\b(today|yesterday)\b/i],
];

// Said about a day that is already over, these are simply wrong.
const PRESENT_TENSE_WORDS = /\b(right now|now|yet|so far|this evening|later today)\b/i;

// A sentence counts as the action if it starts (after an optional "Tonight,"
// style lead-in) with one of these verbs.
const ACTION_VERBS = new Set([
  'try', 'aim', 'get', 'plan', 'add', 'give', 'keep', 'make', 'take', 'go', 'start',
  'head', 'swap', 'set', 'put', 'drink', 'eat', 'walk', 'wind', 'have', 'fit', 'sneak',
  'build', 'stick', 'choose', 'pick', 'focus', 'let', 'ease', 'spend', 'grab', 'pair',
  'log', 'stay', 'bring', 'turn', 'skip', 'move', 'stretch', 'sip', 'include', 'save',
  'carry', 'shift', 'protect', 'rest', 'treat', 'see', 'lean', 'top', 'dim', 'cut', 'hold',
  'wear', 'charge', 'sync', 'limit', 'avoid', 'leave', 'switch', 'repeat', 'reach', 'opt', 'line', 'use',
]);
const LEAD_IN = /^(tonight|tomorrow|this evening|next time|for tomorrow|so|and|then|before bed|after dinner|in the morning)\b[\s,]*/i;

const sentences = (text) => String(text).split(/(?<=[.?])\s+/).map((s) => s.trim()).filter(Boolean);

// Clause-level, not just sentence starts: "With no heart-rate data captured,
// wear your sensor overnight" is a real action that a sentence-start check
// rejected three times in a row.
function hasActionSentence(description) {
  return sentences(description)
    .flatMap((s) => s.split(/[,;:]\s*/))
    .some((clause) => {
      const first = clause.trim().replace(LEAD_IN, '').split(/\s/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
      return ACTION_VERBS.has(first);
    });
}

/**
 * Problems with a parsed {title, description, summary}, as short phrases the
 * model can act on. Empty array = good to save. `dayIsOver` bans present
 * tense ("now", "yet") for insights describing a finished day.
 */
function findTextProblems(parsed, { dayIsOver = true } = {}) {
  const all = [parsed.title, parsed.description, parsed.summary].filter(Boolean).join(' ');
  const problems = [];
  const numberHit = all.match(NUMBER_PATTERN);
  if (numberHit) problems.push(`contains a number ("${numberHit[0]}") — use words like "a little" or "a short walk"`);
  for (const [label, pattern] of AI_PHRASES) {
    if (pattern.test(all)) problems.push(`uses ${label}`);
  }
  if (dayIsOver) {
    const tenseHit = all.match(PRESENT_TENSE_WORDS);
    if (tenseHit) problems.push(`says "${tenseHit[0]}" about a day that is already over`);
  }
  if (!hasActionSentence(parsed.description || '')) {
    problems.push('has no action sentence — end with one that starts with a verb like Try, Aim, Get or Plan');
  }
  return problems;
}

// Mechanical slips are cheaper to fix in code than with another LLM call.
function autoFix(parsed) {
  const fix = (s) => String(s || '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/!+/g, '.')
    .replace(/\s+,/g, ',')
    .trim();
  return { title: fix(parsed.title).replace(/[.,]$/, ''), description: fix(parsed.description), summary: fix(parsed.summary) };
}

// ------------------------------------------------- agreement with the labels

const LOW_STEPS = new Set(['not_started', 'just_started', 'low']);
// "Activity is going well" / "you moved well" next to a step ring far from
// its goal reads as a mistake, even when a workout lifted the activity score.
// Bare "well" is left out: "steps fell well short" is the honest version.
const ACTIVITY_PRAISE = /\b(activity|movement)( score)? (was|is|looked|looks|came in|stayed|went|is going|was going) (really |very )?(solid|strong|great|good|excellent|well)\b|\b(solid|strong|great|good|excellent) (activity|movement)\b|\b(moved|moving) (well|a lot)\b/i;
const SLEEP_PRAISE = /\bsleep (was|is|looked|looks|came in) (really |very )?(excellent|great|perfect|strong|solid)\b|\b(excellent|great|perfect|strong|solid) sleep\b|\bslept (great|perfectly)\b/i;
const MEALS_AS_LOW = /\b(meals?|food|eating)\b[^.,;]{0,25}\b(low|light|small|under|few)\b|\b(light|small|few|fewer) meals?\b|\bate (little|less|light)\b/i;
const NEGATIVE_WORDS = /\b(short|low|lower|missed|needs? attention|under|behind|fell|slipped|not logged|weren't logged|wasn't logged)\b/i;

// What the text must mention to have actually made the connection the data
// picked. Every pattern in a list has to match.
const LINK_TERMS = {
  alcohol_sleep: [/\b(drink|drinks|alcohol)\b/i, /\b(sleep|recover\w*)\b/i],
  sleep_recovery: [/\b(sleep|night)\b/i, /\brecover\w*/i],
  sleep_activity: [/\b(sleep|night)\b/i, /\b(mov\w*|activ\w*|steps?|energy|walk\w*)\b/i],
  recovery_push: [/\brecover\w*/i, /\b(push\w*|hard|activ\w*|workout|mov\w*|train\w*)\b/i],
  underfuel_active: [/\b(meals?|ate|eat\w*|food|fuel\w*)\b/i, /\b(activ\w*|mov\w*|workout|steps?)\b/i],
  underfuel_inactive: [/\b(meals?|ate|eat\w*|food|fuel\w*)\b/i, /\b(energy|activ\w*|mov\w*)\b/i],
  workout_protein: [/\b(workout|exercise|training)\b/i, /\bprotein\b/i],
  surplus_inactive: [/\b(meals?|ate|eat\w*|food)\b/i, /\b(mov\w*|activ\w*|walk\w*|steps?)\b/i],
  water_active: [/\b(water|drink\w*|sip\w*)\b/i, /\b(activ\w*|mov\w*|workout)\b/i],
  rested_inactive: [/\b(rest\w*|sleep|recover\w*)\b/i, /\b(mov\w*|walk\w*|activ\w*|steps?)\b/i],
};

const LINK_MEANING = {
  alcohol_sleep: 'drinks the evening before affecting sleep or recovery',
  sleep_recovery: 'short sleep holding back recovery',
  sleep_activity: 'short sleep leaving less energy to move',
  recovery_push: 'pushing hard while not recovered',
  underfuel_active: 'meals too light for how active they were',
  underfuel_inactive: 'light meals leaving less energy to move',
  workout_protein: 'a workout without enough protein to recover from it',
  surplus_inactive: 'eating more than the body used while moving little',
  water_active: 'not enough water for how active they were',
  rested_inactive: 'being well rested but not moving much',
};

/**
 * Problems where the text disagrees with the labels it was written from —
 * the cases the model got wrong in production (praising activity on a
 * low-step day, calling a short night excellent) plus the overall link/tier.
 */
function findLabelProblems(parsed, categories, insightType) {
  if (!categories) return [];
  const all = [parsed.title, parsed.description, parsed.summary].filter(Boolean).join(' ');
  const problems = [];

  if ((insightType === 'overall' || insightType === 'fitness') && LOW_STEPS.has(categories.stepsVsGoal)
    && ACTIVITY_PRAISE.test(all)) {
    problems.push('praises activity although steps were well short of the goal (a workout can be credited, but never call the activity good, strong or going well)');
  }
  // Nothing logged is not the same as eating little ("meals are still low").
  if (categories.meals === 'none_logged' && MEALS_AS_LOW.test(all)) {
    problems.push('no meals were logged, so say they were not logged, never that meals were low or light');
  }
  if (insightType !== 'overall') return problems;

  if (categories.sleepVsGoal === 'below' && SLEEP_PRAISE.test(all)) {
    problems.push('calls sleep excellent or great although it was short of the sleep goal');
  }
  if (categories.tier === 'reward' && NEGATIVE_WORDS.test(all)) {
    problems.push('this is a reward day where everything came together, so nothing may be called short, low or missing');
  }
  if (categories.tier === 'incomplete_data' && !/\blog/i.test(parsed.description || '')) {
    problems.push('must ask them to log the pillars that were not logged');
  }
  const terms = LINK_TERMS[categories.link];
  if (terms && !terms.every((re) => re.test(parsed.description || ''))) {
    problems.push(`the first sentence must explain the connection the data shows: ${LINK_MEANING[categories.link]}`);
  }
  return problems;
}

module.exports = { findTextProblems, findLabelProblems, autoFix, hasActionSentence, NUMBER_PATTERN };
