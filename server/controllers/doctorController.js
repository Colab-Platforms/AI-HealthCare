const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const HealthReport = require('../models/HealthReport');
const WearableData = require('../models/WearableData');
const emailService = require('../services/emailService');
const videoService = require('../services/videoService');

exports.getAllDoctors = async (req, res) => {
  try {
    const { specialization, available } = req.query;
    const filter = {
      approvalStatus: 'approved',
      isListed: true
    };
    
    if (specialization) filter.specialization = new RegExp(specialization, 'i');
    if (available === 'true') filter.isAvailable = true;

    const doctors = await Doctor.find(filter)
      .populate('user', 'name email')
      .sort({ rating: -1 });
    
    const transformedDoctors = doctors.map(doc => ({
      ...doc.toObject(),
      user: doc.user ? doc.user : { name: doc.name, email: doc.email }
    }));
    
    res.json(transformedDoctors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDoctorById = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({
      _id: req.params.id,
      approvalStatus: 'approved',
      isListed: true
    }).populate('user', 'name email');
    
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    
    const transformed = {
      ...doctor.toObject(),
      user: doctor.user ? doctor.user : { name: doctor.name, email: doctor.email }
    };
    
    res.json(transformed);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.bookAppointment = async (req, res) => {
  try {
    const { doctorId, date, timeSlot, type, symptoms, healthReportId } = req.body;
    
    const doctor = await Doctor.findById(doctorId).populate('user', 'name email');
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Check if slot is available
    const existingAppointment = await Appointment.findOne({
      doctor: doctorId,
      date: new Date(date),
      timeSlot,
      status: 'scheduled'
    });

    if (existingAppointment) {
      return res.status(400).json({ message: 'Time slot not available' });
    }

    // Create video room if it's a video consultation
    let videoRoom = null;
    if (type === 'video') {
      try {
        videoRoom = videoService.getRoomDetails(`${doctorId}_${req.user._id}_${Date.now()}`);
      } catch (error) {
        console.error('Error creating video room:', error);
        // Continue without video room - can be created later
      }
    }

    const appointment = await Appointment.create({
      patient: req.user._id,
      doctor: doctorId,
      healthReport: healthReportId,
      date: new Date(date),
      timeSlot,
      type,
      symptoms,
      fee: doctor.consultationFee,
      videoRoom: videoRoom ? {
        roomId: videoRoom.roomId,
        type: videoRoom.type || 'agora',
        config: videoRoom
      } : null
    });

    // Populate the appointment with patient and doctor details for email
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('patient', 'name email age')
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email' } });

    // Send email notifications
    try {
      const emailData = {
        patient: populatedAppointment.patient,
        doctor: {
          name: populatedAppointment.doctor.user?.name || populatedAppointment.doctor.name,
          email: populatedAppointment.doctor.user?.email || populatedAppointment.doctor.email,
          specialization: populatedAppointment.doctor.specialization
        },
        appointment: populatedAppointment
      };

      await emailService.sendAppointmentConfirmation(emailData);
    } catch (emailError) {
      console.error('Error sending appointment emails:', emailError);
      // Don't fail the appointment booking if email fails
    }

    res.status(201).json({
      ...appointment.toObject(),
      videoRoom: videoRoom
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMyAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ patient: req.user._id })
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email' } })
      .sort({ date: -1 });
    
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRecommendedDoctors = async (req, res) => {
  try {
    const { specializations } = req.query;
    const specs = specializations ? specializations.split(',') : [];
    
    const doctors = await Doctor.find({
      specialization: { $in: specs.map(s => new RegExp(s, 'i')) },
      approvalStatus: 'approved',
      isListed: true,
      isAvailable: true
    })
      .populate('user', 'name email')
      .sort({ rating: -1 })
      .limit(5);
    
    const transformedDoctors = doctors.map(doc => ({
      ...doc.toObject(),
      user: doc.user ? doc.user : { name: doc.name, email: doc.email }
    }));
    
    res.json(transformedDoctors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Doctor's own dashboard
exports.getDoctorDashboard = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    // Get appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const appointments = await Appointment.find({ doctor: doctor._id })
      .populate('patient', 'name email phone profile healthMetrics')
      .populate('healthReport', 'reportType aiAnalysis.healthScore')
      .sort({ date: 1 });

    const todayAppointments = appointments.filter(a => {
      const aptDate = new Date(a.date);
      aptDate.setHours(0, 0, 0, 0);
      return aptDate.getTime() === today.getTime() && a.status === 'scheduled';
    });

    const upcomingAppointments = appointments.filter(a => 
      new Date(a.date) > today && a.status === 'scheduled'
    );

    const completedAppointments = appointments.filter(a => a.status === 'completed');
    const totalPatients = [...new Set(appointments.map(a => a.patient?._id?.toString()))].length;

    res.json({
      doctor: {
        _id: doctor._id,
        name: doctor.name,
        specialization: doctor.specialization,
        approvalStatus: doctor.approvalStatus,
        isListed: doctor.isListed,
        rating: doctor.rating,
        totalReviews: doctor.totalReviews,
        consultationFee: doctor.consultationFee
      },
      stats: {
        todayAppointments: todayAppointments.length,
        upcomingAppointments: upcomingAppointments.length,
        completedAppointments: completedAppointments.length,
        totalPatients
      },
      todaySchedule: todayAppointments,
      upcomingSchedule: upcomingAppointments.slice(0, 10),
      recentPatients: completedAppointments.slice(0, 5)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get doctor's own appointments
exports.getMyDoctorAppointments = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    const { status, date } = req.query;
    const filter = { doctor: doctor._id };
    
    if (status) filter.status = status;
    if (date) {
      const queryDate = new Date(date);
      queryDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(queryDate);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.date = { $gte: queryDate, $lt: nextDay };
    }

    const appointments = await Appointment.find(filter)
      .populate('patient', 'name email phone profile healthMetrics')
      .populate('healthReport', 'reportType aiAnalysis.healthScore aiAnalysis.deficiencies')
      .sort({ date: 1 });

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update appointment status (for doctors)
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status, notes, prescription } = req.body;

    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    const appointment = await Appointment.findOne({ 
      _id: appointmentId, 
      doctor: doctor._id 
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (status) appointment.status = status;
    if (notes) appointment.notes = notes;
    if (prescription) appointment.prescription = prescription;
    
    await appointment.save();
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get doctor's own profile
exports.getMyDoctorProfile = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id })
      .populate('user', 'name email phone')
      .populate('approvedBy', 'name');
    
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    res.json(doctor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update doctor's own profile
exports.updateMyDoctorProfile = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    const allowedUpdates = ['phone', 'hospital', 'consultationFee', 'availability', 'bio', 'isAvailable'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        doctor[field] = req.body[field];
      }
    });

    await doctor.save();
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get complete patient profile for doctor consultation
exports.getPatientProfile = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { appointmentId } = req.query;

    // Verify the doctor has an appointment with this patient (for security)
    if (appointmentId) {
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment || appointment.patient.toString() !== patientId) {
        return res.status(403).json({ message: 'Unauthorized to view this patient' });
      }
    }

    // Get patient basic info
    const patient = await User.findById(patientId).select('-password');
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Get all health reports
    const healthReports = await HealthReport.find({ user: patientId })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get wearable data
    const wearableData = await WearableData.find({ user: patientId, isConnected: true });

    // Get appointment history
    const appointmentHistory = await Appointment.find({ patient: patientId })
      .populate('doctor', 'name specialization')
      .sort({ date: -1 })
      .limit(10);

    // Compile latest health metrics from reports
    const latestReport = healthReports[0];
    const healthSummary = latestReport?.aiAnalysis ? {
      healthScore: latestReport.aiAnalysis.healthScore,
      deficiencies: latestReport.aiAnalysis.deficiencies || [],
      riskFactors: latestReport.aiAnalysis.riskFactors || [],
      keyFindings: latestReport.aiAnalysis.keyFindings || [],
      recommendations: latestReport.aiAnalysis.recommendations || {}
    } : null;

    // Compile wearable summary
    let wearableSummary = null;
    if (wearableData.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      wearableSummary = {
        devices: wearableData.map(w => ({ type: w.deviceType, name: w.deviceName, lastSynced: w.lastSyncedAt })),
        recentMetrics: [],
        avgHeartRate: 0,
        avgSleepHours: 0,
        avgSteps: 0
      };

      let totalHeartRate = 0, heartRateCount = 0;
      let totalSleep = 0, sleepCount = 0;
      let totalSteps = 0, stepsCount = 0;

      for (const device of wearableData) {
        // Recent daily metrics
        const recentMetrics = device.dailyMetrics.filter(m => new Date(m.date) >= weekAgo);
        wearableSummary.recentMetrics.push(...recentMetrics);

        // Calculate averages
        for (const hr of device.heartRate.slice(-50)) {
          totalHeartRate += hr.bpm;
          heartRateCount++;
        }

        for (const sleep of device.sleepData.slice(-7)) {
          totalSleep += sleep.totalSleepMinutes || 0;
          sleepCount++;
        }

        for (const metric of recentMetrics) {
          totalSteps += metric.steps || 0;
          stepsCount++;
        }
      }

      wearableSummary.avgHeartRate = heartRateCount ? Math.round(totalHeartRate / heartRateCount) : null;
      wearableSummary.avgSleepHours = sleepCount ? parseFloat((totalSleep / sleepCount / 60).toFixed(1)) : null;
      wearableSummary.avgSteps = stepsCount ? Math.round(totalSteps / stepsCount) : null;
    }

    res.json({
      patient: {
        _id: patient._id,
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        profile: patient.profile,
        healthMetrics: patient.healthMetrics,
        subscription: patient.subscription,
        createdAt: patient.createdAt
      },
      healthSummary,
      healthReports: healthReports.map(r => ({
        _id: r._id,
        reportType: r.reportType,
        status: r.status,
        healthScore: r.aiAnalysis?.healthScore,
        deficienciesCount: r.aiAnalysis?.deficiencies?.length || 0,
        createdAt: r.createdAt
      })),
      wearableSummary,
      appointmentHistory: appointmentHistory.map(a => ({
        _id: a._id,
        date: a.date,
        type: a.type,
        status: a.status,
        doctor: a.doctor,
        symptoms: a.symptoms,
        notes: a.notes
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get doctor's appointments with patient details
exports.getDoctorAppointments = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { status } = req.query;

    const filter = { doctor: doctorId };
    if (status) filter.status = status;

    const appointments = await Appointment.find(filter)
      .populate('patient', 'name email phone profile healthMetrics')
      .populate('healthReport', 'reportType aiAnalysis.healthScore aiAnalysis.deficiencies')
      .sort({ date: 1 });

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Video Consultation Endpoints

// Get appointment details with video room info
exports.getAppointmentDetails = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    const appointment = await Appointment.findById(appointmentId)
      .populate('patient', 'name email age')
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email' } });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check if user has access to this appointment
    const isPatient = appointment.patient._id.toString() === req.user._id.toString();
    const isDoctor = appointment.doctor.user?._id.toString() === req.user._id.toString();
    
    if (!isPatient && !isDoctor) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Create or refresh video room if needed
    if (appointment.type === 'video' && (!appointment.videoRoom || !videoService.isRoomActive(appointment.videoRoom.config))) {
      try {
        const videoRoom = videoService.getRoomDetails(appointmentId);
        appointment.videoRoom = {
          roomId: videoRoom.roomId,
          type: videoRoom.type || 'agora',
          config: videoRoom
        };
        await appointment.save();
      } catch (error) {
        console.error('Error creating video room:', error);
      }
    }

    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Start consultation
exports.startConsultation = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    appointment.status = 'in-progress';
    appointment.startedAt = new Date();
    await appointment.save();

    res.json({ message: 'Consultation started', appointment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// End consultation
exports.endConsultation = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { notes, prescription, followUpDate } = req.body;
    
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    appointment.status = 'completed';
    appointment.endedAt = new Date();
    if (notes) appointment.notes = notes;
    if (prescription) appointment.prescription = prescription;
    if (followUpDate) appointment.followUpDate = new Date(followUpDate);

    // End video room
    if (appointment.videoRoom) {
      videoService.endConsultationRoom(appointment.videoRoom.roomId);
    }

    await appointment.save();

    res.json({ message: 'Consultation ended', appointment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get consultation summary
exports.getConsultationSummary = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    const appointment = await Appointment.findById(appointmentId)
      .populate('patient', 'name email age')
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email' } });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check if user has access
    const isPatient = appointment.patient._id.toString() === req.user._id.toString();
    const isDoctor = appointment.doctor.user?._id.toString() === req.user._id.toString();
    
    if (!isPatient && !isDoctor) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Mock consultation summary data (in real app, this would be stored)
    const summary = {
      id: appointment._id,
      doctor: {
        name: appointment.doctor.user?.name || appointment.doctor.name,
        specialization: appointment.doctor.specialization,
        image: null
      },
      date: appointment.date,
      duration: appointment.endedAt && appointment.startedAt 
        ? Math.round((new Date(appointment.endedAt) - new Date(appointment.startedAt)) / (1000 * 60)) + ' minutes'
        : '30 minutes',
      diagnosis: appointment.diagnosis || 'General consultation completed',
      prescription: appointment.prescription || [],
      recommendations: appointment.recommendations || [
        'Follow prescribed medication schedule',
        'Maintain healthy diet and exercise',
        'Schedule follow-up as recommended'
      ],
      followUp: appointment.followUpDate ? {
        date: appointment.followUpDate,
        type: 'Follow-up consultation'
      } : null,
      notes: appointment.notes || 'Consultation completed successfully',
      reviewSubmitted: appointment.reviewSubmitted || false
    };

    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Submit review for doctor
exports.submitReview = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { rating, review } = req.body;
    
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check if patient owns this appointment
    if (appointment.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update appointment with review
    appointment.rating = rating;
    appointment.review = review;
    appointment.reviewSubmitted = true;
    await appointment.save();

    // Update doctor's overall rating
    const doctor = await Doctor.findById(appointment.doctor);
    if (doctor) {
      const appointments = await Appointment.find({ 
        doctor: doctor._id, 
        rating: { $exists: true } 
      });
      
      const totalRating = appointments.reduce((sum, apt) => sum + apt.rating, 0);
      const avgRating = totalRating / appointments.length;
      
      doctor.rating = Math.round(avgRating * 10) / 10;
      doctor.totalReviews = appointments.length;
      await doctor.save();
    }

    res.json({ message: 'Review submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Download prescription (mock implementation)
exports.downloadPrescription = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    const appointment = await Appointment.findById(appointmentId)
      .populate('patient', 'name email age')
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email' } });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // In a real implementation, you would generate a PDF here
    // For now, return a mock response
    res.json({ 
      message: 'Prescription download would be implemented here',
      appointmentId,
      prescriptionData: appointment.prescription || []
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Send consultation reminder emails
exports.sendConsultationReminder = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    const appointment = await Appointment.findById(appointmentId)
      .populate('patient', 'name email age')
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email' } });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const emailData = {
      patient: appointment.patient,
      doctor: {
        name: appointment.doctor.user?.name || appointment.doctor.name,
        email: appointment.doctor.user?.email || appointment.doctor.email,
        specialization: appointment.doctor.specialization
      },
      appointment
    };

    await emailService.sendConsultationReminder(emailData);
    
    res.json({ message: 'Reminder emails sent successfully' });
  } catch (error) {
    console.error('Error sending reminder emails:', error);
    res.status(500).json({ message: 'Failed to send reminder emails' });
  }
};
// Test email functionality
exports.testEmail = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email address required' });
    }

    // Create test appointment data
    const testData = {
      patient: {
        name: 'Test Patient',
        email: email,
        age: 30
      },
      doctor: {
        name: 'Dr. Test Doctor',
        email: 'doctor@test.com',
        specialization: 'General Physician'
      },
      appointment: {
        _id: 'test123',
        date: new Date(),
        timeSlot: '10:00 AM',
        type: 'video',
        symptoms: 'Testing email functionality'
      }
    };

    await emailService.sendAppointmentConfirmation(testData);
    
    res.json({ 
      success: true, 
      message: `Test email sent successfully to ${email}` 
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send test email: ' + error.message 
    });
  }
};
// Generate Agora token for video test
exports.generateVideoToken = async (req, res) => {
  try {
    const { channelName, uid } = req.body;
    
    if (!channelName) {
      return res.status(400).json({ message: 'Channel name is required' });
    }

    const tokenData = videoService.generateTestToken(channelName, uid);
    
    res.json({
      success: true,
      ...tokenData
    });
  } catch (error) {
    console.error('Error generating video token:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate video token: ' + error.message 
    });
  }
};
// Doctor Availability Management

// Get doctor's availability schedule
exports.getMyAvailability = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id }).lean();
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    // Default settings
    const defaultAvailability = {
      settings: { startTime: '09:00', endTime: '18:00', slotDuration: 30 },
      blockedSlots: {},
      timezone: 'Asia/Kolkata'
    };
    
    // Handle case where availability might be an array (legacy data)
    let docAvailability = doctor.availability;
    if (Array.isArray(docAvailability) || !docAvailability) {
      docAvailability = {};
    }
    
    // Merge with defaults
    const availability = {
      settings: docAvailability.settings || defaultAvailability.settings,
      blockedSlots: (docAvailability.blockedSlots && typeof docAvailability.blockedSlots === 'object' && !Array.isArray(docAvailability.blockedSlots)) 
        ? docAvailability.blockedSlots 
        : {},
      timezone: docAvailability.timezone || 'Asia/Kolkata'
    };

    console.log('Returning availability:', JSON.stringify(availability, null, 2));

    res.json({ availability });
  } catch (error) {
    console.error('Error getting availability:', error);
    res.status(500).json({ message: error.message });
  }
};

// Update doctor's availability schedule
exports.updateMyAvailability = async (req, res) => {
  try {
    const { settings, blockedSlots } = req.body;
    
    console.log('Received settings:', settings);
    console.log('Received blockedSlots:', blockedSlots);
    
    // First, get the current doctor to check existing availability
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }
    
    // Build the complete availability object (replace entire field to avoid array issues)
    const newAvailability = {
      settings: {
        startTime: settings?.startTime || doctor.availability?.settings?.startTime || '09:00',
        endTime: settings?.endTime || doctor.availability?.settings?.endTime || '18:00',
        slotDuration: parseInt(settings?.slotDuration) || doctor.availability?.settings?.slotDuration || 30
      },
      blockedSlots: {},
      timezone: 'Asia/Kolkata'
    };
    
    // Handle blocked slots
    if (blockedSlots && typeof blockedSlots === 'object') {
      Object.entries(blockedSlots).forEach(([date, times]) => {
        if (Array.isArray(times)) {
          newAvailability.blockedSlots[date] = times;
        }
      });
    } else if (doctor.availability?.blockedSlots && typeof doctor.availability.blockedSlots === 'object' && !Array.isArray(doctor.availability.blockedSlots)) {
      newAvailability.blockedSlots = doctor.availability.blockedSlots;
    }
    
    // Replace the entire availability field
    const savedDoctor = await Doctor.findOneAndUpdate(
      { user: req.user._id },
      { availability: newAvailability },
      { new: true }
    );
    
    console.log('Saved availability:', JSON.stringify(savedDoctor.availability, null, 2));

    res.json({ 
      message: 'Availability updated successfully',
      availability: savedDoctor.availability
    });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({ message: error.message });
  }
};

// Generate time slots for doctor
exports.generateTimeSlots = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    const slots = doctor.generateWeekSlots();
    await doctor.save();

    res.json({ 
      message: 'Time slots generated successfully',
      slots
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get available time slots for a specific doctor (for patients)
exports.getDoctorAvailableSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;
    
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Handle case where availability might be an array (legacy data)
    let docAvailability = doctor.availability;
    if (Array.isArray(docAvailability) || !docAvailability) {
      docAvailability = {};
    }

    console.log('Doctor availability:', JSON.stringify(docAvailability, null, 2));

    // Get existing appointments for this doctor
    const appointments = await Appointment.find({
      doctor: doctorId,
      status: { $in: ['scheduled', 'in-progress'] }
    });

    // Generate slots based on settings - use defaults if not set
    const defaultSettings = { startTime: '09:00', endTime: '18:00', slotDuration: 30 };
    const settings = {
      startTime: docAvailability.settings?.startTime || defaultSettings.startTime,
      endTime: docAvailability.settings?.endTime || defaultSettings.endTime,
      slotDuration: docAvailability.settings?.slotDuration || defaultSettings.slotDuration
    };
    
    console.log('Using settings:', settings);
    
    // Handle blockedSlots - ensure it's an object
    const blockedSlots = (docAvailability.blockedSlots && typeof docAvailability.blockedSlots === 'object' && !Array.isArray(docAvailability.blockedSlots))
      ? docAvailability.blockedSlots 
      : {};
    
    const slotsByDate = {};
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() + i);
      const dateKey = currentDate.toDateString();
      const dateStr = currentDate.toISOString().split('T')[0];
      const isToday = i === 0;
      
      // Skip if filtering by specific date and this isn't it
      if (date && dateStr !== date) continue;
      
      slotsByDate[dateKey] = [];
      
      const startTimeParts = settings.startTime.split(':');
      const endTimeParts = settings.endTime.split(':');
      
      if (startTimeParts.length < 2 || endTimeParts.length < 2) {
        console.error('Invalid time format:', settings);
        continue;
      }
      
      const startHour = parseInt(startTimeParts[0], 10);
      const startMin = parseInt(startTimeParts[1], 10);
      const endHour = parseInt(endTimeParts[0], 10);
      const endMin = parseInt(endTimeParts[1], 10);
      
      let currentTime = startHour * 60 + startMin;
      const endTimeMinutes = endHour * 60 + endMin;
      
      console.log(`Date ${dateStr}: generating slots from ${startHour}:${startMin} to ${endHour}:${endMin}`);
      
      while (currentTime < endTimeMinutes) {
        const hours = Math.floor(currentTime / 60);
        const mins = currentTime % 60;
        const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        const displayTime = new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        
        // Check if blocked by doctor
        const blocked = blockedSlots[dateStr]?.includes(timeStr);
        
        // Check if already booked
        const isBooked = appointments.some(apt => {
          const aptDate = new Date(apt.date).toISOString().split('T')[0];
          return aptDate === dateStr && apt.timeSlot === displayTime;
        });
        
        // Check if time has passed (for today only)
        let isPassed = false;
        if (isToday) {
          const slotDateTime = new Date(currentDate);
          slotDateTime.setHours(hours, mins, 0, 0);
          isPassed = slotDateTime <= now;
        }
        
        // Determine slot status
        let status = 'available';
        let available = 1;
        
        if (blocked) {
          status = 'blocked';
          available = 0;
        } else if (isPassed) {
          status = 'passed';
          available = 0;
        } else if (isBooked) {
          status = 'booked';
          available = 0;
        }
        
        // Include all slots (not just unblocked) so frontend can show status
        slotsByDate[dateKey].push({
          timeSlot: displayTime,
          time: timeStr,
          available,
          status,
          maxBookings: 1
        });
        
        currentTime += settings.slotDuration;
      }
    }
    
    console.log('Total slots generated:', Object.values(slotsByDate).flat().length);

    res.json({
      doctorId,
      doctorName: doctor.name,
      timezone: doctor.availability?.timezone || 'Asia/Kolkata',
      slotsByDate,
      totalAvailableSlots: Object.values(slotsByDate).flat().filter(s => s.available > 0).length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Check if a specific time slot is available
exports.checkSlotAvailability = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date, timeSlot } = req.query;
    
    if (!date || !timeSlot) {
      return res.status(400).json({ message: 'Date and time slot are required' });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const requestedDate = new Date(date);
    const slot = doctor.availability?.generatedSlots?.find(s => 
      s.date.toDateString() === requestedDate.toDateString() && 
      s.timeSlot === timeSlot
    );

    if (!slot) {
      return res.json({ available: false, reason: 'Time slot not found' });
    }

    const available = slot.currentBookings < slot.maxBookings;
    
    res.json({
      available,
      timeSlot: slot.timeSlot,
      date: slot.date,
      currentBookings: slot.currentBookings,
      maxBookings: slot.maxBookings,
      reason: available ? null : 'Time slot is fully booked'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get doctor's schedule overview (for admin)
exports.getDoctorScheduleOverview = async (req, res) => {
  try {
    const { doctorId } = req.params;
    
    const doctor = await Doctor.findById(doctorId)
      .populate('user', 'name email');
    
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Calculate schedule statistics
    const schedule = doctor.availability?.schedule || [];
    const totalWorkingDays = schedule.filter(day => day.isAvailable).length;
    const totalSlots = doctor.availability?.generatedSlots?.length || 0;
    const bookedSlots = doctor.availability?.generatedSlots?.filter(slot => slot.isBooked).length || 0;
    
    res.json({
      doctor: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        specialization: doctor.specialization,
        approvalStatus: doctor.approvalStatus
      },
      schedule: {
        workingDays: totalWorkingDays,
        totalSlots,
        bookedSlots,
        availableSlots: totalSlots - bookedSlots,
        utilizationRate: totalSlots > 0 ? ((bookedSlots / totalSlots) * 100).toFixed(1) : 0
      },
      availability: doctor.availability
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};