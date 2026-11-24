/**
 * Code emails (signup OTP, resend, forgot password) must not answer "sent"
 * when the email failed: emailService.sendEmail returns { success: false }
 * instead of throwing, and that used to be ignored.
 *
 * Run: node --test tests/emailCodeSendFailure.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const emailService = require('../services/emailService');
const User = require('../models/User');
const Otp = require('../models/Otp');
const auth = require('../controllers/authController');

const run = (handler, body) => new Promise((resolve) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { resolve({ status: this.statusCode, body: payload }); },
  };
  handler({ body, headers: {}, query: {} }, res);
});

const SMTP_DOWN = { success: false, error: 'Invalid login' };

test('signup OTP: email failure -> 503, not "code sent"', async (t) => {
  t.mock.method(User, 'findOne', async () => null);
  t.mock.method(Otp, 'findOneAndUpdate', async () => ({}));
  t.mock.method(emailService, 'sendVerificationCode', async () => SMTP_DOWN);
  const r = await run(auth.requestRegistrationOtp, { email: 'a@b.com', name: 'A' });
  assert.equal(r.status, 503);
  assert.equal(r.body.code, 'EMAIL_SEND_FAILED');
});

test('signup OTP: email sent -> 200', async (t) => {
  t.mock.method(User, 'findOne', async () => null);
  t.mock.method(Otp, 'findOneAndUpdate', async () => ({}));
  t.mock.method(emailService, 'sendVerificationCode', async () => ({ success: true }));
  const r = await run(auth.requestRegistrationOtp, { email: 'a@b.com', name: 'A' });
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
});

test('forgot password: email failure -> 503', async (t) => {
  t.mock.method(User, 'findOne', async () => ({ email: 'a@b.com', name: 'A', save: async () => {} }));
  t.mock.method(emailService, 'sendPasswordResetCode', async () => SMTP_DOWN);
  const r = await run(auth.forgotPassword, { email: 'a@b.com' });
  assert.equal(r.status, 503);
});
