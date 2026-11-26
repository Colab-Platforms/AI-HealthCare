/**
 * Guard: health facts in User.profile are a MIRROR of HealthProfile. Only
 * ProfileWriteService (via modules/health-profile) may write them; any other
 * direct write makes the two copies drift. This scans the app code for the
 * write patterns and fails on a new one.
 *
 * Found one? Send the write through
 * modules/health-profile/services/profileSync.js (or ProfileWriteService)
 * instead. Read queries are fine and not matched.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCAN_DIRS = ['controllers', 'services', 'routes', 'utils', 'middleware', 'modules', 'models', 'jobs', 'workers', 'config'];
const SKIP_DIRS = [path.join('modules', 'health-profile')];

const HEALTH_KEYS = [
    'age', 'gender', 'height', 'weight', 'dateOfBirth', 'bloodGroup',
    'allergies', 'chronicConditions', 'healthConditions', 'healthConditionOther', 'isDiabetic',
    'dietaryPreference', 'activityLevel', 'profession', 'goals', 'goalOther',
    'medicalHistory(?:\\.\\w+)?',
    'lifestyle\\.(?:smoker|smokingFrequency|alcohol|alcoholFrequency|sleepHours|stressLevel)',
].join('|');

const PATTERNS = [
    // update object key with a plain value: { 'profile.weight': x }, $set/$push/$unset.
    // `{ $regex ... }` style values are query filters (reads) and not matched.
    { name: 'update key', re: new RegExp(`['"\`]profile\\.(?:${HEALTH_KEYS})['"\`]\\s*:(?!\\s*\\{\\s*\\$)`) },
    // assignment on a document: user.profile.weight = x
    { name: 'assignment', re: new RegExp(`\\.profile\\.(?:${HEALTH_KEYS})\\s*=(?!=)`) },
    // whole-profile replace: user.profile = {...}
    { name: 'profile replace', re: /\.profile\s*=(?!=)/ },
    // doc.set('profile.weight', x)
    { name: 'set()', re: new RegExp(`\\.set\\(\\s*['"\`]profile\\.(?:${HEALTH_KEYS})['"\`]`) },
];

// Known writes still waiting to be moved. Each entry must still match (a
// stale entry fails the test too), so this list only ever shrinks.
const ALLOWED = [
    {
        file: 'controllers/authController.js',
        contains: 'user.profile = mergedProfile',
        // Old app versions' profile edit. The legacy save is followed by
        // profileSync.syncLegacyEdit (5b). Remove with the endpoint once old app
        // versions are force-updated to /api/health-profile.
        reason: 'updateProfile: legacy save + syncLegacyEdit, until old app versions are gone',
    },
];

function* walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(ROOT, full);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || SKIP_DIRS.includes(rel)) continue;
            yield* walk(full);
        } else if (entry.name.endsWith('.js')) {
            yield full;
        }
    }
}

function findWrites() {
    const hits = [];
    for (const dir of SCAN_DIRS) {
        const abs = path.join(ROOT, dir);
        if (!fs.existsSync(abs)) continue;
        for (const file of walk(abs)) {
            const rel = path.relative(ROOT, file).split(path.sep).join('/');
            fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
                const code = line.replace(/\/\/.*$/, '');
                if (/^\s*\*/.test(code)) return; // block comment line
                for (const p of PATTERNS) {
                    if (p.re.test(code)) hits.push({ file: rel, line: i + 1, text: line.trim(), pattern: p.name });
                }
            });
        }
    }
    return hits;
}

test('no direct writes to User.profile health fields outside HealthProfile', () => {
    const hits = findWrites();
    const isAllowed = (h) => ALLOWED.some((a) => a.file === h.file && h.text.includes(a.contains));
    const offenders = hits.filter((h) => !isAllowed(h));
    assert.deepEqual(offenders, [], `Direct health-field writes found (route them through profileSync):\n${
        offenders.map((h) => `  ${h.file}:${h.line} [${h.pattern}] ${h.text}`).join('\n')}`);

    const stale = ALLOWED.filter((a) => !hits.some((h) => h.file === a.file && h.text.includes(a.contains)));
    assert.deepEqual(stale, [], 'Allowlist entry no longer matches anything: remove it');
});

test('guard patterns catch the write styles they claim to', () => {
    const catches = (s) => PATTERNS.some((p) => p.re.test(s));
    assert.ok(catches(`await User.updateOne({ _id }, { $set: { 'profile.weight': w } })`));
    assert.ok(catches(`{ "profile.allergies": [] }`));
    assert.ok(catches(`$push: { 'profile.medicalHistory.currentMedications': m }`));
    assert.ok(catches(`'profile.lifestyle.smoker': true`));
    assert.ok(catches(`user.profile.weight = Number(weight);`));
    assert.ok(catches(`user.profile = { ...user.profile, ...body };`));
    assert.ok(catches(`user.set('profile.gender', g)`));
    // reads and app settings are not matched
    assert.ok(!catches(`{ 'profile.gender': { $regex: x, $options: 'i' } }`));
    assert.ok(!catches(`if (user.profile.weight === 0) return;`));
    assert.ok(!catches(`.select('profile.age profile.weight')`));
    assert.ok(!catches(`{ 'profile.lifestyle.waterGlassSizeMl': ml }`));
    assert.ok(!catches(`{ 'profile.avatar': url }`));
});
