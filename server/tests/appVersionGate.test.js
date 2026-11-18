/**
 * POST /api/app-version/report must always return the version gate
 * { minBuild, latestBuild, message, storeUrl } — it used to reject every call
 * from the app with "minBuild must be a positive integer" because it read the
 * app's own build from a body field the app never sends.
 *
 * Run: node --test tests/appVersionGate.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const AppVersionConfig = require('../models/AppVersionConfig');
const { reportVersion, pushVersionUpdate, getVersionConfig } = require('../controllers/appVersionController');

const chain = (value) => ({ select: () => ({ lean: async () => value }), lean: async () => value });

function run(handler, body) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); },
    };
    handler({ body }, res);
  });
}

// What the app does with the response.
const appDecision = (build, gate) => (build < gate.minBuild ? 'force' : build < gate.latestBuild ? 'optional' : 'none');

const ANDROID = { platform: 'android', minBuild: 18, latestBuild: 18, message: 'Update please', storeUrl: 'https://play.example/app' };

test('app request without minBuild (the real app body) returns the gate', async (t) => {
  t.mock.method(AppVersionConfig, 'findOne', () => chain(ANDROID));
  const r = await run(reportVersion, { platform: 'android', version: '1.0.4', buildNumber: 17 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { success: true, minBuild: 18, latestBuild: 18, message: 'Update please', storeUrl: 'https://play.example/app' });
});

test('build 17 is forced to update, build 18 sees nothing', async (t) => {
  t.mock.method(AppVersionConfig, 'findOne', () => chain(ANDROID));
  const { body } = await run(reportVersion, { platform: 'android', buildNumber: 17 });
  assert.equal(appDecision(17, body), 'force');
  assert.equal(appDecision(18, body), 'none');
});

test('empty DB: still 200 with safe defaults (never forced)', async (t) => {
  t.mock.method(AppVersionConfig, 'findOne', () => chain(null));
  const r = await run(reportVersion, { platform: 'android' });
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
  assert.equal(r.body.minBuild, 1);
  assert.equal(r.body.latestBuild, 1);
  assert.match(r.body.message, /new version/);
  assert.match(r.body.storeUrl, /play\.google\.com/);
});

test('a config saved before minBuild existed counts as never forced', async (t) => {
  t.mock.method(AppVersionConfig, 'findOne', () => chain({ platform: 'ios', latestBuild: 20 }));
  const { body } = await run(reportVersion, { platform: 'ios', buildNumber: 19 });
  assert.equal(body.minBuild, 1);
  assert.equal(body.latestBuild, 20);
  assert.equal(appDecision(19, body), 'optional');
});

test('only a bad platform is rejected', async () => {
  const r = await run(reportVersion, { platform: 'windows', buildNumber: 17 });
  assert.equal(r.status, 400);
});

test('admin save: minBuild is stored next to latestBuild', async (t) => {
  let saved;
  t.mock.method(AppVersionConfig, 'findOneAndUpdate', (_f, update) => {
    saved = update.$set;
    return { lean: async () => ({ platform: 'android', ...update.$set }) };
  });
  const r = await run(pushVersionUpdate, { android: { version: '1.0.5', minBuild: 18, latestBuild: 18 } });
  assert.equal(r.status, 200);
  assert.equal(saved.minBuild, 18);
  assert.equal(saved.latestBuild, 18);
  assert.equal(r.body.updated.android.minBuild, 18);
});

test('admin save: minBuild above latestBuild is rejected and nothing is written', async (t) => {
  const write = t.mock.method(AppVersionConfig, 'findOneAndUpdate', () => ({ lean: async () => ({}) }));
  const r = await run(pushVersionUpdate, {
    android: { version: '1.0.5', minBuild: 10, latestBuild: 12 },
    ios: { version: '2.0', minBuild: 25, latestBuild: 20 },
  });
  assert.equal(r.status, 400);
  assert.equal(write.mock.callCount(), 0);
});

test('admin save without minBuild keeps the saved one', async (t) => {
  t.mock.method(AppVersionConfig, 'findOne', () => chain({ minBuild: 18 }));
  let saved;
  t.mock.method(AppVersionConfig, 'findOneAndUpdate', (_f, update) => {
    saved = update.$set;
    return { lean: async () => ({ platform: 'android', ...update.$set }) };
  });
  await run(pushVersionUpdate, { android: { version: '1.0.6', latestBuild: 19 } });
  assert.equal(saved.minBuild, 18);
});

test('admin read returns minBuild (1 for old docs)', async (t) => {
  t.mock.method(AppVersionConfig, 'find', () => chain([{ platform: 'android', minBuild: 18, latestBuild: 18 }, { platform: 'ios', latestBuild: 20 }]));
  const r = await run(getVersionConfig, {});
  assert.equal(r.body.android.minBuild, 18);
  assert.equal(r.body.ios.minBuild, 1);
});
