/**
 * Issue #3 (staging 24 Nov): a Hinglish reply ended with the gap question in
 * English. One language decision per message now (orchestrator/language.js).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { detectLanguage, resolveLanguage } = require('../modules/ai-coach/orchestrator/language');

test('detectLanguage: Hinglish with no word from the old 15-word list is still Hinglish', () => {
    for (const msg of [
        'tired hoon, gym jaun?',
        'aaj neend achi nahi aayi',
        'pait mein jalan, dinner mein kya khaun?',
        'bhai protein kitna lu',
        'thakan lag rahi hai',
    ]) assert.equal(detectLanguage(msg), 'hinglish', msg);
});

test('detectLanguage: English stays English, including words that look Hindi', () => {
    for (const msg of [
        'I am feeling tired today, should I go to the gym?',
        'going to the gym?',
        'I bought a new yoga mat, any stretches?',
        'jet lag is killing me',
        'my sir told me to run more',
        'what should I eat for dinner?',
        'left knee pain',
    ]) assert.equal(detectLanguage(msg), 'english', msg);
});

test('detectLanguage: Devanagari is Hindi; ok / haan / numbers / emoji are neutral', () => {
    assert.equal(detectLanguage('मुझे नींद नहीं आती'), 'hindi');
    for (const msg of ['ok', 'haan', 'Yes', '72', '68.5 kg', '👍', 'thanks', 'undo', '']) {
        assert.equal(detectLanguage(msg), 'neutral', msg);
    }
});

test('resolveLanguage: neutral keeps the chat language; a clear message follows the classifier', () => {
    assert.equal(resolveLanguage({ message: 'ok', classifierLanguage: 'english', previous: 'hinglish' }), 'hinglish');
    assert.equal(resolveLanguage({ message: '72', previous: null }), 'english');
    assert.equal(resolveLanguage({ message: 'tired hoon', classifierLanguage: null, previous: 'english' }), 'hinglish');
    assert.equal(resolveLanguage({ message: 'what about protein?', classifierLanguage: 'english', previous: 'hinglish' }), 'english');
    assert.equal(resolveLanguage({ message: 'मुझे नींद', classifierLanguage: 'hinglish' }), 'hindi');
});
