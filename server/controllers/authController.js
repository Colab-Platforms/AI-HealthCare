const fs = require('fs');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const HealthGoal = require('../models/HealthGoal');
const { calculateNutritionGoals } = require('../services/nutritionGoalCalculator');
const cloudinary = require('../services/cloudinary');
const Otp = require('../models/Otp');
const { logActivity } = require('../utils/activityLogger');
const gamificationService = require('../services/gamificationService');
const RefreshToken = require('../models/RefreshToken');
const FCMToken = require('../models/FCMToken');
const crypto = require('crypto')

// Short-lived access token — 15 minutes
const generateAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' });

// Long-lived refresh token — opaque random string stored in DB
const generateRefreshToken = () => crypto.randomBytes(40).toString('hex');

// Legacy alias so existing register/doctor flows still work
const generateToken = generateAccessToken;

// DPDPA Section 9: a submitted age under 18 requires verifiable guardian
// consent before that profile data can be stored. Returns an error message
// string if consent is missing/incomplete, or null if the request may proceed.
const checkGuardianConsentRequired = (age, guardianConsent, alreadyOnFile) => {
  const numericAge = Number(age);
  if (!Number.isFinite(numericAge) || numericAge <= 0 || numericAge >= 18) return null;
  if (alreadyOnFile) return null;
  if (guardianConsent?.given && guardianConsent?.guardianName && guardianConsent?.guardianEmail) return null;
  return 'This profile indicates an age under 18. Guardian consent (guardianConsent: { given, guardianName, guardianEmail }) is required under DPDPA before this data can be saved.';
};

// ---------------------------------------------------------------------------
// Single-device sessions
//
// An account is bound to one device at a time (User.device_id). The binding was
// previously only ever written at registration and cleared at logout — never
// compared, never re-bound — so an app uninstall without logging out left a
// stale binding that no later login could reclaim. These helpers do the
// comparison, and re-bind the account to whichever device just signed in.
// ---------------------------------------------------------------------------

// The mobile app sends this snake_case, the web client camelCase, and a native
// HTTP layer may only be able to set a header. Accept all of them.
const getIncomingDeviceId = (req) => {
  const raw =
    req.body?.device_id ?? req.body?.deviceId ??
    req.query?.device_id ?? req.query?.deviceId ??
    req.headers['x-device-id'];
  const value = typeof raw === 'string' ? raw.trim() : (raw ? String(raw) : '');
  return value || null;
};

// Same snake_case/camelCase split as device_id — mobile sends fcm_token, web sends fcmToken.
const getIncomingFcmToken = (req) => {
  const raw = req.body?.fcmToken ?? req.body?.fcm_token;
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value.length >= 20 ? value : null;
};

// Upserts the token so a device that already registered just gets its lastUsedAt
// bumped instead of creating a duplicate row. Fire-and-forget — a failed token
// save must never fail the login/register/profile response, and this collection
// is independent of the User document so it's safe to run in parallel.
const upsertFcmTokenRecord = (userId, token, req) => {
  const platform = req.body?.platform || 'web';
  const deviceLabel = req.body?.deviceLabel || 'Unknown Device';

  FCMToken.findOneAndUpdate(
    { token },
    { userId, platform, deviceLabel, isActive: true, lastUsedAt: new Date() },
    { upsert: true, new: true }
  ).catch((e) => console.error('FCM token save failed:', e.message));
};

// Sets the legacy single-token field on an in-memory User document (the caller
// must still `await user.save()`) and upserts the FCMToken collection record.
// IMPORTANT: this must mutate the same document instance the handler is about
// to save — a parallel `User.updateOne` here would race the handler's own
// `user.save()` and get silently overwritten by the stale in-memory value.
const captureFcmToken = (user, req) => {
  const token = getIncomingFcmToken(req);
  if (!token) return;
  user.fcmToken = token;
  upsertFcmTokenRecord(user._id, token, req);
};

// One tagged logger for the whole device-binding path, so the full story of a
// single login can be pulled out of the logs with `grep '\[device\]'`.
//
// Values are JSON.stringify'd on purpose: an id that differs only by trailing
// whitespace, or an empty string vs. a real null, is invisible in a plain log
// line and is exactly the kind of mismatch that causes a false conflict.
const deviceLog = (stage, req, extra = {}) => {
  const b = req.body || {};
  const q = req.query || {};
  console.log('[device]', stage, JSON.stringify({
    // Which field the client actually populated — tells us at a glance whether
    // the app is sending snake_case, camelCase, the header, or nothing at all.
    sources: {
      'body.device_id': b.device_id ?? null,
      'body.deviceId': b.deviceId ?? null,
      'query.device_id': q.device_id ?? null,
      'query.deviceId': q.deviceId ?? null,
      'header.x-device-id': req.headers?.['x-device-id'] ?? null,
    },
    resolved: getIncomingDeviceId(req),
    forceFlag: wantsDeviceReplace(req),
    userAgent: req.headers?.['user-agent'] ?? null,
    ...extra,
  }));
};

// Query-string flags arrive as strings, body flags as real booleans.
const isTruthyFlag = (v) => v === true || v === 'true' || v === 1 || v === '1';

// "Sign me in here and drop the other device." Honoured from the body or the
// query string, under either casing.
const wantsDeviceReplace = (req) =>
  ['forceLogin', 'force_login', 'replaceDevice', 'replace_device', 'force']
    .some((flag) => isTruthyFlag(req.body?.[flag]) || isTruthyFlag(req.query?.[flag]));

