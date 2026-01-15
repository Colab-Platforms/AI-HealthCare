const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Doctor = require('../models/Doctor');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, role, profile } = req.body;
    
    // Check if user exists by email or phone
    const existingUser = await User.findOne({ 
      $or: [{ email }, ...(phone ? [{ phone }] : [])]
    });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email or phone' });
    }

    // Determine role - only patient allowed via normal registration
    // Doctor registration is separate, admin is created by existing admin
    const userRole = role === 'doctor' ? 'doctor' : 'patient';
    
    const user = await User.create({ 
      name, 
      email, 
      phone,
      password, 
      role: userRole,
      profile: profile || {},
      subscription: {
        plan: 'free',
        status: 'active',
        startDate: new Date()
      }
    });
    
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      profile: user.profile,
      subscription: user.subscription,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Create user with doctor role
    const user = await User.create({ 
      name, 
      email, 
      phone,
      password, 
      role: 'doctor',
      isActive: true
    });

    // Create doctor profile (pending approval)
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

    // Link doctor profile to user
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
    
    // Allow login with email or phone
    const query = email ? { email } : { phone };
    const user = await User.findOne(query).populate('doctorProfile');

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated. Please contact support.' });
    }

    if (await user.comparePassword(password)) {
      const response = {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profile: user.profile,
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

      res.json(response);
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.name = req.body.name || user.name;
      user.phone = req.body.phone || user.phone;
      
      // Properly merge profile object
      if (req.body.profile) {
        user.profile = {
          ...user.profile.toObject(),
          ...req.body.profile
        };
      }
      
      // Mark profile as modified to ensure Mongoose saves it
      user.markModified('profile');
      
      const updatedUser = await user.save();
      res.json({ ...updatedUser.toObject(), password: undefined });
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
    const user = await User.findById(req.user._id).select('subscription');
    res.json(user.subscription);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin only - create admin user
exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    const existingUser = await User.findOne({ email });
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
