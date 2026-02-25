import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp, Plus, Droplet, Activity, Calendar, Bell, ChevronDown,
  Info, AlertCircle, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DiabetesCare() {
  const { user } = useAuth();
  const [selectedMetric, setSelectedMetric] = useState('HbA1c');
  const [glucoseReadings, setGlucoseReadings] = useState([]);
  const [currentHbA1c, setCurrentHbA1c] = useState(5.8);
  const [dailyAvg, setDailyAvg] = useState(108);

  // Load glucose readings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('glucose_readings');
    if (saved) {
      setGlucoseReadings(JSON.parse(saved));
    } else {
      // Sample data
      const sampleReadings = [
        { id: 1, type: 'Fasting', value: 98, time: 'Today • 08:00 AM', status: 'optimal', date: new Date().toISOString() },
        { id: 2, type: 'Post-Meal', value: 142, time: 'Today • 01:30 PM', status: 'monitor', date: new Date().toISOString() },
        { id: 3, type: 'HbA1c', value: 5.8, time: 'Feb 15 • Last Lab', status: 'target', date: '2026-02-15' }
      ];
      setGlucoseReadings(sampleReadings);
      localStorage.setItem('glucose_readings', JSON.stringify(sampleReadings));
    }
  }, []);

  // Weekly progress data for chart
  const weeklyData = [
    { day: 'Tue', value: 105 },
    { day: 'Wed', value: 110 },
    { day: 'Thu', value: 115 },
    { day: 'Fri', value: 108 },
    { day: 'Sat', value: 102 },
    { day: 'Sun', value: 108 }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'optimal': return 'text-green-600 bg-green-100';
      case 'monitor': return 'text-orange-600 bg-orange-100';
      case 'target': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'optimal': return 'OPTIMAL';
      case 'monitor': return 'MONITOR';
      case 'target': return 'TARGET';
      default: return 'NORMAL';
    }
  };

  const getIconColor = (type) => {
    switch (type) {
      case 'Fasting': return 'bg-green-100 text-green-600';
      case 'Post-Meal': return 'bg-orange-100 text-orange-600';
      case 'HbA1c': return 'bg-red-100 text-red-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        
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

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Diabetes Care</h1>
            <p className="text-sm text-slate-600 mt-1">Glycemic Control & Trends</p>
          </div>
          <button className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg hover:bg-blue-700 transition-all">
            <Plus className="w-6 h-6 md:w-7 md:h-7" />
          </button>
        </div>

        {/* Weekly Progress Chart */}
        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">WEEKLY PROGRESS</h2>
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm font-medium text-slate-700">
              {selectedMetric}
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Simple Line Chart */}
          <div className="relative h-48 mb-4">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Background area */}
              <path
                d="M 0 40 Q 16.67 35 33.33 30 T 66.67 45 T 100 40 L 100 100 L 0 100 Z"
                fill="url(#chartGradient)"
              />
              {/* Line */}
              <path
                d="M 0 40 Q 16.67 35 33.33 30 T 66.67 45 T 100 40"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Days */}
          <div className="grid grid-cols-6 gap-2 text-center text-xs text-slate-500">
            {weeklyData.map((day, idx) => (
              <div key={idx}>{day.day}</div>
            ))}
          </div>
        </div>

        {/* Current Metrics */}
        <div className="grid grid-cols-2 gap-4">
          {/* HbA1c Card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-5 text-white shadow-xl">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">CURRENT HBA1C</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-4xl font-bold">{currentHbA1c}</span>
              <span className="text-green-400 text-lg">%</span>
            </div>
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-400 to-orange-400 rounded-full" style={{ width: '60%' }} />
            </div>
            <p className="text-xs text-cyan-400 mt-2 uppercase tracking-wide">Target Range</p>
          </div>

          {/* Daily Average Card */}
          <div className="bg-white rounded-3xl p-5 shadow-lg border-2 border-slate-200">
            <p className="text-slate-600 text-xs uppercase tracking-wide mb-2">DAILY AVG</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-4xl font-bold text-slate-900">{dailyAvg}</span>
              <span className="text-slate-500 text-sm">mg/dL</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-blue-600 font-semibold uppercase">Stable Baseline</span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900">RECENT ACTIVITY</h2>
            <Link to="/diabetes/history" className="text-sm text-blue-600 font-semibold hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-3">
            {glucoseReadings.map((reading) => (
              <div key={reading.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all">
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getIconColor(reading.type)}`}>
                    <Droplet className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900">{reading.type} Reading</h3>
                    <p className="text-sm text-slate-500">{reading.time}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">
                    {reading.value}
                    <span className="text-sm text-slate-500 ml-1">
                      {reading.type === 'HbA1c' ? '%' : 'MG/DL'}
                    </span>
                  </p>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold uppercase ${getStatusColor(reading.status)}`}>
                    {getStatusText(reading.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Smart Forecast */}
        <div className="bg-gradient-to-br from-purple-50 to-orange-50 rounded-3xl p-6 border-2 border-blue-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Info className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-blue-900 mb-2">SMART FORECAST</h3>
              <p className="text-sm text-blue-800 leading-relaxed">
                Your post-meal glucose has increased by 4% compared to last week. Consider tracking fiber intake to stabilize spikes.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Quick Tips</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">Test fasting glucose before breakfast for accurate baseline readings</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">Check post-meal levels 2 hours after eating to monitor spikes</p>
            </div>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">Aim for HbA1c below 7% for optimal diabetes management</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
