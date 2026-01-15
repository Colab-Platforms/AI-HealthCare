const User = require('../models/User');
const HealthReport = require('../models/HealthReport');
const Doctor = require('../models/Doctor');
const DietPlanTemplate = require('../models/DietPlanTemplate');
const DeficiencyRule = require('../models/DeficiencyRule');
const SupplementMapping = require('../models/SupplementMapping');

// User Management
exports.getAllUsers = async (req, res) => {
  try {
    const { role, status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);
    res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const reportCount = await HealthReport.countDocuments({ user: req.params.id });
    res.json({ user, reportCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Report Oversight
exports.getAllReports = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const reports = await HealthReport.find(filter)
      .populate('user', 'name email')
      .select('reportType status createdAt aiAnalysis.healthScore')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await HealthReport.countDocuments(filter);
    res.json({ reports, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getReportStats = async (req, res) => {
  try {
    const totalReports = await HealthReport.countDocuments();
    const completedReports = await HealthReport.countDocuments({ status: 'completed' });
    const failedReports = await HealthReport.countDocuments({ status: 'failed' });
    const totalUsers = await User.countDocuments({ role: 'patient' });
    const activeUsers = await User.countDocuments({ role: 'patient', isActive: true });
    
    // Doctor stats
    const totalDoctors = await Doctor.countDocuments();
    const pendingDoctors = await Doctor.countDocuments({ approvalStatus: 'pending' });
    const approvedDoctors = await Doctor.countDocuments({ approvalStatus: 'approved' });

    const recentReports = await HealthReport.find()
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      stats: { 
        totalReports, completedReports, failedReports, 
        totalUsers, activeUsers,
        totalDoctors, pendingDoctors, approvedDoctors
      },
      recentReports
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Deficiency Management
exports.getDeficiencyRules = async (req, res) => {
  try {
    const rules = await DeficiencyRule.find().sort({ name: 1 });
    res.json(rules);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createDeficiencyRule = async (req, res) => {
  try {
    const rule = await DeficiencyRule.create(req.body);
    res.status(201).json(rule);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateDeficiencyRule = async (req, res) => {
  try {
    const rule = await DeficiencyRule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    res.json(rule);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteDeficiencyRule = async (req, res) => {
  try {
    await DeficiencyRule.findByIdAndDelete(req.params.id);
    res.json({ message: 'Rule deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Supplement Management
exports.getSupplementMappings = async (req, res) => {
  try {
    const mappings = await SupplementMapping.find().sort({ deficiency: 1 });
    res.json(mappings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createSupplementMapping = async (req, res) => {
  try {
    const mapping = await SupplementMapping.create(req.body);
    res.status(201).json(mapping);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateSupplementMapping = async (req, res) => {
  try {
    const mapping = await SupplementMapping.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!mapping) return res.status(404).json({ message: 'Mapping not found' });
    res.json(mapping);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteSupplementMapping = async (req, res) => {
  try {
    await SupplementMapping.findByIdAndDelete(req.params.id);
    res.json({ message: 'Mapping deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Diet Plan Management
exports.getDietPlanTemplates = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const templates = await DietPlanTemplate.find(filter).sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createDietPlanTemplate = async (req, res) => {
  try {
    const template = await DietPlanTemplate.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateDietPlanTemplate = async (req, res) => {
  try {
    const template = await DietPlanTemplate.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true }
    );
    if (!template) return res.status(404).json({ message: 'Template not found' });
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.approveDietPlanTemplate = async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    const template = await DietPlanTemplate.findByIdAndUpdate(
      req.params.id,
      { status, approvedBy: req.user._id, approvedAt: new Date() },
      { new: true }
    );
    if (!template) return res.status(404).json({ message: 'Template not found' });
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteDietPlanTemplate = async (req, res) => {
  try {
    await DietPlanTemplate.findByIdAndDelete(req.params.id);
    res.json({ message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Doctor Management
exports.getAllDoctors = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.approvalStatus = status;

    const doctors = await Doctor.find(filter)
      .populate('user', 'name email isActive')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Doctor.countDocuments(filter);
    const pending = await Doctor.countDocuments({ approvalStatus: 'pending' });
    
    res.json({ doctors, total, pending, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.approveDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findById(id);
    
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    doctor.approvalStatus = 'approved';
    doctor.approvedBy = req.user._id;
    doctor.approvedAt = new Date();
    doctor.isListed = true;
    await doctor.save();

    res.json({ message: 'Doctor approved successfully', doctor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.rejectDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const doctor = await Doctor.findById(id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    doctor.approvalStatus = 'rejected';
    doctor.rejectionReason = reason || 'Application rejected by admin';
    doctor.isListed = false;
    await doctor.save();

    res.json({ message: 'Doctor rejected', doctor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.create(req.body);
    res.status(201).json(doctor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteDoctor = async (req, res) => {
  try {
    await Doctor.findByIdAndDelete(req.params.id);
    res.json({ message: 'Doctor removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.toggleDoctorVisibility = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    doctor.isAvailable = !doctor.isAvailable;
    await doctor.save();
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
