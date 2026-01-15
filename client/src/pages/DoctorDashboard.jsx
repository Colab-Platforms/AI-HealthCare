import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doctorService } from '../services/api';
import { Calendar, Clock, Users, Star, AlertCircle, CheckCircle, XCircle, Eye, TrendingUp, Activity, Settings } from 'lucide-react';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const { data } = await doctorService.getDashboard();
        setData(data);
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const { doctor, stats, todaySchedule, upcomingSchedule } = data || {};

  // Pending approval
  if (doctor?.approvalStatus === 'pending') {
    return (
      <div className="max-w-lg mx-auto mt-20">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Approval Pending</h2>
          <p className="text-slate-500 mb-4">Your profile is under review. You'll be notified once approved.</p>
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-sm font-medium">
            <AlertCircle className="w-4 h-4" /> Pending Review
          </span>
        </div>
      </div>
    );
  }

  // Rejected
  if (doctor?.approvalStatus === 'rejected') {
    return (
      <div className="max-w-lg mx-auto mt-20">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Application Rejected</h2>
          <p className="text-slate-500">Please contact support for more information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Welcome, Dr. {doctor?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-slate-500 mt-1">{doctor?.specialization}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/doctor/availability"
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all"
          >
            <Settings className="w-4 h-4" /> Manage Slots
          </Link>
          {doctor?.isListed ? (
            <span className="px-3 py-2 bg-green-100 text-green-700 rounded-xl text-sm font-medium flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> Listed
            </span>
          ) : (
            <span className="px-3 py-2 bg-amber-100 text-amber-700 rounded-xl text-sm font-medium flex items-center gap-1">
              <AlertCircle className="w-4 h-4" /> Not Listed
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats?.todayAppointments || 0}</p>
          <p className="text-sm text-slate-500">Today</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats?.upcomingAppointments || 0}</p>
          <p className="text-sm text-slate-500">Upcoming</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center mb-3">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats?.totalPatients || 0}</p>
          <p className="text-sm text-slate-500">Patients</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
            <Star className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{doctor?.rating?.toFixed(1) || '0.0'}</p>
          <p className="text-sm text-slate-500">Rating</p>
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-500" /> Today's Schedule
          </h2>
        </div>
        {todaySchedule?.length > 0 ? (
          <div className="space-y-3">
            {todaySchedule.map((apt) => (
              <div key={apt._id} className="p-4 bg-slate-50 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center text-cyan-600 font-bold">
                    {apt.patient?.name?.[0]?.toUpperCase() || 'P'}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{apt.patient?.name}</p>
                    <p className="text-sm text-slate-500">{apt.timeSlot}</p>
                  </div>
                </div>
                <Link
                  to={`/patient/${apt.patient?._id}?appointmentId=${apt._id}`}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all text-sm flex items-center gap-1"
                >
                  <Eye className="w-4 h-4" /> View
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Calendar className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p>No appointments today</p>
          </div>
        )}
      </div>

      {/* Upcoming */}
      {upcomingSchedule?.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-green-500" /> Upcoming Appointments
          </h2>
          <div className="space-y-3">
            {upcomingSchedule.slice(0, 5).map((apt) => (
              <div key={apt._id} className="p-4 bg-slate-50 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-green-600 font-bold">
                    {apt.patient?.name?.[0]?.toUpperCase() || 'P'}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{apt.patient?.name}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(apt.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {apt.timeSlot}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
