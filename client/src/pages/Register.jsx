import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, Mail, Lock, User, Eye, EyeOff, ArrowRight, Stethoscope, Heart, ArrowLeft, Scale, Ruler, Droplet, Cigarette, Wine, Moon, Dumbbell, Target, TrendingUp, TrendingDown, Minus, Plus, X, CheckCircle2, Loader2, Syringe, Utensils, Calendar, Pill } from 'lucide-react';
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
    // Diabetes Profile (NEW)
    diabetesType: '',
    diagnosisYear: '',
    diabetesStatus: '',
    hba1c: '',
    glucoseMonitoring: '',
    fastingGlucose: '',
    postMealGlucose: '',
    testingFrequency: '',
    onMedication: false,
    medicationType: [],
    insulinTiming: '',
    recentDosageChange: false,
    // Health Profile
    height: '', // cm
    weight: '', // kg
    bloodGroup: '',
    bloodPressure: '',
    otherConditions: [],
    dietaryPreference: 'vegetarian',
    activityLevel: 'sedentary',
    // Diet Preferences (NEW)
    cuisinePreference: 'indian',
    mealsPerDay: '3',
    foodRestrictions: [],
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
    // Fitness & Goals (NEW)
    exercisePreference: [],
    primaryGoal: '',
    timeframe: '3',
    biggestChallenge: '',
    // Nutrition Goals
    nutritionGoal: 'general_health',
    targetWeight: '',
    weeklyGoal: '0.5'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Step state variables
  const [customCondition, setCustomCondition] = useState('');
  const [customMedication, setCustomMedication] = useState('');
  const [customAllergy, setCustomAllergy] = useState('');
  const [customFoodRestriction, setCustomFoodRestriction] = useState('');
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
        bloodPressure: formData.bloodPressure || undefined,
        dietaryPreference: formData.dietaryPreference,
        activityLevel: formData.activityLevel,
        medicalHistory: {
          conditions: [
            formData.diabetesType ? `Diabetes ${formData.diabetesType}` : '',
            ...formData.chronicConditions,
            ...formData.otherConditions
          ].filter(Boolean),
          currentMedications: [...formData.currentMedications, ...formData.medicationType].filter(Boolean)
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
        allergies: [...formData.allergies, ...formData.foodRestrictions].filter(Boolean),
        diabetesProfile: formData.diabetesType ? {
          type: formData.diabetesType,
          diagnosisYear: formData.diagnosisYear,
          status: formData.diabetesStatus,
          hba1c: formData.hba1c,
          glucoseMonitoring: formData.glucoseMonitoring,
          fastingGlucose: formData.fastingGlucose,
          postMealGlucose: formData.postMealGlucose,
          testingFrequency: formData.testingFrequency,
          onMedication: formData.onMedication,
          medicationType: formData.medicationType,
          insulinTiming: formData.insulinTiming,
          recentDosageChange: formData.recentDosageChange
        } : undefined,
        dietPreferences: {
          cuisinePreference: formData.cuisinePreference,
          mealsPerDay: formData.mealsPerDay,
          restrictions: formData.foodRestrictions
        },
        fitnessProfile: {
          exercisePreference: formData.exercisePreference,
          primaryGoal: formData.primaryGoal,
          timeframe: formData.timeframe,
          biggestChallenge: formData.biggestChallenge
        }
      };

      const nutritionGoal = {
        goal: formData.primaryGoal || formData.nutritionGoal,
        targetWeight: formData.targetWeight ? parseFloat(formData.targetWeight) : null,
        weeklyGoal: parseFloat(formData.weeklyGoal)
      };

      await register(formData.name, formData.email, formData.password, profileData, nutritionGoal);
      toast.success('Account created successfully! Your personalized health plan is ready.');
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

  // Step 2: Patient Registration Form - Basic Info
  if (step === 2) {
    return (
      <div className="min-h-screen flex bg-gradient-to-br from-cyan-50 to-blue-50">
        {/* Mobile Health Animation - Shows only on mobile */}
        <div className="lg:hidden w-full">
          <HealthProgressAnimation step={2} />
        </div>

        {/* Left Panel with Animation - Desktop Only */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-cyan-500 via-blue-500 to-cyan-600">
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
                  strokeDashoffset={377 - (377 * 0.16)}
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
            <div className="flex items-center gap-2 mt-4">
              <div className="flex items-center gap-1">
                <div className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center">
                  <span className="text-sm font-bold">1</span>
                </div>
                <span className="text-xs">Basic</span>
              </div>
              <div className="w-8 h-0.5 bg-white/20"></div>
              <div className="flex items-center gap-1">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-xs">2</span>
                </div>
                <span className="text-xs text-white/60">Health</span>
              </div>
              <div className="w-8 h-0.5 bg-white/20"></div>
              <div className="flex items-center gap-1">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-xs">3</span>
                </div>
                <span className="text-xs text-white/60">Diabetes</span>
              </div>
              <div className="w-8 h-0.5 bg-white/20"></div>
              <div className="flex items-center gap-1">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-xs">4</span>
                </div>
                <span className="text-xs text-white/60">Diet</span>
              </div>
              <div className="w-8 h-0.5 bg-white/20"></div>
              <div className="flex items-center gap-1">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-xs">5</span>
                </div>
                <span className="text-xs text-white/60">Fitness</span>
              </div>
              <div className="w-8 h-0.5 bg-white/20"></div>
              <div className="flex items-center gap-1">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-xs">6</span>
                </div>
                <span className="text-xs text-white/60">Goals</span>
              </div>
            </div>
            
            <p className="text-sm text-white/70 mt-6">Step 1 of 6 - Let's begin!</p>
          </div>
        </div>
        
        {/* Right Panel - Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <button onClick={() => navigate('/')} className="flex items-center gap-2 mb-6 text-cyan-600 hover:text-cyan-700">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2 text-gray-900">Basic Information</h2>
              <p className="text-gray-600">Step 1 of 6 - Let's start with the basics</p>
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
                className="w-full py-3 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
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

  // Step 3: Health Profile
  if (step === 3) {
    return (
      <div className="min-h-screen flex bg-gradient-to-br from-cyan-50 to-blue-50">
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-cyan-500 via-blue-500 to-cyan-600">
          <div className="absolute inset-0">
            <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white">
            <div className="relative w-32 h-32 mb-8">
              <div className="absolute inset-0 bg-white/20 backdrop-blur-xl rounded-full animate-pulse"></div>
              <div className="absolute inset-4 bg-white/30 backdrop-blur-xl rounded-full flex items-center justify-center">
                <Scale className="w-12 h-12 animate-bounce" style={{ animationDuration: '2s' }} />
              </div>
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="64" cy="64" r="60" stroke="white" strokeOpacity="0.2" strokeWidth="4" fill="none" />
                <circle 
                  cx="64" cy="64" r="60" 
                  stroke="white" 
                  strokeWidth="4" 
                  fill="none"
                  strokeDasharray="377"
                  strokeDashoffset={377 - (377 * 0.33)}
                  className="transition-all duration-500"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            
            <h1 className="text-4xl font-bold mb-4 text-center">Health Profile</h1>
            <p className="text-xl text-white/80 text-center max-w-md mb-6">
              Help us calculate your personalized nutrition goals based on your body metrics.
            </p>
            
            <p className="text-sm text-white/70 mt-6">Step 2 of 6</p>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <button onClick={prevStep} className="flex items-center gap-2 mb-6 text-cyan-700 hover:text-cyan-800">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2 text-gray-900">Health Profile</h2>
              <p className="text-cyan-700">Step 2 of 6 - Your body metrics</p>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-900">Height (cm) *</label>
                  <div className="relative">
                    <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-600" />
                    <input
                      type="number"
                      value={formData.height}
                      onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value }))}
                      className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
                      placeholder="170"
                      min="100"
                      max="250"
                      step="0.1"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-900">Weight (kg) *</label>
                  <div className="relative">
                    <Scale className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-600" />
                    <input
                      type="number"
                      value={formData.weight}
                      onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                      className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
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
                <label className="block text-sm font-medium mb-2 text-gray-900">Blood Group</label>
                <div className="relative">
                  <Droplet className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-600" />
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData(prev => ({ ...prev, bloodGroup: e.target.value }))}
                    className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
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
                <label className="block text-sm font-medium mb-2 text-gray-900">Dietary Preference *</label>
                <select
                  value={formData.dietaryPreference}
                  onChange={(e) => setFormData(prev => ({ ...prev, dietaryPreference: e.target.value }))}
                  className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
                  required
                >
                  <option value="non-vegetarian">Non-Vegetarian</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="eggetarian">Eggetarian</option>
                </select>
                <p className="text-xs mt-1 text-cyan-700">This helps us recommend suitable diet plans</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900">Activity Level *</label>
                <select
                  value={formData.activityLevel}
                  onChange={(e) => setFormData(prev => ({ ...prev, activityLevel: e.target.value }))}
                  className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
                  required
                >
                  <option value="sedentary">Sedentary (Little or no exercise)</option>
                  <option value="lightly_active">Lightly Active (1-3 days/week)</option>
                  <option value="moderately_active">Moderately Active (3-5 days/week)</option>
                  <option value="very_active">Very Active (6-7 days/week)</option>
                  <option value="extremely_active">Extremely Active (Athlete)</option>
                </select>
                <p className="text-xs mt-1 text-cyan-700">Used to calculate your daily calorie needs</p>
              </div>
            
              <button 
                type="submit"
                className="w-full py-3 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
              >
                Continue <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Diabetes Profile (NEW STEP)
  if (step === 4) {
    return (
      <div className="min-h-screen flex bg-gradient-to-br from-cyan-50 to-blue-50">
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-cyan-500 via-blue-500 to-cyan-600">
          <div className="absolute inset-0">
            <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white">
            <div className="relative w-32 h-32 mb-8">
              <div className="absolute inset-0 bg-white/20 backdrop-blur-xl rounded-full animate-pulse"></div>
              <div className="absolute inset-4 bg-white/30 backdrop-blur-xl rounded-full flex items-center justify-center">
                <Activity className="w-12 h-12" />
              </div>
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="64" cy="64" r="60" stroke="white" strokeOpacity="0.2" strokeWidth="4" fill="none" />
                <circle 
                  cx="64" cy="64" r="60" 
                  stroke="white" 
                  strokeWidth="4" 
                  fill="none"
                  strokeDasharray="377"
                  strokeDashoffset={377 - (377 * 0.50)}
                  className="transition-all duration-500"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            
            <h1 className="text-4xl font-bold mb-4 text-center">Diabetes Profile</h1>
            <p className="text-xl text-white/80 text-center max-w-md mb-6">
              Help us provide personalized diabetes management recommendations.
            </p>
            
            <p className="text-sm text-white/70 mt-6">Step 3 of 6 - Optional</p>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
          <div className="w-full max-w-md py-8">
            <button onClick={prevStep} className="flex items-center gap-2 mb-6 text-cyan-700 hover:text-cyan-800">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2 text-gray-900">Diabetes Profile</h2>
              <p className="text-cyan-700">Step 3 of 6 - Optional but recommended for diabetes management</p>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-6">
              {/* Diabetes Type */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900">Do you have diabetes?</label>
                <select
                  value={formData.diabetesType}
                  onChange={(e) => setFormData({ ...formData, diabetesType: e.target.value })}
                  className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
                >
                  <option value="">No / Prefer not to say</option>
                  <option value="Type 1">Type 1 Diabetes</option>
                  <option value="Type 2">Type 2 Diabetes</option>
                  <option value="Prediabetes">Prediabetes</option>
                  <option value="Gestational">Gestational Diabetes</option>
                </select>
              </div>

              {/* Show additional fields only if diabetes type is selected */}
              {formData.diabetesType && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-900">Year of Diagnosis</label>
                      <input
                        type="number"
                        value={formData.diagnosisYear}
                        onChange={(e) => setFormData({ ...formData, diagnosisYear: e.target.value })}
                        className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
                        placeholder="2020"
                        min="1900"
                        max={new Date().getFullYear()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-900">Current Status</label>
                      <select
                        value={formData.diabetesStatus}
                        onChange={(e) => setFormData({ ...formData, diabetesStatus: e.target.value })}
                        className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
                      >
                        <option value="">Select</option>
                        <option value="Controlled">Controlled</option>
                        <option value="Uncontrolled">Uncontrolled</option>
                        <option value="Newly diagnosed">Newly diagnosed</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900">Latest HbA1c (%)</label>
                    <input
                      type="number"
                      value={formData.hba1c}
                      onChange={(e) => setFormData({ ...formData, hba1c: e.target.value })}
                      className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
                      placeholder="6.5"
                      min="4"
                      max="15"
                      step="0.1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900">Glucose Monitoring Method</label>
                    <select
                      value={formData.glucoseMonitoring}
                      onChange={(e) => setFormData({ ...formData, glucoseMonitoring: e.target.value })}
                      className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
                    >
                      <option value="">Select</option>
                      <option value="Finger prick">Finger prick (Glucometer)</option>
                      <option value="CGM">Continuous Glucose Monitor (CGM)</option>
                      <option value="Flash glucose monitor">Flash Glucose Monitor</option>
                      <option value="Lab tests only">Lab tests only</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-900">Fasting Glucose (mg/dL)</label>
                      <input
                        type="number"
                        value={formData.fastingGlucose}
                        onChange={(e) => setFormData({ ...formData, fastingGlucose: e.target.value })}
                        className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
                        placeholder="100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-900">Post-Meal Glucose (mg/dL)</label>
                      <input
                        type="number"
                        value={formData.postMealGlucose}
                        onChange={(e) => setFormData({ ...formData, postMealGlucose: e.target.value })}
                        className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
                        placeholder="140"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900">Testing Frequency</label>
                    <select
                      value={formData.testingFrequency}
                      onChange={(e) => setFormData({ ...formData, testingFrequency: e.target.value })}
                      className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
                    >
                      <option value="">Select</option>
                      <option value="Multiple times daily">Multiple times daily</option>
                      <option value="Once daily">Once daily</option>
                      <option value="Few times a week">Few times a week</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>

                  {/* Medication Section */}
                  <div className="bg-white rounded-xl p-4 border border-cyan-200">
                    <label className="flex items-center gap-2 text-sm font-medium mb-3 text-gray-900">
                      <Pill className="w-5 h-5 text-cyan-600" />
                      Are you on diabetes medication?
                    </label>
                    <div className="flex gap-4 mb-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={!formData.onMedication}
                          onChange={() => setFormData({ ...formData, onMedication: false, medicationType: [], insulinTiming: '' })}
                          className="text-cyan-500"
                        />
                        <span className="text-sm text-gray-900">No</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={formData.onMedication}
                          onChange={() => setFormData({ ...formData, onMedication: true })}
                          className="text-cyan-500"
                        />
                        <span className="text-sm text-gray-900">Yes</span>
                      </label>
                    </div>

                    {formData.onMedication && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-900">Medication Type (select all that apply)</label>
                          <div className="space-y-2">
                            {['Metformin', 'Insulin', 'Sulfonylureas', 'DPP-4 inhibitors', 'SGLT2 inhibitors', 'GLP-1 agonists'].map(med => (
                              <label key={med} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formData.medicationType.includes(med)}
                                  onChange={() => toggleArrayItem('medicationType', med)}
                                  className="text-cyan-500"
                                />
                                <span className="text-sm text-gray-900">{med}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {formData.medicationType.includes('Insulin') && (
                          <div>
                            <label className="block text-sm font-medium mb-2 text-gray-900">Insulin Timing</label>
                            <select
                              value={formData.insulinTiming}
                              onChange={(e) => setFormData({ ...formData, insulinTiming: e.target.value })}
                              className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
                            >
                              <option value="">Select</option>
                              <option value="Before meals">Before meals</option>
                              <option value="After meals">After meals</option>
                              <option value="Bedtime">Bedtime</option>
                              <option value="Multiple times">Multiple times daily</option>
                            </select>
                          </div>
                        )}

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.recentDosageChange}
                            onChange={(e) => setFormData({ ...formData, recentDosageChange: e.target.checked })}
                            className="text-cyan-500"
                          />
                          <span className="text-sm text-gray-900">Recent dosage change (within last 3 months)</span>
                        </label>
                      </div>
                    )}
                  </div>
                </>
              )}
            
              <button 
                type="submit"
                className="w-full py-3 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
              >
                Continue <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Step 5: Diet Preferences (NEW STEP)
  if (step === 5) {
    const commonFoodRestrictions = ['Gluten', 'Dairy', 'Nuts', 'Shellfish', 'Eggs', 'Soy', 'Sugar', 'Processed foods'];
    
    return (
      <div className="min-h-screen flex bg-gradient-to-br from-cyan-50 to-blue-50">
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-cyan-500 via-blue-500 to-cyan-600">
          <div className="absolute inset-0">
            <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white">
            <div className="relative w-32 h-32 mb-8">
              <div className="absolute inset-0 bg-white/20 backdrop-blur-xl rounded-full animate-pulse"></div>
              <div className="absolute inset-4 bg-white/30 backdrop-blur-xl rounded-full flex items-center justify-center">
                <Utensils className="w-12 h-12" />
              </div>
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="64" cy="64" r="60" stroke="white" strokeOpacity="0.2" strokeWidth="4" fill="none" />
                <circle 
                  cx="64" cy="64" r="60" 
                  stroke="white" 
                  strokeWidth="4" 
                  fill="none"
                  strokeDasharray="377"
                  strokeDashoffset={377 - (377 * 0.66)}
                  className="transition-all duration-500"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            
            <h1 className="text-4xl font-bold mb-4 text-center">Diet Preferences</h1>
            <p className="text-xl text-white/80 text-center max-w-md mb-6">
              Tell us about your food preferences for personalized meal plans.
            </p>
            
            <p className="text-sm text-white/70 mt-6">Step 4 of 6</p>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
          <div className="w-full max-w-md py-8">
            <button onClick={prevStep} className="flex items-center gap-2 mb-6 text-cyan-700 hover:text-cyan-800">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2 text-gray-900">Diet Preferences</h2>
              <p className="text-cyan-700">Step 4 of 6 - Customize your meal plans</p>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900">Cuisine Preference</label>
                <select
                  value={formData.cuisinePreference}
                  onChange={(e) => setFormData({ ...formData, cuisinePreference: e.target.value })}
                  className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
                >
                  <option value="indian">Indian</option>
                  <option value="continental">Continental</option>
                  <option value="chinese">Chinese</option>
                  <option value="mediterranean">Mediterranean</option>
                  <option value="mixed">Mixed / International</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900">Meals Per Day</label>
                <select
                  value={formData.mealsPerDay}
                  onChange={(e) => setFormData({ ...formData, mealsPerDay: e.target.value })}
                  className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
                >
                  <option value="2">2 meals</option>
                  <option value="3">3 meals</option>
                  <option value="4">4 meals</option>
                  <option value="5">5-6 small meals</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-3 text-gray-900">Food Restrictions / Allergies</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {commonFoodRestrictions.map(restriction => (
                    <button
                      key={restriction}
                      type="button"
                      onClick={() => toggleArrayItem('foodRestrictions', restriction)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        formData.foodRestrictions.includes(restriction)
                          ? 'bg-cyan-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {restriction}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customFoodRestriction}
                    onChange={(e) => setCustomFoodRestriction(e.target.value)}
                    placeholder="Add custom restriction"
                    className="flex-1 bg-white rounded-xl py-2 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900 text-sm"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomItem('foodRestrictions', customFoodRestriction);
                        setCustomFoodRestriction('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      addCustomItem('foodRestrictions', customFoodRestriction);
                      setCustomFoodRestriction('');
                    }}
                    className="px-4 py-2 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {formData.foodRestrictions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {formData.foodRestrictions.map(item => (
                      <span key={item} className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-xs">
                        {item}
                        <button type="button" onClick={() => removeItem('foodRestrictions', item)}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            
              <button 
                type="submit"
                className="w-full py-3 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
              >
                Continue <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Step 6: Fitness & Goals (NEW STEP)
  if (step === 6) {
    const exerciseOptions = ['Walking', 'Running', 'Cycling', 'Swimming', 'Yoga', 'Gym/Weights', 'Sports', 'Dancing', 'Home workouts'];
    const challenges = ['Lack of time', 'Lack of motivation', 'Physical limitations', 'No gym access', 'Dietary restrictions', 'Stress management'];
    
    return (
      <div className="min-h-screen flex bg-gradient-to-br from-cyan-50 to-blue-50">
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-cyan-500 via-blue-500 to-cyan-600">
          <div className="absolute inset-0">
            <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white">
            <div className="relative w-32 h-32 mb-8">
              <div className="absolute inset-0 bg-white/20 backdrop-blur-xl rounded-full animate-pulse"></div>
              <div className="absolute inset-4 bg-white/30 backdrop-blur-xl rounded-full flex items-center justify-center">
                <Dumbbell className="w-12 h-12" />
              </div>
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="64" cy="64" r="60" stroke="white" strokeOpacity="0.2" strokeWidth="4" fill="none" />
                <circle 
                  cx="64" cy="64" r="60" 
                  stroke="white" 
                  strokeWidth="4" 
                  fill="none"
                  strokeDasharray="377"
                  strokeDashoffset={377 - (377 * 0.83)}
                  className="transition-all duration-500"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            
            <h1 className="text-4xl font-bold mb-4 text-center">Fitness & Goals</h1>
            <p className="text-xl text-white/80 text-center max-w-md mb-6">
              Share your fitness preferences and health goals with us.
            </p>
            
            <p className="text-sm text-white/70 mt-6">Step 5 of 6 - Almost there!</p>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
          <div className="w-full max-w-md py-8">
            <button onClick={prevStep} className="flex items-center gap-2 mb-6 text-cyan-700 hover:text-cyan-800">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2 text-gray-900">Fitness & Goals</h2>
              <p className="text-cyan-700">Step 5 of 6 - Define your fitness journey</p>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-3 text-gray-900">Exercise Preferences (select all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {exerciseOptions.map(exercise => (
                    <button
                      key={exercise}
                      type="button"
                      onClick={() => toggleArrayItem('exercisePreference', exercise)}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        formData.exercisePreference.includes(exercise)
                          ? 'bg-cyan-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {exercise}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900">Primary Health Goal</label>
                <select
                  value={formData.primaryGoal}
                  onChange={(e) => setFormData({ ...formData, primaryGoal: e.target.value })}
                  className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
                >
                  <option value="">Select your goal</option>
                  <option value="weight_loss">Weight Loss</option>
                  <option value="weight_gain">Weight Gain</option>
                  <option value="muscle_gain">Muscle Gain</option>
                  <option value="maintain">Maintain Current Weight</option>
                  <option value="general_health">General Health & Wellness</option>
                  <option value="diabetes_management">Diabetes Management</option>
                  <option value="heart_health">Heart Health</option>
                  <option value="energy_boost">Increase Energy Levels</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900">Timeframe to Achieve Goal</label>
                <select
                  value={formData.timeframe}
                  onChange={(e) => setFormData({ ...formData, timeframe: e.target.value })}
                  className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
                >
                  <option value="1">1 month</option>
                  <option value="3">3 months</option>
                  <option value="6">6 months</option>
                  <option value="12">1 year</option>
                  <option value="24">2 years</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-3 text-gray-900">Biggest Challenge</label>
                <div className="space-y-2">
                  {challenges.map(challenge => (
                    <label key={challenge} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="challenge"
                        value={challenge}
                        checked={formData.biggestChallenge === challenge}
                        onChange={(e) => setFormData({ ...formData, biggestChallenge: e.target.value })}
                        className="text-cyan-500"
                      />
                      <span className="text-sm text-gray-900">{challenge}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Lifestyle Habits */}
              <div className="bg-white rounded-xl p-4 border border-cyan-200">
                <h3 className="font-semibold mb-4 text-gray-900">Lifestyle Habits</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-900">
                      <Moon className="w-4 h-4" />
                      Average sleep hours: {formData.sleepHours}h
                    </label>
                    <input
                      type="range"
                      min="4"
                      max="12"
                      value={formData.sleepHours}
                      onChange={(e) => setFormData({ ...formData, sleepHours: e.target.value })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs mt-1 text-gray-600">
                      <span>4h</span>
                      <span>12h</span>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-900">
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
                    <div className="flex justify-between text-xs mt-1 text-gray-600">
                      <span>1</span>
                      <span>15</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900">Stress Level</label>
                    <select
                      value={formData.stressLevel}
                      onChange={(e) => setFormData({ ...formData, stressLevel: e.target.value })}
                      className="w-full bg-white rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900 text-sm"
                    >
                      <option value="low">Low</option>
                      <option value="moderate">Moderate</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.smoker}
                        onChange={(e) => setFormData({ ...formData, smoker: e.target.checked })}
                        className="text-cyan-500"
                      />
                      <span className="text-sm text-gray-900">Smoker</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.alcohol}
                        onChange={(e) => setFormData({ ...formData, alcohol: e.target.checked })}
                        className="text-cyan-500"
                      />
                      <span className="text-sm text-gray-900">Alcohol</span>
                    </label>
                  </div>
                </div>
              </div>
            
              <button 
                type="submit"
                className="w-full py-3 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
              >
                Continue <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Step 7: Final - Nutrition Goals
  if (step === 7) {
    const calculateEstimate = () => {
      if (!formData.targetWeight || !formData.weight) return null;
      const diff = Math.abs(parseFloat(formData.targetWeight) - parseFloat(formData.weight));
      const weeks = Math.ceil(diff / parseFloat(formData.weeklyGoal));
      return weeks;
    };

    const estimatedWeeks = calculateEstimate();

    return (
      <div className="min-h-screen flex bg-gradient-to-br from-cyan-50 to-blue-50">
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-cyan-500 via-blue-500 to-cyan-600">
          <div className="absolute inset-0">
            <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white">
            <div className="relative w-32 h-32 mb-8">
              <div className="absolute inset-0 bg-white/20 backdrop-blur-xl rounded-full animate-pulse"></div>
              <div className="absolute inset-4 bg-white/30 backdrop-blur-xl rounded-full flex items-center justify-center">
                <Target className="w-12 h-12" />
              </div>
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="64" cy="64" r="60" stroke="white" strokeOpacity="0.2" strokeWidth="4" fill="none" />
                <circle 
                  cx="64" cy="64" r="60" 
                  stroke="white" 
                  strokeWidth="4" 
                  fill="none"
                  strokeDasharray="377"
                  strokeDashoffset={377 - (377 * 1.0)}
                  className="transition-all duration-500"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <CheckCircle2 className="w-16 h-16 text-white/80 animate-pulse" />
              </div>
            </div>
            
            <h1 className="text-4xl font-bold mb-4 text-center">Final Step!</h1>
            <p className="text-xl text-white/80 text-center max-w-md mb-6">
              We'll calculate your personalized nutrition plan based on your goals.
            </p>
            
            <div className="mt-6 text-center">
              <p className="text-lg font-bold text-white mb-2">🎉 Almost Complete!</p>
              <p className="text-sm text-white/70">One more step to unlock your personalized health plan</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
          <div className="w-full max-w-md py-8">
            <button onClick={prevStep} className="flex items-center gap-2 mb-6 text-cyan-700 hover:text-cyan-800">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2 text-gray-900">Nutrition Goals</h2>
              <p className="text-cyan-700">Step 6 of 6 - Final step!</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Goal Selection */}
              <div>
                <label className="block text-sm font-medium mb-3 text-gray-900">What's your primary nutrition goal?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nutritionGoal: 'weight_loss' })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.nutritionGoal === 'weight_loss'
                        ? 'border-cyan-600 bg-cyan-50'
                        : 'border-gray-200 bg-white hover:border-cyan-300'
                    }`}
                  >
                    <TrendingDown className={`w-8 h-8 mx-auto mb-2 ${formData.nutritionGoal === 'weight_loss' ? 'text-cyan-600' : 'text-gray-600'}`} />
                    <p className="text-sm font-medium text-gray-900">Weight Loss</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nutritionGoal: 'weight_gain' })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.nutritionGoal === 'weight_gain'
                        ? 'border-cyan-600 bg-cyan-50'
                        : 'border-gray-200 bg-white hover:border-cyan-300'
                    }`}
                  >
                    <TrendingUp className={`w-8 h-8 mx-auto mb-2 ${formData.nutritionGoal === 'weight_gain' ? 'text-cyan-600' : 'text-gray-600'}`} />
                    <p className="text-sm font-medium text-gray-900">Weight Gain</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nutritionGoal: 'muscle_gain' })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.nutritionGoal === 'muscle_gain'
                        ? 'border-cyan-600 bg-cyan-50'
                        : 'border-gray-200 bg-white hover:border-cyan-300'
                    }`}
                  >
                    <Dumbbell className={`w-8 h-8 mx-auto mb-2 ${formData.nutritionGoal === 'muscle_gain' ? 'text-cyan-600' : 'text-gray-600'}`} />
                    <p className="text-sm font-medium text-gray-900">Muscle Gain</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nutritionGoal: 'maintain' })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.nutritionGoal === 'maintain'
                        ? 'border-cyan-600 bg-cyan-50'
                        : 'border-gray-200 bg-white hover:border-cyan-300'
                    }`}
                  >
                    <Minus className={`w-8 h-8 mx-auto mb-2 ${formData.nutritionGoal === 'maintain' ? 'text-cyan-600' : 'text-gray-600'}`} />
                    <p className="text-sm font-medium text-gray-900">Maintain</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nutritionGoal: 'general_health' })}
                    className={`p-4 rounded-xl border-2 transition-all col-span-2 ${
                      formData.nutritionGoal === 'general_health'
                        ? 'border-cyan-600 bg-cyan-50'
                        : 'border-gray-200 bg-white hover:border-cyan-300'
                    }`}
                  >
                    <Heart className={`w-8 h-8 mx-auto mb-2 ${formData.nutritionGoal === 'general_health' ? 'text-cyan-600' : 'text-gray-600'}`} />
                    <p className="text-sm font-medium text-gray-900">General Health</p>
                  </button>
                </div>
              </div>

              {/* Target Weight & Weekly Goal */}
              {(formData.nutritionGoal === 'weight_loss' || formData.nutritionGoal === 'weight_gain') && (
                <div className="bg-white rounded-xl p-4 space-y-4 border border-cyan-200">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900">
                      Target Weight (kg)
                    </label>
                    <input
                      type="number"
                      value={formData.targetWeight}
                      onChange={(e) => setFormData({ ...formData, targetWeight: e.target.value })}
                      className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
                      placeholder={formData.weight}
                      min="30"
                      max="300"
                      step="0.1"
                    />
                    <p className="text-xs mt-1 text-gray-600">Current: {formData.weight} kg</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900">
                      Weekly Goal
                    </label>
                    <select
                      value={formData.weeklyGoal}
                      onChange={(e) => setFormData({ ...formData, weeklyGoal: e.target.value })}
                      className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-gray-900"
                    >
                      <option value="0.25">0.25 kg/week (Slow & Steady)</option>
                      <option value="0.5">0.5 kg/week (Recommended)</option>
                      <option value="1">1 kg/week (Aggressive)</option>
                    </select>
                  </div>

                  {estimatedWeeks && (
                    <div className="bg-cyan-50 rounded-xl p-3 border border-cyan-200">
                      <p className="text-sm text-cyan-900">
                        <strong>Estimated time:</strong> {estimatedWeeks} weeks ({Math.ceil(estimatedWeeks / 4)} months)
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Info Box */}
              <div className="bg-cyan-50 rounded-xl p-4 border border-cyan-200">
                <p className="text-sm text-cyan-900">
                  <strong className="text-cyan-900">What happens next?</strong> We'll calculate your personalized daily calorie and macro goals based on your profile and goals. You can adjust these anytime from your nutrition dashboard.
                </p>
              </div>
            
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-3 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
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
