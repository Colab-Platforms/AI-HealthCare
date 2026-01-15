import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { healthService } from '../services/api';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  User, Save, Activity, TrendingUp, TrendingDown, FileText, 
  Heart, AlertCircle, ChevronRight, Camera, Mail, Phone, Upload
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [healthHistory, setHealthHistory] = useState(null);
  const [selectedType, setSelectedType] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
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
    const fetchHistory = async () => {
      try {
        const { data } = await healthService.getHistory();
        setHealthHistory(data);
        const types = Object.keys(data.history || {});
        if (types.length > 0) setSelectedType(types[0]);
      } catch (error) {
        console.error('Failed to fetch health history:', error);
      }
    };
    fetchHistory();
  }, []);

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
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
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
  const chartData = healthHistory?.history?.[selectedType]?.map(r => ({
    date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: r.healthScore || 0
  })).reverse() || [];
  const reportTypes = Object.keys(healthHistory?.history || {});

  const getHealthTrend = () => {
    if (!chartData || chartData.length < 2) return null;
    const latest = chartData[chartData.length - 1]?.score || 0;
    const previous = chartData[chartData.length - 2]?.score || 0;
    const diff = latest - previous;
    return { diff, trend: diff > 0 ? 'improved' : diff < 0 ? 'declined' : 'stable' };
  };
  const healthTrend = getHealthTrend();

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
        <p className="text-slate-500 mt-1">Manage your information and track health progress</p>
      </div>

      {/* Profile Header Card */}
      <div className="bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl p-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
        </div>
        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl font-bold">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center text-cyan-600 shadow-lg hover:scale-110 transition-transform">
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">{user?.name}</h2>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-white/90">
              <span className="flex items-center gap-1"><Mail className="w-4 h-4" /> {user?.email}</span>
              {user?.phone && <span className="flex items-center gap-1"><Phone className="w-4 h-4" /> {user?.phone}</span>}
            </div>
          </div>
          <div className="flex gap-4">
            <div className="text-center p-4 bg-white/10 backdrop-blur-sm rounded-xl">
              <p className="text-3xl font-bold">{user?.healthMetrics?.healthScore || '--'}</p>
              <p className="text-sm text-white/80">Health Score</p>
            </div>
            {bmi && (
              <div className="text-center p-4 bg-white/10 backdrop-blur-sm rounded-xl">
                <p className="text-3xl font-bold">{bmi}</p>
                <p className="text-sm text-white/80">BMI</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
        {[{ id: 'profile', label: 'Edit Profile', icon: User }, { id: 'history', label: 'Health History', icon: Activity }].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)} 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === tab.id 
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
        <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-cyan-500" />
                Basic Information
              </h3>
              <div className="grid md:grid-cols-2 gap-5">
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
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
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
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Medical History
              </h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Allergies <span className="text-slate-400 font-normal">(comma separated)</span>
                  </label>
                  <input 
                    type="text" 
                    name="profile.allergies" 
                    value={formData.profile.allergies} 
                    onChange={handleChange} 
                    className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4 text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none" 
                    placeholder="e.g., Penicillin, Peanuts" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Chronic Conditions <span className="text-slate-400 font-normal">(comma separated)</span>
                  </label>
                  <input 
                    type="text" 
                    name="profile.chronicConditions" 
                    value={formData.profile.chronicConditions} 
                    onChange={handleChange} 
                    className="w-full bg-white border border-slate-300 rounded-xl py-3 px-4 text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none" 
                    placeholder="e.g., Diabetes, Hypertension" 
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
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

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-600">Total Reports</span>
                  <span className="font-bold text-slate-800">{healthHistory?.totalReports || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-600">Report Types</span>
                  <span className="font-bold text-slate-800">{reportTypes.length}</span>
                </div>
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

      {activeTab === 'history' && (
        <div className="space-y-6">
          {reportTypes.length > 0 ? (
            <>
              {/* Health Score Trend Chart */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Health Score Trend</h3>
                    <p className="text-sm text-slate-500">Track your progress over time</p>
                  </div>
                  <select 
                    value={selectedType} 
                    onChange={(e) => setSelectedType(e.target.value)} 
                    className="bg-white border border-slate-300 rounded-xl py-2 px-4 text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
                  >
                    {reportTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {chartData.length > 1 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="historyGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                      <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }} 
                        labelStyle={{ color: '#475569' }} 
                      />
                      <Area type="monotone" dataKey="score" stroke="#06b6d4" strokeWidth={3} fill="url(#historyGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>Upload more reports to see your health trend</p>
                  </div>
                )}
              </div>

              {/* Recent Reports */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Recent {selectedType} Reports</h3>
                <div className="space-y-3">
                  {healthHistory?.history?.[selectedType]?.slice(0, 5).map((report, i) => {
                    const prevReport = healthHistory.history[selectedType][i + 1];
                    const scoreDiff = prevReport ? report.healthScore - prevReport.healthScore : null;
                    return (
                      <Link 
                        key={report._id} 
                        to={`/reports/${report._id}`} 
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all group border border-slate-200"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-cyan-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">
                              {new Date(report.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                            <p className="text-sm text-slate-500">
                              {report.keyFindings?.slice(0, 2).join(', ') || 'View details'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {scoreDiff !== null && (
                            <span className={`text-sm font-semibold ${
                              scoreDiff > 0 ? 'text-emerald-600' : scoreDiff < 0 ? 'text-red-600' : 'text-slate-500'
                            }`}>
                              {scoreDiff > 0 ? '+' : ''}{scoreDiff}
                            </span>
                          )}
                          <span className="text-2xl font-bold text-cyan-600">{report.healthScore || '--'}</span>
                          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-cyan-500 transition-colors" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center py-16 shadow-sm">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-800 mb-2">No Health History Yet</h3>
              <p className="text-slate-500 mb-6">Upload health reports to track your progress over time</p>
              <Link 
                to="/upload" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                <Upload className="w-5 h-5" />
                Upload Your First Report
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
