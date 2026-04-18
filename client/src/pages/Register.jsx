import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Activity, Mail, Lock, User, Eye, EyeOff, ArrowRight, ArrowLeft, Heart, Loader2, Phone } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Register() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
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
    // Password Validation
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }


    setLoading(true);
    try {
      // âœ… JUST REQUEST OTP - Don't create user yet as per requirement
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
      // âœ… FINALIZE REGISTRATION ONLY AFTER OTP VERIFICATION
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

    // âœ… NEW MEDICAL VALIDATION (Logical Consistency Check)
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
      navigate('/onboarding');
    } catch (error) {
      const msg = error.response?.data?.message || 'Profile completion failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#064e3b]">
        {/* Decorative Glow Elements matching Dashboard */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-cyan-400/10 rounded-full blur-[100px] translate-y-1/4 -translate-x-1/4 pointer-events-none" />

        <div className="absolute inset-0 bg-gradient-to-br from-[#064e3b] via-[#065f46] to-[#042f24] opacity-90" />

        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <div className="flex justify-center mb-10 group">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-400/20 blur-2xl rounded-full group-hover:bg-emerald-400/40 transition-all duration-700" />
              <img
                src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/logo_with_text-1.png?v=1774261099"
                alt="take.health"
                className="h-32 w-auto object-contain brightness-0 invert relative z-10 transition-transform duration-700 group-hover:scale-105"
              />
            </div>
          </div>
          <h1 className="text-4xl font-light tracking-tight mb-4 text-center">
            {step === 1 ? 'Start Your Journey' : step === 1.5 ? 'Verify Identity' : 'Personalize Care'}
          </h1>
          <p className="text-xl text-emerald-50/70 text-center max-w-md leading-relaxed">
            {step === 1 ? "Join thousands of users who have transformed their life with take.health AI." :
              step === 1.5 ? "We've sent a 6-digit code to your email. This ensures your health data stays private." :
                "Tell us a bit about yourself so our AI can craft your perfect health strategy."}
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col justify-center bg-white overflow-y-auto">
        <div className="w-full max-w-xl mx-auto flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-8 sm:py-12">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-1">
            <img
              src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/logo_with_text-1.png?v=1774261099"
              alt="take.health"
              className="h-20 w-auto object-contain"
            />
          </div>

          <div className="mb-2 relative">
            {step > 1 && (
              <button onClick={() => setStep(step - 0.5)} className="absolute -top-4 left-0 flex items-center gap-1 text-[#064e3b] font-black uppercase text-[9px] tracking-widest hover:text-[#042f24] transition-all">
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
            )}
            <h2 className="text-xl font-black mb-0.5 text-[#064e3b] uppercase tracking-tighter">
              {step === 1 ? 'Create Account' : step === 1.5 ? 'Verify Identity' : 'Setup Profile'}
            </h2>
            <p className="text-gray-400 font-bold uppercase text-[8px] tracking-[0.2em]">
              {step === 1 ? 'Fill in your details to get started' : step === 1.5 ? 'Email verification' : 'Health identity'}
            </p>
          </div>

          {step === 1 ? (
            <form onSubmit={handleNext} className="space-y-2">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Full Name *</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-[#064e3b] transition-colors" />
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white border-2 border-gray-400 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-semibold transition-all placeholder:text-gray-300 text-sm shadow-sm"
                    placeholder="Full Name" required />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Email Address *</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-[#064e3b] transition-colors" />
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-white border-2 border-gray-400 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-semibold transition-all placeholder:text-gray-300 text-sm shadow-sm"
                    placeholder="Email Address" required />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Phone Number *</label>
                <div className="relative group">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-[#064e3b] transition-colors" />
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    className="w-full bg-white border-2 border-gray-400 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-semibold transition-all placeholder:text-gray-300 text-sm shadow-sm"
                    placeholder="Phone Number" required />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Password *</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-[#064e3b] transition-colors" />
                  <input type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-white border-2 border-gray-400 rounded-xl py-3 pl-12 pr-12 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-semibold transition-all placeholder:text-gray-300 text-sm shadow-sm"
                    placeholder="Password" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#064e3b] transition-colors">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-5 mt-2 text-white font-black uppercase text-sm tracking-[0.2em] rounded-xl hover:bg-[#042f24] hover:shadow-[0_20px_40px_rgba(6,78,59,0.3)] shadow-[0_10px_20px_rgba(6,78,59,0.15)] transition-all flex items-center justify-center gap-3 bg-[#064e3b] disabled:opacity-70 active:scale-[0.98] border-b-4 border-[#042f24] hover:border-b-2 hover:translate-y-px active:border-b-0 active:translate-y-1">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span className="text-base">Continue</span> <ArrowRight className="w-4 h-4" /></>}
              </button>
              <div className="mt-4 text-center">
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Already registered?</span>{' '}
                <Link to="/login" className="ml-2 font-black text-[#064e3b] hover:text-[#042f24] transition-all uppercase text-xs tracking-widest border-b-2 border-gray-200 hover:border-[#064e3b] pb-0.5">Sign In</Link>
              </div>
            </form>
          ) : step === 1.5 ? (
            <div className="space-y-6 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto mb-2 border-2 border-dashed border-gray-200 relative">
                <div className="absolute inset-0 bg-gray-100/50 animate-pulse rounded-[2rem]" />
                <Mail className="w-8 h-8 text-[#064e3b]" />
              </div>
              <div className="space-y-1">
                <p className="text-[#064e3b] font-black text-lg uppercase tracking-tighter">Enter Code</p>
                <p className="text-gray-400 font-bold text-[9px] uppercase tracking-widest">Sent to <span className="text-[#064e3b] px-2 py-0.5 bg-gray-50 rounded-lg">{formData.email}</span></p>
              </div>
              <div className="flex justify-center gap-2">
                {verificationCode.map((digit, i) => (
                  <input key={i} id={`otp-${i}`} type="text" inputMode="numeric" pattern="[0-9]*"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength="1" value={digit}
                    onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); const newCode = [...verificationCode]; newCode[i] = val; setVerificationCode(newCode); if (val && i < 5) document.getElementById(`otp-${i + 1}`).focus(); }}
                    onKeyDown={(e) => { if (e.key === 'Backspace' && !verificationCode[i] && i > 0) document.getElementById(`otp-${i - 1}`).focus(); }}
                    className="w-11 h-14 bg-white border-2 border-gray-400 rounded-2xl text-center font-black text-xl focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] focus:outline-none text-gray-800 shadow-sm transition-all"
                  />
                ))}
              </div>
              <div className="space-y-3">
                <button onClick={handleVerifyEmail} disabled={loading}
                  className="w-full py-5 bg-[#064e3b] text-white font-black uppercase text-sm tracking-[0.2em] rounded-xl shadow-[0_10px_20px_rgba(6,78,59,0.15)] hover:bg-[#042f24] hover:shadow-[0_20px_40px_rgba(6,78,59,0.3)] transition-all flex items-center justify-center gap-3 active:scale-[0.98] border-b-4 border-[#042f24] hover:border-b-2 hover:translate-y-px active:border-b-0 active:translate-y-1">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="text-base">Confirm Identity</span>}
                </button>
                <button onClick={handleResendCode} className="text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-[#064e3b] transition-colors">Resend Verification Code</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Age *</label>
                  <input type="number" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="w-full bg-white border-2 border-gray-400 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-semibold transition-all text-base shadow-sm"
                    placeholder="Years" min="10" max="120" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Gender *</label>
                  <select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full bg-white border-2 border-gray-400 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-semibold appearance-none transition-all text-base shadow-sm" required>
                    <option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1 ml-1">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Height *</label>
                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                      <button type="button" onClick={() => setHeightUnit('cm')} className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-md transition-all ${heightUnit === 'cm' ? 'bg-[#064e3b] text-white shadow-sm' : 'text-gray-400'}`}>cm</button>
                      <button type="button" onClick={() => setHeightUnit('ft')} className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-md transition-all ${heightUnit === 'ft' ? 'bg-[#064e3b] text-white shadow-sm' : 'text-gray-400'}`}>ft</button>
                    </div>
                  </div>
                  {heightUnit === 'cm' ? (
                    <input type="number" value={formData.height} onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                      className="w-full bg-white border-2 border-gray-400 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-semibold transition-all text-base shadow-sm"
                      placeholder="170" min="100" max="250" required />
                  ) : (
                    <div className="flex gap-2">
                      <input type="number" placeholder="Ft" value={feet} onChange={(e) => { const f = e.target.value; setFeet(f); const totalCm = (parseFloat(f || 0) * 30.48) + (parseFloat(inches || 0) * 2.54); setFormData({ ...formData, height: totalCm.toFixed(1) }); }}
                        className="w-1/2 bg-white border-2 border-gray-400 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-semibold transition-all text-base shadow-sm" required />
                      <input type="number" placeholder="In" value={inches} onChange={(e) => { const i = e.target.value; setInches(i); const totalCm = (parseFloat(feet || 0) * 30.48) + (parseFloat(i || 0) * 2.54); setFormData({ ...formData, height: totalCm.toFixed(1) }); }}
                        className="w-1/2 bg-white border-2 border-gray-400 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-semibold transition-all text-base shadow-sm" required />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Weight (kg) *</label>
                  <input type="number" step="0.1" value={formData.weight} onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className="w-full bg-white border-2 border-gray-400 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-semibold transition-all text-base shadow-sm"
                    placeholder="70.5" min="30" max="300" required />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Activity Level *</label>
                <select value={formData.activityLevel} onChange={(e) => setFormData({ ...formData, activityLevel: e.target.value })}
                  className="w-full bg-white border-2 border-gray-400 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-semibold appearance-none transition-all text-base shadow-sm" required>
                  <option value="sedentary">Sedentary (Little/no exercise)</option><option value="lightly_active">Lightly Active (1-3 days)</option>
                  <option value="moderately_active">Moderately Active (3-5 days)</option><option value="very_active">Very Active (6-7 days)</option>
                  <option value="extremely_active">Extremely Active (Athlete)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Are you Diabetic? *</label>
                  <select value={formData.isDiabetic} onChange={(e) => setFormData({ ...formData, isDiabetic: e.target.value })}
                    className="w-full bg-white border-2 border-gray-400 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-semibold appearance-none transition-all text-base shadow-sm" required>
                    <option value="no">No</option><option value="yes">Yes</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Diet Preference *</label>
                  <select value={formData.dietaryPreference} onChange={(e) => setFormData({ ...formData, dietaryPreference: e.target.value })}
                    className="w-full bg-white border-2 border-gray-400 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-semibold appearance-none transition-all text-base shadow-sm" required>
                    <option value="non-vegetarian">Non-Vegetarian</option><option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option><option value="eggetarian">Eggetarian</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-5 mt-2 text-white font-black uppercase text-sm tracking-[0.2em] rounded-xl hover:bg-[#042f24] hover:shadow-[0_20px_40px_rgba(6,78,59,0.3)] shadow-[0_10px_20px_rgba(6,78,59,0.15)] transition-all flex items-center justify-center gap-3 bg-[#064e3b] disabled:opacity-70 active:scale-[0.98] border-b-4 border-[#042f24] hover:border-b-2 hover:translate-y-px active:border-b-0 active:translate-y-1">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="text-base">Sign Up</span>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>

  );
}