// Decides whether `user` may sign in from this request's device and re-binds the
// account when they may; returns a 409 payload when they may not.
//
// Callers must only reach this once credentials are verified — run any earlier
// and it would tell an anonymous caller whether an account has an active
// session.
const claimDevice = async (user, req) => {
  const incoming = getIncomingDeviceId(req);
  const stored = user.device_id || null;

  deviceLog('claimDevice:enter', req, {
    userId: String(user._id),
    storedRaw: user.device_id ?? null,
    stored,
    incoming,
    // The comparison that decides everything. If these differ only by
    // whitespace/case, the mismatch is a normalisation bug, not a real
    // second device.
    equal: stored === incoming,
    storedLen: stored ? stored.length : 0,
    incomingLen: incoming ? incoming.length : 0,
  });

  // Clients that don't report a device (the web app) keep the old behaviour:
  // never blocked, and they don't disturb an existing mobile binding.
  if (!incoming) {
    deviceLog('claimDevice:allow(no-device-reported)', req, { userId: String(user._id), stored });
    return { allowed: true };
  }

  const isSameDevice = stored === incoming;
  const isUnbound = !stored;

  if (!isSameDevice && !isUnbound && !wantsDeviceReplace(req)) {
    deviceLog('claimDevice:BLOCK', req, {
      userId: String(user._id),
      stored,
      incoming,
      reason: 'account bound to a different device and no force flag sent',
    });
    return {
      allowed: false,
      status: 409,
      body: {
        message: 'This account is already logged in on another device.',
        code: 'DEVICE_ALREADY_LOGGED_IN',
        // Tells the app it may retry the same call with forceLogin: true.
        canForceLogin: true,
      },
    };
  }

  // Taking the account off a different device ends that device's session —
  // revoke its refresh tokens so it can't silently keep working. The new
  // session's token is created after this point, so it survives.
  if (!isSameDevice && !isUnbound) {
    deviceLog('claimDevice:takeover', req, {
      userId: String(user._id),
      stored,
      incoming,
      note: 'force flag present — revoking refresh tokens of the previous device',
    });
    await RefreshToken.deleteMany({ userId: user._id });
  }

  // Re-bind on every accepted login, same-device included: that is what makes a
  // reinstall (or any other stale binding) reclaimable.
  user.device_id = incoming; // keep the in-memory doc in step with later save()s
  await User.updateOne({ _id: user._id }, { device_id: incoming });

  deviceLog('claimDevice:allow(rebound)', req, {
    userId: String(user._id),
    previous: stored,
    boundTo: incoming,
    wasSameDevice: isSameDevice,
  });

  return { allowed: true };
};

exports.requestRegistrationOtp = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const email = req.body.email?.toLowerCase().trim();
    if (!email) return res.status(400).json({ message: 'Email is required' });

    // Check if user already exists (by email or phone)
    const existingUser = await User.findOne({
      $or: [{ email }, ...(phone ? [{ phone }] : [])]
    });
    if (existingUser) {
      const conflictField = existingUser.email === email ? 'email' : 'phone number';
      return res.status(400).json({ message: `An account with this ${conflictField} already exists` });
    }

    // Generate 6-digit code
    const code = crypto.randomInt(100000, 1000000).toString();

    // Save/Update OTP in DB
    await Otp.findOneAndUpdate(
      { email },
      { code, createdAt: Date.now() },
      { upsert: true, new: true }
    );

    // Send email
    const emailService = require('../services/emailService');
    await emailService.sendVerificationCode(email, name || 'User', code);

    res.json({ success: true, message: 'Verification code sent' });
  } catch (error) {
    console.error('OTP request error:', error);
    res.status(500).json({ message: 'Failed to send verification code' });
  }
};

// @desc    Send a login OTP to an existing user's phone (passwordless login, step 1)
// @route   POST /api/auth/phone/login-otp
exports.requestPhoneLoginOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    const phoneRegex = /^\d{10}$/;
    if (!phone || !phoneRegex.test(phone)) {
      return res.status(400).json({ message: 'A valid 10-digit phone number is required' });
    }

    const user = await User.findOne({ phone }).maxTimeMS(15000);
    if (!user) {
      return res.status(404).json({ message: 'No account found with this phone number' });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated. Please contact support at support@takesolutions.com' });
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    await Otp.findOneAndUpdate(
      { phone },
      { phone, code, createdAt: Date.now() },
      { upsert: true, new: true }
    );

    const smsService = require('../services/smsService');
    await smsService.sendOtpSms(phone, code);

    res.json({ success: true, message: 'Verification code sent to your phone' });
  } catch (error) {
    console.error('Phone login OTP request error:', error.message);
    res.status(500).json({ message: 'Failed to send verification code' });
  }
};


exports.loginWithPhoneOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone number and verification code are required' });
    }

    const otpRecord = await Otp.findOne({ phone, code: otp });
    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }
    await Otp.deleteOne({ _id: otpRecord._id });

    const user = await User.findOne({ phone }).populate('doctorProfile').maxTimeMS(15000);
    if (!user) {
      return res.status(404).json({ message: 'No account found with this phone number' });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated. Please contact support at support@takesolutions.com' });
    }

    const deviceCheck = await claimDevice(user, req);
    if (!deviceCheck.allowed) {
      return res.status(deviceCheck.status).json(deviceCheck.body);
    }

    user.isPhoneVerified = true;
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();

    const rawRefreshToken = generateRefreshToken();
    await RefreshToken.create({
      userId: user._id,
      token: rawRefreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    const response = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      profile: user.profile,
      nutritionGoal: user.nutritionGoal,
      foodPreferences: user.foodPreferences,
      subscription: user.subscription,
      healthMetrics: user.healthMetrics,
      consent: user.consent,
      privacySettings: user.privacySettings,
      dataRetention: user.dataRetention,
      token: generateAccessToken(user._id),
      refreshToken: rawRefreshToken,
    };

    if (user.role === 'doctor' && user.doctorProfile) {
      response.doctorProfile = {
        _id: user.doctorProfile._id,
        approvalStatus: user.doctorProfile.approvalStatus,
        specialization: user.doctorProfile.specialization,
        isListed: user.doctorProfile.isListed
      };
    }

    await logActivity(user._id, 'USER_LOGIN', 'authentication', { method: 'phone_otp' }, req);
    gamificationService.awardPoints(user._id, 'login', 'Daily Login').catch(console.error);

    res.json(response);
  } catch (error) {
    console.error('Phone OTP login error:', error.message);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
};

