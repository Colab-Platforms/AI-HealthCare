import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, Mail, Lock, User, Eye, EyeOff, ArrowRight, Stethoscope, Heart, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Register() {
  const [step, setStep] = useState(1); // 1: role selection, 2: form
  const [userType, setUserType] = useState(null); // 'patient' or 'doctor'
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    confirmPassword: '',
    age: '',
    gender: '',
    dietaryPreference: 'non-vegetarian'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
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
    if (!formData.age || !formData.gender || !formData.dietaryPreference) {
      toast.error('Please provide your age, gender, and dietary preference for personalized health insights');
      return;
    }
    setLoading(true);
    try {
      await register(formData.name, formData.email, formData.password, {
        age: parseInt(formData.age),
        gender: formData.gender,
        dietaryPreference: formData.dietaryPreference
      });
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Role Selection
  if (step === 1) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center">
              <Activity className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-800">HealthAI</span>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Join HealthAI</h1>
            <p className="text-slate-500">Choose how you want to use our platform</p>
          </div>

          {/* Role Selection Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Patient Card */}
            <button
              onClick={() => handleRoleSelect('patient')}
              className="bg-white rounded-2xl border-2 border-slate-200 p-8 text-left hover:border-cyan-500 hover:shadow-lg transition-all group"
            >
              <div className="w-16 h-16 rounded-2xl bg-cyan-100 flex items-center justify-center mb-4 group-hover:bg-cyan-500 transition-colors">
                <Heart className="w-8 h-8 text-cyan-600 group-hover:text-white transition-colors" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">I am a Patient</h2>
              <p className="text-slate-500 text-sm mb-4">
                Upload health reports, get AI-powered insights, personalized diet plans, and connect with doctors.
              </p>
              <ul className="text-sm text-slate-600 space-y-2">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500"></div>
                  AI Health Report Analysis
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500"></div>
                  Personalized Diet Plans
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500"></div>
                  Video Consultations
                </li>
              </ul>
              <div className="mt-6 flex items-center text-cyan-600 font-medium">
                Get Started <ArrowRight className="w-4 h-4 ml-2" />
              </div>
            </button>

            {/* Doctor Card */}
            <button
              onClick={() => handleRoleSelect('doctor')}
              className="bg-white rounded-2xl border-2 border-slate-200 p-8 text-left hover:border-blue-500 hover:shadow-lg transition-all group"
            >
              <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-500 transition-colors">
                <Stethoscope className="w-8 h-8 text-blue-600 group-hover:text-white transition-colors" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">I am a Doctor</h2>
              <p className="text-slate-500 text-sm mb-4">
                Join our platform to provide consultations, manage appointments, and help patients.
              </p>
              <ul className="text-sm text-slate-600 space-y-2">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  Manage Your Schedule
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  Video Consultations
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  View Patient Reports
                </li>
              </ul>
              <div className="mt-6 flex items-center text-blue-600 font-medium">
                Apply Now <ArrowRight className="w-4 h-4 ml-2" />
              </div>
            </button>
          </div>

          <p className="text-center mt-8 text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="text-cyan-600 font-semibold hover:text-cyan-700">Sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  // Step 2: Patient Registration Form
  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600">
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
        </div>
      </div>
      
      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <button onClick={() => setStep(1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Create Patient Account</h2>
            <p className="text-slate-500">We need some details for personalized health insights</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Age</label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none"
                  placeholder="25"
                  min="1"
                  max="120"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-slate-800 focus:border-cyan-500 focus:outline-none"
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
              <label className="block text-sm font-medium text-slate-700 mb-2">Dietary Preference</label>
              <select
                value={formData.dietaryPreference}
                onChange={(e) => setFormData({ ...formData, dietaryPreference: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-slate-800 focus:border-cyan-500 focus:outline-none"
                required
              >
                <option value="non-vegetarian">Non-Vegetarian</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="eggetarian">Eggetarian</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">This helps us recommend suitable diet plans</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-12 text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none"
                  placeholder="••••••••"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Your age, gender, and dietary preference help us provide personalized health interpretations, deficiency assessments, and suitable diet recommendations.
            </p>
            
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Create Account <ArrowRight className="w-5 h-5" /></>
              )}
            </button>
          </form>
          
          <p className="text-center mt-6 text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="text-cyan-600 font-semibold hover:text-cyan-700">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
