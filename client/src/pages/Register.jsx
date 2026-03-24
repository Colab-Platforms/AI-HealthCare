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
  const [heightUnit, setHeightUnit] = useState('cm');
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');
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

    const age = parseInt(formData.age);
    const weight = parseFloat(formData.weight);
    const height = parseFloat(formData.height);

    // ✅ NEW MEDICAL VALIDATION (Logical Consistency Check)
    if (age < 10) {
      toast.error('Minimum age for health tracking is 10 years');
      return;
    }
    if (age > 120) {
      toast.error('Please enter a valid age (max 120)');
      return;
    }
    
    // Check for impossible physical combinations
    if (age < 15 && height > 200) {
      toast.error('Height seems unusually high for this age. Please verify.');
      return;
    }
    if (age < 12 && weight > 100) {
      toast.error('Weight seems unusually high for this age. Please verify.');
      return;
    }
    
    // Global bounds check
    if (height < 100 || height > 250) {
      toast.error('Please enter a valid height (100cm - 250cm)');
      return;
    }
    if (weight < 30 || weight > 300) {
      toast.error('Please enter a valid weight (30kg - 300kg)');
      return;
    }

    // BMI Extrema Protection
    const bmi = weight / ((height / 100) ** 2);
    if (bmi < 10 || bmi > 80) {
      toast.error('Height and weight combination seems physiologically improbable.');
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
        isDiabetic: formData.isDiabetic,
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
    <div className="min-h-screen flex bg-white font-sans">
      {/* Visual Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#064e3b]">
        {/* Decorative Glow Elements matching Dashboard */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-cyan-400/10 rounded-full blur-[100px] translate-y-1/4 -translate-x-1/4 pointer-events-none" />
        
        <div className="absolute inset-0 bg-gradient-to-br from-[#064e3b] via-[#065f46] to-[#042f24] opacity-90" />

        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white text-center">
          <div className="relative w-32 h-32 mb-10 group flex items-center justify-center">
            <div className="absolute inset-0 bg-emerald-400/20 blur-2xl rounded-full group-hover:bg-emerald-400/40 transition-all duration-700" />
            <div className="absolute inset-0 bg-white/10 backdrop-blur-3xl rounded-[2rem] border border-white/20 flex items-center justify-center transition-transform duration-700 group-hover:scale-110 shadow-2xl">
              <Heart className="w-16 h-16 text-emerald-400 fill-emerald-400/20" />
            </div>
          </div>
          <h1 className="text-4xl font-black mb-4 text-center uppercase tracking-tight">Your Health Revolution</h1>
          <p className="text-xl text-emerald-50/70 text-center max-w-md mb-10 leading-relaxed font-light">
            Join thousands of users leveraging AI for proactive, personalized health management.
          </p>
          <div className="flex gap-4">
            <div className={`w-16 h-1.5 rounded-full transition-all duration-500 ${step >= 1 ? 'bg-emerald-400' : 'bg-white/10'}`}></div>
            <div className={`w-16 h-1.5 rounded-full transition-all duration-500 ${step >= 1.5 ? 'bg-emerald-400' : 'bg-white/10'}`}></div>
            <div className={`w-16 h-1.5 rounded-full transition-all duration-500 ${step >= 2 ? 'bg-emerald-400' : 'bg-white/10'}`}></div>
          </div>
        </div>
      </div>

      {/* Main Registration Form Area */}
      <div className="flex-1 flex items-center justify-center p-0 sm:p-8 bg-slate-50/30">
        <div className="w-full max-w-md bg-white p-6 sm:p-10 rounded-none sm:rounded-[2.5rem] shadow-[0_20px_60px_rgba(6,78,59,0.05)] border-0 sm:border border-emerald-50/50">
          {/* Mobile Identity */}
          <div className="lg:hidden flex justify-center mb-10">
            <img 
              src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/logo_with_text-1.png?v=1774261099" 
              alt="take.health" 
              className="h-24 w-auto object-contain"
            />
          </div>

          <div className="mb-10 relative">
            {step > 1 && (
              <button onClick={() => setStep(step - 0.5)} className="absolute -top-8 left-0 flex items-center gap-1 text-[#064e3b] font-black uppercase text-[10px] tracking-widest hover:text-[#042f24] transition-all">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            <h2 className="text-3xl font-black mb-2 text-[#064e3b] uppercase tracking-tighter mt-2">
              {step === 1 ? 'Start Journey' : step === 1.5 ? 'Verify Identity' : 'Setup Profile'}
            </h2>
            <p className="text-emerald-800/40 font-black uppercase text-[10px] tracking-[0.2em]">
              Phase {step === 1.5 ? '1.5' : step === 1 ? '01' : '02'} • {step === 1 ? 'Credentials' : step === 1.5 ? 'Verification' : 'Health Identity'}
            </p>
          </div>

          {step === 1 ? (
            <form onSubmit={handleNext} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1.5 ml-1">Full Name *</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-800/20 group-focus-within:text-[#064e3b] transition-colors" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-emerald-50/30 border border-emerald-100/50 rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] text-[#064e3b] font-bold transition-all placeholder:text-emerald-800/20"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1.5 ml-1">Email Address *</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-800/20 group-focus-within:text-[#064e3b] transition-colors" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-emerald-50/30 border border-emerald-100/50 rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] text-[#064e3b] font-bold transition-all placeholder:text-emerald-800/20"
                    placeholder="you@email.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1.5 ml-1">Phone Number *</label>
                <div className="relative group">
                  <Activity className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-800/20 group-focus-within:text-[#064e3b] transition-colors" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    className="w-full bg-emerald-50/30 border border-emerald-100/50 rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] text-[#064e3b] font-bold transition-all placeholder:text-emerald-800/20"
                    placeholder="10 digit number"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1.5 ml-1">Password *</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-800/20 group-focus-within:text-[#064e3b] transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-emerald-50/30 border border-emerald-100/50 rounded-2xl py-3.5 pl-12 pr-12 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] text-[#064e3b] font-bold transition-all placeholder:text-emerald-800/20"
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-800/20 hover:text-[#064e3b] transition-colors">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1.5 ml-1">Confirm Password *</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-800/20 group-focus-within:text-[#064e3b] transition-colors" />
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full bg-emerald-50/30 border border-emerald-100/50 rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] text-[#064e3b] font-bold transition-all placeholder:text-emerald-800/20"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 mt-6 text-emerald-50 font-black uppercase text-xs tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-3 bg-[#064e3b] hover:bg-[#042f24] hover:shadow-[0_20px_40px_rgba(6,78,59,0.2)] disabled:opacity-70 active:scale-[0.98] border-b-4 border-[#042f24] hover:border-b-2 hover:translate-y-px active:border-b-0 active:translate-y-1"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span className="text-sm">Sign Up</span> <ArrowRight className="w-4 h-4" /></>}
              </button>

              <div className="mt-8 text-center">
                <span className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest">Already registered?</span>{' '}
                <Link to="/login" className="ml-2 font-black text-[#064e3b] hover:text-[#042f24] transition-all uppercase text-[10px] tracking-widest border-b-2 border-emerald-100 hover:border-[#064e3b] pb-0.5">Sign In</Link>
              </div>
            </form>
          ) : step === 1.5 ? (
            <div className="space-y-8 text-center">
              <div className="w-24 h-24 bg-emerald-50 rounded-[2rem] flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-[#064e3b]/20 relative">
                <div className="absolute inset-0 bg-emerald-400/10 animate-pulse rounded-[2rem]" />
                <Mail className="w-10 h-10 text-[#064e3b]" />
              </div>
              <div className="space-y-2">
                <p className="text-[#064e3b] font-black text-xl uppercase tracking-tighter">Enter Code</p>
                <p className="text-emerald-800/40 font-bold text-[10px] uppercase tracking-widest">Sent to <span className="text-[#064e3b] px-2 py-0.5 bg-emerald-50 rounded-lg">{formData.email}</span></p>
              </div>
              <div className="flex justify-center gap-3">
                {verificationCode.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
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
                    className="w-12 h-16 bg-emerald-50/30 border-2 border-emerald-100 rounded-2xl text-center font-black text-2xl focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] focus:outline-none text-[#064e3b] shadow-sm transition-all"
                  />
                ))}
              </div>
              <div className="space-y-4">
                <button
                  onClick={handleVerifyEmail}
                  disabled={loading}
                  className="w-full py-4 bg-[#064e3b] text-emerald-50 font-black uppercase text-xs tracking-[0.2em] rounded-2xl shadow-xl hover:bg-[#042f24] transition-all flex items-center justify-center gap-3 active:scale-[0.98] border-b-4 border-[#042f24] hover:border-b-2 hover:translate-y-px active:border-b-0 active:translate-y-1"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="text-sm">Confirm Identity</span>}
                </button>
                <button onClick={handleResendCode} className="text-[10px] font-black text-emerald-800/30 uppercase tracking-widest hover:text-[#064e3b] transition-colors">Resend Verification Code</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1.5 ml-1">Age *</label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="w-full bg-emerald-50/30 border border-emerald-100/50 rounded-2xl py-3 px-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] text-[#064e3b] font-bold transition-all"
                    placeholder="Years"
                    min="10" max="120"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1.5 ml-1">Gender *</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full bg-emerald-50/30 border border-emerald-100/50 rounded-2xl py-3 px-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] text-[#064e3b] font-bold appearance-none transition-all"
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
                  <div className="flex items-center justify-between mb-1.5 ml-1">
                    <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest">Height *</label>
                    <div className="flex bg-emerald-100/50 rounded-lg p-0.5">
                      <button type="button" onClick={() => setHeightUnit('cm')} className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-md transition-all ${heightUnit === 'cm' ? 'bg-[#064e3b] text-white shadow-sm' : 'text-emerald-800/40'}`}>cm</button>
                      <button type="button" onClick={() => setHeightUnit('ft')} className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-md transition-all ${heightUnit === 'ft' ? 'bg-[#064e3b] text-white shadow-sm' : 'text-emerald-800/40'}`}>ft</button>
                    </div>
                  </div>
                  
                  {heightUnit === 'cm' ? (
                    <input
                      type="number"
                      value={formData.height}
                      onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                      className="w-full bg-emerald-50/30 border border-emerald-100/50 rounded-2xl py-3 px-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] text-[#064e3b] font-bold transition-all"
                      placeholder="170"
                      min="100" max="250"
                      required
                    />
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Ft"
                        value={feet}
                        onChange={(e) => {
                          const f = e.target.value;
                          setFeet(f);
                          const totalCm = (parseFloat(f || 0) * 30.48) + (parseFloat(inches || 0) * 2.54);
                          setFormData({ ...formData, height: totalCm.toFixed(1) });
                        }}
                        className="w-1/2 bg-emerald-50/30 border border-emerald-100/50 rounded-2xl py-3 px-3 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] text-[#064e3b] font-bold transition-all"
                        required
                      />
                      <input
                        type="number"
                        placeholder="In"
                        value={inches}
                        onChange={(e) => {
                          const i = e.target.value;
                          setInches(i);
                          const totalCm = (parseFloat(feet || 0) * 30.48) + (parseFloat(i || 0) * 2.54);
                          setFormData({ ...formData, height: totalCm.toFixed(1) });
                        }}
                        className="w-1/2 bg-emerald-50/30 border border-emerald-100/50 rounded-2xl py-3 px-3 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] text-[#064e3b] font-bold transition-all"
                        required
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1.5 ml-1">Weight (kg) *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className="w-full bg-emerald-50/30 border border-emerald-100/50 rounded-2xl py-3 px-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] text-[#064e3b] font-bold transition-all"
                    placeholder="70.5"
                    min="30" max="300"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1.5 ml-1">Activity Level *</label>
                <select
                  value={formData.activityLevel}
                  onChange={(e) => setFormData({ ...formData, activityLevel: e.target.value })}
                  className="w-full bg-emerald-50/30 border border-emerald-100/50 rounded-2xl py-3 px-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] text-[#064e3b] font-bold appearance-none transition-all"
                  required
                >
                  <option value="sedentary">Sedentary (Little/no exercise)</option>
                  <option value="lightly_active">Lightly Active (1-3 days)</option>
                  <option value="moderately_active">Moderately Active (3-5 days)</option>
                  <option value="very_active">Very Active (6-7 days)</option>
                  <option value="extremely_active">Extremely Active (Athlete)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1.5 ml-1">Are you Diabetic? *</label>
                  <select
                    value={formData.isDiabetic}
                    onChange={(e) => setFormData({ ...formData, isDiabetic: e.target.value })}
                    className="w-full bg-emerald-50/30 border border-emerald-100/50 rounded-2xl py-3 px-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] text-[#064e3b] font-bold appearance-none transition-all"
                    required
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1.5 ml-1">Diet Preference *</label>
                  <select
                    value={formData.dietaryPreference}
                    onChange={(e) => setFormData({ ...formData, dietaryPreference: e.target.value })}
                    className="w-full bg-emerald-50/30 border border-emerald-100/50 rounded-2xl py-3 px-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] text-[#064e3b] font-bold appearance-none transition-all"
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
                className="w-full py-4 mt-4 text-emerald-50 font-black uppercase text-xs tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-3 bg-[#064e3b] hover:bg-[#042f24] hover:shadow-[0_20px_40px_rgba(6,78,59,0.2)] disabled:opacity-70 active:scale-[0.98] border-b-4 border-[#042f24] hover:border-b-2 hover:translate-y-px active:border-b-0 active:translate-y-1"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="text-sm">Sign Up</span>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div >
  );
}