// @desc    Send an OTP to verify/change the logged-in user's phone number
// @route   POST /api/auth/phone/verify-otp
exports.requestPhoneVerificationOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    const phoneRegex = /^\d{10}$/;
    if (!phone || !phoneRegex.test(phone)) {
      return res.status(400).json({ message: 'A valid 10-digit phone number is required' });
    }

    const existingUser = await User.findOne({ phone, _id: { $ne: req.user._id } }).maxTimeMS(15000);
    if (existingUser) {
      return res.status(400).json({ message: 'This phone number is already linked to another account' });
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    await Otp.findOneAndUpdate(
      { phone },
      { phone, code, createdAt: Date.now() },
      { upsert: true, new: true }
    );

    const smsService = require('../services/smsService');
    await smsService.sendOtpSms(phone, code);

    res.json({ success: true, message: 'Verification code sent to your phone' });
  } catch (error) {
    console.error('Phone verification OTP request error:', error.message);
    res.status(500).json({ message: 'Failed to send verification code' });
  }
};

// @desc    Verify the OTP and mark the logged-in user's phone as verified
// @route   POST /api/auth/phone/verify
exports.verifyPhone = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone number and verification code are required' });
    }

    const otpRecord = await Otp.findOne({ phone, code: otp });
    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }
    await Otp.deleteOne({ _id: otpRecord._id });

    const user = await User.findById(req.user._id).maxTimeMS(15000);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.phone = phone;
    user.isPhoneVerified = true;
    await user.save();

    res.json({ success: true, message: 'Phone number verified successfully', phone: user.phone, isPhoneVerified: true });
  } catch (error) {
    console.error('Phone verification error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { name, phone, password, role, profile, nutritionGoal, otp, device_id } = req.body;
    const email = req.body.email?.toLowerCase().trim();
    const state = (req.body.state ?? profile?.state ?? req.body.foodPreferences?.state ?? '')
      .toString().trim() || null;

    // Validate required fields
    if (!name || !email || !password ) {
      console.log('Registration attempt: Missing required fields');
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Phone number validation (exactly 0 digits)
    const phoneRegex = /^\d{10}$/;
    if (phone && !phoneRegex.test(phone)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }

    // Password complexity validation
    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters long'
      });
    }

    console.log('Registration attempt for email:', email);

    // Check if user exists by email or phone - with extended timeout for Vercel
    let existingUser = null;
    try {
      existingUser = await User.findOne({
        $or: [{ email }, ...(phone ? [{ phone }] : [])]
      }).maxTimeMS(30000);
    } catch (dbError) {
      console.error('Database error checking existing user:', dbError.message);
      console.error('Database error code:', dbError.code);
      return res.status(503).json({
        message: 'Database error. Please try again.',
        error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }

    if (existingUser) {
      console.log('User already exists:', existingUser.email);
      const conflictField = existingUser.email === email ? 'email' : 'phone number';
      return res.status(400).json({ message: `An account with this ${conflictField} already exists` });
    }

    // ✅ VALIDATE OTP before registration
    if (!otp) return res.status(400).json({ message: 'Verification code is required' });
    const otpRecord = await Otp.findOne({ email, code: otp });
    if (!otpRecord) return res.status(400).json({ message: 'Invalid or expired verification code' });

    // Delete OTP after validation
    await Otp.deleteOne({ _id: otpRecord._id });

    // Determine role - default to user
    const userRole = role === 'doctor' ? 'doctor' : 'user';

    if (profile?.age) {
      const consentError = checkGuardianConsentRequired(profile.age, req.body.guardianConsent, false);
      if (consentError) return res.status(403).json({ message: consentError, requiresGuardianConsent: true });
    }

    // Calculate nutrition goals if profile data is provided
    let calculatedGoals = null;
    if (profile && profile.age && profile.gender && profile.weight && profile.height && nutritionGoal) {
      try {
        calculatedGoals = calculateNutritionGoals({
          age: profile.age,
          gender: profile.gender,
          weight: profile.weight,
          height: profile.height,
          activityLevel: profile.activityLevel || 'sedentary',
          goal: nutritionGoal.goal || 'general_health',
          targetWeight: nutritionGoal.targetWeight,
          weeklyGoal: nutritionGoal.weeklyGoal || 0.5,
          isDiabetic: profile.isDiabetic === 'yes'
        });
      } catch (calcError) {
        console.error('Nutrition goal calculation error:', calcError.message);
        // Continue with registration even if calculation fails
      }
    }

    let user = null;
    try {
      console.log('Creating user in database...');
      deviceLog('register:create-user', req, {
        email,
        storingRaw: device_id ?? null,
        wouldResolveTo: getIncomingDeviceId(req),
      });
      user = await User.create({
        name,
        email,
        phone,
        password,
        role: userRole,
        isEmailVerified: true,
        device_id: device_id || null,
        fcmToken: getIncomingFcmToken(req),
        profile: profile || {},
        ...(req.body.guardianConsent?.given ? {
          guardianConsent: {
            given: true,
            guardianName: req.body.guardianConsent.guardianName,
            guardianEmail: req.body.guardianConsent.guardianEmail,
            relation: req.body.guardianConsent.relation || '',
            consentedAt: new Date(),
          },
        } : {}),
        // Only set when the client actually sent one, so an absent state keeps
        // the schema default instead of writing an explicit null.
        ...(state ? { foodPreferences: { state } } : {}),
        nutritionGoal: calculatedGoals ? {
          goal: nutritionGoal.goal,
          targetWeight: nutritionGoal.targetWeight,
          weeklyGoal: nutritionGoal.weeklyGoal,
          ...calculatedGoals,
          autoCalculated: true
        } : undefined,
        subscription: {
          plan: 'free',
          status: 'active',
          startDate: new Date()
        }
      });

      // 🆕 CREATE INITIAL HEALTHGOAL IF PROFILE PROVIDED
      if (user && profile && nutritionGoal && profile.age) {
        try {
          await HealthGoal.create({
            userId: user._id,
            goalType: nutritionGoal.goal || 'health_improvement',
            currentWeight: profile.weight,
            targetWeight: nutritionGoal.targetWeight || profile.weight,
            height: profile.height,
            age: profile.age,
            gender: profile.gender,
            activityLevel: profile.activityLevel || 'sedentary',
            isActive: true
          });
          console.log('Initial HealthGoal created for user');
        } catch (goalError) {
          console.error('Failed to create initial HealthGoal:', goalError.message);
          // Don't fail the whole registration if this fails
        }
      }
    } catch (createError) {
      console.error('User creation error:', createError.message);
      console.error('User creation error code:', createError.code);
      console.error('User creation error stack:', createError.stack);
      return res.status(500).json({
        message: 'Failed to create user. Please try again.',
        error: process.env.NODE_ENV === 'development' ? createError.message : undefined
      });
    }

    console.log('User registered successfully:', user._id);

    if (user.fcmToken) upsertFcmTokenRecord(user._id, user.fcmToken, req);

    // Log activity
    await logActivity(user._id, 'USER_REGISTER', 'authentication', { role: user.role }, req);

    if (user.guardianConsent?.given) {
      const ConsentLog = require('../models/ConsentLog');
      await ConsentLog.create({
        userId: user._id,
        version: '1.0',
        action: 'granted',
        purposes: ['guardian_consent_minor'],
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          guardianName: user.guardianConsent.guardianName,
          guardianEmail: user.guardianConsent.guardianEmail,
          relation: user.guardianConsent.relation,
        },
      }).catch(err => console.error('Guardian ConsentLog failed:', err.message));
    }

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      profile: user.profile,
      nutritionGoal: user.nutritionGoal,
      subscription: user.subscription,
      token: generateToken(user._id)
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    console.error('Registration error stack:', error.stack);
    console.error('Registration error code:', error.code);
    res.status(500).json({
      message: 'Registration failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
};

// Doctor Registration - creates user + doctor profile (pending approval)
exports.registerDoctor = async (req, res) => {
  try {
    const {
      name, email, phone, password,
      specialization, qualifications, experience, hospital,
      licenseNumber, consultationFee, bio, device_id
    } = req.body;

    // Check if user exists - with extended timeout for Vercel
    const existingUser = await User.findOne({ email }).maxTimeMS(30000);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    deviceLog('registerDoctor:create-user', req, {
      email,
      storingRaw: device_id ?? null,
      wouldResolveTo: getIncomingDeviceId(req),
    });

    // Create user with doctor role - with extended timeout for Vercel
    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: 'doctor',
      isActive: true,
      device_id: device_id || null
    });

    // Create doctor profile (pending approval) - with extended timeout for Vercel
    const doctor = await Doctor.create({
      user: user._id,
      name,
      email,
      phone,
      specialization,
      qualifications: qualifications || [],
      experience,
      hospital,
      licenseNumber,
      consultationFee: consultationFee || 0,
      bio,
      approvalStatus: 'pending',
      isListed: false
    });

    // Link doctor profile to user - with extended timeout for Vercel
    user.doctorProfile = doctor._id;
    await user.save();

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      doctorProfile: {
        _id: doctor._id,
        approvalStatus: doctor.approvalStatus,
        specialization: doctor.specialization
      },
      message: 'Registration successful. Your profile is pending admin approval.',
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { phone, password, device_id } = req.body;
    const email = req.body.email?.toLowerCase().trim();

    deviceLog('login:request', req, { identifier: email || phone || null });

    // Input validation
    if (!email && !phone) {
      console.log('Login attempt: Missing email and phone');
      return res.status(400).json({ message: 'Email or phone is required' });
    }

    if (!password) {
      console.log('Login attempt: Missing password');
      return res.status(400).json({ message: 'Password is required' });
    }

    // Allow login with email or phone - with extended timeout for Vercel
    const query = email ? { email } : { phone };
    console.log('Login attempt with query:', query);

    let user;
    try {
      // doctorProfile is only ever read for role === 'doctor' (a few dozen accounts),
      // but populating it unconditionally cost every single patient login an extra
      // round-trip. Fetch the user first, then populate only when it's actually used.
      user = await User.findOne(query).maxTimeMS(15000);
    } catch (dbError) {
      console.error('Database error during user lookup:', dbError.message);
      console.error('Database error code:', dbError.code);
      return res.status(503).json({
        message: 'Database error. Please try again.',
        error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }

    if (!user) {
      console.log('User not found for query:', query);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('User found:', user._id, 'isActive:', user.isActive);

    if (!user.isActive) {
      console.log('User account is deactivated:', user._id);
      return res.status(403).json({ message: 'Account is deactivated. Please contact support at support@takesolutions.com' });
    }

    // Compare password with proper error handling
    let passwordMatch = false;
    try {
      console.log('Comparing password for user:', user._id);
      passwordMatch = await user.comparePassword(password);
    } catch (pwError) {
      console.error('Password comparison error:', pwError.message);
      console.error('Password comparison error stack:', pwError.stack);
      return res.status(500).json({
        message: 'Authentication error. Please try again.',
        error: process.env.NODE_ENV === 'development' ? pwError.message : undefined
      });
    }

    if (passwordMatch) {
      const deviceCheck = await claimDevice(user, req);
      if (!deviceCheck.allowed) {
        deviceLog('login:RESPONSE_409', req, { userId: String(user._id), body: deviceCheck.body });
        return res.status(deviceCheck.status).json(deviceCheck.body);
      }

      user.loginCount = (user.loginCount || 0) + 1;
      captureFcmToken(user, req);
      await user.save();

      // Issue refresh token and save to DB
      const rawRefreshToken = generateRefreshToken();
      await RefreshToken.create({
        userId: user._id,
        token: rawRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      // A full user.save() round-tripped the entire document (and re-ran every
      // validator) just to bump a counter. $inc touches one field and doesn't
      // block the response.
      User.updateOne({ _id: user._id }, { $inc: { loginCount: 1 } })
        .catch((e) => console.error('loginCount update failed:', e.message));

      // Doctors are the only role that reads this, so the extra query is paid
      // for by the few accounts that need it rather than by every login.
      if (user.role === 'doctor') {
        try {
          await user.populate('doctorProfile');
        } catch (e) {
          console.error('doctorProfile populate failed:', e.message);
        }
      }

      const response = {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profile: user.profile,
        nutritionGoal: user.nutritionGoal,
        foodPreferences: user.foodPreferences,
        subscription: user.subscription,
        healthMetrics: user.healthMetrics,
        consent: user.consent,
        privacySettings: user.privacySettings,
        dataRetention: user.dataRetention,
        token: generateAccessToken(user._id),
        refreshToken: rawRefreshToken,
      };

      // Include doctor profile info if user is a doctor
      if (user.role === 'doctor' && user.doctorProfile) {
        response.doctorProfile = {
          _id: user.doctorProfile._id,
          approvalStatus: user.doctorProfile.approvalStatus,
          specialization: user.doctorProfile.specialization,
          isListed: user.doctorProfile.isListed
        };
      }

      console.log('Login successful for user:', user._id);

      // Respond first. The audit log and gamification points are both
      // fire-and-forget: neither affects what the client receives, and awaiting
      // the audit write put two extra DB round-trips on the critical path of
      // every login. logActivity already swallows its own errors.
      res.json(response);

      logActivity(user._id, 'USER_LOGIN', 'authentication', { method: email ? 'email' : 'phone' }, req);
      gamificationService.awardPoints(user._id, 'login', 'Daily Login').catch(console.error);
    } else {
      console.log('Password mismatch for user:', user._id);
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Sign in (or sign up) with a Google OAuth2 access token obtained
//          client-side via google.accounts.oauth2 (see GoogleSignInButton.jsx
//          — a custom-styled button, not Google's iframe-rendered one).
//          Verified directly against Google's own endpoints (no
//          google-auth-library dependency, same raw-axios pattern used for
//          the Anthropic API in services/aiService.js).
// @route   POST /api/auth/google
exports.googleAuth = async (req, res) => {
  try {
    // Web (GoogleSignInButton.jsx) sends an OAuth2 access token via
    // google.accounts.oauth2. The mobile app (native Google Sign-In SDK)
    // sends an ID token (JWT) instead — a different token type that needs
    // a different Google verification endpoint. Support both.
    const { accessToken, idToken, device_id } = req.body;

    deviceLog('googleLogin:request', req, { tokenType: idToken ? 'idToken' : 'accessToken' });

    if (!accessToken && !idToken) {
      return res.status(400).json({ message: 'A Google access token or ID token is required' });
    }

    let tokenInfo;
    let profile;
    try {
      if (idToken) {
        const { data } = await axios.get('https://oauth2.googleapis.com/tokeninfo', { params: { id_token: idToken } });
        tokenInfo = data;
        // ID tokens already carry profile claims (with the openid/email/profile scopes) — no extra call needed.
        profile = { email: data.email, sub: data.sub, name: data.name, picture: data.picture };
      } else {
        const [tokenInfoRes, profileRes] = await Promise.all([
          axios.get('https://oauth2.googleapis.com/tokeninfo', { params: { access_token: accessToken } }),
          axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
          })
        ]);
        tokenInfo = tokenInfoRes.data;
        profile = profileRes.data;
      }
    } catch (verifyError) {
      console.error('Google token verification failed:', verifyError.response?.data || verifyError.message);
      return res.status(401).json({ message: 'Invalid Google token' });
    }

    // GOOGLE_CLIENT_ID may hold a single client ID or a comma-separated list
    // (web, iOS, Android each get their own client ID in Google Cloud Console —
    // an ID token's audience will be whichever one issued it).
    const allowedClientIds = (process.env.GOOGLE_CLIENT_ID || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    // Access-token tokeninfo responses identify the requesting client via
    // `azp` (authorized party); `aud` isn't always populated the same way
    // an ID token's `aud` claim is. Check both.
    const receivedAud = tokenInfo.aud || null;
    const receivedAzp = tokenInfo.azp || null;
    const audienceOk = allowedClientIds.includes(receivedAud) || allowedClientIds.includes(receivedAzp);

    if (!audienceOk) {
      console.log('Google token audience mismatch — receivedAud:', receivedAud, 'receivedAzp:', receivedAzp, 'expected (one of):', allowedClientIds);
      return res.status(401).json({ message: 'Google token audience mismatch' });
    }

    const email = profile.email?.toLowerCase().trim();
    const googleId = profile.sub;
    if (!email || !googleId) {
      return res.status(401).json({ message: 'Google token missing required fields' });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email }] }).populate('doctorProfile');

    if (!user) {
      deviceLog('googleLogin:create-user', req, {
        email,
        storingRaw: device_id ?? null,
        wouldResolveTo: getIncomingDeviceId(req),
      });
      user = await User.create({
        name: profile.name || email.split('@')[0],
        email,
        password: crypto.randomBytes(32).toString('hex'), // unusable random password — user only ever signs in via Google
        googleId,
        authProvider: 'google',
        isEmailVerified: true,
        device_id: device_id || null,
        profilePicture: profile.picture,
        subscription: {
          plan: 'free',
          status: 'active',
          startDate: new Date()
        }
      });
    } else if (!user.googleId) {
      // Existing password-based account with the same email — link it instead of creating a duplicate
      user.googleId = googleId;
      user.authProvider = 'google';
      await user.save();
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated. Please contact support at support@takesolutions.com' });
    }

    // The Google token is verified by this point, so the caller has proven they
    // own the account and the device state is safe to act on.
    const deviceCheck = await claimDevice(user, req);
    if (!deviceCheck.allowed) {
      deviceLog('googleLogin:RESPONSE_409', req, { userId: String(user._id), email, body: deviceCheck.body });
      return res.status(deviceCheck.status).json(deviceCheck.body);
    }

    user.loginCount = (user.loginCount || 0) + 1;
    captureFcmToken(user, req);
    await user.save();

    const rawRefreshToken = generateRefreshToken();
    await RefreshToken.create({
      userId: user._id,
      token: rawRefreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    // Counter bump, off the critical path — see login()
    User.updateOne({ _id: user._id }, { $inc: { loginCount: 1 } })
      .catch((e) => console.error('loginCount update failed:', e.message));

    if (user.role === 'doctor') {
      try {
        await user.populate('doctorProfile');
      } catch (e) {
        console.error('doctorProfile populate failed:', e.message);
      }
    }

    const response = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      profile: user.profile,
      nutritionGoal: user.nutritionGoal,
      foodPreferences: user.foodPreferences,
      subscription: user.subscription,
      healthMetrics: user.healthMetrics,
      consent: user.consent,
      privacySettings: user.privacySettings,
      dataRetention: user.dataRetention,
      token: generateAccessToken(user._id),
      refreshToken: rawRefreshToken,
    };

    if (user.role === 'doctor' && user.doctorProfile) {
      response.doctorProfile = {
        _id: user.doctorProfile._id,
        approvalStatus: user.doctorProfile.approvalStatus,
        specialization: user.doctorProfile.specialization,
        isListed: user.doctorProfile.isListed
      };
    }

    res.json(response);

    // Fire-and-forget bookkeeping — see login()
    logActivity(user._id, 'USER_LOGIN', 'authentication', { method: 'google' }, req);
    gamificationService.awardPoints(user._id, 'login', 'Daily Login').catch(console.error);
  } catch (error) {
    console.error('Google auth error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Logout user & revoke refresh token
// @route   POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken });
    }
    if (req.user) {
      deviceLog('logout:clearing-binding', req, {
        userId: String(req.user._id),
        wasBoundTo: req.user.device_id ?? null,
      });
      await User.updateOne({ _id: req.user._id }, { device_id: null });
      await logActivity(req.user._id, 'USER_LOGOUT', 'authentication', {}, req);
    } else {
      // No req.user means the access token was missing/expired, so the binding
      // is NOT cleared here — the account stays bound and the next login on a
      // freshly-generated device id will look like a conflict.
      deviceLog('logout:NO_AUTH_BINDING_NOT_CLEARED', req, {
        hadRefreshToken: Boolean(refreshToken),
      });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Refresh access token using refresh token
// @route   POST /api/auth/refresh
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: 'Refresh token required' });

    const stored = await RefreshToken.findOne({ token: refreshToken });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await stored.deleteOne();
      return res.status(401).json({ code: 'REFRESH_EXPIRED', message: 'Session expired. Please login again.' });
    }

    const newAccessToken = generateAccessToken(stored.userId);
    res.json({ token: newAccessToken });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password').maxTimeMS(30000);
    res.json(user.toObject());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).maxTimeMS(30000);
    if (user) {
      const oldHeight = user.profile?.height;
      const oldWeight = user.profile?.weight;

      captureFcmToken(user, req);

      user.name = req.body.name || user.name;
      user.phone = req.body.phone || user.phone;

      // Properly merge profile object and sanitize strict enums
      if (req.body.profile) {
        const sanitizedProfile = { ...req.body.profile };

        // Remove empty strings for fields with fixed enums to prevent validation errors
        if (sanitizedProfile.gender === "") delete sanitizedProfile.gender;
        if (sanitizedProfile.dietaryPreference === "") delete sanitizedProfile.dietaryPreference;
        if (sanitizedProfile.activityLevel === "") delete sanitizedProfile.activityLevel;
        if (sanitizedProfile.isDiabetic === "") delete sanitizedProfile.isDiabetic;

        const mergedProfile = { ...user.profile.toObject(), ...sanitizedProfile };

        if (sanitizedProfile.age) {
          const consentError = checkGuardianConsentRequired(
            mergedProfile.age,
            req.body.guardianConsent,
            user.guardianConsent?.given
          );
          if (consentError) {
            return res.status(403).json({ message: consentError, requiresGuardianConsent: true });
          }
          if (req.body.guardianConsent?.given && !user.guardianConsent?.given) {
            user.guardianConsent = {
              given: true,
              guardianName: req.body.guardianConsent.guardianName,
              guardianEmail: req.body.guardianConsent.guardianEmail,
              relation: req.body.guardianConsent.relation || '',
              consentedAt: new Date(),
            };
            const ConsentLog = require('../models/ConsentLog');
            await ConsentLog.create({
              userId: user._id,
              version: '1.0',
              action: 'granted',
              purposes: ['guardian_consent_minor'],
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
              metadata: {
                guardianName: req.body.guardianConsent.guardianName,
                guardianEmail: req.body.guardianConsent.guardianEmail,
                relation: req.body.guardianConsent.relation || '',
              },
            }).catch(err => console.error('Guardian ConsentLog failed:', err.message));
          }
        }

        user.profile = mergedProfile;
      }

      // Handle foodPreferences update
      if (req.body.foodPreferences) {
        user.foodPreferences = {
          ...user.foodPreferences,
          ...req.body.foodPreferences,
          lastUpdated: new Date()
        };
        user.markModified('foodPreferences');
      }

      const newHeight = user.profile?.height;
      const newWeight = user.profile?.weight;
      let bmiChanged = false;
      let newBmi = user.healthMetrics?.bmi;

      // Calculate nutrition goals correctly if nutritionGoal is provided (e.g. from profile completion after register)
      if (req.body.nutritionGoal && user.profile.age && user.profile.gender && newWeight && newHeight) {
        try {
          const calculatedGoals = calculateNutritionGoals({
            age: user.profile.age,
            gender: user.profile.gender,
            weight: newWeight,
            height: newHeight,
            activityLevel: user.profile.activityLevel || 'sedentary',
            goal: req.body.nutritionGoal.goal || 'general_health',
            targetWeight: req.body.nutritionGoal.targetWeight,
            weeklyGoal: req.body.nutritionGoal.weeklyGoal || 0.5,
            isDiabetic: user.profile.isDiabetic === 'yes'
          });

          user.nutritionGoal = {
            goal: req.body.nutritionGoal.goal,
            targetWeight: req.body.nutritionGoal.targetWeight,
            weeklyGoal: req.body.nutritionGoal.weeklyGoal,
            ...calculatedGoals,
            autoCalculated: true
          };
          user.markModified('nutritionGoal');
        } catch (calcError) {
          console.error('Nutrition goal calculation error:', calcError.message);
        }
      } else if (req.body.nutritionGoal) {
        user.nutritionGoal = { ...user.nutritionGoal, ...req.body.nutritionGoal };
        user.markModified('nutritionGoal');
      }

      // Detecting changes in height, weight, age, or gender
      if (newHeight !== oldHeight || newWeight !== oldWeight || req.body.profile?.age || req.body.profile?.gender) {
        if (newHeight && newWeight) {
          // Recalculate BMI
          newBmi = Number((newWeight / Math.pow(newHeight / 100, 2)).toFixed(1));
          user.healthMetrics = {
            ...user.healthMetrics,
            bmi: newBmi
          };
          bmiChanged = true;
        }

        // Search for and update active HealthGoal - with extended timeout for Vercel
        const healthGoal = await HealthGoal.findOne({ userId: user._id, isActive: true }).maxTimeMS(30000);
        if (healthGoal) {
          healthGoal.height = newHeight || healthGoal.height;
          healthGoal.currentWeight = newWeight || healthGoal.currentWeight;
          healthGoal.age = user.profile.age || healthGoal.age;
          healthGoal.gender = user.profile.gender || healthGoal.gender;

          // The pre-save hook in HealthGoal will handle target recalculations
          await healthGoal.save();

          // Sync recalculated calorie/macro targets back to user.nutritionGoal
          user.nutritionGoal = {
            ...(user.nutritionGoal?.toObject ? user.nutritionGoal.toObject() : user.nutritionGoal || {}),
            calorieGoal: healthGoal.dailyCalorieTarget,
            proteinGoal: healthGoal.macroTargets?.protein || user.nutritionGoal?.proteinGoal,
            carbsGoal: healthGoal.macroTargets?.carbs || user.nutritionGoal?.carbsGoal,
            fatGoal: healthGoal.macroTargets?.fats || user.nutritionGoal?.fatGoal,
            lastUpdated: new Date()
          };
          user.markModified('nutritionGoal');
        } else if (!req.body.nutritionGoal && user.nutritionGoal?.calorieGoal) {
          // No HealthGoal doc but user has a saved calorieGoal — recalculate from updated profile
          try {
            const recalculated = calculateNutritionGoals({
              age: user.profile.age,
              gender: user.profile.gender,
              weight: newWeight,
              height: newHeight,
              activityLevel: user.profile.activityLevel || 'sedentary',
              goal: user.nutritionGoal.goal || 'general_health',
              targetWeight: user.nutritionGoal.targetWeight,
              weeklyGoal: user.nutritionGoal.weeklyGoal || 0.5,
              isDiabetic: user.profile.isDiabetic === 'yes'
            });
            user.nutritionGoal = {
              ...(user.nutritionGoal?.toObject ? user.nutritionGoal.toObject() : user.nutritionGoal || {}),
              ...recalculated
            };
            user.markModified('nutritionGoal');
          } catch (e) {
            console.error('Profile-change nutrition recalc error:', e.message);
          }
        } else if (req.body.nutritionGoal) {
          // Create initial HealthGoal record for early registration profile completion
          try {
            await HealthGoal.create({
              userId: user._id,
              goalType: req.body.nutritionGoal.goal || 'health_improvement',
              currentWeight: newWeight,
              targetWeight: req.body.nutritionGoal.targetWeight || newWeight,
              height: newHeight,
              age: user.profile.age,
              gender: user.profile.gender,
              activityLevel: user.profile.activityLevel || 'sedentary',
              isActive: true
            });
            console.log('Initial HealthGoal created for user through profile setup');
          } catch (goalError) {
            console.error('Failed to create initial HealthGoal:', goalError.message);
          }
        }
      }

      // Mark profile as modified to ensure Mongoose saves it
      user.markModified('profile');
      if (bmiChanged) user.markModified('healthMetrics');

      const updatedUser = await user.save();

      const responseBody = {
        ...updatedUser.toObject(),
        password: undefined,
        bmiChanged,
        newBmi
      };

      console.log('updateProfile response:', JSON.stringify(responseBody, null, 2));

      res.json(responseBody);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('subscription').maxTimeMS(30000);
    res.json(user.subscription);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Change password for a logged-in user (Profile > Account Details)
// @route   POST /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    const user = await User.findById(req.user._id).maxTimeMS(15000);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Google-only accounts have a random, never-shared password — there's
    // nothing real for the user to "verify" here.
    if (user.authProvider === 'google') {
      return res.status(400).json({ message: 'This account uses Google Sign-In and has no password to change' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      // 400, not 401 — this is a wrong-input error, not an invalid/expired
      // auth token. The global axios interceptor treats any 401 as "your
      // session is dead" and force-logs the user out, which would silently
      // swallow this message before it ever reaches the UI.
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'New password must be different from your current password' });
    }

    user.password = newPassword; // hashed by the pre-save hook
    await user.save();

    // Revoke all other sessions — force re-login everywhere except this device
    await RefreshToken.deleteMany({ userId: user._id });
    user.device_id = null;
    await user.save();

    await logActivity(user._id, 'PASSWORD_CHANGED', 'authentication', {}, req);

    // Security alert email — fire-and-forget so a slow/down SMTP server
    // never delays this response.
    require('../services/emailService').sendPasswordChangedAlert(user.email, user.name).catch((e) => {
      console.error('Failed to send password-changed alert email:', e.message);
    });

    res.json({ message: 'Password changed successfully. Please log in again on your other devices.' });
  } catch (error) {
    console.error('Change password error:', error.message);
    res.status(500).json({ message: 'Failed to change password. Please try again.' });
  }
};

// Admin only - create admin user
exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email }).maxTimeMS(30000);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const admin = await User.create({
      name,
      email,
      password,
      role: 'admin',
      subscription: { plan: 'premium', status: 'active', startDate: new Date() }
    });

    res.status(201).json({
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Upload profile picture to Cloudinary
exports.uploadProfilePicture = async (req, res) => {
  try {
    console.log('Upload profile picture request received. Files:', req.file ? 'File found' : 'No file');

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    try {
      console.log('Attempting Cloudinary upload...');
      const dataBuffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);

      if (!dataBuffer) {
        console.error('❌ No file data found in req.file');
        throw new Error('File data is missing or corrupted');
      }

      const imageUrl = await cloudinary.uploadImage(dataBuffer, 'profile_pictures');

      if (!imageUrl) {
        console.error('❌ Cloudinary returned null URL. Check your environment variables.');
        throw new Error('Cloudinary upload failed - check server configuration');
      }

      console.log('Cloudinary upload success:', imageUrl);

      user.profilePicture = imageUrl;
      await user.save();

      res.json({
        message: 'Profile picture uploaded successfully',
        profilePicture: user.profilePicture
      });
    } catch (uploadError) {
      console.error('Cloudinary upload error details:', uploadError);
      res.status(500).json({
        message: 'Cloudinary upload failed',
        error: uploadError.message,
        details: uploadError.toString()
      });
    }
  } catch (error) {
    console.error('Upload profile picture general error:', error);
    res.status(500).json({ message: 'Server error during upload', error: error.message });
  }
};

// --- Forgot Password Flow ---

// @desc    Forgot Password - Send code
// @route   POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase().trim();
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'No user found with that email' });
    }

    // Generate 4-digit numeric code
    const resetCode = crypto.randomInt(1000, 10000).toString();

    // Set expiry (10 minutes); reset the attempt counter for the new code
    user.resetPasswordCode = resetCode;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    user.resetPasswordAttempts = 0;

    await user.save();

    // Send email
    const emailService = require('../services/emailService');
    await emailService.sendPasswordResetCode(user.email, user.name, resetCode);

    res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Failed to send reset code' });
  }
};

