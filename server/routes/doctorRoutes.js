const express = require('express');
const router = express.Router();
const {
  getAllDoctors,
  getDoctorById,
  bookAppointment,
  getMyAppointments,
  getRecommendedDoctors,
  getPatientProfile,
  getDoctorAppointments,
  getDoctorDashboard,
  getMyDoctorAppointments,
  updateAppointmentStatus,
  getMyDoctorProfile,
  updateMyDoctorProfile,
  // Video consultation endpoints
  getAppointmentDetails,
  startConsultation,
  endConsultation,
  getConsultationSummary,
  submitReview,
  downloadPrescription,
  sendConsultationReminder,
  // Test routes
  testEmail,
  generateVideoToken,
  // Availability management
  getMyAvailability,
  updateMyAvailability,
  generateTimeSlots,
  getDoctorAvailableSlots,
  checkSlotAvailability,
  getDoctorScheduleOverview
} = require('../controllers/doctorController');
const { protect, authorize } = require('../middleware/auth');

// Public routes (only shows approved doctors)
router.get('/', getAllDoctors);
router.get('/recommended', protect, getRecommendedDoctors);

// Patient routes
router.get('/appointments', protect, getMyAppointments);
router.post('/book', protect, bookAppointment);

// Video consultation routes (accessible by both patients and doctors)
router.get('/appointments/:appointmentId', protect, getAppointmentDetails);
router.post('/appointments/:appointmentId/start', protect, startConsultation);
router.post('/appointments/:appointmentId/end', protect, endConsultation);
router.get('/appointments/:appointmentId/summary', protect, getConsultationSummary);
router.post('/appointments/:appointmentId/review', protect, submitReview);
router.get('/appointments/:appointmentId/prescription', protect, downloadPrescription);
router.post('/appointments/:appointmentId/reminder', protect, sendConsultationReminder);

// Test routes
router.post('/test-email', testEmail);
router.post('/generate-video-token', generateVideoToken);

// Doctor-specific routes (requires doctor role)
router.get('/me/dashboard', protect, authorize('doctor'), getDoctorDashboard);
router.get('/me/profile', protect, authorize('doctor'), getMyDoctorProfile);
router.put('/me/profile', protect, authorize('doctor'), updateMyDoctorProfile);
router.get('/me/appointments', protect, authorize('doctor'), getMyDoctorAppointments);
router.patch('/me/appointments/:appointmentId', protect, authorize('doctor'), updateAppointmentStatus);
router.get('/patient/:patientId', protect, authorize('doctor'), getPatientProfile);

// Availability management routes (for doctors)
router.get('/me/availability', protect, authorize('doctor'), getMyAvailability);
router.put('/me/availability', protect, authorize('doctor'), updateMyAvailability);
router.post('/me/generate-slots', protect, authorize('doctor'), generateTimeSlots);

// Public availability routes (for patients and admin)
router.get('/:doctorId/available-slots', getDoctorAvailableSlots);
router.get('/:doctorId/check-slot', checkSlotAvailability);

// Admin routes for doctor schedule overview
router.get('/:doctorId/schedule-overview', protect, authorize('admin'), getDoctorScheduleOverview);

// Generic routes (must be last due to :id param)
router.get('/:doctorId/appointments', protect, getDoctorAppointments);
router.get('/:id', getDoctorById);

module.exports = router;
