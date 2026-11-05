const test = require('node:test');
const assert = require('node:assert');
const {
  findTextProblems, findLabelProblems, findRepeatProblems, copiedShare, autoFix, hasActionSentence,
} = require('../services/insightTextRules');

const insight = (description, title = 'Short on sleep', summary = 'Get to bed earlier tonight.') => ({ title, description, summary });

test('a clean, human insight with an action passes', () => {
  const problems = findTextProblems(insight(
    "That was a rough night, you were well short of your sleep goal and it's the second short one in a row. Tonight, try getting into bed a good while earlier and leave the phone in another room.",
  ));
  assert.deepStrictEqual(problems, []);
});

test('number words from live samples are rejected', () => {
  const problems = findTextProblems(insight('Sleep took a hit after a solid night before. Hit the sack thirty minutes earlier tonight and try winding down.'));
  assert.ok(problems.some((p) => p.includes('thirty')));
});

test('AI coach-speak phrases from live samples are rejected', () => {
  const problems = findTextProblems(insight(
    'You crushed your step goal, which is a great sign of consistent movement. Keep building on this momentum with a walk.',
    'You crushed it',
  ));
  for (const phrase of ['crushed', 'great sign', 'momentum']) {
    assert.ok(problems.some((p) => p.includes(phrase)), `expected "${phrase}" to be flagged`);
  }
});

test('em dashes and exclamation marks are rejected', () => {
  const problems = findTextProblems(insight("You're probably feeling wiped out—that night was well short! Try an earlier bedtime."));
  assert.ok(problems.some((p) => p.includes('dash')));
  assert.ok(problems.some((p) => p.includes('exclamation')));
});

test('"now"/"yet" is rejected only for a day that is over', () => {
  const text = insight("Meals were on track but water hasn't started yet. Try sipping water through the afternoon.");
  assert.ok(findTextProblems(text, { dayIsOver: true }).some((p) => p.includes('yet')));
  assert.ok(!findTextProblems(text, { dayIsOver: false }).some((p) => p.includes('yet')));
});

test('a description with no action sentence is rejected', () => {
  const problems = findTextProblems(insight('Your sleep and recovery need attention, while activity was excellent. Meals were fair but water was light.'));
  assert.ok(problems.some((p) => p.includes('no action')));
});

test('action sentences may start with a time lead-in', () => {
  assert.ok(hasActionSentence('Recovery dipped. Tomorrow, aim for an easy day with a gentle walk.'));
  assert.ok(hasActionSentence('Recovery dipped. Tonight try to wind down early.'));
  assert.ok(!hasActionSentence('Recovery dipped and your body is still bouncing back.'));
});

test('an action after a leading clause counts (live recovery sample)', () => {
  assert.ok(hasActionSentence('Recovery dropped. With no heart-rate data captured, wear your sensor overnight and keep bedtime steady.'));
  assert.ok(!hasActionSentence('Your sleep and recovery need attention, while meals were fair and water was light.'));
});

test('autoFix removes dashes and exclamation marks without an LLM call', () => {
  const fixed = autoFix({ title: 'Nice work!', description: 'You moved—a lot! Try a walk.', summary: 'Good day!' });
  assert.strictEqual(fixed.title, 'Nice work');
  assert.strictEqual(fixed.description, 'You moved, a lot. Try a walk.');
  assert.deepStrictEqual(findTextProblems(fixed).filter((p) => /dash|exclamation/.test(p)), []);
});

test('praising activity on a low-step day is rejected (live samples)', () => {
  const low = { stepsVsGoal: 'just_started' };
  for (const text of ['Activity is going well so far, though steps are just starting.', 'You moved well with your workout.', 'Strong activity even with fewer steps.']) {
    assert.ok(findLabelProblems(insight(text, 'Steps behind'), low, 'overall').length > 0, text);
  }
  const honest = insight('Your workout counted, but your steps fell well short of your goal. Try a short walk after dinner.', 'Workout done, steps behind');
  assert.deepStrictEqual(findLabelProblems(honest, low, 'fitness'), []);
});

test('overall: a short night may not be called excellent sleep', () => {
  const text = insight('Your sleep was excellent and meals were on track. Keep the same bedtime tomorrow.', 'Good day');
  assert.ok(findLabelProblems(text, { sleepVsGoal: 'below', link: 'none' }, 'overall').length > 0);
});

