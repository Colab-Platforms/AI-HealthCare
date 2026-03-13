import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Activity, Mail, Lock, User, Eye, EyeOff, ArrowRight, ArrowLeft, Heart, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Register() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    age: '',
    gender: '',
    height: '',
    weight: '',
    bloodGroup: '',
    activityLevel: 'sedentary',
    allergies: '',
    isDiabetic: 'no',
    dietaryPreference: 'non-vegetarian'
  });

  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const { register, refreshUser, user } = useAuth();
  const navigate = useNavigate();

  // Handle flow control and automatic step skipping
  useEffect(() => {
    if (user) {
      if (!user.profile?.age) {
        // User logged in but profile not complete - redirect to setup
        setStep(2);
      } else if (user.profile?.age) {
        // User fully registered and profile complete
        navigate('/dashboard');
      }
    }
  }, [user, navigate]);

  const handleNext = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (formData.phone.length !== 10) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    const pwdRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.*[0-9]).{6,}$/;
    if (!pwdRegex.test(formData.password)) {
      toast.error('Password must contain 1 uppercase, 1 special char, and 1 number');
      return;
    }

    setLoading(true);
    try {
      // ✅ JUST REQUEST OTP - Don't create user yet as per requirement
      await api.post('auth/register-otp', {
        name: formData.name,
        email: formData.email
      });
      toast.success('Verification code sent to your email!', { icon: '📧' });
      setStep(1.5);
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to send verification code';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    const code = verificationCode.join('');
    if (code.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      // ✅ FINALIZE REGISTRATION ONLY AFTER OTP VERIFICATION
      await register(
        formData.name,
        formData.email,
        formData.phone,
        formData.password,
        {},
        null,
        code
      );
      toast.success('Account verified! Let\'s setup your profile.');
      setIsVerified(true);
      setStep(2);
    } catch (error) {
      const msg = error.response?.data?.message || 'Verification failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      await api.post('auth/register-otp', {
        email: formData.email,
        name: formData.name
      });
      toast.success('Verification code resent to your email');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to resend code');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.age || !formData.gender || !formData.activityLevel || !formData.height || !formData.weight) {
      toast.error('Please fill in all mandatory profile fields');
      return;
    }

    setLoading(true);

    try {
      const profileData = {
        age: parseInt(formData.age),
        gender: formData.gender,
        dietaryPreference: formData.dietaryPreference,
        height: parseFloat(formData.height),
        weight: parseFloat(formData.weight),
        bloodGroup: formData.bloodGroup || undefined,
        activityLevel: formData.activityLevel,
        allergies: formData.allergies ? formData.allergies.split(',').map(a => a.trim()).filter(a => a) : [],
        medicalHistory: {
          conditions: formData.isDiabetic === 'yes' ? ['Diabetes'] : []
        }
      };

      const nutritionGoal = {
        goal: 'general_health',
        targetWeight: parseFloat(formData.weight),
        weeklyGoal: 0.5
      };

      await api.put('auth/profile', {
        name: formData.name,
        profile: profileData,
        nutritionGoal: nutritionGoal
      });
      await refreshUser();

      toast.success('Registration completed successfully!');
      navigate('/dashboard');
    } catch (error) {
      const msg = error.response?.data?.message || 'Profile completion failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Visual Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-black">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-20 left-20 w-72 h-72 bg-slate-400/20 rounded-full blur-[120px]" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-slate-600/20 rounded-full blur-[120px]" />
          </div>
        </div>
        <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white">
          <div className="relative w-32 h-32 mb-8">
            <div className="absolute inset-0 bg-white/20 backdrop-blur-xl rounded-full animate-pulse"></div>
            <div className="absolute inset-4 bg-white/30 backdrop-blur-xl rounded-full flex items-center justify-center">
              <Heart className="w-12 h-12" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4 text-center">Your Health Journey Starts Here</h1>
          <p className="text-xl text-white/80 text-center max-w-md mb-6">
            Get personalized health insights and proactive care management.
          </p>
          <div className="flex gap-2">
            <div className={`w-12 h-2 rounded-full ${step >= 1 ? 'bg-white' : 'bg-white/20'}`}></div>
            <div className={`w-12 h-2 rounded-full ${step >= 2 ? 'bg-white' : 'bg-white/20'}`}></div>
          </div>
        </div>
      </div>

      {/* Main Registration Form Area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Identity */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border border-slate-200 shadow-lg">
              <Activity className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-black text-black uppercase tracking-tighter">FitCure</span>
          </div>

          <div className="mb-8 relative">
            {step > 1 && (
              <button onClick={() => setStep(step - 0.5)} className="absolute -top-6 left-0 flex items-center gap-1 text-black font-black uppercase text-xs hover:text-slate-600 transition-all">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            <h2 className="text-3xl font-black mb-2 text-black uppercase tracking-tighter mt-2">
              {step === 1 ? 'Create Account' : step === 1.5 ? 'Verify Email' : 'Setup Profile'}
            </h2>
            <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">
              Step {step === 1.5 ? '1.5' : step === 1 ? '1' : '2'} of 2 • {step === 1 ? 'Credentials' : step === 1.5 ? 'Verification' : 'Health Identity'}
            </p>
          </div>

          {step === 1 ? (
            <form onSubmit={handleNext} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-black text-black font-bold placeholder:text-slate-400"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-black text-black font-bold placeholder:text-slate-400"
                    placeholder="you@email.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Phone Number *</label>
                <div className="relative">
                  <Activity className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-black text-black font-bold placeholder:text-slate-400"
                    placeholder="10 digit number"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Password *</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black text-black font-bold placeholder:text-slate-400"
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Confirm Password *</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-black text-black font-bold placeholder:text-slate-400"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 mt-6 text-white font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 bg-black hover:bg-slate-900 shadow-xl disabled:opacity-70"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Register & Verify <ArrowRight className="w-5 h-5" /></>}
              </button>

              <div className="mt-6 text-center text-sm font-bold text-slate-500">
                Already registered? <Link to="/login" className="text-black border-b border-black uppercase text-xs hover:text-slate-600 hover:border-slate-600 transition">Sign In</Link>
              </div>
            </form>
          ) : step === 1.5 ? (
            <div className="space-y-6 text-center">
              <div className="w-20 h-20 bg-[#F5F5F7] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-black/20">
                <Mail className="w-8 h-8 text-black" />
              </div>
              <div className="space-y-2">
                <p className="text-black font-bold text-lg">Verification Email Sent!</p>
                <p className="text-slate-500 text-sm">We've sent a 6-digit verification code to <span className="text-black font-black uppercase text-xs px-2 py-0.5 bg-slate-100 rounded">{formData.email}</span></p>
              </div>
              <div className="flex justify-center gap-3">
                {verificationCode.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    maxLength="1"
                    value={digit}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      const newCode = [...verificationCode];
                      newCode[i] = val;
                      setVerificationCode(newCode);
                      if (val && i < 5) {
                        document.getElementById(`otp-${i + 1}`).focus();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !verificationCode[i] && i > 0) {
                        document.getElementById(`otp-${i - 1}`).focus();
                      }
                    }}
                    className="w-10 h-12 bg-slate-50 border border-slate-200 rounded-lg text-center font-black text-lg focus:ring-2 focus:ring-slate-900/10 focus:border-black focus:outline-none text-black"
                  />
                ))}
              </div>
              <div className="space-y-3">
                <button
                  onClick={handleVerifyEmail}
                  disabled={loading}
                  className="w-full py-4 bg-black text-white font-black uppercase tracking-widest rounded-xl shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Verification'}
                </button>
                <button onClick={handleResendCode} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-black">Resend Code</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">Age *</label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-black text-black font-bold"
                    placeholder="Years"
                    min="1" max="120"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">Gender *</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-black text-black font-bold"
                    required
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">Height (cm) *</label>
                  <input
                    type="number"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-black text-black font-bold"
                    placeholder="170"
                    min="100" max="250"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">Weight (kg) *</label>
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-black text-black font-bold"
                    placeholder="70"
                    min="30" max="300"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Activity Level *</label>
                <select
                  value={formData.activityLevel}
                  onChange={(e) => setFormData({ ...formData, activityLevel: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black text-black font-bold"
                  required
                >
                  <option value="sedentary">Sedentary (Little or no exercise)</option>
                  <option value="lightly_active">Lightly Active (1-3 days/week)</option>
                  <option value="moderately_active">Moderately Active (3-5 days/week)</option>
                  <option value="very_active">Very Active (6-7 days/week)</option>
                  <option value="extremely_active">Extremely Active (Athlete)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-1">
                  <label className="block text-sm font-medium mb-1 text-slate-700">Blood Group</label>
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-black text-black font-bold"
                  >
                    <option value="">Optional</option>
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
                <div className="col-span-1">
                  <label className="block text-sm font-medium mb-1 text-slate-700">Allergies</label>
                  <input
                    type="text"
                    value={formData.allergies}
                    onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black text-black font-bold placeholder:text-slate-400"
                    placeholder="e.g. Peanuts, Dust"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">Are you Diabetic? *</label>
                  <select
                    value={formData.isDiabetic}
                    onChange={(e) => setFormData({ ...formData, isDiabetic: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-black text-black font-bold"
                    required
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">Diet Preference *</label>
                  <select
                    value={formData.dietaryPreference}
                    onChange={(e) => setFormData({ ...formData, dietaryPreference: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-black text-black font-bold"
                    required
                  >
                    <option value="non-vegetarian">Non-Vegetarian</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="eggetarian">Eggetarian</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 mt-8 text-white font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 bg-black hover:bg-slate-900 shadow-xl disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Finalize & Enter Dashboard'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div >
  );
}
