import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  User, Save, Heart, AlertCircle, Camera, Mail, Phone, Target,
  Activity, Droplet, Cigarette, Wine, Moon, Apple, Dumbbell, Pill, Upload,
  Bell, ShieldCheck, ChevronRight, LogOut, FileText, Settings, CheckCircle2,
  TrendingUp, TrendingDown, Clock, Sparkles, Zap, X, ScrollText, Shield, Headphones
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import ProfileSkeleton from '../components/skeletons/ProfileSkeleton';

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [healthGoal, setHealthGoal] = useState(null);
  const [goalLoading, setGoalLoading] = useState(false);
  const [extraData, setExtraData] = useState({
    reportsCount: 0,
    metrics: {},
    latestAnalysis: null,
    loading: true
  });
  const [expandedSection, setExpandedSection] = useState(null); // 'profile' or 'goals'
  
  const [goalFormData, setGoalFormData] = useState({
    goalType: 'maintenance',
    currentWeight: user?.profile?.weight || '',
    targetWeight: '',
    height: user?.profile?.height || '',
    age: user?.profile?.age || '',
    gender: user?.profile?.gender || 'male',
    activityLevel: user?.profile?.activityLevel || 'sedentary',
    dietaryPreference: user?.profile?.dietaryPreference || 'non-vegetarian',
    targetWeeks: '12'
  });

  const [formData, setFormData] = useState({
    name: user?.name || '',
    profile: {
      age: user?.profile?.age || '',
      gender: user?.profile?.gender || '',
      dietaryPreference: user?.profile?.dietaryPreference || 'non-vegetarian',
      height: user?.profile?.height || '',
      weight: user?.profile?.weight || '',
      bloodGroup: user?.profile?.bloodGroup || '',
      phone: user?.phone || user?.profile?.phone || '',
      activityLevel: user?.profile?.activityLevel || 'sedentary',
      isDiabetic: user?.profile?.isDiabetic || 'no',
      allergies: user?.profile?.allergies || '',
      medicalHistory: {
        conditions: user?.profile?.medicalHistory?.conditions || []
      },
      lifestyle: {
        smoker: user?.profile?.lifestyle?.smoker || false,
        alcohol: user?.profile?.lifestyle?.alcohol || false,
        sleepHours: user?.profile?.lifestyle?.sleepHours || '7',
        stressLevel: user?.profile?.lifestyle?.stressLevel || 'moderate',
        waterIntake: user?.profile?.lifestyle?.waterIntake || '8'
      },
      diabetesProfile: user?.profile?.diabetesProfile || { type: 'Type 2', hba1c: '' }
    }
  });

  const fetchHealthGoal = async () => {
    try {
      const { data } = await api.get('nutrition/goals');
      setHealthGoal(data.healthGoal);
      if (data.healthGoal) {
        setGoalFormData(prev => ({
          ...prev,
          goalType: data.healthGoal.goalType,
          currentWeight: user?.profile?.weight || data.healthGoal.currentWeight,
          targetWeight: data.healthGoal.targetWeight,
          height: user?.profile?.height || data.healthGoal.height,
          age: user?.profile?.age || data.healthGoal.age,
          gender: user?.profile?.gender || data.healthGoal.gender,
          activityLevel: data.healthGoal.activityLevel,
          dietaryPreference: data.healthGoal.dietaryPreference
        }));
      }
    } catch (e) {
      console.error("Failed to fetch health goal", e);
    }
  };

  const fetchExtraData = async () => {
    try {
      const [reportsRes, summaryRes, dashRes] = await Promise.all([
        api.get('health/reports'),
        api.get('metrics/summary/latest?types=heart_rate,blood_pressure'),
        api.get('health/dashboard')
      ]);

      const reportsArray = Array.isArray(reportsRes.data) ? reportsRes.data : (reportsRes.data?.reports || []);
      const reportsCount = (dashRes.data && typeof dashRes.data.totalReports === 'number') 
        ? dashRes.data.totalReports 
        : reportsArray.length;

      setExtraData({
        reportsCount,
        metrics: summaryRes.data,
        latestAnalysis: dashRes.data.latestAnalysis,
        recentReports: reportsArray.slice(0, 3),
        loading: false
      });
    } catch (e) {
      console.error("Failed to fetch extra profile data", e);
      setExtraData(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchHealthGoal();
    fetchExtraData();
    if (searchParams.get('tab') === 'goals') setExpandedSection('goals');
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      setGoalFormData(prev => ({
        ...prev,
        currentWeight: user?.profile?.weight || prev.currentWeight,
        height: user?.profile?.height || prev.height,
        age: user?.profile?.age || prev.age,
        gender: user?.profile?.gender || prev.gender,
        dietaryPreference: user?.profile?.dietaryPreference || prev.dietaryPreference
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData(prev => {
      const keys = name.split('.');
      if (keys.length === 1) {
        return { ...prev, [name]: type === 'checkbox' ? checked : value };
      }
      
      const newFormData = { ...prev };
      let current = newFormData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = type === 'checkbox' ? checked : value;
      return newFormData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        phone: formData.profile.phone,
        profile: {
          ...formData.profile,
          age: Number(formData.profile.age),
          height: Number(formData.profile.height),
          weight: Number(formData.profile.weight),
          diabetesProfile: formData.profile.isDiabetic === 'yes' ? formData.profile.diabetesProfile : undefined
        }
      };
      const { data } = await api.put('auth/profile', payload);
      updateUser(data);
      toast.success('Profile updated successfully!');
      if (data.bmiChanged) await fetchHealthGoal();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleGoalSubmit = async (e) => {
    e.preventDefault();
    setGoalLoading(true);
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + (parseInt(goalFormData.targetWeeks) * 7));

      const payload = {
        ...goalFormData,
        targetDate,
        currentWeight: parseFloat(formData.profile.weight),
        targetWeight: parseFloat(goalFormData.targetWeight),
        height: parseFloat(formData.profile.height),
        age: parseInt(formData.profile.age),
        gender: formData.profile.gender,
        isDiabetic: formData.profile.isDiabetic === 'yes'
      };
      const { data } = await api.put('nutrition/goals', payload);
      setHealthGoal(data.healthGoal);
      toast.success('Fitness goal updated!');
      const { data: userData } = await api.get('auth/profile');
      updateUser(userData);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update goal');
    } finally {
      setGoalLoading(false);
    }
  };

  const handleGoalChange = (e) => {
    const { name, value } = e.target;
    setGoalFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('profilePicture', file);
      const { data } = await api.post('auth/upload-profile-picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateUser({ ...user, profilePicture: data.profilePicture });
      toast.success('Profile picture updated!');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const bmi = formData.profile.height && formData.profile.weight
    ? (formData.profile.weight / Math.pow(formData.profile.height / 100, 2)).toFixed(1) : null;

  const getBmiStatus = (bmi) => {
    if (!bmi) return { label: 'N/A', color: 'slate' };
    if (bmi < 18.5) return { label: 'Underweight', color: 'blue' };
    if (bmi < 25) return { label: 'Normal', color: 'emerald' };
    if (bmi < 30) return { label: 'Overweight', color: 'amber' };
    return { label: 'Obese', color: 'red' };
  };

  const bmiStatus = getBmiStatus(parseFloat(bmi));

  // Smart weight / goal mismatch warning
  const goalMismatchWarning = (() => {
    const cw = parseFloat(formData.profile.weight) || parseFloat(user?.profile?.weight) || 0;
    const tw = parseFloat(goalFormData.targetWeight) || 0;
    const goal = goalFormData.goalType;
    
    if (!cw || !tw) return null;

    if (goal === 'weight_loss' && tw > cw) {
      return { msg: `Weight mismatch: Target (${tw}kg) is higher than current (${cw}kg).`, icon: '⚠️' };
    } else if ((goal === 'weight_gain' || goal === 'muscle_gain') && tw < cw) {
      return { msg: `Weight mismatch: Target (${tw}kg) is lower than current (${cw}kg).`, icon: '⚠️' };
    }
    return null;
  })();

  // Toast alert for mismatch
  useEffect(() => {
    if (goalMismatchWarning && goalMismatchWarning.icon === '⚠️') {
      toast.error(goalMismatchWarning.msg, { id: 'weight-mismatch' });
    }
  }, [goalMismatchWarning]);

  // Live Macro Preview (Client-side calculation to match backend)
  const liveMacroPreview = (() => {
    const cw = parseFloat(formData.profile.weight) || parseFloat(user?.profile?.weight) || 0;
    const ht = parseFloat(formData.profile.height) || parseFloat(user?.profile?.height) || 0;
    const age = parseInt(formData.profile.age) || parseInt(user?.profile?.age) || 0;
    const gender = formData.profile.gender || user?.profile?.gender || 'male';
    const goal = goalFormData.goalType;
    const activity = goalFormData.activityLevel || 'sedentary';
    const isDiabetic = formData.profile.isDiabetic === 'yes';

    if (!cw || !ht || !age) return null;

    // 1. Calculate BMR
    let bmr = (10 * cw) + (6.25 * ht) - (5 * age);
    bmr = gender === 'male' ? bmr + 5 : bmr - 161;

    // 2. Calculate TDEE
    const multipliers = { sedentary: 1.2, lightly_active: 1.375, moderately_active: 1.55, very_active: 1.725, extremely_active: 1.9 };
    const tdee = bmr * (multipliers[activity] || 1.2);

    // 3. Calorie Target
    let adjust = 0;
    if (goal === 'weight_loss') adjust = isDiabetic ? -400 : -500;
    else if (goal === 'weight_gain') adjust = isDiabetic ? 250 : 500;
    else if (goal === 'muscle_gain') adjust = isDiabetic ? 200 : 300;
    
    const calorieTarget = Math.round(tdee + adjust);

    // 4. Macros
    let pro, carb, fat;
    if (isDiabetic) {
      const proPct = (goal === 'weight_loss' || goal === 'muscle_gain') ? 0.35 : 0.30;
      const carbPct = 0.25;
      const fatPct = 1 - proPct - carbPct;
      pro = Math.round((calorieTarget * proPct) / 4);
      carb = Math.round((calorieTarget * carbPct) / 4);
      fat = Math.round((calorieTarget * fatPct) / 9);
    } else {
      const proPerKg = goal === 'weight_loss' ? 1.6 : goal === 'muscle_gain' ? 1.8 : 1.2;
      const fatPerKg = goal === 'weight_loss' ? 0.6 : 1.0;
      pro = Math.round(cw * proPerKg);
      fat = Math.round(cw * fatPerKg);
      carb = Math.round(Math.max((calorieTarget - (pro * 4) - (fat * 9)) / 4, 0));
    }

    return { calories: calorieTarget, protein: pro, carbs: carb, fats: fat };
  })();

  if (!user) return <ProfileSkeleton />;

  return (
    <div className="w-full relative min-h-screen bg-[#F9FCF3] overflow-x-hidden animate-fade-in pb-32">
      <div className="relative z-10 px-[21.96px] pt-12 max-w-lg mx-auto">
        
        {/* Profile Header Section - Horizontal Layout */}
        <div className="flex items-center gap-[18px] mb-10">
          <div className="relative flex-shrink-0">
            <div className="relative group cursor-pointer" onClick={() => setExpandedSection(expandedSection === 'img_options' ? null : 'img_options')}>
              {user?.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt={user.name}
                  className="w-[84.18px] h-[84.18px] rounded-full object-cover border-[3.66px] border-white shadow-lg transition-transform active:scale-95"
                />
              ) : (
                <div className="w-[84.18px] h-[84.18px] rounded-full bg-slate-100 flex items-center justify-center text-2xl font-black text-slate-400 border-[3.66px] border-white shadow-lg transition-transform active:scale-95">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
              )}
              
              <div className="absolute -bottom-1 -right-1">
                <div className="w-[31.1px] h-[31.1px] rounded-xl bg-[#1a2138] flex items-center justify-center border-[2.75px] border-white shadow-md">
                  <Camera className="w-[14px] h-[14px] text-white" strokeWidth={3} />
                </div>
              </div>

              <AnimatePresence>
                {expandedSection === 'img_options' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="absolute top-full left-0 mt-3 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 w-44"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button 
                      onClick={() => {
                        fileInputRef.current?.click();
                        setExpandedSection(null);
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#69A38D] flex items-center justify-center">
                        <Upload size={14} />
                      </div>
                      <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">Upload Photo</span>
                    </button>
                    <button 
                      onClick={() => {
                        cameraInputRef.current?.click();
                        setExpandedSection(null);
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Camera size={14} />
                      </div>
                      <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">Open Camera</span>
                    </button>
                    <div className="absolute -top-1.5 left-6 w-3 h-3 bg-white border-t border-l border-slate-100 rotate-45" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
            <input type="file" ref={cameraInputRef} onChange={handleImageUpload} accept="image/*" capture="environment" className="hidden" />
          </div>

          <div className="flex-1 flex flex-col items-start gap-1">
            <h2 className="text-[28px] font-black text-[#1a1a1a] leading-none mb-1">{user?.name}</h2>
            <div className="flex flex-col gap-1 mb-2">
              <p className="text-[16px] font-bold text-[#7B8B9A] flex items-center gap-2">
                <span>{user?.profile?.age ? `${user.profile.age} yrs` : 'Age not set'}</span>
                <span className="w-1 h-1 bg-[#D9D9D9] rounded-full" />
                <span className="capitalize">{user?.profile?.gender || 'Other'}</span>
                <span className="w-1 h-1 bg-[#D9D9D9] rounded-full" />
                <span>{user?.profile?.height ? `${user.profile.height}cm` : 'Height not set'}</span>
              </p>
              <p className="text-[12px] font-bold text-slate-400 flex items-center gap-1.5 lowercase">
                <Mail size={12} className="text-slate-300" />
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Row - Precision Layout */}
        <div className="w-full grid grid-cols-2 gap-[14px] mb-8">
           {/* Health Score Card */}
           <div className="bg-white rounded-[25.6px] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border-[0.91px] border-white/50 flex flex-col justify-between h-[144.91px] w-full overflow-hidden">
              <div className="flex items-center gap-2">
                 <div className="w-[36px] h-[36px] rounded-full bg-[#EEF6F2] flex items-center justify-center flex-shrink-0">
                    <Heart size={16} className="text-[#69A38D]" />
                 </div>
                 <span className="text-[12px] font-bold text-[#4A5568] tracking-tight truncate">Health Score</span>
              </div>
              <div className="flex flex-col">
                 <div className="flex items-baseline gap-1">
                    <span className="text-[32px] font-black text-[#1a2138] leading-none shrink-0">
                       {user?.healthMetrics?.healthScore || extraData.latestAnalysis?.healthScore || '92'}
                    </span>
                    <span className="text-[16px] font-bold text-[#69A38D] -translate-y-1">/ 100</span>
                 </div>
                 <p className="text-[10px] font-medium text-[#7B8B9A] whitespace-nowrap overflow-hidden text-ellipsis">Top 5% for your age</p>
              </div>
           </div>

           {/* BMI Card */}
           <div className="bg-white rounded-[25.6px] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border-[0.91px] border-white/50 flex flex-col justify-between h-[144.91px] w-full overflow-hidden">
              <div className="flex items-center gap-2">
                 <div className="w-[36px] h-[36px] rounded-full bg-[#EAF2FF] flex items-center justify-center flex-shrink-0">
                    <Activity size={16} className="text-[#1F75FE]" />
                 </div>
                 <span className="text-[12px] font-bold text-[#4A5568] tracking-tight truncate">Current BMI</span>
              </div>
              <div className="flex flex-col gap-2">
                 <span className="text-[32px] font-black text-[#1a2138] leading-none">{bmi || '22.4'}</span>
                 <div className="flex">
                    <div 
                      className="flex items-center justify-center bg-[#EAF2FF] border-[0.91px] border-[#1F75FE]/20 rounded-[7.31px]" 
                      style={{ width: '67.47px', height: '22.86px' }}
                    >
                       <span className="text-[8px] font-black text-[#1F75FE] uppercase tracking-tight">{bmiStatus.label}</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Big Settings & Logout Card - Unified & Dynamic Height */}
        <div 
          className="w-full bg-white shadow-[0_8px_40px_rgba(0,0,0,0.03)] border-[0.91px] border-slate-100 flex flex-col mx-auto mb-10"
          style={{ 
            minHeight: '468.10px', 
            borderRadius: '25.6px',
            maxWidth: '349.25px'
          }}
        >
           <div className="flex flex-col">
                 {/* Account Details */}
                 <button 
                  onClick={() => setExpandedSection(expandedSection === 'account' ? null : 'account')}
                  className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors border-b border-slate-50 group"
                 >
                    <div className="flex items-center gap-5">
                       <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                          <User size={18} className="text-slate-600" />
                       </div>
                       <span className="text-[15px] font-black text-[#1a1a1a] tracking-tight">Account Details</span>
                    </div>
                    <ChevronRight size={18} className={`text-slate-300 transition-transform ${expandedSection === 'account' ? 'rotate-90' : ''}`} />
                 </button>
   
                 <AnimatePresence>
                   {expandedSection === 'account' && (
                     <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: 'auto', opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }} 
                        className="bg-slate-50/30 px-6 border-b border-slate-100 overflow-hidden"
                     >
                       <div className="py-6 space-y-5">
                          <div className="grid grid-cols-2 gap-4">
                             <div className="col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Full Name</label>
                                <input name="name" value={formData.name} onChange={handleChange} className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold shadow-sm" />
                             </div>
                             <div className="col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Email</label>
                                <input value={user?.email} disabled className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-400" />
                             </div>
                             <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Phone</label>
                                <input name="profile.phone" value={formData.profile.phone} onChange={handleChange} className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold shadow-sm" />
                             </div>
                             <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Age</label>
                                <input name="profile.age" value={formData.profile.age} onChange={handleChange} className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold shadow-sm" />
                             </div>
                             <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Gender</label>
                                <select name="profile.gender" value={formData.profile.gender} onChange={handleChange} className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold shadow-sm">
                                   <option value="male">Male</option>
                                   <option value="female">Female</option>
                                   <option value="other">Other</option>
                                </select>
                             </div>
                             <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Blood Group</label>
                                <select name="profile.bloodGroup" value={formData.profile.bloodGroup} onChange={handleChange} className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold shadow-sm">
                                   <option value="">Select</option>
                                   {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                                </select>
                             </div>
                             <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Height (cm)</label>
                                <input name="profile.height" value={formData.profile.height} onChange={handleChange} className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold shadow-sm" />
                             </div>
                             <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Weight (kg)</label>
                                <input name="profile.weight" value={formData.profile.weight} onChange={handleChange} className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold shadow-sm" />
                             </div>
                             
                             <div className="col-span-2 border-t border-slate-200 pt-5 mt-2">
                                <label className="text-[11px] font-black text-[#69A38D] uppercase tracking-widest mb-4 block">Comprehensive Health History</label>
                                <div className="grid grid-cols-2 gap-4">
                                   <div>
                                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Are you Diabetic?</label>
                                      <select name="profile.isDiabetic" value={formData.profile.isDiabetic} onChange={handleChange} className="w-full bg-white border border-slate-100 rounded-xl py-2.5 px-3 text-[11px] font-bold">
                                         <option value="no">No</option>
                                         <option value="yes">Yes</option>
                                      </select>
                                   </div>
                                   {formData.profile.isDiabetic === 'yes' && (
                                      <div>
                                         <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">HbA1c (%)</label>
                                         <input name="profile.diabetesProfile.hba1c" value={formData.profile.diabetesProfile.hba1c} onChange={handleChange} className="w-full bg-white border border-slate-100 rounded-xl py-2.5 px-3 text-[11px] font-bold" />
                                      </div>
                                   )}
                                   <div className="col-span-2">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Medical Conditions</label>
                                      <input 
                                         value={formData.profile.medicalHistory.conditions.join(', ')} 
                                         onChange={(e) => {
                                            const conds = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                            setFormData(prev => ({ ...prev, profile: { ...prev.profile, medicalHistory: { conditions: conds } } }));
                                         }}
                                         className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold" 
                                         placeholder="e.g. Hypertension, Asthma" 
                                      />
                                   </div>
                                   <div className="col-span-2">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Allergies</label>
                                      <input name="profile.allergies" value={formData.profile.allergies} onChange={handleChange} className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold" placeholder="e.g. Peanuts, Penicillin" />
                                   </div>
                                </div>
                             </div>
                          </div>
                          <button onClick={handleSubmit} className="w-full py-4 bg-[#1a2138] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] shadow-lg active:scale-98 transition-transform">Save Changes</button>
                       </div>
                     </motion.div>
                   )}
                 </AnimatePresence>
   
                 {/* Goal Settings */}
                 <button 
                  onClick={() => setExpandedSection(expandedSection === 'goals' ? null : 'goals')} 
                  className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors border-b border-slate-50 group"
                 >
                    <div className="flex items-center gap-5">
                       <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                          <Target size={18} className="text-slate-600" />
                       </div>
                       <span className="text-[15px] font-black text-[#1a1a1a] tracking-tight">Goal Settings</span>
                    </div>
                    <ChevronRight size={18} className={`text-slate-300 transition-transform ${expandedSection === 'goals' ? 'rotate-90' : ''}`} />
                 </button>

                 <AnimatePresence>
                   {expandedSection === 'goals' && (
                     <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-slate-50/30 px-6 border-b border-slate-100 overflow-hidden">
                        <div className="py-6 space-y-6">
                           <form onSubmit={handleGoalSubmit} className="space-y-6">
                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Health Objective</label>
                                 <select 
                                    name="goalType" 
                                    value={goalFormData.goalType} 
                                    onChange={handleGoalChange}
                                    className="w-full bg-white border-2 border-[#69A38D]/20 rounded-xl py-3 px-4 text-[13px] font-black shadow-sm"
                                 >
                                    <option value="weight_loss">Weight loss</option>
                                    <option value="weight_gain">Weight gain</option>
                                    <option value="maintenance">Maintain weight</option>
                                    <option value="muscle_gain">Muscle gain / strength building</option>
                                    <option value="health_improvement">Improve fitness / stamina</option>
                                    <option value="general_health">General health / wellness</option>
                                    <option value="disease_management">Disease management</option>
                                 </select>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                 <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100/30">
                                    <p className="text-[9px] font-black text-[#69A38D] uppercase mb-1">Current Weight</p>
                                    <p className="text-lg font-black text-[#1a1a1a]">{formData.profile.weight || user?.profile?.weight || '—'} <span className="text-[10px] text-slate-400">kg</span></p>
                                 </div>
                                 <div className="p-4 bg-white rounded-xl border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Target Weight</p>
                                    <input 
                                       type="number" 
                                       name="targetWeight" 
                                       value={goalFormData.targetWeight} 
                                       onChange={handleGoalChange} 
                                       className="w-full text-lg font-black text-[#1a1a1a] bg-transparent focus:outline-none" 
                                       placeholder="Set target"
                                    />
                                 </div>
                              </div>

                              {/* Smart Weight / Goal Mismatch Warning */}
                              {goalMismatchWarning && (
                                <div className="flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl animate-bounce-subtle">
                                  <span className="text-sm">{goalMismatchWarning.icon}</span>
                                  <p className="text-[10px] font-bold text-red-700">{goalMismatchWarning.msg}</p>
                                </div>
                              )}

                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Target Timeframe</label>
                                 <select 
                                    name="targetWeeks" 
                                    value={goalFormData.targetWeeks} 
                                    onChange={handleGoalChange}
                                    className="w-full bg-white border-2 border-slate-100 rounded-xl py-3 px-4 text-sm font-bold shadow-sm"
                                 >
                                    <option value="4">4 Weeks (Aggressive)</option>
                                    <option value="8">8 Weeks (Steady)</option>
                                    <option value="12">12 Weeks (Sustainable)</option>
                                    <option value="16">16 Weeks (Lifestyle)</option>
                                    <option value="24">24 Weeks (Long-term)</option>
                                 </select>
                                 <p className="text-[9px] text-slate-400 mt-2 italic px-1">Tip: 12 weeks is recommended for sustainable fat loss or muscle gain.</p>
                              </div>

                              {/* Macros Card - Uses Live Preview or Last Synced Data */}
                              {(liveMacroPreview || healthGoal?.macroTargets) && (
                                 <div className="p-5 bg-[#1a2138] rounded-2xl text-white shadow-xl relative overflow-hidden">
                                    {/* Preview Glow Effect */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[40px] rounded-full -mr-10 -mt-10" />
                                    
                                    <div className="flex items-center justify-between mb-4 relative z-10">
                                       <div className="flex flex-col gap-0.5">
                                          <div className="flex items-center gap-2">
                                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Daily Calorie Budget</span>
                                             {formData.profile.isDiabetic === 'yes' && (
                                               <span className="text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">Diabetic</span>
                                             )}
                                          </div>
                                          {!healthGoal && <span className="text-[8px] font-bold text-[#69A38D] uppercase tracking-tight">Live Prediction</span>}
                                       </div>
                                       <span className="text-xl font-black">
                                          {liveMacroPreview?.calories || healthGoal?.dailyCalorieTarget} 
                                          <span className="text-[11px] text-[#69A38D] ml-1">KCAL</span>
                                       </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 relative z-10">
                                       {[
                                          { label: 'PRO', val: liveMacroPreview?.protein || healthGoal?.macroTargets.protein, unit: 'g', color: 'bg-emerald-500' },
                                          { label: 'CARB', val: liveMacroPreview?.carbs || healthGoal?.macroTargets.carbs, unit: 'g', color: 'bg-amber-500' },
                                          { label: 'FAT', val: liveMacroPreview?.fats || healthGoal?.macroTargets.fats, unit: 'g', color: 'bg-rose-500' }
                                       ].map(m => (
                                          <div key={m.label} className="bg-white/5 rounded-xl p-3 border border-white/5">
                                             <div className={`w-1 h-4 ${m.color} rounded-full mb-2 shadow-[0_0_10px_rgba(0,0,0,0.2)]`} />
                                             <p className="text-[10px] font-black text-slate-400 mb-0.5">{m.label}</p>
                                             <p className="text-sm font-black text-white">{m.val}{m.unit}</p>
                                          </div>
                                       ))}
                                    </div>

                                    {formData.profile.isDiabetic === 'yes' && (
                                      <div className="mt-4 flex flex-col gap-1 px-1 relative z-10">
                                        <div className="flex items-center gap-2">
                                          <div className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                                          <p className="text-[9px] text-amber-400/80 italic font-medium">
                                            🩺 Glucose Optimization: Controlled carbs for stable insulin levels
                                          </p>
                                        </div>
                                        <p className="text-[8px] text-slate-500 opacity-60 ml-3 italic">
                                          *Macros are based on current weight to ensure safety during your journey
                                        </p>
                                      </div>
                                    )}
                                 </div>
                              )}

                              <button type="submit" className="w-full py-4 bg-[#69A38D] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg hover:bg-[#5a8b78] transition-all">
                                 Sync Fitness Plan
                              </button>
                           </form>
                        </div>
                     </motion.div>
                   )}
                 </AnimatePresence>
                 
                 {/* Medical Records */}
                 <button 
                  onClick={() => setExpandedSection(expandedSection === 'reports' ? null : 'reports')}
                  className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors border-b border-slate-50 group"
                 >
                    <div className="flex items-center gap-5">
                       <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                          <FileText size={18} className="text-slate-600" />
                       </div>
                       <span className="text-[15px] font-black text-[#1a1a1a] tracking-tight">Medical Records</span>
                    </div>
                    <ChevronRight size={18} className={`text-slate-300 transition-transform ${expandedSection === 'reports' ? 'rotate-90' : ''}`} />
                 </button>

                 <AnimatePresence>
                    {expandedSection === 'reports' && (
                       <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="bg-slate-50/30 px-6 border-b border-slate-100">
                          <div className="py-4 max-h-[200px] overflow-y-auto no-scrollbar space-y-2">
                             {extraData.recentReports?.map(r => (
                                <div key={r._id} onClick={() => navigate(`/reports/${r._id}`)} className="p-3 bg-white rounded-xl border border-slate-100 flex items-center justify-between">
                                   <span className="text-[11px] font-bold text-slate-700 truncate">{r.reportType}</span>
                                   <span className="text-[9px] text-slate-400">{new Date(r.date).toLocaleDateString()}</span>
                                </div>
                             ))}
                             <button onClick={() => navigate('/all-reports')} className="w-full py-2 text-[9px] font-black text-[#69A38D] uppercase tracking-widest text-center">Open Vault →</button>
                          </div>
                       </motion.div>
                    )}
                 </AnimatePresence>
   
                 <button onClick={() => navigate('/complete-analysis')} className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors border-b border-slate-50 group">
                    <div className="flex items-center gap-5">
                       <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                          <TrendingUp size={18} className="text-slate-600" />
                       </div>
                       <span className="text-[15px] font-black text-[#1a1a1a] tracking-tight">Progress Reports</span>
                    </div>
                    <ChevronRight size={18} className="text-slate-300" />
                 </button>

                 {/* Terms & Conditions */}
                 <button 
                   onClick={() => toast('Terms & Conditions coming soon', { icon: '📄' })}
                   className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors border-b border-slate-50 group"
                 >
                    <div className="flex items-center gap-5">
                       <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                          <ScrollText size={18} className="text-slate-600" />
                       </div>
                       <span className="text-[15px] font-black text-[#1a1a1a] tracking-tight">Terms & Conditions</span>
                    </div>
                    <ChevronRight size={18} className="text-slate-300" />
                 </button>

                 {/* Privacy Policy */}
                 <button 
                   onClick={() => toast('Privacy Policy coming soon', { icon: '🔒' })}
                   className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors border-b border-slate-50 group"
                 >
                    <div className="flex items-center gap-5">
                       <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                          <Shield size={18} className="text-slate-600" />
                       </div>
                       <span className="text-[15px] font-black text-[#1a1a1a] tracking-tight">Privacy Policy</span>
                    </div>
                    <ChevronRight size={18} className="text-slate-300" />
                 </button>

                 {/* Customer Support */}
                 <button 
                   onClick={() => toast('Customer Support coming soon', { icon: '🎧' })}
                   className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors border-b border-slate-50 group"
                 >
                    <div className="flex items-center gap-5">
                       <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                          <Headphones size={18} className="text-slate-600" />
                       </div>
                       <span className="text-[15px] font-black text-[#1a1a1a] tracking-tight">Customer Support</span>
                    </div>
                    <ChevronRight size={18} className="text-slate-300" />
                 </button>
              </div>

           {/* Logout Section - Fixed at the bottom of the card */}
           <div className="p-6 border-t border-slate-50 bg-slate-50/30">
              <button 
                onClick={logout} 
                className="w-full py-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center gap-3 hover:bg-rose-50 hover:border-rose-100 transition-all group"
              >
                 <LogOut size={16} className="text-rose-500" />
                 <span className="text-[14px] font-black text-rose-500 tracking-tight">Logout Account</span>
              </button>
           </div>
        </div>

      </div>
    </div>
  );
}