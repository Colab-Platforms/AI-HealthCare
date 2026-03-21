import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  User, Save, Heart, AlertCircle, Camera, Mail, Phone, Target,
  Activity, Droplet, Cigarette, Wine, Moon, Apple, Dumbbell, Pill, Upload,
  Bell, ShieldCheck, ChevronRight, LogOut, FileText, Settings, CheckCircle2,
  TrendingUp, TrendingDown, Clock, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import BMIWidget from '../components/BMIWidget';
import ProfileSkeleton from '../components/skeletons/ProfileSkeleton';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const [healthGoal, setHealthGoal] = useState(null);
  const [goalLoading, setGoalLoading] = useState(false);
  const [extraData, setExtraData] = useState({
    appointmentsCount: 0,
    reportsCount: 0,
    metrics: {},
    recentActivity: [],
    wearable: null,
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
    dietaryPreference: user?.profile?.dietaryPreference || 'non-vegetarian'
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
      allergies: user?.profile?.allergies ? user.profile.allergies.join(', ') : '',
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
      diabetesProfile: user?.profile?.diabetesProfile || { type: '', hba1c: '' }
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
      const [aptRes, reportsRes, summaryRes, wearableRes, dashRes] = await Promise.all([
        api.get('doctor/appointments'),
        api.get('health/reports'),
        api.get('metrics/summary/latest?types=heart_rate,blood_pressure'),
        api.get('wearables/dashboard'),
        api.get('health/dashboard')
      ]);

      const reportsArray = Array.isArray(reportsRes.data) ? reportsRes.data : (reportsRes.data?.reports || []);
      const reportsCount = (dashRes.data && typeof dashRes.data.totalReports === 'number') 
        ? dashRes.data.totalReports 
        : reportsArray.length;

      setExtraData({
        appointmentsCount: aptRes.data.length,
        reportsCount: reportsCount || 0,
        metrics: summaryRes.data,
        recentActivity: aptRes.data.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4),
        wearable: wearableRes.data,
        latestAnalysis: dashRes.data.latestAnalysis,
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
    if (searchParams.get('tab') === 'goals') {
      setExpandedSection('goals');
    }
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
    if (name.startsWith('profile.lifestyle.')) {
      const field = name.split('.')[2];
      setFormData(prev => ({
        ...prev,
        profile: {
          ...prev.profile,
          lifestyle: { ...prev.profile.lifestyle, [field]: type === 'checkbox' ? checked : value }
        }
      }));
    } else if (name.startsWith('profile.diabetesProfile.')) {
      const field = name.split('.')[2];
      setFormData(prev => ({
        ...prev,
        profile: {
          ...prev.profile,
          diabetesProfile: { ...prev.profile.diabetesProfile, [field]: value }
        }
      }));
    } else if (name === 'profile.isDiabetic') {
      const isNo = value === 'no';
      setFormData(prev => {
        let newConditions = [...(prev.profile.medicalHistory.conditions || [])];
        if (isNo) {
          // Remove diabetes from conditions if switching to 'no'
          newConditions = newConditions.filter(c => !c.toLowerCase().includes('diabetes'));
        }
        
        return {
          ...prev,
          profile: {
            ...prev.profile,
            isDiabetic: value,
            medicalHistory: {
              ...prev.profile.medicalHistory,
              conditions: newConditions
            },
            // Clear diabetes profile if switching to 'no'
             diabetesProfile: isNo ? { type: '', hba1c: '' } : prev.profile.diabetesProfile
          }
        };
      });
    } else if (name.startsWith('profile.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({ ...prev, profile: { ...prev.profile, [field]: value } }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
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
          gender: formData.profile.gender || undefined,
          dietaryPreference: formData.profile.dietaryPreference || undefined,
          age: formData.profile.age ? Number(formData.profile.age) : undefined,
          height: formData.profile.height ? Number(formData.profile.height) : undefined,
          weight: formData.profile.weight ? Number(formData.profile.weight) : undefined,
          allergies: formData.profile.allergies ? formData.profile.allergies.split(',').map(a => a.trim()).filter(Boolean) : [],
          lifestyle: {
            ...formData.profile.lifestyle,
            sleepHours: Number(formData.profile.lifestyle.sleepHours),
            waterIntake: Number(formData.profile.lifestyle.waterIntake)
          }
        }
      };
      const { data } = await api.put('auth/profile', payload);
      updateUser(data);
      toast.success('Profile updated successfully!');

      if (data.bmiChanged) {
        await fetchHealthGoal();
        toast((t) => (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              Your BMI has changed to <span className="font-bold text-cyan-600">{data.newBmi}</span>.
              Nutrition targets have been updated!
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  setExpandedSection('goals');
                }}
                className="px-3 py-1.5 bg-cyan-100 text-cyan-700 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-cyan-200 transition-colors"
              >
                Review Fitness Goal
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-200 transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        ), { duration: 8000, position: 'bottom-center' });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // Derive age, height, weight from profile for fitness goal
  const profileAge = Number(formData.profile.age) || user?.profile?.age || 0;
  const profileHeight = Number(formData.profile.height) || user?.profile?.height || 0;
  const profileWeight = Number(formData.profile.weight) || user?.profile?.weight || 0;
  const profileGender = formData.profile.gender || user?.profile?.gender || 'male';

  const handleGoalSubmit = async (e) => {
    e.preventDefault();
    
    // Validate profile data exists
    if (!profileWeight || profileWeight < 30) {
      toast.error('Please set your weight (min 30kg) in General Profile first');
      setExpandedSection('profile');
      return;
    }
    if (!profileHeight || profileHeight < 100) {
      toast.error('Please set your height (min 100cm) in General Profile first');
      setExpandedSection('profile');
      return;
    }
    if (!profileAge || profileAge < 1) {
      toast.error('Please set your age in General Profile first');
      setExpandedSection('profile');
      return;
    }
    if (!goalFormData.targetWeight || goalFormData.targetWeight < 30) {
      toast.error('Target weight must be at least 30kg');
      return;
    }

    setGoalLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...goalFormData,
        currentWeight: profileWeight,
        targetWeight: Number(goalFormData.targetWeight),
        height: profileHeight,
        age: profileAge,
        gender: profileGender
      };

      // Use PUT if goal exists, POST if new
      const response = healthGoal
        ? await api.put('nutrition/goals', payload, {
          headers: { Authorization: `Bearer ${token}` }
        })
        : await api.post('nutrition/goals', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });

      setHealthGoal(response.data.healthGoal);
      toast.success('Fitness goal set successfully! Your daily targets have been calculated.');
      
      // Update global user context to sync nutritionGoals immediately
      const { data: userData } = await api.get('auth/profile');
      updateUser(userData);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to set fitness goal');
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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setUploadingImage(true);

    try {
      // Small compression utility using Canvas
      const compressImage = (file) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;

              // Max dimension 800px for profile pic
              const MAX_DIM = 800;
              if (width > height) {
                if (width > MAX_DIM) {
                  height *= MAX_DIM / width;
                  width = MAX_DIM;
                }
              } else {
                if (height > MAX_DIM) {
                  width *= MAX_DIM / height;
                  height = MAX_DIM;
                }
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);

              canvas.toBlob((blob) => {
                resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
              }, 'image/jpeg', 0.8); // 80% quality
            };
          };
        });
      };

      const compressedFile = file.size > 500 * 1024 ? await compressImage(file) : file;
      console.log(`Original: ${(file.size / 1024).toFixed(2)}KB, Compressed: ${(compressedFile.size / 1024).toFixed(2)}KB`);

      const formData = new FormData();
      formData.append('profilePicture', compressedFile);

      const { data } = await api.post('auth/upload-profile-picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Update user with new profile picture
      updateUser({ ...user, profilePicture: data.profilePicture });
      toast.success('Profile picture updated successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to upload image');
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

  const colorMap = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', pillBg: 'bg-blue-100', pillText: 'text-blue-700' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', pillBg: 'bg-emerald-100', pillText: 'text-emerald-700' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', pillBg: 'bg-amber-100', pillText: 'text-amber-700' },
    red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100', pillBg: 'bg-red-100', pillText: 'text-red-700' },
    slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-100', pillBg: 'bg-slate-100', pillText: 'text-slate-700' }
  };
  const bmiColors = colorMap[bmiStatus.color] || colorMap.slate;

  if (!user) return <ProfileSkeleton />;

  return (
    <div className="w-full relative min-h-screen bg-slate-50 overflow-x-hidden animate-fade-in pb-24">
      {/* Black Header Background */}
      <div className="absolute top-0 left-0 right-0 h-48 md:h-64 bg-black" />

      <div className="relative z-10 px-4 md:px-8 pt-8 md:pt-12 max-w-5xl mx-auto space-y-6">
        {/* Profile Header Card */}
        <div className="bg-white rounded-[2.5rem] p-6 md:p-10 shadow-xl border border-slate-100">
          <div className="flex items-center gap-6 mb-8">
            {/* Profile Picture Section */}
            <div className="relative group flex-shrink-0">
              <div className="relative">
                {user?.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={user.name}
                    className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-4 border-white shadow-lg ring-1 ring-slate-100"
                  />
                ) : (
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-slate-100 flex items-center justify-center text-3xl font-black text-slate-400 border-4 border-white shadow-lg ring-1 ring-slate-100">
                    {user?.name?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className="absolute bottom-1 right-1 w-5 h-5 bg-[#10B981] rounded-full border-4 border-white shadow-sm ring-1 ring-slate-100">
                  <div className="absolute inset-0 bg-[#10B981] animate-ping opacity-25 rounded-full" />
                </div>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center cursor-pointer"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0 space-y-1">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 truncate capitalize">{user?.name}</h2>
              <div className="flex items-center gap-x-2 text-slate-500 font-medium text-sm">
                <span className="capitalize">{user?.profile?.gender || 'N/A'}</span>
                <span className="text-slate-300">•</span>
                <span>{user?.profile?.age ? `${user.profile.age} years old` : 'Age not set'}</span>
              </div>
              <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-widest">
                  <Mail className="w-3.5 h-3.5" />
                  {user?.email}
                </div>
                {(user?.phone || user?.profile?.phone) && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-widest">
                    <Phone className="w-3.5 h-3.5" />
                    {user?.phone || user?.profile?.phone}
                  </div>
                )}
              </div>
              <div className="inline-flex items-center px-4 py-1 bg-black text-white rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest mt-3">
                {user?.subscription?.plan || 'Free'} Member
              </div>
            </div>
          </div>

          <div className="w-full h-px bg-slate-100 mb-8" />

          {/* Core Dashboard Stats - Health Score & Reports Only */}
          <div className="flex items-center justify-center w-full max-w-xl mx-auto gap-12">
            <div className="text-center space-y-1">
              <p className="text-3xl md:text-4xl font-black text-black">
                {extraData.latestAnalysis?.healthScore || '75'}
              </p>
              <div className="flex flex-col items-center">
                <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-wider">Health Score</p>
                <div className="h-1 w-12 bg-emerald-400 rounded-full mt-1" />
              </div>
            </div>
            <div className="h-12 w-px bg-slate-100" />
            <div className="text-center space-y-1">
              <p className="text-3xl md:text-4xl font-black text-black">
                {extraData.reportsCount || '0'}
              </p>
              <div className="flex flex-col items-center">
                <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-wider">Reports</p>
                <div className="h-1 w-12 bg-blue-400 rounded-full mt-1" />
              </div>
            </div>
          </div>
        </div>

        {/* Relocated BMI Summary Card - Just below Profile Header */}
        {bmi && (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 md:p-8 shadow-sm animate-fade-in shadow-xl hover:shadow-2xl transition-all">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full ${bmiColors.bg} border-4 border-white shadow-lg ring-1 ring-slate-100 flex items-center justify-center transition-transform hover:scale-105 pointer-events-none`}>
                  <span className={`text-2xl md:text-3xl font-bold ${bmiColors.text}`}>{bmi}</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">Body Mass Index (BMI)</h3>
                  <span className={`px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider ${bmiColors.pillBg} ${bmiColors.pillText}`}>
                    {bmiStatus.label}
                  </span>
                </div>
              </div>
              <div className="hidden md:block h-12 w-px bg-slate-100 mx-4" />
              <div className="flex-1 max-w-md text-slate-500 text-sm">
                <p className="leading-relaxed">Your BMI indicates you are in the <strong className={bmiColors.text}>{bmiStatus.label.toLowerCase()}</strong> range. {
                  bmiStatus.color === 'emerald'
                    ? "Excellent! You're in the healthy range. Keep up the great work with your nutrition and exercise."
                    : "Work towards a balanced diet and regular activity to reach the optimal health range for your height/age."
                }</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-12 animate-slide-up pb-12">
          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Left Column: Personalization (2/3 width) */}
            <div className="lg:col-span-2 space-y-8">
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-slate-900">Personalize Your Health</h3>
                <div className="space-y-4">
                  {/* General Profile Details Card */}
                  <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden transition-all duration-300">
                    <div
                      onClick={() => setExpandedSection(expandedSection === 'profile' ? null : 'profile')}
                      className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
                          <User className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">General Profile Details</h4>
                          <p className="text-sm text-slate-500">Edit age, weight, blood group, etc.</p>
                        </div>
                      </div>
                      <ChevronRight className={`w-6 h-6 text-slate-300 transition-transform duration-300 ${expandedSection === 'profile' ? 'rotate-90' : ''}`} />
                    </div>

                    {expandedSection === 'profile' && (
                      <div className="px-6 pb-8 pt-2 animate-fade-in">
                        <form onSubmit={handleSubmit} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Age</label>
                              <input
                                type="number"
                                name="profile.age"
                                value={formData.profile.age}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-slate-800 focus:border-blue-500 focus:ring-0 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Gender</label>
                              <select
                                name="profile.gender"
                                value={formData.profile.gender}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-slate-800 focus:border-blue-500 focus:outline-none"
                              >
                                <option value="">Select Gender</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Height (cm)</label>
                              <input
                                type="number"
                                name="profile.height"
                                value={formData.profile.height}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-slate-800 focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Weight (kg)</label>
                              <input
                                type="number"
                                name="profile.weight"
                                value={formData.profile.weight}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-slate-800 focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                              <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Blood Group</label>
                                <select
                                  name="profile.bloodGroup"
                                  value={formData.profile.bloodGroup}
                                  onChange={handleChange}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-slate-800 focus:border-blue-500 focus:outline-none"
                                >
                                  <option value="">Select</option>
                                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                                    <option key={bg} value={bg}>{bg}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Dietary Preference</label>
                                <select
                                  name="profile.dietaryPreference"
                                  value={formData.profile.dietaryPreference}
                                  onChange={handleChange}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-slate-800"
                                >
                                  <option value="">Select Dietary Preference</option>
                                  <option value="non-vegetarian">Non-Vegetarian</option>
                                  <option value="vegetarian">Vegetarian</option>
                                  <option value="vegan">Vegan</option>
                                  <option value="eggetarian">Eggetarian</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Activity Level</label>
                                <select
                                  name="profile.activityLevel"
                                  value={formData.profile.activityLevel}
                                  onChange={handleChange}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-slate-800 focus:border-blue-500 focus:outline-none"
                                >
                                  <option value="">Select Activity Level</option>
                                  <option value="sedentary">Sedentary (Little/no exercise)</option>
                                  <option value="lightly_active">Lightly Active (1-3 days)</option>
                                  <option value="moderately_active">Moderately Active (3-5 days)</option>
                                  <option value="very_active">Very Active (6-7 days)</option>
                                  <option value="extremely_active">Extremely Active (Athlete)</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Phone Number</label>
                                <input
                                  name="profile.phone"
                                  value={formData.profile.phone}
                                  onChange={handleChange}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-slate-800 focus:border-blue-500 focus:outline-none"
                                  placeholder="e.g. +1 234 567 890"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Are you Diabetic?</label>
                                <select
                                  name="profile.isDiabetic"
                                  value={formData.profile.isDiabetic}
                                  onChange={handleChange}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-slate-800 focus:border-blue-500 focus:outline-none"
                                >
                                  <option value="no">No</option>
                                  <option value="yes">Yes</option>
                                </select>
                              </div>
                            </div>

                            {/* Lifestyle Section */}
                            <div className="md:col-span-2 pt-4 border-t border-slate-100">
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Stress Level</label>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <select
                                  name="profile.lifestyle.stressLevel"
                                  value={formData.profile.lifestyle.stressLevel}
                                  onChange={handleChange}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-xs font-bold"
                                >
                                  <option value="low">Low</option>
                                  <option value="moderate">Moderate</option>
                                  <option value="high">High</option>
                                </select>
                                <div className="flex items-center gap-4 mt-2">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      name="profile.lifestyle.smoker"
                                      checked={formData.profile.lifestyle.smoker}
                                      onChange={handleChange}
                                      className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <span className="text-xs font-bold text-slate-400 uppercase">Smoker</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      name="profile.lifestyle.alcohol"
                                      checked={formData.profile.lifestyle.alcohol}
                                      onChange={handleChange}
                                      className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <span className="text-xs font-bold text-slate-400 uppercase">Alcohol</span>
                                  </label>
                                </div>
                              </div>
                            </div>

                            {/* Medical History */}
                            <div className="md:col-span-2 pt-4 border-t border-slate-100">
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Medical Conditions (Comma separated)</label>
                              <input
                                type="text"
                                value={formData.profile.medicalHistory.conditions.join(', ')}
                                onChange={(e) => {
                                  const conditions = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                  setFormData(prev => ({
                                    ...prev,
                                    profile: {
                                      ...prev.profile,
                                      medicalHistory: { ...prev.profile.medicalHistory, conditions }
                                    }
                                  }));
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-slate-800"
                                placeholder="e.g. Diabetes, Hypertension"
                              />
                            </div>

                            {/* Diabetes Profile */}
                             {(formData.profile.isDiabetic === 'yes' || formData.profile.diabetesProfile?.type || formData.profile.medicalHistory.conditions.some(c => c.toLowerCase().includes('diabetes'))) && (
                              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                                <div>
                                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Diabetes Type</label>
                                  <select
                                    name="profile.diabetesProfile.type"
                                    value={formData.profile.diabetesProfile.type}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4"
                                  >
                                    <option value="Type 1">Type 1</option>
                                    <option value="Type 2">Type 2</option>
                                    <option value="Prediabetes">Prediabetes</option>
                                    <option value="Gestational">Gestational</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Current HbA1c (%)</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    name="profile.diabetesProfile.hba1c"
                                    value={formData.profile.diabetesProfile.hba1c}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95"
                          >
                            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            Update Profile Info
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                  {/* Fitness Goal Card */}
                  <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden transition-all duration-300">
                    <div
                      onClick={() => setExpandedSection(expandedSection === 'goals' ? null : 'goals')}
                      className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#FFF7ED] text-[#F97316] flex items-center justify-center">
                          <Target className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">Set Fitness Goals</h4>
                          <p className="text-sm text-slate-500">Update weight loss or gain targets</p>
                        </div>
                      </div>
                      <ChevronRight className={`w-6 h-6 text-slate-300 transition-transform duration-300 ${expandedSection === 'goals' ? 'rotate-90' : ''}`} />
                    </div>

                    {expandedSection === 'goals' && (
                      <div className="px-6 pb-8 pt-2 animate-fade-in">
                        <form onSubmit={handleGoalSubmit} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Goal Objective</label>
                              <select
                                name="goalType"
                                value={goalFormData.goalType}
                                onChange={handleGoalChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-slate-800"
                              >
                                <option value="weight_loss">Weight Loss</option>
                                <option value="weight_gain">Weight Gain</option>
                                <option value="muscle_gain">Muscle Gain</option>
                                <option value="maintain">Maintenance</option>
                                <option value="general_health">General Health Improvement</option>
                              </select>
                            </div>
                            {/* Age, Height, Current Weight — read-only from General Profile */}
                            <div className="md:col-span-2 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                              <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider mb-3">From Your Profile</p>
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Age</p>
                                  <p className="text-lg font-bold text-slate-800">{profileAge || <span className="text-red-400 text-sm">Not set</span>}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Height</p>
                                  <p className="text-lg font-bold text-slate-800">{profileHeight ? `${profileHeight} cm` : <span className="text-red-400 text-sm">Not set</span>}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Weight</p>
                                  <p className="text-lg font-bold text-slate-800">{profileWeight ? `${profileWeight} kg` : <span className="text-red-400 text-sm">Not set</span>}</p>
                                </div>
                              </div>
                              {(!profileAge || !profileHeight || !profileWeight) && (
                                <button type="button" onClick={() => setExpandedSection('profile')} className="mt-3 text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                                  → Update in General Profile
                                </button>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Target Weight (kg)</label>
                              <input
                                type="number"
                                name="targetWeight"
                                value={goalFormData.targetWeight}
                                onChange={handleGoalChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4"
                                placeholder="Target"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Activity Level</label>
                              <select
                                name="activityLevel"
                                value={goalFormData.activityLevel}
                                onChange={handleGoalChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4"
                              >
                                <option value="sedentary">Sedentary (Little or no exercise)</option>
                                <option value="lightly_active">Lightly Active (1-3 days/week)</option>
                                <option value="moderately_active">Moderately Active (3-5 days/week)</option>
                                <option value="very_active">Very Active (6-7 days/week)</option>
                                <option value="extremely_active">Extremely Active (Athlete)</option>
                              </select>
                            </div>
                          </div>

                        {healthGoal && healthGoal.macroTargets && (
                          <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in shadow-inner">
                            <div>
                              <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Calories</p>
                              <p className="text-xl font-black text-orange-700">{healthGoal.dailyCalorieTarget || '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Protein</p>
                              <p className="text-xl font-black text-orange-700">{healthGoal.macroTargets?.protein ? `${healthGoal.macroTargets.protein}g` : '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Carbs</p>
                              <p className="text-xl font-black text-orange-700">{healthGoal.macroTargets?.carbs ? `${healthGoal.macroTargets.carbs}g` : '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Fats</p>
                              <p className="text-xl font-black text-orange-700">{healthGoal.macroTargets?.fats ? `${healthGoal.macroTargets.fats}g` : '—'}</p>
                            </div>
                          </div>
                        )}

                          <button
                            type="submit"
                            disabled={goalLoading}
                            className="w-full py-3 bg-[#F97316] text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                          >
                            {goalLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            Recalculate & Save Goal
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Mini Info / Stats (1/3 width) */}
            <div className="space-y-8">
              {/* Account Control at the bottom of the grid or strictly after */}
              <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
                 <h3 className="text-xl font-bold text-slate-900 mb-6">Account Control</h3>
                 <button
                    onClick={logout}
                    className="w-full flex items-center justify-between p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <LogOut className="w-5 h-5" />
                      <span className="font-bold text-sm">Sign Out</span>
                    </div>
                    <ChevronRight className="w-4 h-4" />
                  </button>
              </div>
            </div>
          </div>

          {/* AI Health Insights Section */}
          <div className="space-y-6 mt-12">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg">
                <Sparkles className="w-5 h-5 transition-transform group-hover:rotate-12" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-slate-900">AI Health Insights</h3>
            </div>
            <div className="bg-[#F8FAFF] rounded-[2rem] p-6 md:p-8 border border-[#EBF2FF] relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative flex gap-5 md:gap-6">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-3xl bg-white shadow-sm flex items-center justify-center flex-shrink-0 text-purple-600">
                  <Activity className="w-8 h-8 md:w-10 md:h-10" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-lg md:text-xl font-bold text-slate-900">
                    {extraData.latestAnalysis?.summary ? "Personalized Analysis" : "General Health Summary"}
                  </h4>
                  <p className="text-slate-600 leading-relaxed max-w-2xl text-sm md:text-base">
                    {extraData.latestAnalysis?.summary || 
                     extraData.latestAnalysis?.recommendations?.lifestyle?.[0] ||
                     user?.healthAnalysis?.summary || 
                     "Based on your profile, we recommend maintaining a consistent sleep schedule and monitoring your activity levels."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}