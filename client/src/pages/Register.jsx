import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, Mail, Lock, User, Eye, EyeOff, ArrowRight, Stethoscope, Heart, ArrowLeft, Scale, Ruler, Droplet, Cigarette, Wine, Moon, Dumbbell, Target, TrendingUp, TrendingDown, Minus, Plus, X, CheckCircle2, Loader2, Syringe, Utensils, Calendar, Tablets } from 'lucide-react';
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
    // Lifestyle (Smoking, alcohol, sleep, stress, water, conditions)
    smoker: false,
    alcohol: false,
    sleepHours: '7',
    stressLevel: 'moderate',
    waterIntake: '8',
    chronicConditions: [], // This will store conditions including diabetes if they have it
    // Diabetes Profile (Conditional)
    isDiabetic: 'no', // 'yes' or 'no'
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
    // Goals
    primaryGoal: 'general_health',
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
        dietaryPreference: formData.dietaryPreference,
        activityLevel: formData.activityLevel,
        medicalHistory: {
          conditions: formData.chronicConditions.includes('Diabetes')
            ? formData.chronicConditions
            : formData.isDiabetic === 'yes' ? ['Diabetes', ...formData.chronicConditions] : formData.chronicConditions
        },
        lifestyle: {
          smoker: formData.smoker,
          alcohol: formData.alcohol,
          sleepHours: parseInt(formData.sleepHours),
          stressLevel: formData.stressLevel,
          waterIntake: parseInt(formData.waterIntake)
        },
        diabetesProfile: formData.isDiabetic === 'yes' ? {
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
        } : undefined
      };

      const nutritionGoal = {
        goal: formData.primaryGoal,
        targetWeight: formData.targetWeight ? parseFloat(formData.targetWeight) : null,
        weeklyGoal: parseFloat(formData.weeklyGoal)
      };

      await register(formData.name, formData.email, formData.password, profileData, nutritionGoal);
      toast.success('Account created successfully!');
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
        toast.error('Please fill in all basic fields');
        return;
      }
    }
    if (step === 3) {
      if (!formData.height || !formData.weight) {
        toast.error('Please provide height and weight');
        return;
      }
    }
    if (step === 5 && formData.isDiabetic === 'no') {
      setStep(6);
      return;
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
      <div className="min-h-screen flex bg-white">
        {/* Left Panel with Animation - Desktop Only */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-black">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-20 left-20 w-72 h-72 bg-[#2FC8B9] rounded-full blur-[120px]" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#2FC8B9] rounded-full blur-[120px]" />
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
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-[#2FC8B9] text-white' : 'bg-white/10'}`}>
                  <span className="text-sm font-bold">1</span>
                </div>
                <span className="text-xs">Basic</span>
              </div>
              <div className="w-8 h-0.5 bg-white/20"></div>
              <div className="flex items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-[#2FC8B9] text-white' : 'bg-white/10'}`}>
                  <span className="text-sm font-bold">2</span>
                </div>
                <span className="text-xs">Health</span>
              </div>
              <div className="w-8 h-0.5 bg-white/20"></div>
              <div className="flex items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 4 ? 'bg-[#2FC8B9] text-white' : 'bg-white/10'}`}>
                  <span className="text-sm font-bold">3</span>
                </div>
                <span className="text-xs">Lifestyle</span>
              </div>
              <div className="w-8 h-0.5 bg-white/20"></div>
              <div className="flex items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 5 ? 'bg-[#2FC8B9] text-white' : 'bg-white/10'}`}>
                  <span className="text-sm font-bold">4</span>
                </div>
                <span className="text-xs">Diabetes</span>
              </div>
              <div className="w-8 h-0.5 bg-white/20"></div>
              <div className="flex items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 6 ? 'bg-[#2FC8B9] text-white' : 'bg-white/10'}`}>
                  <span className="text-sm font-bold">5</span>
                </div>
                <span className="text-xs">Goals</span>
              </div>
            </div>

            <p className="text-sm text-white/70 mt-6">Step {step - 1} of 5 - {step === 2 ? 'Basic Info' : step === 3 ? 'Health Profile' : step === 4 ? 'Lifestyle' : step === 5 ? 'Diabetes' : 'Goals'}</p>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
              <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border border-[#2FC8B9]/30 shadow-lg shadow-[#2FC8B9]/10">
                <Activity className="w-7 h-7 text-[#2FC8B9]" />
              </div>
              <span className="text-2xl font-black text-black uppercase tracking-tighter">FitCure</span>
            </div>

            <button onClick={() => navigate('/')} className="flex items-center gap-2 mb-6 text-[#2FC8B9] font-black uppercase tracking-tighter text-xs hover:text-black transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-black mb-2 text-black uppercase tracking-tighter">Your Health Profile</h2>
              <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Step 1 of 5 • Global Health Identity</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-[#2FC8B9]/30 focus:border-[#2FC8B9] text-black font-bold placeholder:text-slate-400"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">Age *</label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-slate-200 text-slate-900 placeholder:text-slate-400"
                    placeholder="25"
                    min="1"
                    max="120"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">Gender *</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-slate-200 text-slate-900"
                    required
                  >
                    <option value="" className="text-slate-900">Select</option>
                    <option value="male" className="text-slate-900">Male</option>
                    <option value="female" className="text-slate-900">Female</option>
                    <option value="other" className="text-slate-900">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-slate-200 text-slate-900 placeholder:text-slate-400"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Password *</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-slate-200 text-slate-900 placeholder:text-slate-400"
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Confirm Password *</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-slate-200 text-slate-900 placeholder:text-slate-400"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 text-white font-black uppercase tracking-widest rounded-xl hover:shadow-[0_10px_25px_rgba(47,200,185,0.3)] transition-all flex items-center justify-center gap-2 bg-[#2FC8B9] hover:bg-[#28b5a6]"
              >
                Continue Setup <ArrowRight className="w-5 h-5" />
              </button>
            </form>

            <p className="text-center mt-6 text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="font-black text-[#2FC8B9] hover:text-black transition-colors uppercase text-xs tracking-widest">Sign in</Link>
            </p>

          </div>
        </div>
      </div>
    );
  }

  // Step 3: Health Profile
  if (step === 3) {
    return (
      <div className="min-h-screen flex bg-gradient-to-br from-purple-50 to-orange-50">
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-purple-500 via-pink-500 to-orange-600">
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
                  strokeDashoffset={377 - (377 * 0.40)} // Adjusted for 2/5th progress
                  className="transition-all duration-500"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <h1 className="text-4xl font-bold mb-4 text-center">Health Profile</h1>
            <p className="text-xl text-white/80 text-center max-w-md mb-6">
              Help us calculate your personalized nutrition goals based on your body metrics.
            </p>

            <p className="text-sm text-white/70 mt-6">Step 2 of 5</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
              <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border border-[#2FC8B9]/30 shadow-lg shadow-[#2FC8B9]/10">
                <Activity className="w-7 h-7 text-[#2FC8B9]" />
              </div>
              <span className="text-2xl font-black text-black uppercase tracking-tighter">FitCure</span>
            </div>

            <button onClick={prevStep} className="flex items-center gap-2 mb-6 text-cyan-700 hover:text-cyan-800">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2 text-slate-900">Health Profile</h2>
              <p className="text-cyan-700">Step 2 of 5 - Your body metrics</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-900">Height (cm) *</label>
                  <div className="relative">
                    <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-600" />
                    <input
                      type="number"
                      value={formData.height}
                      onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value }))}
                      className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-slate-900 placeholder:text-slate-400"
                      placeholder="170"
                      min="100"
                      max="250"
                      step="0.1"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-900">Weight (kg) *</label>
                  <div className="relative">
                    <Scale className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-600" />
                    <input
                      type="number"
                      value={formData.weight}
                      onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                      className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-slate-900 placeholder:text-slate-400"
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
                <label className="block text-sm font-medium mb-2 text-slate-900">Blood Group</label>
                <div className="relative">
                  <Droplet className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-600" />
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData(prev => ({ ...prev, bloodGroup: e.target.value }))}
                    className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-slate-900"
                  >
                    <option value="" className="text-slate-900">Select (Optional)</option>
                    <option value="A+" className="text-slate-900">A+</option>
                    <option value="A-" className="text-slate-900">A-</option>
                    <option value="B+" className="text-slate-900">B+</option>
                    <option value="B-" className="text-slate-900">B-</option>
                    <option value="AB+" className="text-slate-900">AB+</option>
                    <option value="AB-" className="text-slate-900">AB-</option>
                    <option value="O+" className="text-slate-900">O+</option>
                    <option value="O-" className="text-slate-900">O-</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-900">Dietary Preference *</label>
                <select
                  value={formData.dietaryPreference}
                  onChange={(e) => setFormData(prev => ({ ...prev, dietaryPreference: e.target.value }))}
                  className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-slate-900"
                  required
                >
                  <option value="non-vegetarian" className="text-slate-900">Non-Vegetarian</option>
                  <option value="vegetarian" className="text-slate-900">Vegetarian</option>
                  <option value="vegan" className="text-slate-900">Vegan</option>
                  <option value="eggetarian" className="text-slate-900">Eggetarian</option>
                </select>
                <p className="text-xs mt-1 text-cyan-700">This helps us recommend suitable diet plans</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-900">Activity Level *</label>
                <select
                  value={formData.activityLevel}
                  onChange={(e) => setFormData(prev => ({ ...prev, activityLevel: e.target.value }))}
                  className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-slate-900"
                  required
                >
                  <option value="sedentary" className="text-slate-900">Sedentary (Little or no exercise)</option>
                  <option value="lightly_active" className="text-slate-900">Lightly Active (1-3 days/week)</option>
                  <option value="moderately_active" className="text-slate-900">Moderately Active (3-5 days/week)</option>
                  <option value="very_active" className="text-slate-900">Very Active (6-7 days/week)</option>
                  <option value="extremely_active" className="text-slate-900">Extremely Active (Athlete)</option>
                </select>
                <p className="text-xs mt-1 text-cyan-700">Used to calculate your daily calorie needs</p>
              </div>


              <button
                type="submit"
                className="w-full py-3 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-orange-600 hover:from-purple-700 hover:to-orange-700"
              >
                Continue <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Step 5: Diabetes Profile (Conditional)
  if (step === 5) {
    return (
      <div className="min-h-screen flex bg-gradient-to-br from-purple-50 to-orange-50">
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-purple-500 via-pink-500 to-orange-600">
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
            </div>
            <h1 className="text-4xl font-bold mb-4 text-center">Diabetes Information</h1>
            <p className="text-xl text-white/80 text-center max-w-md mb-6">
              Skip this if you don't have diabetes. This helps us tailor your glucose management plan.
            </p>
            <p className="text-sm text-white/70 mt-6">Step 4 of 5</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
          <div className="w-full max-w-md py-8">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
              <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border border-[#2FC8B9]/30 shadow-lg shadow-[#2FC8B9]/10">
                <Activity className="w-7 h-7 text-[#2FC8B9]" />
              </div>
              <span className="text-2xl font-black text-black uppercase tracking-tighter">FitCure</span>
            </div>

            <button onClick={prevStep} className="flex items-center gap-2 mb-6 text-cyan-700 hover:text-cyan-800">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2 text-slate-900">Are you diabetic?</h2>
              <p className="text-cyan-700">Step 4 of 5 - Detailed health check</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-6">
              <div className="flex gap-4 p-4 bg-white rounded-xl border border-cyan-200">
                <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all hover:bg-cyan-50 border-cyan-200">
                  <input type="radio" checked={formData.isDiabetic === 'no'} onChange={() => setFormData({ ...formData, isDiabetic: 'no', diabetesType: '' })} className="text-cyan-500" />
                  <span className="font-medium text-slate-800">No</span>
                </label>
                <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all hover:bg-cyan-50 border-cyan-200">
                  <input type="radio" checked={formData.isDiabetic === 'yes'} onChange={() => setFormData({ ...formData, isDiabetic: 'yes' })} className="text-cyan-500" />
                  <span className="font-medium text-slate-800">Yes</span>
                </label>
              </div>

              {formData.isDiabetic === 'yes' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-900">Diabetes Type</label>
                    <select
                      value={formData.diabetesType}
                      onChange={(e) => setFormData({ ...formData, diabetesType: e.target.value })}
                      className="w-full bg-white rounded-xl py-3 px-4 border border-cyan-200 text-slate-900"
                    >
                      <option value="" className="text-slate-900">Select Type</option>
                      <option value="Type 1" className="text-slate-900">Type 1</option>
                      <option value="Type 2" className="text-slate-900">Type 2</option>
                      <option value="Prediabetes" className="text-slate-900">Prediabetes</option>
                      <option value="Gestational" className="text-slate-900">Gestational</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-slate-900">Diagnosis Year</label>
                      <input type="number" value={formData.diagnosisYear} onChange={(e) => setFormData({ ...formData, diagnosisYear: e.target.value })} className="w-full bg-white rounded-xl py-3 px-4 border border-cyan-200 text-slate-900 placeholder:text-slate-400" placeholder="2020" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-slate-900">HbA1c (%)</label>
                      <input type="number" step="0.1" value={formData.hba1c} onChange={(e) => setFormData({ ...formData, hba1c: e.target.value })} className="w-full bg-white rounded-xl py-3 px-4 border border-cyan-200 text-slate-900 placeholder:text-slate-400" placeholder="6.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-900">Are you on medication?</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={!formData.onMedication} onChange={() => setFormData({ ...formData, onMedication: false })} className="text-cyan-500" />
                        <span className="text-sm text-slate-800">No</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={formData.onMedication} onChange={() => setFormData({ ...formData, onMedication: true })} className="text-cyan-500" />
                        <span className="text-sm text-slate-800">Yes</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}


              <button type="submit" className="w-full py-4 text-white font-black uppercase tracking-widest rounded-xl hover:shadow-[0_10px_25px_rgba(47,200,185,0.3)] transition-all flex items-center justify-center gap-2 bg-[#2FC8B9] hover:bg-[#28b5a6]">
                Finalize Steps <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Lifestyle Habits & Conditions
  if (step === 4) {
    return (
      <div className="min-h-screen flex bg-gradient-to-br from-purple-50 to-orange-50">
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-purple-500 via-pink-500 to-orange-600">
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
            </div>
            <h1 className="text-4xl font-bold mb-4 text-center">Lifestyle & Health</h1>
            <p className="text-xl text-white/80 text-center max-w-md mb-6">
              Tell us about your daily habits and any existing health conditions.
            </p>
            <p className="text-sm text-white/70 mt-6">Step 3 of 5</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
          <div className="w-full max-w-md py-8">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
              <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border border-[#2FC8B9]/30 shadow-lg shadow-[#2FC8B9]/10">
                <Activity className="w-7 h-7 text-[#2FC8B9]" />
              </div>
              <span className="text-2xl font-black text-black uppercase tracking-tighter">FitCure</span>
            </div>

            <button onClick={prevStep} className="flex items-center gap-2 mb-6 text-cyan-700 hover:text-cyan-800">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2 text-slate-900">Lifestyle & Conditions</h2>
              <p className="text-cyan-700">Step 3 of 5 - Habits and health history</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200">
                  <Cigarette className="w-5 h-5 text-slate-400" />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.smoker} onChange={(e) => setFormData({ ...formData, smoker: e.target.checked })} className="text-cyan-500" />
                    <span className="text-sm text-slate-800">Smoker</span>
                  </label>
                </div>
                <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200">
                  <Wine className="w-5 h-5 text-slate-400" />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.alcohol} onChange={(e) => setFormData({ ...formData, alcohol: e.target.checked })} className="text-cyan-500" />
                    <span className="text-sm text-slate-800">Alcohol</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Sleep Hours/Night: {formData.sleepHours}h</label>
                <input type="range" min="4" max="12" value={formData.sleepHours} onChange={(e) => setFormData({ ...formData, sleepHours: e.target.value })} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Stress Level</label>
                <select value={formData.stressLevel} onChange={(e) => setFormData({ ...formData, stressLevel: e.target.value })} className="w-full bg-white rounded-xl py-3 px-4 border border-slate-200 text-slate-900">
                  <option value="low" className="text-slate-900">Low</option>
                  <option value="moderate" className="text-slate-900">Moderate</option>
                  <option value="high" className="text-slate-900">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Water Intake (Glasses/Day): {formData.waterIntake}</label>
                <input type="range" min="1" max="15" value={formData.waterIntake} onChange={(e) => setFormData({ ...formData, waterIntake: e.target.value })} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Chronic Conditions (If any)</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {['Hypertension', 'Thyroid', 'PCOS/PCOD', 'Asthma', 'Arthritis', 'None'].map(cond => (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => {
                        if (cond === 'None') {
                          setFormData({ ...formData, chronicConditions: [] });
                        } else {
                          toggleArrayItem('chronicConditions', cond);
                        }
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${formData.chronicConditions.includes(cond) ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                    >
                      {cond}
                    </button>
                  ))}
                </div>
              </div>


              <button type="submit" className="w-full py-3 text-white font-semibold rounded-xl bg-gradient-to-r from-purple-600 to-orange-600 hover:from-purple-700 hover:to-orange-700 flex items-center justify-center gap-2">
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
      <div className="min-h-screen flex bg-gradient-to-br from-purple-50 to-orange-50">
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-purple-500 via-pink-500 to-orange-600">
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
              <h2 className="text-3xl font-bold mb-2 text-slate-900">Nutrition Goals</h2>
              <p className="text-cyan-700">Step 6 of 6 - Final step!</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Goal Selection */}
              <div>
                <label className="block text-sm font-medium mb-3 text-slate-900">What's your primary nutrition goal?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nutritionGoal: 'weight_loss' })}
                    className={`p-4 rounded-xl border-2 transition-all ${formData.nutritionGoal === 'weight_loss'
                      ? 'border-cyan-600 bg-cyan-50'
                      : 'border-slate-200 bg-white hover:border-cyan-300'
                      }`}
                  >
                    <TrendingDown className={`w-8 h-8 mx-auto mb-2 ${formData.nutritionGoal === 'weight_loss' ? 'text-cyan-600' : 'text-slate-400'}`} />
                    <p className="text-sm font-medium text-slate-900">Weight Loss</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nutritionGoal: 'weight_gain' })}
                    className={`p-4 rounded-xl border-2 transition-all ${formData.nutritionGoal === 'weight_gain'
                      ? 'border-cyan-600 bg-cyan-50'
                      : 'border-slate-200 bg-white hover:border-cyan-300'
                      }`}
                  >
                    <TrendingUp className={`w-8 h-8 mx-auto mb-2 ${formData.nutritionGoal === 'weight_gain' ? 'text-cyan-600' : 'text-slate-400'}`} />
                    <p className="text-sm font-medium text-slate-900">Weight Gain</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nutritionGoal: 'muscle_gain' })}
                    className={`p-4 rounded-xl border-2 transition-all ${formData.nutritionGoal === 'muscle_gain'
                      ? 'border-cyan-600 bg-cyan-50'
                      : 'border-slate-200 bg-white hover:border-cyan-300'
                      }`}
                  >
                    <Dumbbell className={`w-8 h-8 mx-auto mb-2 ${formData.nutritionGoal === 'muscle_gain' ? 'text-cyan-600' : 'text-slate-400'}`} />
                    <p className="text-sm font-medium text-slate-900">Muscle Gain</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nutritionGoal: 'maintain' })}
                    className={`p-4 rounded-xl border-2 transition-all ${formData.nutritionGoal === 'maintain'
                      ? 'border-cyan-600 bg-cyan-50'
                      : 'border-slate-200 bg-white hover:border-cyan-300'
                      }`}
                  >
                    <Minus className={`w-8 h-8 mx-auto mb-2 ${formData.nutritionGoal === 'maintain' ? 'text-cyan-600' : 'text-slate-400'}`} />
                    <p className="text-sm font-medium text-slate-900">Maintain</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nutritionGoal: 'general_health' })}
                    className={`p-4 rounded-xl border-2 transition-all col-span-2 ${formData.nutritionGoal === 'general_health'
                      ? 'border-cyan-600 bg-cyan-50'
                      : 'border-slate-200 bg-white hover:border-cyan-300'
                      }`}
                  >
                    <Heart className={`w-8 h-8 mx-auto mb-2 ${formData.nutritionGoal === 'general_health' ? 'text-cyan-600' : 'text-slate-400'}`} />
                    <p className="text-sm font-medium text-slate-900">General Health</p>
                  </button>
                </div>
              </div>

              {/* Target Weight & Weekly Goal */}
              {(formData.nutritionGoal === 'weight_loss' || formData.nutritionGoal === 'weight_gain') && (
                <div className="bg-white rounded-xl p-4 space-y-4 border border-cyan-200">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-900">
                      Target Weight (kg)
                    </label>
                    <input
                      type="number"
                      value={formData.targetWeight}
                      onChange={(e) => setFormData({ ...formData, targetWeight: e.target.value })}
                      className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-slate-900 placeholder:text-slate-400"
                      placeholder={formData.weight}
                      min="30"
                      max="300"
                      step="0.1"
                    />
                    <p className="text-xs mt-1 text-slate-600">Current: {formData.weight} kg</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-900">
                      Weekly Goal
                    </label>
                    <select
                      value={formData.weeklyGoal}
                      onChange={(e) => setFormData({ ...formData, weeklyGoal: e.target.value })}
                      className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cyan-200 text-slate-900"
                    >
                      <option value="0.25" className="text-slate-900">0.25 kg/week (Slow & Steady)</option>
                      <option value="0.5" className="text-slate-900">0.5 kg/week (Recommended)</option>
                      <option value="1" className="text-slate-900">1 kg/week (Aggressive)</option>
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
                <p className="text-sm text-cyan-900 font-medium">
                  What happens next? We'll calculate your personalized daily calorie and macro goals based on your profile and goals. You can adjust these anytime from your nutrition dashboard.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 bg-gradient-to-r from-purple-600 to-orange-600 hover:from-purple-700 hover:to-orange-700"
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
  // Step 6: Goals
  if (step === 6) {
    return (
      <div className="min-h-screen flex bg-gradient-to-br from-purple-50 to-orange-50">
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-purple-500 via-pink-500 to-orange-600">
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
            </div>
            <h1 className="text-4xl font-bold mb-4 text-center">Set Your Goals</h1>
            <p className="text-xl text-white/80 text-center max-w-md mb-6">
              Define your target and we'll help you reach it with precision.
            </p>
            <p className="text-sm text-white/70 mt-6">Step 5 of 5</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
          <div className="w-full max-w-md py-8">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
              <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border border-[#2FC8B9]/30 shadow-lg shadow-[#2FC8B9]/10">
                <Activity className="w-7 h-7 text-[#2FC8B9]" />
              </div>
              <span className="text-2xl font-black text-black uppercase tracking-tighter">FitCure</span>
            </div>

            <button onClick={prevStep} className="flex items-center gap-2 mb-6 text-cyan-700 hover:text-cyan-800">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2 text-slate-900">Health Goals</h2>
              <p className="text-cyan-700">Step 5 of 5 - The finish line!</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-900">Primary Goal</label>
                <select value={formData.primaryGoal} onChange={(e) => setFormData({ ...formData, primaryGoal: e.target.value })} className="w-full bg-white rounded-xl py-3 px-4 border border-cyan-200 text-slate-900">
                  <option value="weight_loss" className="text-slate-900">Weight Loss</option>
                  <option value="weight_gain" className="text-slate-900">Weight Gain</option>
                  <option value="maintain" className="text-slate-900">Maintain Weight</option>
                  <option value="general_health" className="text-slate-900">General Health</option>
                  <option value="diabetes_management" className="text-slate-900">Diabetes Management</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-900">Target Weight (kg)</label>
                <input type="number" step="0.1" value={formData.targetWeight} onChange={(e) => setFormData({ ...formData, targetWeight: e.target.value })} className="w-full bg-white rounded-xl py-3 px-4 border border-cyan-200 text-slate-900 placeholder:text-slate-400" placeholder="65" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-900">Weekly Goal (kg/week)</label>
                <select value={formData.weeklyGoal} onChange={(e) => setFormData({ ...formData, weeklyGoal: e.target.value })} className="w-full bg-white rounded-xl py-3 px-4 border border-cyan-200 text-slate-900">
                  <option value="0.25" className="text-slate-900">0.25 kg (Steady)</option>
                  <option value="0.5" className="text-slate-900">0.5 kg (Recommended)</option>
                  <option value="1.0" className="text-slate-900">1.0 kg (Aggressive)</option>
                </select>
              </div>

              <button type="submit" disabled={loading} className="w-full py-3 text-white font-semibold rounded-xl bg-gradient-to-r from-purple-600 to-orange-600 hover:from-purple-700 hover:to-orange-700 flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Create Account <ArrowRight className="w-5 h-5" /></>}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
