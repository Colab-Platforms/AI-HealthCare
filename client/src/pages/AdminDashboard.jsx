import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { Users, FileText, Activity, AlertCircle, CheckCircle, XCircle, Calendar, Clock, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import GenericSkeleton from '../components/skeletons/GenericSkeleton';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const { data } = await adminService.getStats();
      setStats(data);
    } catch (error) {
      toast.error('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-12 h-12 border-4 border-black/20 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'users', label: 'User Management', icon: Users }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
        <p className="text-slate-500 mt-1">Manage platform settings and monitor activity</p>
      </div>

      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${activeTab === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab stats={stats} />}
      {activeTab === 'users' && <UsersTab />}
    </div>
  );
}

function OverviewTab({ stats }) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Users className="w-6 h-6 text-black" />
        </div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Patients</p>
        <p className="text-3xl font-black text-slate-900 mt-1">{stats.stats?.totalUsers || 0}</p>
      </div>
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <CheckCircle className="w-6 h-6 text-black" />
        </div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Active Today</p>
        <p className="text-3xl font-black text-slate-900 mt-1">{stats.stats?.activeUsers || 0}</p>
      </div>
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <FileText className="w-6 h-6 text-black" />
        </div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Processed Reports</p>
        <p className="text-3xl font-black text-slate-900 mt-1">{stats.stats?.totalReports || 0}</p>
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await adminService.getUsers();
      setUsers(data.users || []);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      await adminService.updateUserStatus(id, !currentStatus);
      setUsers(users.map(u => u._id === id ? { ...u, isActive: !currentStatus } : u));
      toast.success('User status updated');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const viewUserDetails = async (id) => {
    setViewLoading(true);
    try {
      const { data } = await adminService.getUserDetails(id);
      setSelectedUser({ ...data.user, activity: data.activity });
    } catch (error) {
      toast.error('Failed to load details');
    } finally {
      setViewLoading(false);
    }
  };

  if (loading) return <GenericSkeleton />;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="pb-4 px-4 text-xs font-bold text-slate-400 uppercase">User</th>
                <th className="pb-4 px-4 text-xs font-bold text-slate-400 uppercase">Status</th>
                <th className="pb-4 px-4 text-xs font-bold text-slate-400 uppercase">Registered</th>
                <th className="pb-4 px-4 text-xs font-bold text-slate-400 uppercase text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((user) => (
                <tr key={user._id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white font-bold">
                        {user.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${user.isActive ? 'bg-slate-100 text-black' : 'bg-slate-50 text-slate-500'
                      }`}>
                      {user.isActive ? 'Active' : 'Banned'}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-slate-500 font-medium">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => viewUserDetails(user._id)}
                        className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded-lg transition-all"
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(user._id, user.isActive)}
                        className={`p-2 rounded-lg transition-all ${user.isActive ? 'text-slate-400 hover:text-slate-900 hover:bg-slate-100' : 'text-black hover:bg-slate-50'
                          }`}
                      >
                        {user.isActive ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-black flex items-center justify-center text-white text-2xl font-black">
                  {selectedUser.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">{selectedUser.name}</h2>
                  <p className="text-slate-500 font-medium">{selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors shadow-sm"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Age / Gender</p>
                  <p className="text-lg font-bold text-slate-900">{selectedUser.profile?.age || 'N/A'} • {selectedUser.profile?.gender || 'N/A'}</p>
                </div>
                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Blood Group</p>
                  <p className="text-lg font-bold text-slate-900">{selectedUser.profile?.bloodGroup || 'N/A'}</p>
                </div>
                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Weight / Height</p>
                  <p className="text-lg font-bold text-slate-900">{selectedUser.profile?.weight}kg • {selectedUser.profile?.height}cm</p>
                </div>
                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Role</p>
                  <p className="text-lg font-bold text-black capitalize">{selectedUser.role}</p>
                </div>
              </div>

              {/* Advanced Details */}
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-black" /> Lifestyle & Health
                  </h3>
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-3 shadow-sm hover:shadow-md transition-all">
                    <DetailItem label="Dietary Preference" value={selectedUser.profile?.dietaryPreference} />
                    <DetailItem label="Activity Level" value={selectedUser.profile?.activityLevel?.replace('_', ' ')} />
                    <DetailItem label="Sleep Hours" value={`${selectedUser.profile?.lifestyle?.sleepHours || 0} hrs`} />
                    <DetailItem label="Water Intake" value={`${selectedUser.profile?.lifestyle?.waterIntake || 0} glasses`} />
                    <DetailItem label="Stress Level" value={selectedUser.profile?.lifestyle?.stressLevel} />
                    <DetailItem label="Smoker" value={selectedUser.profile?.lifestyle?.smoker ? 'Yes' : 'No'} />
                    <DetailItem label="Alcohol" value={selectedUser.profile?.lifestyle?.alcohol ? 'Yes' : 'No'} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Target className="w-5 h-5 text-black" /> Nutrition & Goals
                  </h3>
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-3 shadow-sm hover:shadow-md transition-all">
                    <DetailItem label="Primary Goal" value={selectedUser.nutritionGoal?.goal?.replace('_', ' ')} />
                    <DetailItem label="Target Weight" value={`${selectedUser.nutritionGoal?.targetWeight || 'N/A'} kg`} />
                    <DetailItem label="Calorie Target" value={`${selectedUser.nutritionGoal?.calorieGoal || 'N/A'} kcal`} />
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-50 mt-2">
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Prot</p>
                        <p className="text-xs font-black text-slate-900">{selectedUser.nutritionGoal?.proteinGoal || 0}g</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Carb</p>
                        <p className="text-xs font-black text-slate-900">{selectedUser.nutritionGoal?.carbsGoal || 0}g</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Fat</p>
                        <p className="text-xs font-black text-slate-900">{selectedUser.nutritionGoal?.fatGoal || 0}g</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Diabetes Profile and Medical History */}
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-black" /> Diabetes Profile
                  </h3>
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-3 shadow-sm hover:shadow-md transition-all min-h-[160px]">
                    {selectedUser.profile?.diabetesProfile?.type ? (
                      <>
                        <DetailItem label="Type" value={selectedUser.profile.diabetesProfile.type} />
                        <DetailItem label="Diagnosis Year" value={selectedUser.profile.diabetesProfile.diagnosisYear} />
                        <DetailItem label="Status" value={selectedUser.profile.diabetesProfile.status} />
                        <DetailItem label="HbA1c" value={`${selectedUser.profile.diabetesProfile.hba1c}%`} />
                        <DetailItem label="Medication" value={selectedUser.profile.diabetesProfile.onMedication ? 'Yes' : 'No'} />
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 text-slate-300">
                        <CheckCircle className="w-8 h-8 opacity-20 mb-2" />
                        <p className="text-sm font-bold">Non-Diabetic</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-black" /> Medical History
                  </h3>
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all min-h-[160px]">
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Chronic Conditions</p>
                        {selectedUser.profile?.medicalHistory?.conditions?.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedUser.profile.medicalHistory.conditions.map((c, i) => (
                              <span key={i} className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-wider ring-1 ring-red-100">
                                {c}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400 text-xs italic">No chronic conditions listed</p>
                        )}
                      </div>
                      <div className="pt-4 border-t border-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Medications</p>
                        {selectedUser.profile?.medicalHistory?.currentMedications?.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedUser.profile.medicalHistory.currentMedications.map((m, i) => (
                              <span key={i} className="px-3 py-1 bg-slate-100 text-black rounded-full text-[10px] font-black uppercase tracking-wider ring-1 ring-slate-200">
                                {m}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400 text-xs italic">No current medications</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity Timeline */}
              <div className="space-y-4">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-black" /> Recent System Activity
                </h3>
                <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-6">
                  {selectedUser.activity?.length > 0 ? (
                    <div className="space-y-4">
                      {selectedUser.activity.map((item, i) => (
                        <div key={i} className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.type === 'report' ? 'bg-slate-100 text-black' : 'bg-slate-50 text-slate-700'
                            }`}>
                            {item.type === 'report' ? <FileText className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-slate-900 text-sm">{item.title}</p>
                            <p className="text-xs text-slate-500">{new Date(item.date).toLocaleDateString()} • {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${item.status === 'completed' || item.status === 'confirmed' ? 'bg-slate-100 text-black' : 'bg-slate-50 text-slate-500'
                            }`}>
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium">No recent activity found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-slate-800 transition-colors shadow-lg"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold text-slate-700 capitalize">{value || 'N/A'}</span>
    </div>
  );
}
