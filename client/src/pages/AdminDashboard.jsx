import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { Users, FileText, Activity, AlertCircle, CheckCircle, XCircle, UserCog, Calendar, Clock } from 'lucide-react';
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
        <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'doctors', label: 'Doctors', icon: UserCog }
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
      {activeTab === 'doctors' && <DoctorsTab />}
    </div>
  );
}

function OverviewTab({ stats }) {
  if (!stats) return null;
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
          <Users className="w-5 h-5 text-blue-600" />
        </div>
        <p className="text-sm text-slate-500">Total Patients</p>
        <p className="text-2xl font-bold text-slate-800">{stats.stats?.totalUsers || 0}</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center mb-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
        </div>
        <p className="text-sm text-slate-500">Active Users</p>
        <p className="text-2xl font-bold text-slate-800">{stats.stats?.activeUsers || 0}</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center mb-3">
          <FileText className="w-5 h-5 text-purple-600" />
        </div>
        <p className="text-sm text-slate-500">Total Reports</p>
        <p className="text-2xl font-bold text-slate-800">{stats.stats?.totalReports || 0}</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
          <AlertCircle className="w-5 h-5 text-amber-600" />
        </div>
        <p className="text-sm text-slate-500">Pending Doctors</p>
        <p className="text-2xl font-bold text-slate-800">{stats.stats?.pendingDoctors || 0}</p>
      </div>
    </div>
  );
}

function DoctorsTab() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchDoctors(); }, []);
  
  const fetchDoctors = async () => {
    try {
      const { data } = await adminService.getDoctors();
      setDoctors(data.doctors || []);
    } catch (error) {
      toast.error('Failed to load doctors');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await adminService.approveDoctor(id);
      setDoctors(doctors.map(d => d._id === id ? { ...d, approvalStatus: 'approved', isListed: true } : d));
      toast.success('Doctor approved!');
    } catch (error) {
      toast.error('Failed to approve');
    }
  };

  const handleReject = async (id) => {
    try {
      await adminService.rejectDoctor(id);
      setDoctors(doctors.map(d => d._id === id ? { ...d, approvalStatus: 'rejected', isListed: false } : d));
      toast.success('Doctor rejected');
    } catch (error) {
      toast.error('Failed to reject');
    }
  };

  const filteredDoctors = doctors.filter(d => filter === 'all' ? true : d.approvalStatus === filter);
  const pendingCount = doctors.filter(d => d.approvalStatus === 'pending').length;

  if (loading) return <GenericSkeleton />;

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-4">
          <AlertCircle className="w-6 h-6 text-amber-500" />
          <div className="flex-1">
            <p className="font-medium text-amber-800">{pendingCount} Doctor(s) Pending Approval</p>
          </div>
          <button onClick={() => setFilter('pending')} className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600">
            Review
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-800">Doctor Management</h2>
          <div className="flex gap-2">
            {['all', 'pending', 'approved', 'rejected'].map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${filter === f ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredDoctors.map((doctor) => (
            <div key={doctor._id} className={`p-4 rounded-xl border ${doctor.approvalStatus === 'pending' ? 'bg-amber-50 border-amber-200' : doctor.approvalStatus === 'rejected' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center text-white font-bold">
                    {doctor.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-800">Dr. {doctor.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        doctor.approvalStatus === 'approved' ? 'bg-green-100 text-green-700' :
                        doctor.approvalStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {doctor.approvalStatus}
                      </span>
                    </div>
                    <p className="text-sm text-cyan-600">{doctor.specialization}</p>
                    <p className="text-xs text-slate-500">{doctor.experience} yrs • ₹{doctor.consultationFee || 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {doctor.approvalStatus === 'pending' && (
                    <>
                      <button onClick={() => handleApprove(doctor._id)} className="px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Approve
                      </button>
                      <button onClick={() => handleReject(doctor._id)} className="px-3 py-1.5 bg-slate-200 text-red-600 text-sm font-medium rounded-lg hover:bg-slate-300 flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filteredDoctors.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <UserCog className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p>No doctors found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
