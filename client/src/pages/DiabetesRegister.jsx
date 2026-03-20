import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Heart, ArrowLeft, Activity, Calendar, Syringe, Pill, Apple, Utensils, Dumbbell, Moon, TrendingUp, AlertCircle, CheckCircle2, Loader2, Scale, Ruler, Droplet, Target, X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

// Comprehensive Diabetes-Focused Registration Form
export default function DiabetesRegister() {
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    age: '',
    gender: '',
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
    height: '',
    weight: '',
    bloodPressure: '',
    otherConditions: [],
    dietType: 'vegetarian',
    foodRestrictions: [],
    cuisinePreference: 'indian',
    mealsPerDay: '3',
    activityLevel: 'sedentary',
    exercisePreference: [],
    sleepHours: '7',
    smoking: false,
    alcohol: false,
    primaryGoal: '',
    timeframe: '3',
    biggestChallenge: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    setLoading(true);
    try {
      const profileData = {
        age: parseInt(formData.age),
        gender: formData.gender,
        height: formData.height ? parseFloat(formData.height) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        dietaryPreference: formData.dietType,
        activityLevel: formData.activityLevel,
        medicalHistory: {
          conditions: [
            formData.diabetesType ? `Diabetes ${formData.diabetesType}` : '',
            ...formData.otherConditions
          ].filter(Boolean),
          currentMedications: formData.medicationType
        },
        lifestyle: {
          smoker: formData.smoking,
          alcohol: formData.alcohol,
          sleepHours: parseInt(formData.sleepHours)
        },
        allergies: formData.foodRestrictions,
        diabetesProfile: {
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
        },
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
        goal: formData.primaryGoal || 'general_health',
        weeklyGoal: 0.5
      };

      await register(formData.name, formData.email, formData.password, profileData, nutritionGoal);
      toast.success('Account created successfully! Your personalized diabetes management plan is ready.');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.name || !formData.email || !formData.password || !formData.age || !formData.gender) {
        toast.error('Please fill in all required fields');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    }
    if (step === 2) {
      if (!formData.diabetesType || !formData.diagnosisYear || !formData.diabetesStatus) {
        toast.error('Please complete your diabetes profile');
        return;
      }
    }
    if (step === 3) {
      if (!formData.height || !formData.weight) {
        toast.error('Please provide your height and weight');
        return;
      }
    }
    setStep(step + 1);
  };

  const prevStep = () => {
    if (step === 1) {
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

  // Step 1: Basic Account Details
  if (step === 1) {
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
                <Heart className="w-12 h-12 animate-pulse" />
              </div>
            </div>
            <h1 className="text-4xl font-bold mb-4 text-center">Welcome to FitCure</h1>
            <p className="text-xl text-white/80 text-center max-w-md mb-6">
              Your personalized diabetes management platform
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center">
                <span className="text-sm font-bold">1</span>
              </div>
              <div className="w-12 h-0.5 bg-white/20"></div>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-sm">2</span>
              </div>
              <div className="w-12 h-0.5 bg-white/20"></div>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-sm">3</span>
              </div>
              <div className="w-12 h-0.5 bg-white/20"></div>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-sm">4</span>
              </div>
            </div>
            <p className="text-sm text-white/70 mt-6">Step 1 of 4</p>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <button onClick={prevStep} className="flex items-center gap-2 mb-6 text-cyan-600 hover:text-cyan-700">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2 text-gray-900">Basic Account Details</h2>
              <p className="text-gray-600">Step 1 of 4 - Let's get started</p>
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

  // Step 2: Diabetes Profile
  if (step === 2) {
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
            <h1 className="text-4xl font-bold mb-4 text-center">Diabetes Profile</h1>
            <p className="text-xl text-white/80 text-center max-w-md mb-6">
              Help us understand your diabetes management needs
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div className="w-12 h-0.5 bg-white"></div>
              <div className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center">
                <span className="text-sm font-bold">2</span>
              </div>
              <div className="w-12 h-0.5 bg-white/20"></div>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-sm">3</span>
              </div>
              <div className="w-12 h-0.5 bg-white/20"></div>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-sm">4</span>
              </div>
            </div>
            <p className="text-sm text-white/70 mt-6">Step 2 of 4</p>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
          <div className="w-full max-w-md py-8">
            <button onClick={prevStep} className="flex items-center gap-2 mb-6 text-cyan-600 hover:text-cyan-700">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2 text-gray-900">Diabetes Profile</h2>
              <p className="text-gray-600">Step 2 of 4 - Core diabetes information</p>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-3 text-gray-700">Diabetes Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Type 1', 'Type 2', 'Prediabetes', 'Gestational'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, diabetesType: type })}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        formData.diabetesType === type ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900">{type}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Year of Diagnosis *</label>
                  <input
                    type="number"
                    value={formData.diagnosisYear}
                    onChange={(e) => setFormData({ ...formData, diagnosisYear: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                    placeholder="2020"
                    min="1900"
                    max={new Date().getFullYear()}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Current Status *</label>
                  <select
                    value={formData.diabetesStatus}
                    onChange={(e) => setFormData({ ...formData, diabetesStatus: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                    required
                  >
                    <option value="">Select</option>
                    <option value="Controlled">Controlled</option>
                    <option value="Uncontrolled">Uncontrolled</option>
                    <option value="Newly diagnosed">Newly diagnosed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Latest HbA1c (%) - Optional</label>
                <input
                  type="number"
                  value={formData.hba1c}
                  onChange={(e) => setFormData({ ...formData, hba1c: e.target.value })}
                  className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                  placeholder="6.5"
                  step="0.1"
                  min="4"
                  max="15"
                />
                <p className="text-xs mt-1 text-gray-500">Used for risk scoring and personalized recommendations</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-3 text-gray-700">How do you measure glucose?</label>
                <div className="grid grid-cols-3 gap-3">
                  {['Glucometer', 'CGM', 'Both'].map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setFormData({ ...formData, glucoseMonitoring: method })}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        formData.glucoseMonitoring === method ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900">{method}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Fasting Glucose (mg/dL)</label>
                  <input
                    type="text"
                    value={formData.fastingGlucose}
                    onChange={(e) => setFormData({ ...formData, fastingGlucose: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                    placeholder="80-120"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Post-Meal Glucose</label>
                  <input
                    type="text"
                    value={formData.postMealGlucose}
                    onChange={(e) => setFormData({ ...formData, postMealGlucose: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                    placeholder="120-180"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Testing Frequency</label>
                <select
                  value={formData.testingFrequency}
                  onChange={(e) => setFormData({ ...formData, testingFrequency: e.target.value })}
                  className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                >
                  <option value="">Select</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="rarely">Rarely</option>
                </select>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <label className="flex items-center gap-2 text-sm font-medium mb-3 text-gray-700">
                  <Pill className="w-4 h-4" />
                  Are you on diabetes medication?
                </label>
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!formData.onMedication}
                      onChange={() => setFormData({ ...formData, onMedication: false, medicationType: [] })}
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
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">Medication Type (select all that apply)</label>
                    <div className="space-y-2">
                      {['Insulin', 'Oral medicines (Metformin, etc.)', 'Lifestyle only'].map(med => (
                        <label key={med} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.medicationType.includes(med)}
                            onChange={() => toggleArrayItem('medicationType', med)}
                            className="rounded text-cyan-500"
                          />
                          <span className="text-sm text-gray-900">{med}</span>
                        </label>
                      ))}
                    </div>

                    {formData.medicationType.includes('Insulin') && (
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">Insulin Timing</label>
                        <input
                          type="text"
                          value={formData.insulinTiming}
                          onChange={(e) => setFormData({ ...formData, insulinTiming: e.target.value })}
                          className="w-full bg-white rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                          placeholder="e.g., Before meals, Bedtime"
                        />
                      </div>
                    )}

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.recentDosageChange}
                        onChange={(e) => setFormData({ ...formData, recentDosageChange: e.target.checked })}
                        className="rounded text-cyan-500"
                      />
                      <span className="text-sm text-gray-900">Recent dosage change</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  We do not provide dosage advice. Our recommendations are pattern-based insights only.
                </p>
              </div>
            
              <button 
                type="submit"
                className="w-full py-3 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-orange-600 hover:from-purple-600 hover:to-orange-700"
              >
                Continue <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Body Metrics & Diet Preferences
  if (step === 3) {
    const bmi = formData.height && formData.weight 
      ? (formData.weight / ((formData.height/100) ** 2)).toFixed(1)
      : null;

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
                <Scale className="w-12 h-12" />
              </div>
            </div>
            <h1 className="text-4xl font-bold mb-4 text-center">Body Metrics & Diet</h1>
            <p className="text-xl text-white/80 text-center max-w-md mb-6">
              Your physical metrics and dietary preferences
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div className="w-12 h-0.5 bg-white"></div>
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div className="w-12 h-0.5 bg-white"></div>
              <div className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center">
                <span className="text-sm font-bold">3</span>
              </div>
              <div className="w-12 h-0.5 bg-white/20"></div>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-sm">4</span>
              </div>
            </div>
            <p className="text-sm text-white/70 mt-6">Step 3 of 4</p>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
          <div className="w-full max-w-md py-8">
            <button onClick={prevStep} className="flex items-center gap-2 mb-6 text-cyan-600 hover:text-cyan-700">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2 text-gray-900">Body Metrics & Diet</h2>
              <p className="text-gray-600">Step 3 of 4 - Physical and dietary information</p>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Height (cm) *</label>
                  <div className="relative">
                    <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      value={formData.height}
                      onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                      className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                      placeholder="170"
                      min="100"
                      max="250"
                      step="0.1"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Weight (kg) *</label>
                  <div className="relative">
                    <Scale className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                      className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                      placeholder="70"
                      min="30"
                      max="300"
                      step="0.1"
                      required
                    />
                  </div>
                </div>
              </div>

              {bmi && (
                <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Your BMI:</span>
                    <span className="text-2xl font-bold text-cyan-600">{bmi}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese'}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Blood Pressure (optional)</label>
                <input
                  type="text"
                  value={formData.bloodPressure}
                  onChange={(e) => setFormData({ ...formData, bloodPressure: e.target.value })}
                  className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                  placeholder="120/80"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-3 text-gray-700">Other Conditions (select all that apply)</label>
                <div className="space-y-2">
                  {['Hypertension', 'Thyroid', 'PCOS', 'Heart issues', 'None'].map(condition => (
                    <label key={condition} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.otherConditions.includes(condition)}
                        onChange={() => toggleArrayItem('otherConditions', condition)}
                        className="rounded text-cyan-500"
                      />
                      <span className="text-sm text-gray-900">{condition}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Diet Type *</label>
                <select
                  value={formData.dietType}
                  onChange={(e) => setFormData({ ...formData, dietType: e.target.value })}
                  className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                  required
                >
                  <option value="vegetarian">Vegetarian</option>
                  <option value="non-vegetarian">Non-Vegetarian</option>
                  <option value="eggetarian">Eggetarian</option>
                  <option value="vegan">Vegan</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-3 text-gray-700">Food Restrictions (select all that apply)</label>
                <div className="space-y-2">
                  {['Lactose intolerance', 'Gluten intolerance', 'Nut allergies', 'Shellfish allergy'].map(restriction => (
                    <label key={restriction} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.foodRestrictions.includes(restriction)}
                        onChange={() => toggleArrayItem('foodRestrictions', restriction)}
                        className="rounded text-cyan-500"
                      />
                      <span className="text-sm text-gray-900">{restriction}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Cuisine Preference</label>
                  <select
                    value={formData.cuisinePreference}
                    onChange={(e) => setFormData({ ...formData, cuisinePreference: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                  >
                    <option value="indian">Indian</option>
                    <option value="south-indian">South Indian</option>
                    <option value="north-indian">North Indian</option>
                    <option value="continental">Continental</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Meals Per Day</label>
                  <select
                    value={formData.mealsPerDay}
                    onChange={(e) => setFormData({ ...formData, mealsPerDay: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                  >
                    <option value="2">2 meals</option>
                    <option value="3">3 meals</option>
                    <option value="4">4+ meals</option>
                  </select>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-3 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-orange-600 hover:from-purple-600 hover:to-orange-700"
              >
                Continue <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Activity, Lifestyle & Goals
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
                <Target className="w-12 h-12" />
              </div>
            </div>
            <h1 className="text-4xl font-bold mb-4 text-center">Activity & Goals</h1>
            <p className="text-xl text-white/80 text-center max-w-md mb-6">
              Final step - Set your health goals
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div className="w-12 h-0.5 bg-white"></div>
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div className="w-12 h-0.5 bg-white"></div>
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div className="w-12 h-0.5 bg-white"></div>
              <div className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center">
                <span className="text-sm font-bold">4</span>
              </div>
            </div>
            <p className="text-sm text-white/70 mt-6">Step 4 of 4 - Almost done!</p>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
          <div className="w-full max-w-md py-8">
            <button onClick={prevStep} className="flex items-center gap-2 mb-6 text-cyan-600 hover:text-cyan-700">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2 text-gray-900">Activity & Goals</h2>
              <p className="text-gray-600">Step 4 of 4 - Lifestyle and health goals</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Daily Activity Level *</label>
                <select
                  value={formData.activityLevel}
                  onChange={(e) => setFormData({ ...formData, activityLevel: e.target.value })}
                  className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                  required
                >
                  <option value="sedentary">Sedentary (Little or no exercise)</option>
                  <option value="lightly_active">Light (1-3 days/week)</option>
                  <option value="moderately_active">Moderate (3-5 days/week)</option>
                  <option value="very_active">Active (6-7 days/week)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-3 text-gray-700">Exercise Preference (select all that apply)</label>
                <div className="space-y-2">
                  {['Walking', 'Yoga', 'Home workouts', 'Gym', 'Swimming', 'Cycling'].map(exercise => (
                    <label key={exercise} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.exercisePreference.includes(exercise)}
                        onChange={() => toggleArrayItem('exercisePreference', exercise)}
                        className="rounded text-cyan-500"
                      />
                      <span className="text-sm text-gray-900">{exercise}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Average Sleep Duration: {formData.sleepHours} hours
                </label>
                <input
                  type="range"
                  min="4"
                  max="12"
                  value={formData.sleepHours}
                  onChange={(e) => setFormData({ ...formData, sleepHours: e.target.value })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>4h</span>
                  <span>12h</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 cursor-pointer bg-white rounded-xl p-4 border border-gray-200">
                  <input
                    type="checkbox"
                    checked={formData.smoking}
                    onChange={(e) => setFormData({ ...formData, smoking: e.target.checked })}
                    className="rounded text-cyan-500"
                  />
                  <span className="text-sm text-gray-900">Smoking</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-white rounded-xl p-4 border border-gray-200">
                  <input
                    type="checkbox"
                    checked={formData.alcohol}
                    onChange={(e) => setFormData({ ...formData, alcohol: e.target.checked })}
                    className="rounded text-cyan-500"
                  />
                  <span className="text-sm text-gray-900">Alcohol</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Primary Goal *</label>
                <select
                  value={formData.primaryGoal}
                  onChange={(e) => setFormData({ ...formData, primaryGoal: e.target.value })}
                  className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                  required
                >
                  <option value="">Select your goal</option>
                  <option value="reduce_hba1c">Reduce HbA1c</option>
                  <option value="weight_loss">Weight Loss</option>
                  <option value="stable_glucose">Stable Glucose</option>
                  <option value="lifestyle_discipline">Lifestyle Discipline</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Timeframe</label>
                  <select
                    value={formData.timeframe}
                    onChange={(e) => setFormData({ ...formData, timeframe: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                  >
                    <option value="3">3 months</option>
                    <option value="6">6 months</option>
                    <option value="12">12 months</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Biggest Challenge</label>
                  <select
                    value={formData.biggestChallenge}
                    onChange={(e) => setFormData({ ...formData, biggestChallenge: e.target.value })}
                    className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                  >
                    <option value="">Select</option>
                    <option value="food_cravings">Food Cravings</option>
                    <option value="inconsistency">Inconsistency</option>
                    <option value="no_guidance">No Guidance</option>
                    <option value="fear_of_workout">Fear of Workout</option>
                  </select>
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-3 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-orange-600 hover:from-purple-600 hover:to-orange-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Account <CheckCircle2 className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