// @desc    Verify Reset Code
// @route   POST /api/auth/verify-reset-code
const MAX_RESET_CODE_ATTEMPTS = 5;

exports.verifyResetCode = async (req, res) => {
  try {
    const { code } = req.body;
    const email = req.body.email?.toLowerCase().trim();

    // Look up by email first (not by code) so failed guesses count against
    // this account's attempt limit — matching by code+email together would
    // let a distributed attacker (many IPs) brute-force the 4-digit code
    // since the per-IP rate limiter can't see it's the same target account.
    const user = await User.findOne({
      email,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user || !user.resetPasswordCode) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    if (user.resetPasswordAttempts >= MAX_RESET_CODE_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many attempts. Please request a new code.' });
    }

    if (user.resetPasswordCode !== code) {
      user.resetPasswordAttempts += 1;
      await user.save();
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    res.json({ success: true, message: 'Code verified successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { code, password } = req.body;
    const email = req.body.email?.toLowerCase().trim();
    const user = await User.findOne({
      email,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user || !user.resetPasswordCode) {
      return res.status(400).json({ message: 'Token expired or invalid. Please request a new code.' });
    }

    if (user.resetPasswordAttempts >= MAX_RESET_CODE_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many attempts. Please request a new code.' });
    }

    if (user.resetPasswordCode !== code) {
      user.resetPasswordAttempts += 1;
      await user.save();
      return res.status(400).json({ message: 'Token expired or invalid. Please request a new code.' });
    }

    // Password complexity check (same as registration)
    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters long'
      });
    }

    // Set new password
    user.password = password;
    user.resetPasswordCode = undefined;
    user.resetPasswordExpire = undefined;
    user.resetPasswordAttempts = 0;

    await user.save();

    res.json({ success: true, message: 'Password reset successful. You can now login.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// @desc    Verify Email
// @route   POST /api/auth/verify-email
exports.verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    console.log(`[Verification] Attempting to verify email: ${email} with code: ${code}`);

    const user = await User.findOne({
      email,
      emailVerificationCode: code,
      emailVerificationExpire: { $gt: Date.now() }
    });

    if (!user) {
      console.log(`[Verification] FAILED: No match for code ${code} or expired for ${email}`);
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    console.log(`[Verification] SUCCESS: Code matched for ${email}`);

    user.isEmailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpire = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isEmailVerified: user.isEmailVerified
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Resend Verification Code
// @route   POST /api/auth/resend-verify-code
exports.resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    const verificationCode = crypto.randomInt(100000, 1000000).toString();
    user.emailVerificationCode = verificationCode;
    user.emailVerificationExpire = Date.now() + 15 * 60 * 1000;
    await user.save();

    const emailService = require('../services/emailService');
    await emailService.sendVerificationCode(user.email, user.name, verificationCode);

    res.json({ success: true, message: 'Verification code resent' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
