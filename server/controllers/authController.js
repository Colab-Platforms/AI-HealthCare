const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const HealthGoal = require('../models/HealthGoal');
const { calculateNutritionGoals } = require('../services/nutritionGoalCalculator');
const cloudinary = require('../services/cloudinary');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, role, profile, nutritionGoal } = req.body;

    // Validate required fields
    if (!name || !email || !password || !phone) {
      console.log('Registration attempt: Missing required fields');
      return res.status(400).json({ message: 'Name, email, phone, and password are required' });
    }

    // Phone number validation (exactly 10 digits)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }

    // Password complexity validation
    // At least one uppercase, one special character, one number, min 6 characters
    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.*[0-9]).{6,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: 'Password must contain at least one uppercase letter, one special character, and one number'
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
      return res.status(400).json({ message: 'User already exists with this email or phone' });
    }

    // Determine role - only patient allowed via normal registration
    const userRole = role === 'doctor' ? 'doctor' : 'patient';

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
          weeklyGoal: nutritionGoal.weeklyGoal || 0.5
        });
      } catch (calcError) {
        console.error('Nutrition goal calculation error:', calcError.message);
        // Continue with registration even if calculation fails
      }
    }

    let user = null;
    try {
      console.log('Creating user in database...');
      // Generate 6-digit verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationExpire = Date.now() + 15 * 60 * 1000; // 15 mins

      user = await User.create({
        name,
        email,
        phone,
        password,
        role: userRole,
        isEmailVerified: false,
        emailVerificationCode: verificationCode,
        emailVerificationExpire: verificationExpire,
        profile: profile || {},
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

      // 🆕 Create initial HealthGoal record to sync with Fitness Dashboard
      if (user && profile && nutritionGoal) {
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
      // Send verification email
      const emailService = require('../services/emailService');
      await emailService.sendVerificationCode(user.email, user.name, verificationCode);
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
      licenseNumber, consultationFee, bio
    } = req.body;

    // Check if user exists - with extended timeout for Vercel
    const existingUser = await User.findOne({ email }).maxTimeMS(30000);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Create user with doctor role - with extended timeout for Vercel
    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: 'doctor',
      isActive: true
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
    const { email, phone, password } = req.body;

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
      user = await User.findOne(query).populate('doctorProfile').maxTimeMS(15000);
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
      return res.status(403).json({ message: 'Account is deactivated. Please contact support.' });
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
        token: generateToken(user._id)
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
      res.json(response);
    } else {
      console.log('Password mismatch for user:', user._id);
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error.message);
    console.error('Login error stack:', error.stack);
    console.error('Login error code:', error.code);
    res.status(500).json({
      message: 'Login failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password').maxTimeMS(30000);
    res.json(user);
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

      user.name = req.body.name || user.name;
      user.phone = req.body.phone || user.phone;

      // Properly merge profile object
      if (req.body.profile) {
        user.profile = {
          ...user.profile.toObject(),
          ...req.body.profile
        };
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
            weeklyGoal: req.body.nutritionGoal.weeklyGoal || 0.5
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

      // Detecting changes in height or weight
      if (newHeight !== oldHeight || newWeight !== oldWeight) {
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

      res.json({
        ...updatedUser.toObject(),
        password: undefined,
        bmiChanged,
        newBmi
      });
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
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'No user found with that email' });
    }

    // Generate 4-digit numeric code
    const resetCode = Math.floor(1000 + Math.random() * 9000).toString();

    // Set expiry (10 minutes)
    user.resetPasswordCode = resetCode;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

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
exports.verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({
      email,
      resetPasswordCode: code,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
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
    const { email, code, password } = req.body;
    const user = await User.findOne({
      email,
      resetPasswordCode: code,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Token expired or invalid. Please request a new code.' });
    }

    // Password complexity check (same as registration)
    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.*[0-9]).{6,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: 'Password must contain at least one uppercase letter, one special character, and one number'
      });
    }

    // Set new password
    user.password = password;
    user.resetPasswordCode = undefined;
    user.resetPasswordExpire = undefined;

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

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
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
