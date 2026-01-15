const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const DeficiencyRule = require('../models/DeficiencyRule');
const SupplementMapping = require('../models/SupplementMapping');

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create admin user
    const adminExists = await User.findOne({ email: 'admin@healthai.com' });
    if (!adminExists) {
      await User.create({
        name: 'Admin User',
        email: 'admin@healthai.com',
        password: 'admin123',
        role: 'admin',
        isActive: true,
        subscription: { plan: 'premium', status: 'active', startDate: new Date() }
      });
      console.log('Admin user created: admin@healthai.com / admin123');
    }

    // Seed sample doctors
    const doctorCount = await Doctor.countDocuments();
    if (doctorCount === 0) {
      const sampleDoctors = [
        { name: 'Priya Sharma', specialization: 'General Physician', experience: 10, hospital: 'City Hospital', rating: 4.8 },
        { name: 'Rajesh Kumar', specialization: 'Nutritionist', experience: 8, hospital: 'Wellness Center', rating: 4.6 },
        { name: 'Anita Patel', specialization: 'Endocrinologist', experience: 15, hospital: 'Metro Medical', rating: 4.9 },
        { name: 'Vikram Singh', specialization: 'Cardiologist', experience: 12, hospital: 'Heart Care Institute', rating: 4.7 },
        { name: 'Meera Reddy', specialization: 'Dermatologist', experience: 7, hospital: 'Skin & Care Clinic', rating: 4.5 }
      ];
      await Doctor.insertMany(sampleDoctors);
      console.log('Sample doctors seeded');
    }

    // Seed deficiency rules
    const deficiencyRules = [
      {
        name: 'Vitamin D Deficiency',
        description: 'Low levels of Vitamin D in blood',
        biomarker: 'vitaminD',
        unit: 'ng/mL',
        thresholds: { severe: { max: 10 }, moderate: { min: 10, max: 20 }, mild: { min: 20, max: 30 }, normal: { min: 30, max: 100 } },
        symptoms: ['Fatigue', 'Bone pain', 'Muscle weakness', 'Depression'],
        isEnabled: true
      },
      {
        name: 'Vitamin B12 Deficiency',
        description: 'Low levels of Vitamin B12',
        biomarker: 'vitaminB12',
        unit: 'pg/mL',
        thresholds: { severe: { max: 150 }, moderate: { min: 150, max: 200 }, mild: { min: 200, max: 300 }, normal: { min: 300, max: 900 } },
        symptoms: ['Fatigue', 'Weakness', 'Numbness', 'Memory problems'],
        isEnabled: true
      },
      {
        name: 'Iron Deficiency',
        description: 'Low iron levels leading to anemia',
        biomarker: 'iron',
        unit: 'mcg/dL',
        thresholds: { severe: { max: 30 }, moderate: { min: 30, max: 50 }, mild: { min: 50, max: 60 }, normal: { min: 60, max: 170 } },
        symptoms: ['Fatigue', 'Pale skin', 'Shortness of breath', 'Dizziness'],
        isEnabled: true
      },
      {
        name: 'Vitamin C Deficiency',
        description: 'Low Vitamin C levels',
        biomarker: 'vitaminC',
        unit: 'mg/dL',
        thresholds: { severe: { max: 0.2 }, moderate: { min: 0.2, max: 0.4 }, mild: { min: 0.4, max: 0.6 }, normal: { min: 0.6, max: 2.0 } },
        symptoms: ['Bleeding gums', 'Slow wound healing', 'Dry skin', 'Fatigue'],
        isEnabled: true
      }
    ];

    for (const rule of deficiencyRules) {
      await DeficiencyRule.findOneAndUpdate({ name: rule.name }, rule, { upsert: true });
    }
    console.log('Deficiency rules seeded');

    // Seed supplement mappings
    const supplementMappings = [
      {
        deficiency: 'Vitamin D',
        supplements: [
          { category: 'Vitamin D3 (Cholecalciferol)', description: 'Most effective form of Vitamin D', generalDosage: '1000-2000 IU daily', notes: 'Take with fatty meal for better absorption' },
          { category: 'Vitamin D2 (Ergocalciferol)', description: 'Plant-based Vitamin D', generalDosage: '1000-2000 IU daily', notes: 'Suitable for vegetarians' }
        ],
        isEnabled: true
      },
      {
        deficiency: 'Vitamin B12',
        supplements: [
          { category: 'Methylcobalamin', description: 'Active form of B12', generalDosage: '500-1000 mcg daily', notes: 'Sublingual form may be better absorbed' },
          { category: 'Cyanocobalamin', description: 'Common synthetic form', generalDosage: '500-1000 mcg daily', notes: 'Most stable form' }
        ],
        isEnabled: true
      },
      {
        deficiency: 'Iron',
        supplements: [
          { category: 'Ferrous Sulfate', description: 'Common iron supplement', generalDosage: '325mg daily', notes: 'Take with Vitamin C for better absorption' },
          { category: 'Iron Bisglycinate', description: 'Gentle on stomach', generalDosage: '25-50mg daily', notes: 'Less likely to cause constipation' }
        ],
        isEnabled: true
      },
      {
        deficiency: 'Vitamin C',
        supplements: [
          { category: 'Ascorbic Acid', description: 'Pure Vitamin C', generalDosage: '500-1000mg daily', notes: 'May cause stomach upset in high doses' },
          { category: 'Buffered Vitamin C', description: 'Gentle on stomach', generalDosage: '500-1000mg daily', notes: 'Good for sensitive stomachs' }
        ],
        isEnabled: true
      }
    ];

    for (const mapping of supplementMappings) {
      await SupplementMapping.findOneAndUpdate({ deficiency: mapping.deficiency }, mapping, { upsert: true });
    }
    console.log('Supplement mappings seeded');

    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedData();
