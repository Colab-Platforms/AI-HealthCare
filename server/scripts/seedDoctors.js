const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Doctor = require('../models/Doctor');

dotenv.config();

const doctors = [
  { name: 'Sarah Johnson', email: 'sarah.johnson@healthai.com', specialization: 'Cardiologist', experience: 12, fee: 800, hospital: 'City Heart Hospital' },
  { name: 'Michael Chen', email: 'michael.chen@healthai.com', specialization: 'Neurologist', experience: 15, fee: 1000, hospital: 'Neuro Care Center' },
  { name: 'Priya Sharma', email: 'priya.sharma@healthai.com', specialization: 'Dermatologist', experience: 8, fee: 600, hospital: 'Skin & Care Clinic' },
  { name: 'James Wilson', email: 'james.wilson@healthai.com', specialization: 'Orthopedic', experience: 20, fee: 900, hospital: 'Bone & Joint Hospital' },
  { name: 'Emily Davis', email: 'emily.davis@healthai.com', specialization: 'Pediatrician', experience: 10, fee: 500, hospital: 'Children\'s Medical Center' },
  { name: 'Raj Patel', email: 'raj.patel@healthai.com', specialization: 'General Physician', experience: 18, fee: 400, hospital: 'Family Health Clinic' },
  { name: 'Lisa Anderson', email: 'lisa.anderson@healthai.com', specialization: 'Psychiatrist', experience: 14, fee: 1200, hospital: 'Mind Wellness Center' }
];

const seedDoctors = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    for (const doc of doctors) {
      const existingUser = await User.findOne({ email: doc.email });
      if (existingUser) continue;

      const user = await User.create({
        name: doc.name,
        email: doc.email,
        password: 'doctor123',
        role: 'doctor',
        profile: { gender: doc.name.includes('Sarah') || doc.name.includes('Priya') || doc.name.includes('Emily') || doc.name.includes('Lisa') ? 'female' : 'male' }
      });

      await Doctor.create({
        user: user._id,
        specialization: doc.specialization,
        experience: doc.experience,
        consultationFee: doc.fee,
        hospital: doc.hospital,
        qualifications: ['MBBS', 'MD'],
        rating: (4 + Math.random()).toFixed(1),
        totalReviews: Math.floor(Math.random() * 100) + 20,
        availability: [
          { day: 'Mon', startTime: '09:00', endTime: '17:00' },
          { day: 'Wed', startTime: '09:00', endTime: '17:00' },
          { day: 'Fri', startTime: '09:00', endTime: '17:00' }
        ]
      });
      console.log(`Created doctor: ${doc.name}`);
    }

    console.log('Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDoctors();
