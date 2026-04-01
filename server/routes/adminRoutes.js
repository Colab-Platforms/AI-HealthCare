const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAllUsers, getUserDetails, updateUserStatus, updateUserRole, impersonateUser,
  getAllReports, getReportStats,
  getDeficiencyRules, createDeficiencyRule, updateDeficiencyRule, deleteDeficiencyRule,
  getSupplementMappings, createSupplementMapping, updateSupplementMapping, deleteSupplementMapping,
  getDietPlanTemplates, createDietPlanTemplate, updateDietPlanTemplate, approveDietPlanTemplate, deleteDietPlanTemplate,
  getAllDoctors, approveDoctor, rejectDoctor, createDoctor, updateDoctor, deleteDoctor, toggleDoctorVisibility,
  getAllCachedFoods, createCachedFood, updateCachedFood, deleteCachedFood, bulkCreateCachedFood, clearAllCachedFoods,
  deleteUser
} = require('../controllers/adminController');
const { getDoctorScheduleOverview } = require('../controllers/doctorController');

// 🏓 Internal Router Ping (Bypasses Auth for Debugging)
router.get('/ping-internal', (req, res) => {
  res.json({ status: 'admin-router-active', msg: 'Admin Router is correctly mounted and receiving traffic!' });
});

// 🚿 Super-Open Admin Router Ping
router.get('/open-ping', (req, res) => {
  res.json({ status: 'admin-router-found', msg: 'Successfully reached the admin router! If /users 404s, its an auth issue.' });
});

// All routes require admin role
router.use(protect, authorize('admin'));

// Dashboard & Stats
router.get('/stats', getReportStats);

// User Management
router.get('/users', getAllUsers);
router.get('/users/:id', getUserDetails);
router.patch('/users/:id/status', updateUserStatus);
router.patch('/users/:id/role', updateUserRole);
router.post('/users/:id/impersonate', impersonateUser);
router.delete('/users/:id', deleteUser);

// Report Oversight
router.get('/reports', getAllReports);

// Deficiency Rules
router.get('/deficiency-rules', getDeficiencyRules);
router.post('/deficiency-rules', createDeficiencyRule);
router.put('/deficiency-rules/:id', updateDeficiencyRule);
router.delete('/deficiency-rules/:id', deleteDeficiencyRule);

// Supplement Mappings
router.get('/supplements', getSupplementMappings);
router.post('/supplements', createSupplementMapping);
router.put('/supplements/:id', updateSupplementMapping);
router.delete('/supplements/:id', deleteSupplementMapping);

// Diet Plan Templates
router.get('/diet-plans', getDietPlanTemplates);
router.post('/diet-plans', createDietPlanTemplate);
router.put('/diet-plans/:id', updateDietPlanTemplate);
router.patch('/diet-plans/:id/approve', approveDietPlanTemplate);
router.delete('/diet-plans/:id', deleteDietPlanTemplate);

// Doctor Management & Approval
router.get('/doctors', getAllDoctors);
router.post('/doctors', createDoctor);
router.put('/doctors/:id', updateDoctor);
router.patch('/doctors/:id/approve', approveDoctor);
router.patch('/doctors/:id/reject', rejectDoctor);
router.patch('/doctors/:id/visibility', toggleDoctorVisibility);
router.get('/doctors/:id/schedule-overview', getDoctorScheduleOverview);
router.delete('/doctors/:id', deleteDoctor);

// Food Cache Management
router.get('/food-cache', getAllCachedFoods);
router.post('/food-cache/bulk', bulkCreateCachedFood);
router.post('/food-cache', createCachedFood);
router.put('/food-cache/:id', updateCachedFood);
router.delete('/food-cache/clear-all', clearAllCachedFoods);
router.delete('/food-cache/:id', deleteCachedFood);

module.exports = router;
