import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, Mail, Lock, User, Eye, EyeOff, ArrowRight, Stethoscope, Heart, ArrowLeft, Scale, Ruler, Droplet, Cigarette, Wine, Moon, Dumbbell, Target, TrendingUp, TrendingDown, Minus, Plus, X, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import HealthProgressAnimation from '../components/HealthProgressAnimation';

export default function Register() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  
  // Always skip role selection and start at step 2 (basic info)
  const [step, setStep] = useState(2);
  const [userType, setUserType] = useState('patient'); // Always patient
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
    if (role === 'doctor') {
      navigate('/register/doctor');
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

  const prevStep = () => {
    if (step === 2) {
      // Go back to landing page instead of role selection
      navigate('/');
    } else {
      setStep(step - 1);
    }
  };

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

  // Step 1 is completely removed - we start at step 2

  // Step 2: Patient Registration Form - Basic Info
  if (step === 2) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-purple-50 to-orange-50">
        {/* Mobile Health Animation - Shows only on mobile */}
        <div className="lg:hidden w-full">
          <HealthProgressAnimation step={2} />
        </div>

        {/* Left Panel with Animation - Desktop Only */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-purple-500 via-pink-500 to-orange-600">
          <div className="absolute inset-0">
            <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white">
            {/* Animated Medical Icon */}
            <div className="relative w-32 h-32 mb-8">
              <div className="absolute inset-0 bg-white/20 backdrop-blur-xl rounded-full animate-pulse"></div>
              <div className="absolute inset-4 bg-white/30 backdrop-blur-xl rounded-full flex items-center justify-center">
                <Heart className="w-12 h-12 animate-pulse" />
              </div>
              {/* Progress Ring */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="64" cy="64" r="60" stroke="white" strokeOpacity="0.2" strokeWidth="4" fill="none" />
                <circle 
                  cx="64" cy="64" r="60" 
                  stroke="white" 
                  strokeWidth="4" 
                  fill="none"
                  strokeDasharray="377"
                  strokeDashoffset={377 - (377 * 0.25)}
                  className="transition-all duration-500"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            
            <h1 className="text-4xl font-bold mb-4 text-center">Your Health Journey Starts Here</h1>
            <p className="text-xl text-white/80 text-center max-w-md mb-6">
              Get personalized health insights, diet plans, and supplement recommendations based on your unique profile.
            </p>
            
            {/* Progress Steps */}
            <div className="flex items-center gap-3 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-sm font-medium">Step 1</span>
              </div>
              <div className="w-12 h-0.5 bg-white/40"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center">
                  <span className="text-sm font-bold">2</span>
                </div>
                <span className="text-sm">Step 2</span>
              </div>
              <div className="w-12 h-0.5 bg-white/20"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-sm">3</span>
                </div>
                <span className="text-sm text-white/60">Step 3</span>
              </div>
              <div className="w-12 h-0.5 bg-white/20"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-sm">4</span>
                </div>
                <span className="text-sm text-white/60">Step 4</span>
              </div>
            </div>
            
            <p className="text-sm text-white/70 mt-6">25% Complete - Almost there!</p>
          </div>
        </div>
        
        {/* Right Panel - Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <button onClick={prevStep} className="flex items-center gap-2 mb-6 text-cyan-600 hover:text-cyan-700">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2 text-gray-900">Basic Information</h2>
              <p className="text-gray-600">Step 1 of 4 - Let's start with the basics</p>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Age *</label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                    placeholder="25"
                    min="1"
                    max="120"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Gender *</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
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
                <label className="block text-sm font-medium mb-2 text-gray-700">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Password *</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Confirm Password *</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            
              <button 
                type="submit"
                className="w-full py-3 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-orange-600 hover:from-purple-600 hover:to-orange-700"
              >
                Continue <ArrowRight className="w-5 h-5" />
              </button>
            </form>
            
            <p className="text-center mt-6 text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-cyan-600 hover:text-cyan-700">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }
