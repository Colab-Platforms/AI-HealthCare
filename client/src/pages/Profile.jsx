import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  User, Save, Heart, AlertCircle, Camera, Mail, Phone, Target,
  Activity, Droplet, Cigarette, Wine, Moon, Apple, Dumbbell, Pill, Upload,
  Bell, ShieldCheck, ChevronRight, LogOut, FileText, Settings, CheckCircle2,
  TrendingUp, TrendingDown, Clock
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
    activityLevel: 'moderate',
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
      diabetesProfile: user?.profile?.diabetesProfile || null
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
          currentWeight: data.healthGoal.currentWeight,
          targetWeight: data.healthGoal.targetWeight,
          height: data.healthGoal.height,
          age: data.healthGoal.age,
          gender: data.healthGoal.gender,
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
      const [aptRes, reportsRes, summaryRes, wearableRes] = await Promise.all([
        api.get('doctor/appointments'),
        api.get('health/reports'),
        api.get('metrics/summary/latest?types=heart_rate,blood_pressure'),
        api.get('wearable/dashboard')
      ]);

      setExtraData({
        appointmentsCount: aptRes.data.length,
        reportsCount: reportsRes.data.length,
        metrics: summaryRes.data,
        recentActivity: aptRes.data.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4),
        wearable: wearableRes.data,
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
  }, []);

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
        profile: {
          ...formData.profile,
          age: formData.profile.age ? Number(formData.profile.age) : undefined,
          height: formData.profile.height ? Number(formData.profile.height) : undefined,
          weight: formData.profile.weight ? Number(formData.profile.weight) : undefined,
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

  const handleGoalSubmit = async (e) => {
    e.preventDefault();
    setGoalLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...goalFormData,
        currentWeight: Number(goalFormData.currentWeight),
        targetWeight: Number(goalFormData.targetWeight),
        height: Number(goalFormData.height),
        age: Number(goalFormData.age)
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
      {/* Blue Header Background */}
      <div className="absolute top-0 left-0 right-0 h-48 md:h-64 bg-[#2563EB]" />

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
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0 space-y-1">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 truncate capitalize">{user?.name}</h2>
              <div className="flex items-center gap-x-2 text-slate-500 font-medium text-sm">
                <span className="capitalize">{user?.profile?.gender || 'N/A'}</span>
                <span className="text-slate-300">•</span>
                <span>{user?.profile?.age ? `${user.profile.age} years old` : 'Age not set'}</span>
              </div>
              <div className="inline-flex items-center px-4 py-1 bg-[#EFF6FF] text-[#2563EB] rounded-2xl text-[10px] md:text-xs font-bold border border-[#DBEAFE]">
                {user?.subscription?.plan || 'Free'} Member
              </div>
            </div>
          </div>

          <div className="w-full h-px bg-slate-100 mb-8" />

          {/* Core Dashboard Stats - Horizontal Layout with Dividers */}
          <div className="flex items-center justify-between w-full max-w-2xl mx-auto">
            <div className="flex-1 text-center space-y-1">
              <p className="text-xl md:text-2xl font-bold text-slate-900">
                {user?.healthMetrics?.healthScore || '8.5'}
              </p>
              <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-wider">Health Score</p>
            </div>
            <div className="h-10 w-px bg-slate-100" />
            <div className="flex-1 text-center space-y-1">
              <p className="text-xl md:text-2xl font-bold text-slate-900">
                {extraData.appointmentsCount || '12'}
              </p>
              <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-wider">Checkups</p>
            </div>
            <div className="h-10 w-px bg-slate-100" />
            <div className="flex-1 text-center space-y-1">
              <p className="text-xl md:text-2xl font-bold text-slate-900">
                {extraData.reportsCount || '3'}
              </p>
              <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-wider">Reports</p>
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

        <div className="space-y-10 animate-slide-up">
          {/* Health Metrics Section */}
          <div className="space-y-6 pt-4">
            <h3 className="text-xl md:text-2xl font-bold text-slate-900">Health Metrics</h3>
            <div className="flex overflow-x-auto pb-4 gap-4 md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-visible no-scrollbar">
              {/* Heart Rate Card */}
              {extraData.metrics?.heart_rate && (
                <div className="bg-[#ECFDF5] rounded-3xl p-6 border border-[#D1FAE5] hover:shadow-lg transition-all group flex flex-col justify-between h-full min-h-[140px]">
                  <div className="flex justify-between items-start">
                    <div className="p-2.5 bg-white rounded-xl text-[#059669] shadow-sm">
                      <Heart className="w-6 h-6 fill-[#059669]" />
                    </div>
                    <div className="p-1 px-2.5 bg-[#FEF2F2] rounded-full flex items-center gap-1 text-[#EF4444] text-xs font-bold border border-[#FEE2E2]">
                      <TrendingDown className="w-3 h-3" /> 4%
                    </div>
                  </div>
                  <div>
                    <h4 className="text-slate-500 font-medium text-sm mt-4">Heart Rate</h4>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-bold text-slate-900">{extraData.metrics?.heart_rate?.value}</span>
                      <span className="text-slate-400 font-medium text-xs">bpm</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Blood Pressure Card */}
              {extraData.metrics?.blood_pressure && (
                <div className="bg-[#EFF6FF] rounded-3xl p-6 border border-[#DBEAFE] hover:shadow-lg transition-all group flex flex-col justify-between h-full min-h-[140px]">
                  <div className="flex justify-between items-start">
                    <div className="p-2.5 bg-white rounded-xl text-[#3B82F6] shadow-sm">
                      <Activity className="w-6 h-6" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-slate-500 font-medium text-sm mt-4">Blood Pressure</h4>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-bold text-slate-900">{`${extraData.metrics.blood_pressure.value}/${extraData.metrics.blood_pressure.systolic || 80}`}</span>
                      <span className="text-slate-400 font-medium text-xs">mmHg</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Steps Card */}
              {extraData.wearable?.todayMetrics?.steps && (
                <div className="bg-[#F0FDF4] rounded-3xl p-6 border border-[#DCFCE7] hover:shadow-lg transition-all group flex flex-col justify-between h-full min-h-[140px]">
                  <div className="flex justify-between items-start">
                    <div className="p-2.5 bg-white rounded-xl text-[#22C55E] shadow-sm">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div className="p-1 px-2.5 bg-[#F0FDF4] rounded-full flex items-center gap-1 text-[#22C55E] text-xs font-bold border border-[#DCFCE7]">
                      <TrendingUp className="w-3 h-3" /> 12%
                    </div>
                  </div>
                  <div>
                    <h4 className="text-slate-500 font-medium text-sm mt-4">Steps Today</h4>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-bold text-slate-900">{extraData.wearable.todayMetrics.steps.toLocaleString()}</span>
                      <span className="text-slate-400 font-medium text-xs">steps</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sleep Card */}
              {extraData.wearable?.todayMetrics?.sleepHours && (
                <div className="bg-[#F5F3FF] rounded-3xl p-6 border border-[#EDE9FE] hover:shadow-lg transition-all group flex flex-col justify-between h-full min-h-[140px]">
                  <div className="flex justify-between items-start">
                    <div className="p-2.5 bg-white rounded-xl text-[#8B5CF6] shadow-sm">
                      <Moon className="w-6 h-6" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-slate-500 font-medium text-sm mt-4">Sleep</h4>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-bold text-slate-900">{extraData.wearable.todayMetrics.sleepHours}</span>
                      <span className="text-slate-400 font-medium text-xs">hours</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Initial message if no metrics captured */}
              {!extraData.metrics?.heart_rate && !extraData.metrics?.blood_pressure && !extraData.wearable?.todayMetrics?.steps && (
                <div className="col-span-full py-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <p className="text-slate-500 font-medium">No health metrics captured yet. Start logging data to see insights here.</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Health Insights */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-slate-900">AI Health Insights</h3>
            </div>
            <div className="bg-[#F8FAFF] rounded-[2rem] p-6 md:p-8 border border-[#EBF2FF] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative flex gap-5 md:gap-6">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-3xl bg-white shadow-sm flex items-center justify-center flex-shrink-0 text-purple-600">
                  <Activity className="w-8 h-8 md:w-10 md:h-10" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-lg md:text-xl font-bold text-slate-900">Great Progress!</h4>
                  <p className="text-slate-600 leading-relaxed max-w-2xl text-sm md:text-base">
                    {user?.healthAnalysis?.summary || "Your cardiovascular health has improved by 12% this month. Keep maintaining your exercise routine for optimal results and better longevity."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Sections: Activity & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Profile & Goal Summaries - Single Page Edit */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-slate-900">Personalize Your Health</h3>
              <div className="space-y-4">
                {/* Profile Details Card - Editable in place */}
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
                                <option value="non-vegetarian">Non-Vegetarian</option>
                                <option value="vegetarian">Vegetarian</option>
                                <option value="vegan">Vegan</option>
                                <option value="eggetarian">Eggetarian</option>
                              </select>
                            </div>
                          </div>

                          {/* Lifestyle Habits */}
                          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                            <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sleep (Hours)</label>
                              <input
                                type="number"
                                name="profile.lifestyle.sleepHours"
                                value={formData.profile.lifestyle.sleepHours}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-slate-800"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Water (Glasses)</label>
                              <input
                                type="number"
                                name="profile.lifestyle.waterIntake"
                                value={formData.profile.lifestyle.waterIntake}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-slate-800"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Stress Level</label>
                              <select
                                name="profile.lifestyle.stressLevel"
                                value={formData.profile.lifestyle.stressLevel}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-slate-800"
                              >
                                <option value="low">Low</option>
                                <option value="moderate">Moderate</option>
                                <option value="high">High</option>
                              </select>
                            </div>
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
                          {formData.profile.diabetesProfile && (
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
                          className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                          {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                          Update Profile Info
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                {/* Fitness Goal Card - Editable in place */}
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
                              <option value="muscle_gain">Muscle Gain</option>
                              <option value="maintenance">Maintenance</option>
                            </select>
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
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Activity Level</label>
                            <select
                              name="activityLevel"
                              value={goalFormData.activityLevel}
                              onChange={handleGoalChange}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4"
                            >
                              <option value="sedentary">Sedentary</option>
                              <option value="moderate">Moderate</option>
                              <option value="active">Very Active</option>
                            </select>
                          </div>
                        </div>

                        {healthGoal && (
                          <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 grid grid-cols-3 gap-2">
                            <div>
                              <p className="text-[10px] font-bold text-orange-400 uppercase">Calories</p>
                              <p className="font-bold text-orange-700">{healthGoal.dailyCalorieTarget}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-orange-400 uppercase">Protein</p>
                              <p className="font-bold text-orange-700">{healthGoal.macroTargets.protein}g</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-orange-400 uppercase">Carbs</p>
                              <p className="font-bold text-orange-700">{healthGoal.macroTargets.carbs}g</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-orange-400 uppercase">Fats</p>
                              <p className="font-bold text-orange-700">{healthGoal.macroTargets.fats}g</p>
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

            {/* Quick Actions & Settings */}
            <div className="space-y-10">
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-slate-900">Account Control</h3>
                <div className="space-y-3">
                  <button className="w-full flex items-center justify-between p-5 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <h4 className="font-bold text-slate-900">Medical History</h4>
                        <p className="text-sm text-slate-500">View your medical reports</p>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-slate-600 transition-colors" />
                  </button>
                  <button
                    onClick={logout}
                    className="w-full flex items-center justify-between p-5 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all group lg:mt-6"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center">
                        <LogOut className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <h4 className="font-bold text-slate-900">Sign Out</h4>
                        <p className="text-sm text-slate-500">Securely exit your account</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-bold text-slate-900">Preferences</h3>
                <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100">
                        <Bell className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">Notifications</h4>
                        <p className="text-xs text-slate-500">Health & goal reminders</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2563EB]"></div>
                    </label>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
