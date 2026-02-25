import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import axios from 'axios';
import {
  User, Save, Heart, AlertCircle, Camera, Mail, Phone, Target,
  Activity, Droplet, Cigarette, Wine, Moon, Apple, Dumbbell, Pill, Bell
} from 'lucide-react';
import toast from 'react-hot-toast';
import BMIWidget from '../components/BMIWidget';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
  const [healthGoal, setHealthGoal] = useState(null);
  const [goalLoading, setGoalLoading] = useState(false);
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

  useEffect(() => {
    const fetchHealthGoal = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/nutrition/goals', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.healthGoal) {
          setHealthGoal(response.data.healthGoal);
          setGoalFormData({
            goalType: response.data.healthGoal.goalType,
            currentWeight: response.data.healthGoal.currentWeight,
            targetWeight: response.data.healthGoal.targetWeight,
            height: response.data.healthGoal.height,
            age: response.data.healthGoal.age,
            gender: response.data.healthGoal.gender,
            activityLevel: response.data.healthGoal.activityLevel,
            dietaryPreference: response.data.healthGoal.dietaryPreference
          });
        }
      } catch (error) {
        console.log('No health goal set yet');
      }
    };

    fetchHealthGoal();
  }, []);

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
      const { data } = await api.put('/auth/profile', payload);
      updateUser(data);
      toast.success('Profile updated successfully!');
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

      const response = await axios.post('/api/nutrition/goals', payload, {
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

  return (
    <div className="w-full overflow-x-hidden space-y-6 animate-fade-in px-3 md:px-6">
      {/* Welcome Message - Mobile Only */}
      <div className="md:hidden flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold shadow-md flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <h1 className="text-sm font-bold text-slate-800 truncate">
            {(() => {
              const hour = new Date().getHours();
              if (hour < 12) return 'Good Morning';
              if (hour < 18) return 'Good Afternoon';
              return 'Good Evening';
            })()}, {user?.name?.split(' ')[0] || 'there'}!
          </h1>
        </div>
        <button className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:shadow-lg transition-all flex-shrink-0">
          <Bell className="w-4 h-4 text-slate-700" />
        </button>
      </div>

      <div className="hidden md:block">
        <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
        <p className="text-slate-500 mt-1">Manage your information and track health progress</p>
      </div>

      {/* Profile Header Card */}
      <div className="bg-gradient-to-r from-purple-500 to-orange-500 rounded-2xl p-3 md:p-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
        </div>
        <div className="relative flex flex-col gap-4 md:gap-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
            <div className="relative">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl md:text-3xl font-bold">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center text-cyan-600 shadow-lg hover:scale-110 transition-transform">
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1">
              <h2 className="text-xl md:text-2xl font-bold">{user?.name}</h2>
              <div className="flex flex-col gap-2 mt-2 text-white/90 text-sm md:text-base">
                <span className="flex items-center gap-1"><Mail className="w-4 h-4 flex-shrink-0" /> {user?.email}</span>
                {user?.phone && <span className="flex items-center gap-1"><Phone className="w-4 h-4 flex-shrink-0" /> {user?.phone}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-3 md:gap-4">
            <div className="text-center p-3 md:p-4 bg-white/10 backdrop-blur-sm rounded-xl flex-1">
              <p className="text-2xl md:text-3xl font-bold">{user?.healthMetrics?.healthScore || '--'}</p>
              <p className="text-xs md:text-sm text-white/80">Health Score</p>
            </div>
            {bmi && (
              <div className="text-center p-3 md:p-4 bg-white/10 backdrop-blur-sm rounded-xl flex-1">
                <p className="text-2xl md:text-3xl font-bold">{bmi}</p>
                <p className="text-xs md:text-sm text-white/80">BMI</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BMI Widget */}
      <BMIWidget />

      {/* Tabs */}
      <div className="flex gap-1 md:gap-2 p-1 bg-slate-100 rounded-xl w-full md:w-fit overflow-x-auto">
        {[
          { id: 'profile', label: 'Profile', icon: User },
          { id: 'goals', label: 'Set Goal', icon: Target }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1 md:gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-lg font-medium transition-all whitespace-nowrap text-sm md:text-base ${activeTab === tab.id
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3 md:p-6 shadow-sm">
              <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4 md:mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-cyan-500" />
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4 text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={user?.email}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-500"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Age</label>
                  <input
                    type="number"
                    name="profile.age"
                    value={formData.profile.age}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4 text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
                    min="1"
                    max="120"
                    placeholder="Enter your age"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
                  <select
                    name="profile.gender"
                    value={formData.profile.gender}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4 text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Dietary Preference</label>
                  <select
                    name="profile.dietaryPreference"
                    value={formData.profile.dietaryPreference}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4 text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
                  >
                    <option value="non-vegetarian">Non-Vegetarian</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="eggetarian">Eggetarian</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Health Information */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3 md:p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500" />
                Health Information
              </h3>
              <div className="grid md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Height (cm)</label>
                  <input
                    type="number"
                    name="profile.height"
                    value={formData.profile.height}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4 text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
                    min="50"
                    max="300"
                    placeholder="170"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Weight (kg)</label>
                  <input
                    type="number"
                    name="profile.weight"
                    value={formData.profile.weight}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4 text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
                    min="10"
                    max="500"
                    placeholder="70"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Blood Group</label>
                  <select
                    name="profile.bloodGroup"
                    value={formData.profile.bloodGroup}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4 text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
                  >
                    <option value="">Select</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Medical History */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3 md:p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Medical Conditions
              </h3>
              <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-700">
                  Chronic Conditions <span className="text-slate-400 font-normal">(comma separated)</span>
                </label>
                <input
                  type="text"
                  name="profile.medicalHistory.conditions"
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
                  className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4 text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
                  placeholder="e.g., Diabetes, Hypertension"
                />
              </div>
            </div>

            {/* Diabetes Profile (if applicable) */}
            {formData.profile.diabetesProfile && (
              <div className="bg-white rounded-2xl border border-slate-200 p-3 md:p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Pill className="w-5 h-5 text-purple-500" />
                  Diabetes Management
                </h3>
                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Diabetes Type</label>
                    <select
                      name="profile.diabetesProfile.type"
                      value={formData.profile.diabetesProfile.type}
                      onChange={handleChange}
                      className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4"
                    >
                      <option value="Type 1">Type 1</option>
                      <option value="Type 2">Type 2</option>
                      <option value="Prediabetes">Prediabetes</option>
                      <option value="Gestational">Gestational</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">HbA1c Level (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      name="profile.diabetesProfile.hba1c"
                      value={formData.profile.diabetesProfile.hba1c}
                      onChange={handleChange}
                      className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Diagnosis Year</label>
                    <input
                      type="number"
                      name="profile.diabetesProfile.diagnosisYear"
                      value={formData.profile.diabetesProfile.diagnosisYear}
                      onChange={handleChange}
                      className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Current Status</label>
                    <select
                      name="profile.diabetesProfile.status"
                      value={formData.profile.diabetesProfile.status}
                      onChange={handleChange}
                      className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4"
                    >
                      <option value="Controlled">Controlled</option>
                      <option value="Uncontrolled">Uncontrolled</option>
                      <option value="Newly diagnosed">Newly diagnosed</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Lifestyle Habits */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3 md:p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-500" />
                Lifestyle Habits
              </h3>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Sleep Hours</label>
                  <input
                    type="number"
                    name="profile.lifestyle.sleepHours"
                    value={formData.profile.lifestyle.sleepHours}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4 text-slate-800 focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Water Intake (glasses)</label>
                  <input
                    type="number"
                    name="profile.lifestyle.waterIntake"
                    value={formData.profile.lifestyle.waterIntake}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4 text-slate-800 focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Stress Level</label>
                  <select
                    name="profile.lifestyle.stressLevel"
                    value={formData.profile.lifestyle.stressLevel}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4 text-slate-800 focus:border-cyan-500"
                  >
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="flex flex-col gap-4 justify-center">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="profile.lifestyle.smoker"
                      checked={formData.profile.lifestyle.smoker}
                      onChange={handleChange}
                      className="w-5 h-5 text-cyan-500 rounded border-slate-300 focus:ring-cyan-500"
                    />
                    <span className="text-slate-700 font-medium">Smoker</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="profile.lifestyle.alcohol"
                      checked={formData.profile.lifestyle.alcohol}
                      onChange={handleChange}
                      className="w-5 h-5 text-cyan-500 rounded border-slate-300 focus:ring-cyan-500"
                    />
                    <span className="text-slate-700 font-medium">Consume Alcohol</span>
                  </label>
                </div>
              </div>
            </div>



            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-orange-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {bmi && (
              <div className="bg-white rounded-2xl border border-slate-200 p-3 md:p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">BMI Calculator</h3>
                <div className="text-center">
                  <div className={`w-24 h-24 rounded-full bg-${bmiStatus.color}-100 flex items-center justify-center mx-auto mb-4`}>
                    <span className={`text-3xl font-bold text-${bmiStatus.color}-600`}>{bmi}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium bg-${bmiStatus.color}-100 text-${bmiStatus.color}-700`}>
                    {bmiStatus.label}
                  </span>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-3 md:p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-600">Subscription</span>
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium capitalize">
                    {user?.subscription?.plan || 'Free'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {activeTab === 'goals' && (
        <form onSubmit={handleGoalSubmit} className="max-w-4xl space-y-6">
          {/* Current Goal Display */}
          {healthGoal && (
            <div className="bg-gradient-to-br from-purple-50 to-orange-50 rounded-2xl border-2 border-blue-200 p-3 md:p-6 shadow-sm w-full overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4 mb-4">
                <div className="flex-1">
                  <h3 className="text-lg md:text-xl font-bold text-blue-900 mb-1">Your Current Goal</h3>
                  <p className="text-xs md:text-sm text-blue-700">Daily targets calculated based on your goal</p>
                </div>
                <div className="px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold capitalize text-sm md:text-base whitespace-nowrap">
                  {healthGoal.goalType.replace('_', ' ')}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mt-4">
                <div className="bg-white p-2 md:p-4 rounded-xl">
                  <p className="text-xs md:text-sm text-slate-600 mb-1">Daily Calories</p>
                  <p className="text-lg md:text-2xl font-bold text-slate-800 truncate">{healthGoal.dailyCalorieTarget}</p>
                </div>
                <div className="bg-white p-2 md:p-4 rounded-xl">
                  <p className="text-xs md:text-sm text-slate-600 mb-1">Protein</p>
                  <p className="text-lg md:text-2xl font-bold text-slate-800 truncate">{healthGoal.macroTargets.protein}g</p>
                </div>
                <div className="bg-white p-2 md:p-4 rounded-xl">
                  <p className="text-xs md:text-sm text-slate-600 mb-1">Carbs</p>
                  <p className="text-lg md:text-2xl font-bold text-slate-800 truncate">{healthGoal.macroTargets.carbs}g</p>
                </div>
                <div className="bg-white p-2 md:p-4 rounded-xl">
                  <p className="text-xs md:text-sm text-slate-600 mb-1">Fats</p>
                  <p className="text-lg md:text-2xl font-bold text-slate-800 truncate">{healthGoal.macroTargets.fats}g</p>
                </div>
              </div>
            </div>
          )}

          {/* Goal Setting Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 md:p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              {healthGoal ? 'Update Your Fitness Goal' : 'Set Your Fitness Goal'}
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Goal Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Goal Type</label>
                <select
                  name="goalType"
                  value={goalFormData.goalType}
                  onChange={handleGoalChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  required
                >
                  <option value="weight_loss">Weight Loss (Fat Loss)</option>
                  <option value="muscle_gain">Muscle Gain (Bulking)</option>
                  <option value="weight_gain">Weight Gain</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="health_improvement">Health Improvement</option>
                </select>
              </div>

              {/* Activity Level */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Activity Level</label>
                <select
                  name="activityLevel"
                  value={goalFormData.activityLevel}
                  onChange={handleGoalChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  required
                >
                  <option value="sedentary">Sedentary (Little or no exercise)</option>
                  <option value="light">Light (Exercise 1-3 days/week)</option>
                  <option value="moderate">Moderate (Exercise 3-5 days/week)</option>
                  <option value="active">Active (Exercise 6-7 days/week)</option>
                  <option value="very_active">Very Active (Hard exercise daily)</option>
                </select>
              </div>

              {/* Current Weight */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Current Weight (kg)</label>
                <input
                  type="number"
                  name="currentWeight"
                  value={goalFormData.currentWeight}
                  onChange={handleGoalChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  required
                  min="30"
                  max="300"
                  step="0.1"
                />
              </div>

              {/* Target Weight */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Target Weight (kg)</label>
                <input
                  type="number"
                  name="targetWeight"
                  value={goalFormData.targetWeight}
                  onChange={handleGoalChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  required
                  min="30"
                  max="300"
                  step="0.1"
                />
              </div>

              {/* Height */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Height (cm)</label>
                <input
                  type="number"
                  name="height"
                  value={goalFormData.height}
                  onChange={handleGoalChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  required
                  min="100"
                  max="250"
                />
              </div>

              {/* Age */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Age</label>
                <input
                  type="number"
                  name="age"
                  value={goalFormData.age}
                  onChange={handleGoalChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  required
                  min="10"
                  max="120"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
                <select
                  name="gender"
                  value={goalFormData.gender}
                  onChange={handleGoalChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  required
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Dietary Preference */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Dietary Preference</label>
                <select
                  name="dietaryPreference"
                  value={goalFormData.dietaryPreference}
                  onChange={handleGoalChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  required
                >
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="non-vegetarian">Non-Vegetarian</option>
                  <option value="eggetarian">Eggetarian</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={goalLoading}
              className="mt-6 w-full md:w-auto px-8 py-3 bg-gradient-to-r from-purple-500 to-orange-500 text-white rounded-lg font-medium hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Target className="w-5 h-5" />
              {goalLoading ? 'Calculating...' : healthGoal ? 'Update Goal' : 'Set Goal & Calculate Targets'}
            </button>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">How it works (Scientifically Backed)</p>
                <p className="text-sm text-blue-700 mb-2">
                  We use the <strong>Mifflin-St Jeor equation</strong> (industry standard used by WHO, fitness apps, and hospitals) to calculate your BMR:
                </p>
                <p className="text-xs text-blue-600 font-mono mb-2">
                  Male: BMR = (10 × weight) + (6.25 × height) − (5 × age) + 5<br />
                  Female: BMR = (10 × weight) + (6.25 × height) − (5 × age) − 161
                </p>
                <p className="text-sm text-blue-700 mb-2">
                  Then we calculate TDEE (Total Daily Energy Expenditure) by multiplying BMR with your activity level, and adjust calories based on your goal:
                </p>
                <ul className="text-xs text-blue-600 space-y-1 ml-4">
                  <li>• Muscle Gain: +350 calories</li>
                  <li>• Fat Loss: -400 calories</li>
                  <li>• Maintenance: No adjustment</li>
                </ul>
                <p className="text-sm text-blue-700 mt-2">
                  <strong>Macros:</strong> Protein = 1.6g per kg body weight (realistic & sustainable), Fats = 0.8g per kg, Carbs = remaining calories. These targets will be used throughout the platform to track your nutrition and provide personalized recommendations.
                </p>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
