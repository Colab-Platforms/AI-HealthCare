import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { healthService } from '../services/api';
import axios from 'axios';
import { 
  User, Activity, Heart, AlertCircle, Mail, Phone, Target,
  TrendingUp, Award, Edit, Check, X, Sparkles, Beef, Wheat, Droplet, FileText, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [healthHistory, setHealthHistory] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [healthGoal, setHealthGoal] = useState(null);
  const [goalLoading, setGoalLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
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
      allergies: user?.profile?.allergies?.join(', ') || '',
      chronicConditions: user?.profile?.chronicConditions?.join(', ') || ''
    }
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchHistory();
    fetchHealthGoal();
    
    // Handle URL parameter for tab navigation
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'goals') {
      setActiveTab('goals');
    }
  }, [location.search]);

  const fetchHistory = async () => {
    try {
      const { data } = await healthService.getHistory();
      setHealthHistory(data);
    } catch (error) {
      console.error('Failed to fetch health history:', error);
    }
  };
  
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('profile.')) {
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
          allergies: formData.profile.allergies ? formData.profile.allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
          chronicConditions: formData.profile.chronicConditions ? formData.profile.chronicConditions.split(',').map(s => s.trim()).filter(Boolean) : []
        }
      };
      const { data } = await api.put('/auth/profile', payload);
      updateUser(data);
      setEditMode(false);
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
      toast.success('Fitness goal set successfully!');
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
    if (!bmi) return { label: 'N/A', color: 'slate', gradient: 'from-slate-400 to-slate-500' };
    if (bmi < 18.5) return { label: 'Underweight', color: 'blue', gradient: 'from-blue-400 to-blue-500' };
    if (bmi < 25) return { label: 'Normal', color: 'emerald', gradient: 'from-emerald-400 to-emerald-500' };
    if (bmi < 30) return { label: 'Overweight', color: 'amber', gradient: 'from-amber-400 to-amber-500' };
    return { label: 'Obese', color: 'red', gradient: 'from-red-400 to-red-500' };
  };

  const bmiStatus = getBmiStatus(parseFloat(bmi));

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-cyan-100 pb-20">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in p-4">

        {/* Hero Header - Compact on Mobile */}
        <div className="relative overflow-hidden bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500 rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 sm:w-64 sm:h-64 bg-white/10 rounded-full -mr-16 sm:-mr-32 -mt-16 sm:-mt-32" />
          <div className="absolute bottom-0 left-0 w-24 h-24 sm:w-48 sm:h-48 bg-white/10 rounded-full -ml-12 sm:-ml-24 -mb-12 sm:-mb-24" />
          
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 md:gap-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl sm:rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl sm:text-3xl md:text-4xl font-bold border-2 sm:border-4 border-white/30">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">{user?.name}</h1>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-3 text-white/90 text-xs sm:text-sm">
                  <span className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2">
                    <Mail className="w-3 h-3 sm:w-4 sm:h-4" /> {user?.email}
                  </span>
                  {user?.phone && (
                    <span className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2">
                      <Phone className="w-3 h-3 sm:w-4 sm:h-4" /> {user?.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mt-3 sm:mt-4 md:mt-6">
              <div className="text-center p-2 sm:p-3 md:p-4 bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl">
                <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-1 sm:mb-2">
                  <Heart className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                </div>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold">{user?.healthMetrics?.healthScore || '--'}</p>
                <p className="text-[10px] sm:text-xs md:text-sm text-white/80">Health Score</p>
              </div>
              {bmi && (
                <div className="text-center p-2 sm:p-3 md:p-4 bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-1 sm:mb-2">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                  </div>
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold">{bmi}</p>
                  <p className="text-[10px] sm:text-xs md:text-sm text-white/80">BMI</p>
                </div>
              )}
              <div className="text-center p-2 sm:p-3 md:p-4 bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl">
                <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-1 sm:mb-2">
                  <Activity className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                </div>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold">{healthHistory?.totalReports || 0}</p>
                <p className="text-[10px] sm:text-xs md:text-sm text-white/80">Reports</p>
              </div>
              <div className="text-center p-2 sm:p-3 md:p-4 bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl">
                <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-1 sm:mb-2">
                  <Award className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                </div>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold capitalize">{user?.subscription?.plan || 'Free'}</p>
                <p className="text-[10px] sm:text-xs md:text-sm text-white/80">Plan</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-white rounded-2xl shadow-lg w-full md:w-fit overflow-x-auto">
          {[
            { id: 'profile', label: 'Profile', icon: User }, 
            { id: 'goals', label: 'Fitness Goals', icon: Target }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'profile' && (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information with BMI */}
              <div className="bg-white rounded-3xl shadow-lg p-4 sm:p-6 border-2 border-cyan-100">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <span className="text-base sm:text-xl">Basic Information</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditMode(!editMode)}
                    className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-medium transition-all flex items-center gap-1 sm:gap-2 text-xs sm:text-sm ${
                      editMode 
                        ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                        : 'bg-cyan-100 text-cyan-600 hover:bg-cyan-200'
                    }`}
                  >
                    {editMode ? <><X className="w-3 h-3 sm:w-4 sm:h-4" /> Cancel</> : <><Edit className="w-3 h-3 sm:w-4 sm:h-4" /> Edit</>}
                  </button>
                </div>

                {/* BMI Calculator - Show at top on mobile */}
                {bmi && (
                  <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl border-2 border-cyan-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-xs sm:text-sm text-slate-600 mb-1">Your BMI</p>
                        <div className="flex items-center gap-3">
                          <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br ${bmiStatus.gradient} flex items-center justify-center shadow-lg`}>
                            <span className="text-2xl sm:text-3xl font-bold text-white">{bmi}</span>
                          </div>
                          <div>
                            <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-${bmiStatus.color}-100 text-${bmiStatus.color}-700`}>
                              {bmiStatus.label}
                            </span>
                            <p className="text-xs text-slate-500 mt-1">Body Mass Index</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-3 sm:gap-5">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                    <input 
                      type="text" 
                      name="name" 
                      value={formData.name} 
                      onChange={handleChange} 
                      disabled={!editMode}
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-2 sm:py-3 px-3 sm:px-4 text-sm sm:text-base text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none disabled:opacity-60" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">Email</label>
                    <input 
                      type="email" 
                      value={user?.email} 
                      className="w-full bg-slate-100 border-2 border-slate-200 rounded-xl py-2 sm:py-3 px-3 sm:px-4 text-sm sm:text-base text-slate-500" 
                      disabled 
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">Age</label>
                    <input 
                      type="number" 
                      name="profile.age" 
                      value={formData.profile.age} 
                      onChange={handleChange} 
                      disabled={!editMode}
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-2 sm:py-3 px-3 sm:px-4 text-sm sm:text-base text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none disabled:opacity-60" 
                      min="1" 
                      max="120" 
                      placeholder="Enter your age" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">Gender</label>
                    <select 
                      name="profile.gender" 
                      value={formData.profile.gender} 
                      onChange={handleChange} 
                      disabled={!editMode}
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-2 sm:py-3 px-3 sm:px-4 text-sm sm:text-base text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none disabled:opacity-60"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">Dietary Preference</label>
                    <select 
                      name="profile.dietaryPreference" 
                      value={formData.profile.dietaryPreference} 
                      onChange={handleChange} 
                      disabled={!editMode}
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-2 sm:py-3 px-3 sm:px-4 text-sm sm:text-base text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none disabled:opacity-60"
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
              <div className="bg-white rounded-3xl shadow-lg p-4 sm:p-6 border-2 border-red-100">
                <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-4 sm:mb-6 flex items-center gap-2">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center">
                    <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <span className="text-base sm:text-xl">Health Information</span>
                </h3>
                <div className="grid md:grid-cols-3 gap-3 sm:gap-5">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">Height (cm)</label>
                    <input 
                      type="number" 
                      name="profile.height" 
                      value={formData.profile.height} 
                      onChange={handleChange} 
                      disabled={!editMode}
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-2 sm:py-3 px-3 sm:px-4 text-sm sm:text-base text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none disabled:opacity-60" 
                      min="50" 
                      max="300" 
                      placeholder="170" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">Weight (kg)</label>
                    <input 
                      type="number" 
                      name="profile.weight" 
                      value={formData.profile.weight} 
                      onChange={handleChange} 
                      disabled={!editMode}
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-2 sm:py-3 px-3 sm:px-4 text-sm sm:text-base text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none disabled:opacity-60" 
                      min="10" 
                      max="500" 
                      placeholder="70" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">Blood Group</label>
                    <select 
                      name="profile.bloodGroup" 
                      value={formData.profile.bloodGroup} 
                      onChange={handleChange} 
                      disabled={!editMode}
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-2 sm:py-3 px-3 sm:px-4 text-sm sm:text-base text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none disabled:opacity-60"
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
              <div className="bg-white rounded-3xl shadow-lg p-4 sm:p-6 border-2 border-amber-100">
                <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-4 sm:mb-6 flex items-center gap-2">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <span className="text-base sm:text-xl">Medical History</span>
                </h3>
                <div className="space-y-3 sm:space-y-5">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">
                      Allergies <span className="text-slate-400 font-normal">(comma separated)</span>
                    </label>
                    <input 
                      type="text" 
                      name="profile.allergies" 
                      value={formData.profile.allergies} 
                      onChange={handleChange} 
                      disabled={!editMode}
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-2 sm:py-3 px-3 sm:px-4 text-sm sm:text-base text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none disabled:opacity-60" 
                      placeholder="e.g., Penicillin, Peanuts" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">
                      Chronic Conditions <span className="text-slate-400 font-normal">(comma separated)</span>
                    </label>
                    <input 
                      type="text" 
                      name="profile.chronicConditions" 
                      value={formData.profile.chronicConditions} 
                      onChange={handleChange} 
                      disabled={!editMode}
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-2 sm:py-3 px-3 sm:px-4 text-sm sm:text-base text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none disabled:opacity-60" 
                      placeholder="e.g., Diabetes, Hypertension" 
                    />
                  </div>
                </div>
              </div>

              {editMode && (
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full py-3 sm:py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-2xl hover:shadow-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-base sm:text-lg"
                >
                  {loading ? (
                    <div className="w-5 h-5 sm:w-6 sm:h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5 sm:w-6 sm:h-6" />
                      Save Changes
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Sidebar - Quick Stats Only */}
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-purple-500 to-indigo-500 rounded-3xl shadow-lg p-4 sm:p-6 text-white">
                <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                  Quick Stats
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <span className="text-xs sm:text-sm">Total Reports</span>
                    <span className="font-bold text-lg sm:text-xl">{healthHistory?.totalReports || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <span className="text-xs sm:text-sm">Report Types</span>
                    <span className="font-bold text-lg sm:text-xl">{Object.keys(healthHistory?.history || {}).length}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <span className="text-xs sm:text-sm">Subscription</span>
                    <span className="px-2 sm:px-3 py-1 bg-white text-purple-600 rounded-lg text-xs sm:text-sm font-bold capitalize">
                      {user?.subscription?.plan || 'Free'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}

        {activeTab === 'goals' && (
          <form onSubmit={handleGoalSubmit} className="max-w-5xl space-y-6">
            {/* Current Goal Display - Compact on Mobile */}
            {healthGoal && (
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl sm:rounded-3xl border-2 sm:border-3 border-emerald-200 p-3 sm:p-4 md:p-6 shadow-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
                  <div>
                    <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-emerald-900 mb-0.5 sm:mb-1">Your Current Goal</h3>
                    <p className="text-xs sm:text-sm text-emerald-700">Daily targets calculated</p>
                  </div>
                  <div className="px-3 py-1 sm:px-4 sm:py-2 bg-emerald-600 text-white rounded-lg sm:rounded-xl font-bold capitalize text-xs sm:text-sm whitespace-nowrap">
                    {healthGoal.goalType.replace('_', ' ')}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mt-3 sm:mt-4 md:mt-6">
                  <div className="bg-white p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl shadow-md text-center">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center mx-auto mb-1 sm:mb-2">
                      <Target className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
                    </div>
                    <p className="text-[10px] sm:text-xs md:text-sm text-slate-600 mb-0.5 sm:mb-1">Daily Calories</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">{healthGoal.dailyCalorieTarget}</p>
                  </div>
                  <div className="bg-white p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl shadow-md text-center">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center mx-auto mb-1 sm:mb-2">
                      <Beef className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
                    </div>
                    <p className="text-[10px] sm:text-xs md:text-sm text-slate-600 mb-0.5 sm:mb-1">Protein</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">{healthGoal.macroTargets.protein}g</p>
                  </div>
                  <div className="bg-white p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl shadow-md text-center">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center mx-auto mb-1 sm:mb-2">
                      <Wheat className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
                    </div>
                    <p className="text-[10px] sm:text-xs md:text-sm text-slate-600 mb-0.5 sm:mb-1">Carbs</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">{healthGoal.macroTargets.carbs}g</p>
                  </div>
                  <div className="bg-white p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl shadow-md text-center">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center mx-auto mb-1 sm:mb-2">
                      <Droplet className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
                    </div>
                    <p className="text-[10px] sm:text-xs md:text-sm text-slate-600 mb-0.5 sm:mb-1">Fats</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-orange-600">{healthGoal.macroTargets.fats}g</p>
                  </div>
                </div>
              </div>
            )}

            {/* Goal Setting Form */}
            <div className="bg-white rounded-3xl shadow-lg p-6 border-2 border-cyan-100">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" />
                </div>
                {healthGoal ? 'Update Your Fitness Goal' : 'Set Your Fitness Goal'}
              </h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Goal Type</label>
                  <select
                    name="goalType"
                    value={goalFormData.goalType}
                    onChange={handleGoalChange}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none text-slate-900 bg-white"
                    required
                  >
                    <option value="weight_loss">Weight Loss (Fat Loss)</option>
                    <option value="muscle_gain">Muscle Gain (Bulking)</option>
                    <option value="weight_gain">Weight Gain</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="health_improvement">Health Improvement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Activity Level</label>
                  <select
                    name="activityLevel"
                    value={goalFormData.activityLevel}
                    onChange={handleGoalChange}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none text-slate-900 bg-white"
                    required
                  >
                    <option value="sedentary">Sedentary (Little or no exercise)</option>
                    <option value="light">Light (Exercise 1-3 days/week)</option>
                    <option value="moderate">Moderate (Exercise 3-5 days/week)</option>
                    <option value="active">Active (Exercise 6-7 days/week)</option>
                    <option value="very_active">Very Active (Hard exercise daily)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Current Weight (kg)</label>
                  <input
                    type="number"
                    name="currentWeight"
                    value={goalFormData.currentWeight}
                    onChange={handleGoalChange}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none text-slate-900 bg-white"
                    required
                    min="30"
                    max="300"
                    step="0.1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Target Weight (kg)</label>
                  <input
                    type="number"
                    name="targetWeight"
                    value={goalFormData.targetWeight}
                    onChange={handleGoalChange}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none text-slate-900 bg-white"
                    required
                    min="30"
                    max="300"
                    step="0.1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Height (cm)</label>
                  <input
                    type="number"
                    name="height"
                    value={goalFormData.height}
                    onChange={handleGoalChange}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none text-slate-900 bg-white"
                    required
                    min="100"
                    max="250"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Age</label>
                  <input
                    type="number"
                    name="age"
                    value={goalFormData.age}
                    onChange={handleGoalChange}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none text-slate-900 bg-white"
                    required
                    min="10"
                    max="120"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Gender</label>
                  <select
                    name="gender"
                    value={goalFormData.gender}
                    onChange={handleGoalChange}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none text-slate-900 bg-white"
                    required
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Dietary Preference</label>
                  <select
                    name="dietaryPreference"
                    value={goalFormData.dietaryPreference}
                    onChange={handleGoalChange}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none"
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
                className="mt-6 w-full py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold rounded-2xl hover:shadow-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-lg"
              >
                {goalLoading ? (
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Target className="w-6 h-6" />
                    {healthGoal ? 'Update Goal' : 'Set Goal'}
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Health Reports Section */}
        {healthHistory && healthHistory.history && Object.keys(healthHistory.history).length > 0 && (
          <div className="bg-white rounded-3xl shadow-lg p-6 border-2 border-cyan-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Health Reports</h3>
                <p className="text-sm text-slate-600">Your uploaded health reports by type</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(healthHistory.history).map(([reportType, reports]) => (
                <button
                  key={reportType}
                  onClick={() => navigate('/reports')}
                  className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-5 border-2 border-cyan-200 hover:border-cyan-400 hover:shadow-lg transition-all group text-left"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-cyan-600 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-lg mb-1 capitalize">
                    {reportType.replace(/([A-Z])/g, ' $1').trim()}
                  </h4>
                  <p className="text-sm text-slate-600 mb-2">
                    {reports.length} {reports.length === 1 ? 'report' : 'reports'}
                  </p>
                  {reports[0]?.healthScore && (
                    <div className="flex items-center gap-2 mt-2">
                      <Heart className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-semibold text-slate-700">
                        Latest: {reports[0].healthScore}/100
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between p-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl text-white">
              <div>
                <p className="text-sm text-cyan-100">Total Reports</p>
                <p className="text-2xl font-bold">{healthHistory.totalReports || 0}</p>
              </div>
              <button
                onClick={() => navigate('/reports')}
                className="px-6 py-3 bg-white text-cyan-600 rounded-xl font-bold hover:shadow-lg transition-all flex items-center gap-2"
              >
                View All
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