test('overall: a reward day may not point at anything as short or low', () => {
  const cats = { tier: 'reward', link: 'all_good' };
  const bad = insight('Great day overall, though water was a little low. Keep the same rhythm tomorrow.', 'Great day');
  const good = insight('Everything came together, with good sleep, strong recovery and your step goal reached. Keep the same rhythm tomorrow.', 'Everything came together');
  assert.ok(findLabelProblems(bad, cats, 'overall').length > 0);
  assert.deepStrictEqual(findLabelProblems(good, cats, 'overall'), []);
});

test('overall: the text must make the connection the data picked', () => {
  const cats = { tier: 'improve', link: 'sleep_recovery' };
  const missed = insight('Meals were fair and movement was low. Try a short walk tomorrow.');
  const made = insight('Short sleep likely held back your recovery, even with fair meals. Tonight, get to bed a bit earlier.');
  assert.ok(findLabelProblems(missed, cats, 'overall').some((p) => p.includes('connection')));
  assert.deepStrictEqual(findLabelProblems(made, cats, 'overall'), []);
});

test('no meals logged may not be described as meals being low (live abhiraj sample)', () => {
  const cats = { meals: 'none_logged', tier: 'in_progress', link: 'none' };
  const bad = insight('Last night was well short of your sleep goal, and steps and meals are still low so far. Try a short walk in your next break.');
  const good = insight('Last night was well short of your sleep goal, steps are still low and no meals are logged so far. Try a short walk in your next break.');
  assert.ok(findLabelProblems(bad, cats, 'overall').some((p) => p.includes('not logged')));
  assert.deepStrictEqual(findLabelProblems(good, cats, 'overall'), []);
});

test('copying the example word for word is rejected, the same idea in new words is not (live abhiraj sample)', () => {
  const example = 'Short sleep likely held back your recovery, which can leave you feeling more tired than usual. Tonight, get to bed a bit earlier so tomorrow starts with more energy.';
  const copied = example;
  const ownWords = 'Another short night seems to have kept your recovery down, so your body may feel heavier. Try winding down a little sooner tonight to give it a proper chance to recharge.';
  assert.strictEqual(copiedShare(copied, example), 1);
  assert.ok(copiedShare(ownWords, example) < 0.5);
  assert.ok(findRepeatProblems(copied, { example }).some((p) => p.includes('own words')));
  assert.deepStrictEqual(findRepeatProblems(ownWords, { example }), []);
});

test('single pillars: the reason must be explained, and a reward day names no shortfall', () => {
  const reasonCats = { tier: 'improve', reason: 'workout_needs_protein' };
  const missed = insight('Your meals were logged and calories were on track. Tomorrow, add eggs to one meal.');
  const made = insight('You got a workout in, but protein stayed low, and your muscles need it. Tomorrow, add eggs to one meal.');
  assert.ok(findLabelProblems(missed, reasonCats, 'nutrition').some((p) => p.includes('reason')));
  assert.deepStrictEqual(findLabelProblems(made, reasonCats, 'nutrition'), []);
  const rewardDay = insight('You reached your step goal, though water was low. Keep the same walk tomorrow.', 'Step goal reached');
  assert.ok(findLabelProblems(rewardDay, { tier: 'reward' }, 'fitness').length > 0);
});

test('sleep: a short night may not get a positive title, and well short is never "a little"', () => {
  const desc = 'You were well short of your sleep goal. Tonight, aim for a noticeably earlier bedtime.';
  const cats = { lastNightVsGoal: 'below', shortBy: 'well_short', tier: 'improve', reason: 'none' };
  assert.ok(findLabelProblems(insight(desc, 'Good sleep quality'), cats, 'sleep').some((p) => p.includes('positive')));
  assert.ok(findLabelProblems(insight(desc, 'A little short on sleep'), cats, 'sleep').some((p) => p.includes('well short')));
  assert.deepStrictEqual(findLabelProblems(insight(desc, 'Well short of your sleep goal'), cats, 'sleep'), []);
});

test("repeating the previous day's message is rejected", () => {
  const previousMessage = 'Steps on target again, you met your goal for the day. Plan a similar walk tomorrow to stay in the groove.';
  assert.ok(findRepeatProblems(previousMessage, { previousMessage }).some((p) => p.includes('previous day')));
});

test('"one" as a pronoun is allowed, "keep it steady" is not mistaken for "keep it up"', () => {
  const problems = findTextProblems(insight('No one sleeps perfectly every night. Keep it steady by aiming for the same bedtime tomorrow.'));
  assert.deepStrictEqual(problems, []);
});
