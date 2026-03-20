const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  specialization: { type: String, required: true },
  qualifications: [String],
  experience: { type: Number, required: true },
  hospital: String,
  licenseNumber: { type: String, required: true },
  consultationFee: { type: Number, default: 500 },
  
  // Simplified availability system
  availability: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      settings: {
        startTime: '09:00',
        endTime: '18:00',
        slotDuration: 30
      },
      blockedSlots: {},
      timezone: 'Asia/Kolkata'
    }
  },
  
  rating: { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 },
  
  // Approval workflow
  approvalStatus: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  rejectionReason: String,
  
  // Visibility on platform
  isAvailable: { type: Boolean, default: true },
  isListed: { type: Boolean, default: false },
  
  // Profile details
  bio: String,
  profileImage: String,
  documents: [{
    name: String,
    url: String,
    type: { type: String, enum: ['license', 'degree', 'certificate', 'other'] }
  }]
}, { timestamps: true });

// Only list approved doctors
doctorSchema.statics.findApproved = function(filter = {}) {
  return this.find({ ...filter, approvalStatus: 'approved', isListed: true });
};

// Generate time slots based on settings
doctorSchema.methods.generateWeekSlots = function() {
  const slots = {};
  const { startTime, endTime, slotDuration } = this.availability.settings || { startTime: '09:00', endTime: '18:00', slotDuration: 30 };
  const blockedSlots = this.availability.blockedSlots || new Map();
  
  const today = new Date();
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateKey = date.toISOString().split('T')[0];
    
    slots[dateKey] = [];
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    let currentTime = startHour * 60 + startMin;
    const endTimeMinutes = endHour * 60 + endMin;
    
    while (currentTime < endTimeMinutes) {
      const hours = Math.floor(currentTime / 60);
      const mins = currentTime % 60;
      const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      const displayTime = new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      const blocked = blockedSlots.get(dateKey)?.includes(timeStr) || false;
      
      slots[dateKey].push({
        time: timeStr,
        display: displayTime,
        blocked
      });
      
      currentTime += slotDuration;
    }
  }
  
  return slots;
};

module.exports = mongoose.model('Doctor', doctorSchema);
