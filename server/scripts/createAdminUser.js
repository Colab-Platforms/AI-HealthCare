/**
 * Create (or promote) a single admin login in the database named by MONGODB_URI.
 *
 * Usage (PowerShell, from the server folder). The password is read from an
 * environment variable so it never appears in chat, shell history of the repo, or git:
 *
 *   $env:ADMIN_EMAIL="you@example.com"
 *   $env:ADMIN_NAME="Your Name"
 *   $env:ADMIN_PASSWORD="choose-a-strong-password"
 *   $env:ADMIN_ROLE="superadmin"        # admin | takeadmin | superadmin
 *   node scripts/createAdminUser.js
 *
 * - If the email does not exist: a new user is created (password hashed by the User model).
 * - If the email already exists: ONLY the role is changed; the password is left alone.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const ROLES = ['admin', 'takeadmin', 'superadmin'];

(async () => {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const name = (process.env.ADMIN_NAME || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  const role = (process.env.ADMIN_ROLE || 'admin').trim();

  if (!email) throw new Error('ADMIN_EMAIL is required');
  if (!ROLES.includes(role)) throw new Error('ADMIN_ROLE must be one of: ' + ROLES.join(', '));
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  console.log('Connected to database:', mongoose.connection.name);

  const existing = await User.findOne({ email });
  if (existing) {
    existing.role = role;
    await existing.save();
    console.log('Existing user found. Role set to', role, 'for', email, '(password unchanged).');
  } else {
    if (!name) throw new Error('ADMIN_NAME is required to create a new user');
    if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');
    await User.create({
      name,
      email,
      password,                 // hashed by the User pre-save hook
      role,
      isActive: true,
      isEmailVerified: true,
      privacyPolicyAccepted: true,
      authProvider: 'local',
    });
    console.log('Created new', role, 'user:', email);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
