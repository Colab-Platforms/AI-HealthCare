import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, Mail, Lock, User, Eye, EyeOff, ArrowRight, Stethoscope, Heart, ArrowLeft, Scale, Ruler, Droplet, Cigarette, Wine, Moon, Dumbbell, Target, TrendingUp, TrendingDown, Minus, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Register() {
  const [step, setStep] = useState(1); // 1: role selection, 2: basic info, 3: health profile, 4: lifestyle, 5: goals
  const [userType, setUserType] = useState(null); // 'patient' or 'doctor'
  const [formData, setFormData] = useState({ 
    // Basic Info
    name: '', 
    email: '', 
    password: '', 
    confirmPassword: '',
    age: '',
    gender: '',
    // Health Profile
    height: '', // cm
    weight: '', // kg
    bloodGroup: '',
    dietaryPreference: 'non-vegetarian',
    activityLevel: 'sedentary',
    // Medical History
    chronicConditions: [],
    allergies: [],
    currentMedications: [],
    // Lifestyle
    smoker: false,
    smokingFrequency: '',
    alcohol: false,
    alcoholFrequency: '',
    sleepHours: '7',
    stressLevel: 'moderate',
    waterIntake: '8',
    // Nutrition Goals
    nutritionGoal: 'general_health',
    targetWeight: '',
    weeklyGoal: '0.5'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Step 4 state variables
  const [customCondition, setCustomCondition] = useState('');
  const [customMedication, setCustomMedication] = useState('');
  const [customAllergy, setCustomAllergy] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleRoleSelect = (role) => {
    setUserType(role);
    if (role === 'doctor') {
      navigate('/register/doctor');
    } else {
      setStep(2);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!formData.age || !formData.gender) {
      toast.error('Please provide your age and gender');
      return;
    }
    
    setLoading(true);
    try {
      const profileData = {
        age: parseInt(formData.age),
        gender: formData.gender,
        height: formData.height ? parseFloat(formData.height) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        bloodGroup: formData.bloodGroup || undefined,
        dietaryPreference: formData.dietaryPreference,
        activityLevel: formData.activityLevel,
        medicalHistory: {
          conditions: formData.chronicConditions,
          currentMedications: formData.currentMedications
        },
        lifestyle: {
          smoker: formData.smoker,
          smokingFrequency: formData.smokingFrequency,
          alcohol: formData.alcohol,
          alcoholFrequency: formData.alcoholFrequency,
          sleepHours: parseInt(formData.sleepHours),
          stressLevel: formData.stressLevel,
          waterIntake: parseInt(formData.waterIntake)
        },
        allergies: formData.allergies
      };

      const nutritionGoal = {
        goal: formData.nutritionGoal,
        targetWeight: formData.targetWeight ? parseFloat(formData.targetWeight) : null,
        weeklyGoal: parseFloat(formData.weeklyGoal)
      };

      await register(formData.name, formData.email, formData.password, profileData, nutritionGoal);
      toast.success('Account created successfully! Your personalized nutrition plan is ready.');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    // Validation for each step
    if (step === 2) {
      if (!formData.name || !formData.email || !formData.password || !formData.age || !formData.gender) {
        toast.error('Please fill in all required fields');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    }
    if (step === 3) {
      if (!formData.height || !formData.weight) {
        toast.error('Please provide your height and weight for accurate nutrition calculations');
        return;
      }
    }
    setStep(step + 1);
  };

  const prevStep = () => setStep(step - 1);

  const toggleArrayItem = (field, item) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(item) 
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item]
    }));
  };

  const addCustomItem = (field, value) => {
    if (value && !formData[field].includes(value)) {
      setFormData(prev => ({
        ...prev,
        [field]: [...prev[field], value]
      }));
    }
  };

  const removeItem = (field, item) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter(i => i !== item)
    }));
  };

  // Step 1: Role Selection
  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F5F1EA' }}>
        <div className="w-full max-w-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#8B7355' }}>
              <Activity className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold" style={{ color: '#2C2416' }}>HealthAI</span>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#2C2416' }}>Join HealthAI</h1>
            <p style={{ color: '#5C4F3D' }}>Choose how you want to use our platform</p>
          </div>

          {/* Role Selection Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Patient Card */}
            <button
              onClick={() => handleRoleSelect('patient')}
              className="bg-white rounded-2xl p-8 text-left hover:shadow-lg transition-all group"
              style={{ border: '2px solid #E5DFD3' }}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors" style={{ backgroundColor: '#F5F1EA' }}>
                <Heart className="w-8 h-8 transition-colors" style={{ color: '#8B7355' }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: '#2C2416' }}>I am a Patient</h2>
              <p className="text-sm mb-4" style={{ color: '#5C4F3D' }}>
                Upload health reports, get AI-powered insights, personalized diet plans, and connect with doctors.
              </p>
              <ul className="text-sm space-y-2" style={{ color: '#5C4F3D' }}>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#8B7355' }}></div>
                  AI Health Report Analysis
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#8B7355' }}></div>
                  Personalized Diet Plans
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#8B7355' }}></div>
                  Video Consultations
                </li>
              </ul>
              <div className="mt-6 flex items-center font-medium" style={{ color: '#8B7355' }}>
                Get Started <ArrowRight className="w-4 h-4 ml-2" />
              </div>
            </button>

            {/* Doctor Card */}
            <button
              onClick={() => handleRoleSelect('doctor')}
              className="bg-white rounded-2xl p-8 text-left hover:shadow-lg transition-all group"
              style={{ border: '2px solid #E5DFD3' }}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors" style={{ backgroundColor: '#F5F1EA' }}>
                <Stethoscope className="w-8 h-8 transition-colors" style={{ color: '#8B7355' }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: '#2C2416' }}>I am a Doctor</h2>
              <p className="text-sm mb-4" style={{ color: '#5C4F3D' }}>
                Join our platform to provide consultations, manage appointments, and help patients.
              </p>
              <ul className="text-sm space-y-2" style={{ color: '#5C4F3D' }}>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#8B7355' }}></div>
                  Manage Your Schedule
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#8B7355' }}></div>
                  Video Consultations
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#8B7355' }}></div>
                  View Patient Reports
                </li>
              </ul>
              <div className="mt-6 flex items-center font-medium" style={{ color: '#8B7355' }}>
                Apply Now <ArrowRight className="w-4 h-4 ml-2" />
              </div>
            </button>
          </div>

          <p className="text-center mt-8" style={{ color: '#5C4F3D' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-semibold" style={{ color: '#8B7355' }}>Sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  // Step 2: Patient Registration Form - Basic Info
  if (step === 2) {
    return (
      <div className="min-h-screen flex" style={{ backgroundColor: '#F5F1EA' }}>
        {/* Left Panel */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #8B7355, #A0826D, #8B7355)' }}>
          <div className="absolute inset-0">
            <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-3xl flex items-center justify-center mb-8">
              <Heart className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-bold mb-4 text-center">Your Health Journey Starts Here</h1>
            <p className="text-xl text-white/80 text-center max-w-md">
              Get personalized health insights, diet plans, and supplement recommendations based on your unique profile.
            </p>
            <div className="mt-8 flex gap-2">
              <div className="w-2 h-2 rounded-full bg-white"></div>
              <div className="w-2 h-2 rounded-full bg-white/40"></div>
              <div className="w-2 h-2 rounded-full bg-white/40"></div>
              <div className="w-2 h-2 rounded-full bg-white/40"></div>
            </div>
          </div>
        </div>
        
        {/* Right Panel - Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 mb-6" style={{ color: '#5C4F3D' }}>
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2" style={{ color: '#2C2416' }}>Basic Information</h2>
              <p style={{ color: '#5C4F3D' }}>Step 1 of 4 - Let's start with the basics</p>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#2C2416' }}>Full Name *</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#5C4F3D' }} />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none"
                    style={{ border: '1px solid #E5DFD3', color: '#2C2416' }}
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#2C2416' }}>Age *</label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none"
                    style={{ border: '1px solid #E5DFD3', color: '#2C2416' }}
                    placeholder="25"
                    min="1"
                    max="120"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#2C2416' }}>Gender *</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none"
                    style={{ border: '1px solid #E5DFD3', color: '#2C2416' }}
                    required
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#2C2416' }}>Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#5C4F3D' }} />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none"
                    style={{ border: '1px solid #E5DFD3', color: '#2C2416' }}
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#2C2416' }}>Password *</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#5C4F3D' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 pl-12 pr-12 focus:outline-none"
                    style={{ border: '1px solid #E5DFD3', color: '#2C2416' }}
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: '#5C4F3D' }}>
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#2C2416' }}>Confirm Password *</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#5C4F3D' }} />
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none"
                    style={{ border: '1px solid #E5DFD3', color: '#2C2416' }}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            
              <button 
                type="submit"
                className="w-full py-3 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
                style={{ backgroundColor: '#8B7355' }}
              >
                Continue <ArrowRight className="w-5 h-5" />
              </button>
            </form>
            
            <p className="text-center mt-6" style={{ color: '#5C4F3D' }}>
              Already have an account?{' '}
              <Link to="/login" className="font-semibold" style={{ color: '#8B7355' }}>Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Health Profile
  if (step === 3) {
    return (
      <div className="min-h-screen flex" style={{ backgroundColor: '#F5F1EA' }}>
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #8B7355, #A0826D, #8B7355)' }}>
          <div className="absolute inset-0">
            <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-3xl flex items-center justify-center mb-8">
              <Scale className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-bold mb-4 text-center">Health Profile</h1>
            <p className="text-xl text-white/80 text-center max-w-md">
              Help us calculate your personalized nutrition goals based on your body metrics.
            </p>
            <div className="mt-8 flex gap-2">
              <div className="w-2 h-2 rounded-full bg-white/40"></div>
              <div className="w-2 h-2 rounded-full bg-white"></div>
              <div className="w-2 h-2 rounded-full bg-white/40"></div>
              <div className="w-2 h-2 rounded-full bg-white/40"></div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <button onClick={prevStep} className="flex items-center gap-2 mb-6" style={{ color: '#5C4F3D' }}>
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2" style={{ color: '#2C2416' }}>Health Profile</h2>
              <p style={{ color: '#5C4F3D' }}>Step 2 of 4 - Your body metrics</p>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#2C2416' }}>Height (cm) *</label>
                  <div className="relative">
                    <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#5C4F3D' }} />
                    <input
                      type="number"
                      value={formData.height}
                      onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                      className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none"
                      style={{ border: '1px solid #E5DFD3', color: '#2C2416' }}
                      placeholder="170"
                      min="100"
                      max="250"
                      step="0.1"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#2C2416' }}>Weight (kg) *</label>
                  <div className="relative">
                    <Scale className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#5C4F3D' }} />
                    <input
                      type="number"
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                      className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none"
                      style={{ border: '1px solid #E5DFD3', color: '#2C2416' }}
                      placeholder="70"
                      min="30"
                      max="300"
                      step="0.1"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#2C2416' }}>Blood Group</label>
                <div className="relative">
                  <Droplet className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#5C4F3D' }} />
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none"
                    style={{ border: '1px solid #E5DFD3', color: '#2C2416' }}
                  >
                    <option value="">Select (Optional)</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#2C2416' }}>Dietary Preference *</label>
                <select
                  value={formData.dietaryPreference}
                  onChange={(e) => setFormData({ ...formData, dietaryPreference: e.target.value })}
                  className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none"
                  style={{ border: '1px solid #E5DFD3', color: '#2C2416' }}
                  required
                >
                  <option value="non-vegetarian">Non-Vegetarian</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="eggetarian">Eggetarian</option>
                </select>
                <p className="text-xs mt-1" style={{ color: '#5C4F3D' }}>This helps us recommend suitable diet plans</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#2C2416' }}>Activity Level *</label>
                <select
                  value={formData.activityLevel}
                  onChange={(e) => setFormData({ ...formData, activityLevel: e.target.value })}
                  className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none"
                  style={{ border: '1px solid #E5DFD3', color: '#2C2416' }}
                  required
                >
                  <option value="sedentary">Sedentary (Little or no exercise)</option>
                  <option value="lightly_active">Lightly Active (1-3 days/week)</option>
                  <option value="moderately_active">Moderately Active (3-5 days/week)</option>
                  <option value="very_active">Very Active (6-7 days/week)</option>
                  <option value="extremely_active">Extremely Active (Athlete)</option>
                </select>
                <p className="text-xs mt-1" style={{ color: '#5C4F3D' }}>Used to calculate your daily calorie needs</p>
              </div>
            
              <button 
                type="submit"
                className="w-full py-3 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
                style={{ backgroundColor: '#8B7355' }}
              >
                Continue <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Lifestyle & Medical History
  if (step === 4) {
    const commonConditions = ['Diabetes', 'Hypertension', 'Thyroid', 'Asthma', 'Heart Disease', 'Arthritis'];
    const commonAllergies = ['Peanuts', 'Dairy', 'Gluten', 'Shellfish', 'Eggs', 'Soy'];

    return (
      <div className="min-h-screen flex" style={{ backgroundColor: '#F5F1EA' }}>
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #8B7355, #A0826D, #8B7355)' }}>
          <div className="absolute inset-0">
            <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-3xl flex items-center justify-center mb-8">
              <Heart className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-bold mb-4 text-center">Lifestyle & Health History</h1>
            <p className="text-xl text-white/80 text-center max-w-md">
              Help us understand your lifestyle and medical background for better recommendations.
            </p>
            <div className="mt-8 flex gap-2">
              <div className="w-2 h-2 rounded-full bg-white/40"></div>
              <div className="w-2 h-2 rounded-full bg-white/40"></div>
              <div className="w-2 h-2 rounded-full bg-white"></div>
              <div className="w-2 h-2 rounded-full bg-white/40"></div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
          <div className="w-full max-w-md py-8">
            <button onClick={prevStep} className="flex items-center gap-2 mb-6" style={{ color: '#5C4F3D' }}>
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2" style={{ color: '#2C2416' }}>Lifestyle & Medical History</h2>
              <p style={{ color: '#5C4F3D' }}>Step 3 of 4 - Optional but recommended</p>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-6">
              {/* Lifestyle Section */}
              <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #E5DFD3' }}>
                <h3 className="font-semibold mb-4" style={{ color: '#2C2416' }}>Lifestyle Habits</h3>
                
                <div className="space-y-4">
                  {/* Smoking */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2" style={{ color: '#2C2416' }}>
                      <Cigarette className="w-4 h-4" />
                      Do you smoke?
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={!formData.smoker}
                          onChange={() => setFormData({ ...formData, smoker: false, smokingFrequency: '' })}
                          className="text-cyan-500"
                        />
                        <span className="text-sm" style={{ color: '#2C2416' }}>No</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={formData.smoker}
                          onChange={() => setFormData({ ...formData, smoker: true })}
                          className="text-cyan-500"
                        />
                        <span className="text-sm" style={{ color: '#2C2416' }}>Yes</span>
                      </label>
                    </div>
                    {formData.smoker && (
                      <select
                        value={formData.smokingFrequency}
                        onChange={(e) => setFormData({ ...formData, smokingFrequency: e.target.value })}
                        className="mt-2 w-full rounded-lg py-2 px-3 text-sm"
                        style={{ backgroundColor: '#F5F1EA', border: '1px solid #E5DFD3', color: '#2C2416' }}
                      >
                        <option value="">Select frequency</option>
                        <option value="occasional">Occasional (1-2 times/week)</option>
                        <option value="regular">Regular (3-6 times/week)</option>
                        <option value="heavy">Heavy (Daily)</option>
                      </select>
                    )}
                  </div>

                  {/* Alcohol */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2" style={{ color: '#2C2416' }}>
                      <Wine className="w-4 h-4" />
                      Do you consume alcohol?
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={!formData.alcohol}
                          onChange={() => setFormData({ ...formData, alcohol: false, alcoholFrequency: '' })}
                          className="text-cyan-500"
                        />
                        <span className="text-sm" style={{ color: '#2C2416' }}>No</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={formData.alcohol}
                          onChange={() => setFormData({ ...formData, alcohol: true })}
                          className="text-cyan-500"
                        />
                        <span className="text-sm" style={{ color: '#2C2416' }}>Yes</span>
                      </label>
                    </div>
                    {formData.alcohol && (
                      <select
                        value={formData.alcoholFrequency}
                        onChange={(e) => setFormData({ ...formData, alcoholFrequency: e.target.value })}
                        className="mt-2 w-full rounded-lg py-2 px-3 text-sm"
                        style={{ backgroundColor: '#F5F1EA', border: '1px solid #E5DFD3', color: '#2C2416' }}
                      >
                        <option value="">Select frequency</option>
                        <option value="occasional">Occasional (1-2 drinks/week)</option>
                        <option value="moderate">Moderate (3-7 drinks/week)</option>
                        <option value="heavy">Heavy (8+ drinks/week)</option>
                      </select>
                    )}
                  </div>

                  {/* Sleep */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2" style={{ color: '#2C2416' }}>
                      <Moon className="w-4 h-4" />
                      Average sleep hours per night: {formData.sleepHours}h
                    </label>
                    <input
                      type="range"
                      min="4"
                      max="12"
                      value={formData.sleepHours}
                      onChange={(e) => setFormData({ ...formData, sleepHours: e.target.value })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs mt-1" style={{ color: '#5C4F3D' }}>
                      <span>4h</span>
                      <span>12h</span>
                    </div>
                  </div>

                  {/* Water Intake */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2" style={{ color: '#2C2416' }}>
                      <Droplet className="w-4 h-4" />
                      Water intake (glasses/day): {formData.waterIntake}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      value={formData.waterIntake}
                      onChange={(e) => setFormData({ ...formData, waterIntake: e.target.value })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs mt-1" style={{ color: '#5C4F3D' }}>
                      <span>1</span>
                      <span>15</span>
                    </div>
                  </div>

                  {/* Stress Level */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#2C2416' }}>Stress Level</label>
                    <select
                      value={formData.stressLevel}
                      onChange={(e) => setFormData({ ...formData, stressLevel: e.target.value })}
                      className="w-full rounded-lg py-2 px-3 text-sm"
                      style={{ backgroundColor: '#F5F1EA', border: '1px solid #E5DFD3', color: '#2C2416' }}
                    >
                      <option value="low">Low</option>
                      <option value="moderate">Moderate</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Medical History Section */}
              <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #E5DFD3' }}>
                <h3 className="font-semibold mb-4" style={{ color: '#2C2416' }}>Medical History (Optional)</h3>
                
                <div className="space-y-4">
                  {/* Chronic Conditions */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#2C2416' }}>Chronic Conditions</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {commonConditions.map(condition => (
                        <button
                          key={condition}
                          type="button"
                          onClick={() => toggleArrayItem('chronicConditions', condition)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            formData.chronicConditions.includes(condition)
                              ? 'text-white'
                              : ''
                          }`}
                          style={{
                            backgroundColor: formData.chronicConditions.includes(condition) ? '#8B7355' : '#F5F1EA',
                            color: formData.chronicConditions.includes(condition) ? 'white' : '#5C4F3D'
                          }}
                        >
                          {condition}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customCondition}
                        onChange={(e) => setCustomCondition(e.target.value)}
                        placeholder="Add custom condition"
                        className="flex-1 rounded-lg py-2 px-3 text-sm"
                        style={{ backgroundColor: '#F5F1EA', border: '1px solid #E5DFD3', color: '#2C2416' }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCustomItem('chronicConditions', customCondition);
                            setCustomCondition('');
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          addCustomItem('chronicConditions', customCondition);
                          setCustomCondition('');
                        }}
                        className="px-3 py-2 text-white rounded-lg text-sm"
                        style={{ backgroundColor: '#8B7355' }}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {formData.chronicConditions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.chronicConditions.map(item => (
                          <span key={item} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs" style={{ backgroundColor: '#F5F1EA', color: '#8B7355' }}>
                            {item}
                            <button type="button" onClick={() => removeItem('chronicConditions', item)}>
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Allergies */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#2C2416' }}>Allergies</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {commonAllergies.map(allergy => (
                        <button
                          key={allergy}
                          type="button"
                          onClick={() => toggleArrayItem('allergies', allergy)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors`}
                          style={{
                            backgroundColor: formData.allergies.includes(allergy) ? '#8B7355' : '#F5F1EA',
                            color: formData.allergies.includes(allergy) ? 'white' : '#5C4F3D'
                          }}
                        >
                          {allergy}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customAllergy}
                        onChange={(e) => setCustomAllergy(e.target.value)}
                        placeholder="Add custom allergy"
                        className="flex-1 rounded-lg py-2 px-3 text-sm"
                        style={{ backgroundColor: '#F5F1EA', border: '1px solid #E5DFD3', color: '#2C2416' }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCustomItem('allergies', customAllergy);
                            setCustomAllergy('');
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          addCustomItem('allergies', customAllergy);
                          setCustomAllergy('');
                        }}
                        className="px-3 py-2 text-white rounded-lg text-sm"
                        style={{ backgroundColor: '#8B7355' }}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {formData.allergies.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.allergies.map(item => (
                          <span key={item} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs" style={{ backgroundColor: '#F5F1EA', color: '#8B7355' }}>
                            {item}
                            <button type="button" onClick={() => removeItem('allergies', item)}>
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Current Medications */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#2C2416' }}>Current Medications</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customMedication}
                        onChange={(e) => setCustomMedication(e.target.value)}
                        placeholder="Add medication"
                        className="flex-1 rounded-lg py-2 px-3 text-sm"
                        style={{ backgroundColor: '#F5F1EA', border: '1px solid #E5DFD3', color: '#2C2416' }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCustomItem('currentMedications', customMedication);
                            setCustomMedication('');
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          addCustomItem('currentMedications', customMedication);
                          setCustomMedication('');
                        }}
                        className="px-3 py-2 text-white rounded-lg text-sm"
                        style={{ backgroundColor: '#8B7355' }}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {formData.currentMedications.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.currentMedications.map(item => (
                          <span key={item} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs" style={{ backgroundColor: '#F5F1EA', color: '#8B7355' }}>
                            {item}
                            <button type="button" onClick={() => removeItem('currentMedications', item)}>
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            
              <button 
                type="submit"
                className="w-full py-3 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
                style={{ backgroundColor: '#8B7355' }}
              >
                Continue <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Step 5: Nutrition Goals
  if (step === 5) {
    const calculateEstimate = () => {
      if (!formData.targetWeight || !formData.weight) return null;
      const diff = Math.abs(parseFloat(formData.targetWeight) - parseFloat(formData.weight));
      const weeks = Math.ceil(diff / parseFloat(formData.weeklyGoal));
      return weeks;
    };

    const estimatedWeeks = calculateEstimate();

    return (
      <div className="min-h-screen flex" style={{ backgroundColor: '#F5F1EA' }}>
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #8B7355, #A0826D, #8B7355)' }}>
          <div className="absolute inset-0">
            <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-3xl flex items-center justify-center mb-8">
              <Target className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-bold mb-4 text-center">Set Your Goals</h1>
            <p className="text-xl text-white/80 text-center max-w-md">
              We'll calculate your personalized nutrition plan based on your goals.
            </p>
            <div className="mt-8 flex gap-2">
              <div className="w-2 h-2 rounded-full bg-white/40"></div>
              <div className="w-2 h-2 rounded-full bg-white/40"></div>
              <div className="w-2 h-2 rounded-full bg-white/40"></div>
              <div className="w-2 h-2 rounded-full bg-white"></div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
          <div className="w-full max-w-md py-8">
            <button onClick={prevStep} className="flex items-center gap-2 mb-6" style={{ color: '#5C4F3D' }}>
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2" style={{ color: '#2C2416' }}>Your Nutrition Goals</h2>
              <p style={{ color: '#5C4F3D' }}>Step 4 of 4 - Almost done!</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Goal Selection */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: '#2C2416' }}>What's your primary goal?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nutritionGoal: 'weight_loss' })}
                    className={`p-4 rounded-xl border-2 transition-all`}
                    style={{
                      borderColor: formData.nutritionGoal === 'weight_loss' ? '#8B7355' : '#E5DFD3',
                      backgroundColor: formData.nutritionGoal === 'weight_loss' ? '#F5F1EA' : 'white'
                    }}
                  >
                    <TrendingDown className={`w-8 h-8 mx-auto mb-2`} style={{ color: formData.nutritionGoal === 'weight_loss' ? '#8B7355' : '#5C4F3D' }} />
                    <p className="text-sm font-medium" style={{ color: '#2C2416' }}>Weight Loss</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nutritionGoal: 'weight_gain' })}
                    className={`p-4 rounded-xl border-2 transition-all`}
                    style={{
                      borderColor: formData.nutritionGoal === 'weight_gain' ? '#8B7355' : '#E5DFD3',
                      backgroundColor: formData.nutritionGoal === 'weight_gain' ? '#F5F1EA' : 'white'
                    }}
                  >
                    <TrendingUp className={`w-8 h-8 mx-auto mb-2`} style={{ color: formData.nutritionGoal === 'weight_gain' ? '#8B7355' : '#5C4F3D' }} />
                    <p className="text-sm font-medium" style={{ color: '#2C2416' }}>Weight Gain</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nutritionGoal: 'muscle_gain' })}
                    className={`p-4 rounded-xl border-2 transition-all`}
                    style={{
                      borderColor: formData.nutritionGoal === 'muscle_gain' ? '#8B7355' : '#E5DFD3',
                      backgroundColor: formData.nutritionGoal === 'muscle_gain' ? '#F5F1EA' : 'white'
                    }}
                  >
                    <Dumbbell className={`w-8 h-8 mx-auto mb-2`} style={{ color: formData.nutritionGoal === 'muscle_gain' ? '#8B7355' : '#5C4F3D' }} />
                    <p className="text-sm font-medium" style={{ color: '#2C2416' }}>Muscle Gain</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nutritionGoal: 'maintain' })}
                    className={`p-4 rounded-xl border-2 transition-all`}
                    style={{
                      borderColor: formData.nutritionGoal === 'maintain' ? '#8B7355' : '#E5DFD3',
                      backgroundColor: formData.nutritionGoal === 'maintain' ? '#F5F1EA' : 'white'
                    }}
                  >
                    <Minus className={`w-8 h-8 mx-auto mb-2`} style={{ color: formData.nutritionGoal === 'maintain' ? '#8B7355' : '#5C4F3D' }} />
                    <p className="text-sm font-medium" style={{ color: '#2C2416' }}>Maintain</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nutritionGoal: 'general_health' })}
                    className={`p-4 rounded-xl border-2 transition-all col-span-2`}
                    style={{
                      borderColor: formData.nutritionGoal === 'general_health' ? '#8B7355' : '#E5DFD3',
                      backgroundColor: formData.nutritionGoal === 'general_health' ? '#F5F1EA' : 'white'
                    }}
                  >
                    <Heart className={`w-8 h-8 mx-auto mb-2`} style={{ color: formData.nutritionGoal === 'general_health' ? '#8B7355' : '#5C4F3D' }} />
                    <p className="text-sm font-medium" style={{ color: '#2C2416' }}>General Health</p>
                  </button>
                </div>
              </div>

              {/* Target Weight & Weekly Goal */}
              {(formData.nutritionGoal === 'weight_loss' || formData.nutritionGoal === 'weight_gain') && (
                <div className="bg-white rounded-xl p-4 space-y-4" style={{ border: '1px solid #E5DFD3' }}>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#2C2416' }}>
                      Target Weight (kg)
                    </label>
                    <input
                      type="number"
                      value={formData.targetWeight}
                      onChange={(e) => setFormData({ ...formData, targetWeight: e.target.value })}
                      className="w-full rounded-lg py-2 px-3 text-sm"
                      style={{ backgroundColor: '#F5F1EA', border: '1px solid #E5DFD3', color: '#2C2416' }}
                      placeholder={formData.weight}
                      min="30"
                      max="300"
                      step="0.1"
                    />
                    <p className="text-xs mt-1" style={{ color: '#5C4F3D' }}>Current: {formData.weight} kg</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#2C2416' }}>
                      Weekly Goal
                    </label>
                    <select
                      value={formData.weeklyGoal}
                      onChange={(e) => setFormData({ ...formData, weeklyGoal: e.target.value })}
                      className="w-full rounded-lg py-2 px-3 text-sm"
                      style={{ backgroundColor: '#F5F1EA', border: '1px solid #E5DFD3', color: '#2C2416' }}
                    >
                      <option value="0.25">0.25 kg/week (Slow & Steady)</option>
                      <option value="0.5">0.5 kg/week (Recommended)</option>
                      <option value="1">1 kg/week (Aggressive)</option>
                    </select>
                  </div>

                  {estimatedWeeks && (
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#F5F1EA' }}>
                      <p className="text-sm" style={{ color: '#8B7355' }}>
                        <strong>Estimated time:</strong> {estimatedWeeks} weeks ({Math.ceil(estimatedWeeks / 4)} months)
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Info Box */}
              <div className="rounded-xl p-4" style={{ backgroundColor: '#F5F1EA', border: '1px solid #E5DFD3' }}>
                <p className="text-sm" style={{ color: '#5C4F3D' }}>
                  <strong style={{ color: '#2C2416' }}>What happens next?</strong> We'll calculate your personalized daily calorie and macro goals based on your profile and goals. You can adjust these anytime from your nutrition dashboard.
                </p>
              </div>
            
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-3 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: '#8B7355' }}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Create Account & Calculate Goals <ArrowRight className="w-5 h-5" /></>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Fallback - should not reach here
  return null;
}

