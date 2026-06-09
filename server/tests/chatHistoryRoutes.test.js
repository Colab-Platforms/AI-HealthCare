const test = require('node:test');
const assert = require('node:assert/strict');

const { getAuthenticatedUserId } = require('../routes/chatHistoryRoutes');

test('getAuthenticatedUserId prefers req.user._id when present', () => {
  const req = { user: { _id: '507f1f77bcf86cd799439011' } };
  assert.equal(getAuthenticatedUserId(req), '507f1f77bcf86cd799439011');
});

test('getAuthenticatedUserId falls back to req.user.id and req.user.userId', () => {
  assert.equal(getAuthenticatedUserId({ user: { id: '123' } }), '123');
  assert.equal(getAuthenticatedUserId({ user: { userId: '456' } }), '456');
});
