const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  healthReport: { type: mongoose.Schema.Types.ObjectId, ref: 'HealthReport' },
  date: { type: Date, required: true },
  timeSlot: { type: String, required: true },
  type: { type: String, enum: ['video', 'phone', 'in-person'], default: 'video' },
  status: { 
    type: String, 
    enum: ['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'], 
    default: 'scheduled' 
  },
  symptoms: String,
  notes: String,
  prescription: [{
    medication: String,
    dosage: String,
    duration: String,
    instructions: String
  }],
  diagnosis: String,
  recommendations: [String],
  fee: Number,
  
  // Video consultation fields
  videoRoom: {
    roomId: String,
    type: { type: String, enum: ['agora', 'webrtc'], default: 'agora' },
    config: mongoose.Schema.Types.Mixed
  },
  
  // Consultation timing
  startedAt: Date,
  endedAt: Date,
  
  // Follow-up
  followUpDate: Date,
  
  // Review and rating
  rating: { type: Number, min: 1, max: 5 },
  review: String,
  reviewSubmitted: { type: Boolean, default: false },
  
  // Email reminder tracking
  reminderSent: { type: Boolean, default: false },
  dayBeforeReminderSent: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);
