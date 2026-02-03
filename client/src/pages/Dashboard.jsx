import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import {
  Heart, Moon, TrendingUp, MessageSquare, Watch, FileText, Plus, Battery, 
  Sparkles, Upload, Footprints, RefreshCw, Eye, X, Droplets, Zap, Brain,
  Bone, Shield, Pill, Activity, Sun, Calendar, Clock, AlertTriangle,
  CheckCircle, ArrowUp, Minus, Target, Award, Utensils, Flame, ChevronDown, ArrowDown
} from 'lucide-react';

// Custom Styled Dropdown Component
const ReportFilterDropdown = ({ reports, selectedReport, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedReportData = reports?.find(r => r._id === selectedReport);
  
  // Use reportDate if available, otherwise use createdAt
  const getReportDate = (report) => {
    const dateToUse = report.reportDate || report.createdAt;
    return new Date(dateToUse).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };
  
  const displayText = selectedReportData 
    ? `${selectedReportData.reportType} - ${getReportDate(selectedReportData)}`
    : 'Select Report';

  return (
    <div className="relative inline-block z-10" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 sm:px-4 py-2 bg-white rounded-lg text-xs sm:text-sm font-medium cursor-pointer transition-all shadow-sm hover:shadow-md flex items-center gap-2"
        style={{
          borderColor: '#8B7355',
          border: '2px solid #8B7355',
          color: '#8B7355'
        }}
      >
        <FileText className="w-4 h-4" />
        <span className="hidden sm:inline">{displayText}</span>
        <span className="sm:hidden">{selectedReportData ? selectedReportData.reportType : 'Report'}</span>
        <ChevronDown 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: '#8B7355' }}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border-2 overflow-hidden"
          style={{ borderColor: '#8B7355' }}
        >
          {/* Select Report Option */}
          <button
            onClick={() => {
              onSelect(null);
              setIsOpen(false);
            }}
            className="w-full px-4 py-2.5 text-left text-xs sm:text-sm font-medium transition-colors hover:bg-slate-50"
            style={{
              color: selectedReport === null ? '#8B7355' : '#64748b',
              backgroundColor: selectedReport === null ? '#F5F1EA' : 'transparent',
              borderBottom: '1px solid #e2e8f0'
            }}
          >
            Select Report
          </button>

          {/* Reports List */}
          {reports && reports.length > 0 ? (
            reports.map((report) => (
              <button
                key={report._id}
                onClick={() => {
                  onSelect(report._id);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2.5 text-left text-xs sm:text-sm transition-colors hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                style={{
                  color: selectedReport === report._id ? '#8B7355' : '#64748b',
                  backgroundColor: selectedReport === report._id ? '#F5F1EA' : 'transparent',
                  fontWeight: selectedReport === report._id ? '600' : '500'
                }}
              >
                <div className="flex items-center justify-between">
                  <span>{report.reportType}</span>
                  <span className="text-slate-400 text-xs">
                    {getReportDate(report)}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-center text-slate-500 text-xs sm:text-sm">
              No reports available
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Info Modal Component - Light Theme
const healthMetricsInfo = {
  vitaminD: {
    name: 'Vitamin D',
    icon: Sun,
    color: 'amber',
    unit: 'ng/mL',
    normalRange: '30-100',
    lowExplanation: 'When Vitamin D is low, you may feel tired all the time, have weak bones that break easily, feel sad or depressed, get sick often, and have muscle pain. Your body needs sunlight and certain foods to make Vitamin D.',
    tips: ['Get 15-20 minutes of sunlight daily', 'Eat eggs, fish, and fortified milk', 'Consider supplements if advised by doctor']
  },
  vitaminB12: {
    name: 'Vitamin B12',
    icon: Zap,
    color: 'red',
    unit: 'pg/mL',
    normalRange: '300-900',
    lowExplanation: 'Low Vitamin B12 makes you feel very tired and weak. You might feel dizzy, have trouble thinking clearly, feel numbness in hands or feet, and look pale. Your body needs B12 to make healthy blood cells.',
    tips: ['Eat meat, fish, eggs, and dairy', 'Vegetarians may need supplements', 'Get tested if you feel constantly tired']
  },
  iron: {
    name: 'Iron',
    icon: Droplets,
    color: 'rose',
    unit: 'mcg/dL',
    normalRange: '60-170',
    lowExplanation: 'Low iron means your blood cannot carry enough oxygen. You will feel very tired, look pale, feel short of breath, have cold hands and feet, and may have headaches. Women often have low iron.',
    tips: ['Eat red meat, spinach, and beans', 'Take iron with Vitamin C for better absorption', 'Avoid tea/coffee with iron-rich meals']
  },
  hemoglobin: {
    name: 'Hemoglobin',
    icon: Heart,
    color: 'red',
    unit: 'g/dL',
    normalRange: '12-17',
    lowExplanation: 'Low hemoglobin means anemia - your blood cannot carry enough oxygen to your body. You will feel extremely tired, weak, dizzy, and may have pale skin. Your heart has to work harder.',
    tips: ['Eat iron-rich foods', 'Include Vitamin C in your diet', 'See a doctor if symptoms persist']
  },
  calcium: {
    name: 'Calcium',
    icon: Bone,
    color: 'slate',
    unit: 'mg/dL',
    normalRange: '8.5-10.5',
    lowExplanation: 'Low calcium weakens your bones and teeth. You may have muscle cramps, numbness in fingers, brittle nails, and bones that break easily. Long-term low calcium can cause osteoporosis.',
    tips: ['Drink milk and eat dairy products', 'Eat leafy green vegetables', 'Get enough Vitamin D for calcium absorption']
  },
  vitaminC: {
    name: 'Vitamin C',
    icon: Shield,
    color: 'orange',
    unit: 'mg/dL',
    normalRange: '0.6-2.0',
    lowExplanation: 'Low Vitamin C means your body cannot heal wounds properly. You may have bleeding gums, bruise easily, feel tired, have dry skin, and get sick often. Your immune system becomes weak.',
    tips: ['Eat citrus fruits like oranges and lemons', 'Include tomatoes and bell peppers', 'Eat fresh fruits and vegetables daily']
  },
  cholesterol: {
    name: 'Cholesterol',
    icon: Activity,
    color: 'yellow',
    unit: 'mg/dL',
    normalRange: '<200',
    lowExplanation: 'While high cholesterol is usually the concern, very low cholesterol can affect hormone production and brain function. However, most people need to focus on keeping cholesterol in healthy range.',
    tips: ['Limit fried and fatty foods', 'Exercise regularly', 'Eat more fiber and vegetables']
  },
  bloodSugar: {
    name: 'Blood Sugar',
    icon: Pill,
    color: 'purple',
    unit: 'mg/dL',
    normalRange: '70-100',
    lowExplanation: 'Low blood sugar (hypoglycemia) makes you feel shaky, sweaty, confused, and very hungry. You may feel dizzy or faint. High blood sugar over time can lead to diabetes and damage organs.',
    tips: ['Eat regular meals', 'Limit sugary foods and drinks', 'Exercise helps control blood sugar']
  },
  thyroid: {
    name: 'Thyroid (TSH)',
    icon: Brain,
    color: 'indigo',
    unit: 'mIU/L',
    normalRange: '0.4-4.0',
    lowExplanation: 'Thyroid problems affect your energy and weight. Low thyroid makes you tired, gain weight, feel cold, and have dry skin. High thyroid makes you anxious, lose weight, and feel hot.',
    tips: ['Get thyroid checked if you have unexplained weight changes', 'Iodine in salt helps thyroid function', 'Take thyroid medicine as prescribed']
  },
  heartRate: {
    name: 'Heart Rate',
    icon: Heart,
    color: 'red',
    unit: 'bpm',
    normalRange: '60-100',
    lowExplanation: 'Very low heart rate can mean your heart is not pumping enough blood. You may feel dizzy, tired, or faint. Athletes often have lower heart rates which is normal for them.',
    tips: ['Regular exercise strengthens your heart', 'Reduce stress and anxiety', 'Limit caffeine and alcohol']
  },
  sleep: {
    name: 'Sleep',
    icon: Moon,
    color: 'indigo',
    unit: 'hours',
    normalRange: '7-9',
    lowExplanation: 'Not enough sleep makes you tired, irritable, and unable to think clearly. Long-term poor sleep increases risk of heart disease, diabetes, and weight gain. Your body heals during sleep.',
    tips: ['Sleep 7-9 hours every night', 'Keep a regular sleep schedule', 'Avoid screens before bedtime']
  },
  steps: {
    name: 'Daily Steps',
    icon: Footprints,
    color: 'cyan',
    unit: 'steps',
    normalRange: '8,000-10,000',
    lowExplanation: 'Not walking enough means less exercise for your body. This can lead to weight gain, weak muscles, poor heart health, and low energy. Walking is the easiest exercise for everyone.',
    tips: ['Aim for 8,000-10,000 steps daily', 'Take stairs instead of elevator', 'Walk after meals for better digestion']
  }
};

// Info Modal Component - Light Theme
const MetricInfoModal = ({ metric, onClose }) => {
  if (!metric) return null;
  const info = healthMetricsInfo[metric];
  if (!info) return null;
  const Icon = info.icon;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto p-5 sm:p-6 relative animate-slide-up sm:animate-fade-in shadow-xl" 
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mb-4 sm:hidden" />
        
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1">
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-${info.color}-100 flex items-center justify-center`}>
            <Icon className={`w-5 h-5 sm:w-6 sm:h-6 text-${info.color}-500`} />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-800">{info.name}</h3>
            <p className="text-slate-500 text-xs sm:text-sm">Normal: {info.normalRange} {info.unit}</p>
          </div>
        </div>

        <div className="mb-4">
          <h4 className="text-cyan-600 font-medium mb-2 text-sm sm:text-base">What happens when it's low?</h4>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">{info.lowExplanation}</p>
        </div>

        <div>
          <h4 className="text-emerald-600 font-medium mb-2 text-sm sm:text-base">Simple Tips to Improve</h4>
          <ul className="space-y-2">
            {info.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-slate-600 text-xs sm:text-sm">
                <span className="text-emerald-500 mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
        
        <button 
          onClick={onClose}
          className="w-full mt-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors sm:hidden"
        >
          Got it
        </button>
      </div>
    </div>
  );
};

// Metric Card Component - Light Theme with Comparison
const MetricCard = ({ metricKey, value, unit, status, subtitle, onInfoClick, previousValue, allReports, isSamePatient }) => {
  const info = healthMetricsInfo[metricKey];
  if (!info) return null;
  const Icon = info.icon;

  const statusColors = {
    normal: 'emerald',
    low: 'amber',
    high: 'red',
    critical: 'red'
  };
  const statusColor = statusColors[status] || 'slate';
  
  const hasValue = value !== null && value !== undefined && value !== '';
  
  // Calculate comparison with previous report (only if same patient)
  let comparisonData = null;
  if (hasValue && previousValue !== null && previousValue !== undefined && allReports && allReports.length > 1 && isSamePatient) {
    const currentNum = parseFloat(value);
    const prevNum = parseFloat(previousValue);
    
    if (!isNaN(currentNum) && !isNaN(prevNum) && prevNum !== 0) {
      const change = currentNum - prevNum;
      const percentChange = ((change / prevNum) * 100).toFixed(1);
      
      // Determine if change is good or bad based on metric
      let isImprovement = false;
      let comparisonColor = 'slate';
      
      // For most vitamins/minerals, higher is better
      if (['vitaminD', 'vitaminB12', 'iron', 'calcium', 'hemoglobin', 'vitaminC'].includes(metricKey)) {
        isImprovement = change > 0;
        if (change > 0) comparisonColor = 'emerald'; // Green - improved
        else if (change < 0) comparisonColor = 'red'; // Red - worsened
      }
      // For cholesterol and blood sugar, lower is better
      else if (['cholesterol', 'bloodSugar', 'tsh'].includes(metricKey)) {
        isImprovement = change < 0;
        if (change < 0) comparisonColor = 'emerald'; // Green - improved
        else if (change > 0) comparisonColor = 'red'; // Red - worsened
      }
      
      // Yellow for small changes (warning/borderline)
      if (Math.abs(percentChange) < 5) {
        comparisonColor = 'amber';
      }
      
      comparisonData = {
        change,
        percentChange,
        isImprovement,
        color: comparisonColor
      };
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm group relative p-3 sm:p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-1 sm:mb-2">
        <span className="text-slate-500 text-xs sm:text-sm truncate pr-2">{info.name}</span>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            onClick={() => onInfoClick(metricKey)}
            className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-slate-100 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-slate-200"
            title="Learn more"
          >
            <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-500" />
          </button>
          <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-${info.color}-100 flex items-center justify-center`}>
            <Icon className={`w-3 h-3 sm:w-4 sm:h-4 text-${info.color}-500`} />
          </div>
        </div>
      </div>
      <div className="flex items-baseline gap-1 sm:gap-2 flex-wrap">
        {hasValue ? (
          <>
            <span className="text-xl sm:text-3xl font-bold text-slate-800">{value}</span>
            <span className="text-slate-400 text-xs sm:text-sm">{unit || info.unit}</span>
            {status && (
              <span className={`text-${statusColor}-600 text-[10px] sm:text-xs ml-auto px-1.5 sm:px-2 py-0.5 bg-${statusColor}-100 rounded-full`}>
                {status.toUpperCase()}
              </span>
            )}
          </>
        ) : (
          <span className="text-slate-400 text-sm">No data</span>
        )}
      </div>
      
      {/* Comparison Arrow and Percentage */}
      {comparisonData && (
        <div className={`flex items-center gap-1 mt-2 text-xs sm:text-sm font-medium`}>
          <div className={`flex items-center gap-0.5 px-2 py-1 rounded-lg bg-${comparisonData.color}-100`}>
            {comparisonData.change > 0 ? (
              <ArrowUp className={`w-3 h-3 sm:w-4 sm:h-4 text-${comparisonData.color}-600`} />
            ) : (
              <ArrowDown className={`w-3 h-3 sm:w-4 sm:h-4 text-${comparisonData.color}-600`} />
            )}
            <span className={`text-${comparisonData.color}-600`}>
              {comparisonData.change > 0 ? '+' : ''}{comparisonData.percentChange}%
            </span>
          </div>
          <span className="text-slate-400 text-[10px] sm:text-xs">vs prev</span>
        </div>
      )}
      
      {subtitle && <p className="text-slate-400 text-[10px] sm:text-xs mt-1 sm:mt-2 truncate">{subtitle}</p>}
    </div>
  );
};


export default function Dashboard() {
  const { user } = useAuth();
  const { 
    dashboardData, 
    wearableData, 
    nutritionData: cachedNutritionData,
    loading: contextLoading,
    fetchDashboard,
    fetchWearable,
    fetchNutrition
  } = useData();
  
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [localNutritionData, setLocalNutritionData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);

  // Fetch data on mount - will use cache if available
  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null);
        await Promise.all([
          fetchDashboard(),
          fetchWearable()
        ]);
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
        setError(error.response?.data?.message || 'Failed to load dashboard data');
      }
    };
    loadData();
  }, [fetchDashboard, fetchWearable]);

  // Set latest report as default when data loads
  useEffect(() => {
    if (dashboardData?.recentReports && dashboardData.recentReports.length > 0 && selectedReport === null) {
      setSelectedReport(dashboardData.recentReports[0]._id);
    }
  }, [dashboardData?.recentReports, selectedReport]);

  // Fetch nutrition data when date changes
  useEffect(() => {
    const loadNutrition = async () => {
      const data = await fetchNutrition(selectedDate);
      setLocalNutritionData(data);
    };
    loadNutrition();
  }, [selectedDate, fetchNutrition]);

  const loading = contextLoading.dashboard || contextLoading.wearable;
  const data = dashboardData;
  const nutritionDataToUse = localNutritionData || cachedNutritionData;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading your health data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={() => fetchDashboard()} className="px-6 py-2 bg-cyan-500 text-white rounded-xl hover:bg-cyan-600">Try Again</button>
        </div>
      </div>
    );
  }

  const { user: userData, healthScores, latestAnalysis, recentReports } = data || {};
  const hasReports = recentReports && recentReports.length > 0;
  
  // Get selected report data or use latest analysis
  const selectedReportData = selectedReport && recentReports 
    ? recentReports.find(r => r._id === selectedReport)
    : recentReports?.[0];
  
  const analysisToUse = selectedReportData?.aiAnalysis || latestAnalysis;
  const healthScore = userData?.healthMetrics?.healthScore || analysisToUse?.healthScore || null;

  // Extract metrics from selected report analysis or latest analysis
  const rawMetrics = analysisToUse?.metrics || {};
  const getMetricValue = (metric) => {
    if (metric === null || metric === undefined) return null;
    if (typeof metric === 'object' && metric.value !== undefined) return metric.value;
    return metric;
  };
  const metrics = {
    vitaminD: getMetricValue(rawMetrics.vitaminD),
    vitaminB12: getMetricValue(rawMetrics.vitaminB12),
    iron: getMetricValue(rawMetrics.iron),
    calcium: getMetricValue(rawMetrics.calcium),
    hemoglobin: getMetricValue(rawMetrics.hemoglobin),
    bloodSugar: getMetricValue(rawMetrics.bloodSugar) || getMetricValue(rawMetrics.glucose),
    tsh: getMetricValue(rawMetrics.tsh) || getMetricValue(rawMetrics.thyroid),
    vitaminC: getMetricValue(rawMetrics.vitaminC),
    cholesterol: getMetricValue(rawMetrics.cholesterol) || getMetricValue(rawMetrics.totalCholesterol),
  };
  
  // Get previous metrics for comparison (second latest report)
  const previousMetrics = {};
  let isSamePatient = true; // Flag to check if same patient
  
  if (recentReports && recentReports.length > 1) {
    const previousReport = recentReports[1]; // Second latest report
    const currentPatientName = selectedReportData?.patientName || user?.name || '';
    const previousPatientName = previousReport?.patientName || '';
    
    // Validate if both reports are from same patient
    if (currentPatientName && previousPatientName) {
      // Simple name matching (case-insensitive, trim whitespace)
      const currentName = currentPatientName.toLowerCase().trim();
      const prevName = previousPatientName.toLowerCase().trim();
      isSamePatient = currentName === prevName;
      
      if (!isSamePatient) {
        console.log(`Patient mismatch: "${currentPatientName}" vs "${previousPatientName}"`);
      }
    }
    
    // Only extract previous metrics if same patient
    if (isSamePatient) {
      const prevRawMetrics = previousReport?.aiAnalysis?.metrics || {};
      previousMetrics.vitaminD = getMetricValue(prevRawMetrics.vitaminD);
      previousMetrics.vitaminB12 = getMetricValue(prevRawMetrics.vitaminB12);
      previousMetrics.iron = getMetricValue(prevRawMetrics.iron);
      previousMetrics.calcium = getMetricValue(prevRawMetrics.calcium);
      previousMetrics.hemoglobin = getMetricValue(prevRawMetrics.hemoglobin);
      previousMetrics.bloodSugar = getMetricValue(prevRawMetrics.bloodSugar) || getMetricValue(prevRawMetrics.glucose);
      previousMetrics.tsh = getMetricValue(prevRawMetrics.tsh) || getMetricValue(prevRawMetrics.thyroid);
      previousMetrics.vitaminC = getMetricValue(prevRawMetrics.vitaminC);
      previousMetrics.cholesterol = getMetricValue(prevRawMetrics.cholesterol) || getMetricValue(prevRawMetrics.totalCholesterol);
    }
  }
  
  // Use real wearable data or defaults
  const hasWearableData = wearableData?.connected && wearableData?.todayMetrics;
  const todayMetrics = wearableData?.todayMetrics || { steps: 0, caloriesBurned: 0, activeMinutes: 0 };
  const recentHeartRate = wearableData?.recentHeartRate || [];
  const recentSleep = wearableData?.recentSleep || [];
  
  const avgHeartRate = recentHeartRate.length > 0 
    ? Math.round(recentHeartRate.reduce((sum, r) => sum + r.bpm, 0) / recentHeartRate.length)
    : null;
  const avgSleep = recentSleep.length > 0
    ? (recentSleep.reduce((sum, s) => sum + s.totalSleepMinutes, 0) / recentSleep.length / 60).toFixed(1)
    : null;

  // Health score trend data
  const healthScoreTrend = healthScores?.length > 0 
    ? healthScores.map((s) => ({
        date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: s.score,
        type: s.type
      }))
    : [];

  // Determine status based on values
  const getStatus = (value, normalMin, normalMax) => {
    if (!value) return null;
    const num = parseFloat(value);
    if (num < normalMin * 0.7) return 'critical';
    if (num < normalMin) return 'low';
    if (num > normalMax * 1.3) return 'high';
    if (num > normalMax) return 'high';
    return 'normal';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Info Modal */}
      {selectedMetric && (
        <MetricInfoModal metric={selectedMetric} onClose={() => setSelectedMetric(null)} />
      )}

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-slate-800">
            Welcome back, <span className="text-cyan-600">{user?.name?.split(' ')[0]}</span>
          </h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">Your complete health overview. Tap the eye icon to learn more.</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Link to="/upload" className="px-3 sm:px-6 py-2 sm:py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 flex items-center gap-1 sm:gap-2 text-xs sm:text-base">
            <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Upload Records</span>
            <span className="sm:hidden">Upload</span>
          </Link>
          <button className="px-3 sm:px-6 py-2 sm:py-3 text-white rounded-xl font-medium hover:shadow-lg flex items-center gap-1 sm:gap-2 text-xs sm:text-base" style={{ backgroundColor: '#8B7355' }}>
            <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Log Symptoms</span>
            <span className="sm:hidden">Log</span>
          </button>
        </div>
      </div>

      {/* Health Score Trend Chart */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Health Score */}
        {hasReports && healthScore ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-800">Health Score Trend</h3>
                <p className="text-slate-500 text-xs sm:text-sm">Your overall health progress</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-4xl font-bold text-slate-800">{healthScore}</span>
                <span className="text-slate-400 text-sm">/100</span>
                {healthScoreTrend.length > 1 && (
                  <span className="text-emerald-500 text-xs sm:text-sm ml-2">
                    {healthScoreTrend[healthScoreTrend.length - 1].score > healthScoreTrend[healthScoreTrend.length - 2].score ? '+' : ''}
                    {healthScoreTrend[healthScoreTrend.length - 1].score - healthScoreTrend[healthScoreTrend.length - 2].score}%
                  </span>
                )}
              </div>
            </div>
            {healthScoreTrend.length > 0 && (
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={healthScoreTrend}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} domain={[50, 100]} hide />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#64748b' }}
                    formatter={(value) => [`${value}/100`, 'Score']}
                  />
                  <Area type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} fill="url(#scoreGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">No Health Data Yet</h3>
            <p className="text-slate-500 mb-4">Upload your first health report to see your personalized health score and track your progress over time.</p>
            <Link to="/upload" className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-xl font-medium hover:shadow-lg transition-all" style={{ backgroundColor: '#8B7355' }}>
              <Upload className="w-4 h-4" />
              Upload Your First Report
            </Link>
          </div>
        )}

        {/* Nutrition Tracker */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Utensils className="w-5 h-5 text-emerald-500" />
                Nutrition Tracker
              </h3>
              <p className="text-slate-500 text-xs sm:text-sm">Daily calorie and macro tracking</p>
            </div>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2 mb-4">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              Today
            </button>
          </div>

          {nutritionDataToUse ? (
            <div className="space-y-4">
              {/* Calories Progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Calories</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {nutritionDataToUse.totalCalories || 0} / {nutritionDataToUse.calorieGoal || 1800}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(((nutritionDataToUse.totalCalories || 0) / (nutritionDataToUse.calorieGoal || 1800)) * 100, 100)}%`,
                      backgroundColor: '#8B7355'
                    }}
                  />
                </div>
                {!nutritionDataToUse.calorieGoal && (
                  <p className="text-xs text-amber-600 mt-1">
                    <Link to="/profile" className="underline">Set your fitness goal</Link> for personalized targets
                  </p>
                )}
              </div>

              {/* Macros */}
              <div className="grid grid-cols-3 gap-3">
                {/* Protein */}
                <div className="bg-blue-50 rounded-xl p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Flame className="w-3 h-3 text-blue-500" />
                    <span className="text-xs text-blue-600 font-medium">Protein</span>
                  </div>
                  <p className="text-lg font-bold text-blue-700">{(nutritionDataToUse.totalProtein || 0).toFixed(2)}g</p>
                  <div className="w-full bg-blue-200 rounded-full h-1 mt-2">
                    <div
                      className="bg-blue-500 h-1 rounded-full"
                      style={{ width: `${Math.min(((nutritionDataToUse.totalProtein || 0) / (nutritionDataToUse.proteinGoal || 80)) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Carbs */}
                <div className="bg-amber-50 rounded-xl p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Flame className="w-3 h-3 text-amber-500" />
                    <span className="text-xs text-amber-600 font-medium">Carbs</span>
                  </div>
                  <p className="text-lg font-bold text-amber-700">{(nutritionDataToUse.totalCarbs || 0).toFixed(2)}g</p>
                  <div className="w-full bg-amber-200 rounded-full h-1 mt-2">
                    <div
                      className="bg-amber-500 h-1 rounded-full"
                      style={{ width: `${Math.min(((nutritionDataToUse.totalCarbs || 0) / (nutritionDataToUse.carbsGoal || 200)) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Fats */}
                <div className="bg-rose-50 rounded-xl p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Flame className="w-3 h-3 text-rose-500" />
                    <span className="text-xs text-rose-600 font-medium">Fats</span>
                  </div>
                  <p className="text-lg font-bold text-rose-700">{(nutritionDataToUse.totalFats || 0).toFixed(2)}g</p>
                  <div className="w-full bg-rose-200 rounded-full h-1 mt-2">
                    <div
                      className="bg-rose-500 h-1 rounded-full"
                      style={{ width: `${Math.min(((nutritionDataToUse.totalFats || 0) / (nutritionDataToUse.fatsGoal || 50)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Meals Logged */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-sm text-slate-600">Meals logged today</span>
                <span className="text-sm font-semibold text-slate-800">
                  {(nutritionDataToUse.mealsLogged?.breakfast ? 1 : 0) + 
                   (nutritionDataToUse.mealsLogged?.lunch ? 1 : 0) + 
                   (nutritionDataToUse.mealsLogged?.dinner ? 1 : 0) + 
                   (nutritionDataToUse.mealsLogged?.snacks || 0)}
                </span>
              </div>

              {/* Log Meal Button */}
              <Link
                to="/nutrition"
                className="w-full py-2 text-white rounded-xl font-medium hover:shadow-lg flex items-center justify-center gap-2 text-sm transition-all"
                style={{ backgroundColor: '#8B7355' }}
              >
                <Plus className="w-4 h-4" />
                Log Meal
              </Link>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Utensils className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-500 text-sm mb-4">No meals logged for this day</p>
              <Link
                to="/nutrition"
                className="inline-flex items-center gap-2 px-4 py-2 text-white rounded-xl font-medium hover:shadow-lg text-sm transition-all"
                style={{ backgroundColor: '#8B7355' }}
              >
                <Plus className="w-4 h-4" />
                Log Your First Meal
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Vital Signs Section */}
      <div>
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <h3 className="text-sm sm:text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-500" />
            Vital Signs & Activity
          </h3>
          
          {/* Report Filter Dropdown - Custom Styled */}
          <ReportFilterDropdown 
            reports={recentReports}
            selectedReport={selectedReport}
            onSelect={setSelectedReport}
          />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <MetricCard metricKey="heartRate" value={avgHeartRate} status={getStatus(avgHeartRate, 60, 100)} subtitle={hasWearableData ? 'From wearable' : 'Connect device'} onInfoClick={setSelectedMetric} />
          <MetricCard metricKey="sleep" value={avgSleep} status={avgSleep ? getStatus(parseFloat(avgSleep), 7, 9) : null} subtitle={recentSleep.length > 0 ? `${recentSleep.length} nights avg` : 'Track sleep'} onInfoClick={setSelectedMetric} />
          <MetricCard metricKey="steps" value={todayMetrics.steps > 0 ? todayMetrics.steps.toLocaleString() : null} unit="steps" status={todayMetrics.steps >= 8000 ? 'normal' : todayMetrics.steps >= 5000 ? 'low' : todayMetrics.steps > 0 ? 'critical' : null} subtitle={hasWearableData ? `${todayMetrics.caloriesBurned} cal` : 'Today'} onInfoClick={setSelectedMetric} />
          <MetricCard metricKey="cholesterol" value={metrics.cholesterol} previousValue={previousMetrics.cholesterol} allReports={recentReports} isSamePatient={isSamePatient} status={getStatus(metrics.cholesterol, 0, 200)} subtitle="From blood work" onInfoClick={setSelectedMetric} />
        </div>
      </div>

      {/* Vitamins & Minerals Section */}
      <div>
        <h3 className="text-sm sm:text-lg font-semibold text-slate-800 mb-2 sm:mb-3 flex items-center gap-2">
          <Pill className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
          Vitamins & Minerals
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <MetricCard metricKey="vitaminD" value={metrics.vitaminD} previousValue={previousMetrics.vitaminD} allReports={recentReports} isSamePatient={isSamePatient} status={getStatus(metrics.vitaminD, 30, 100)} subtitle="Bone & immune health" onInfoClick={setSelectedMetric} />
          <MetricCard metricKey="vitaminB12" value={metrics.vitaminB12} previousValue={previousMetrics.vitaminB12} allReports={recentReports} isSamePatient={isSamePatient} status={getStatus(metrics.vitaminB12, 300, 900)} subtitle="Energy & nerves" onInfoClick={setSelectedMetric} />
          <MetricCard metricKey="iron" value={metrics.iron} previousValue={previousMetrics.iron} allReports={recentReports} isSamePatient={isSamePatient} status={getStatus(metrics.iron, 60, 170)} subtitle="Blood oxygen" onInfoClick={setSelectedMetric} />
          <MetricCard metricKey="calcium" value={metrics.calcium} previousValue={previousMetrics.calcium} allReports={recentReports} isSamePatient={isSamePatient} status={getStatus(metrics.calcium, 8.5, 10.5)} subtitle="Bones & teeth" onInfoClick={setSelectedMetric} />
        </div>
      </div>

      {/* Blood & Hormones Section */}
      <div>
        <h3 className="text-sm sm:text-lg font-semibold text-slate-800 mb-2 sm:mb-3 flex items-center gap-2">
          <Droplets className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
          Blood & Hormones
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <MetricCard metricKey="hemoglobin" value={metrics.hemoglobin} previousValue={previousMetrics.hemoglobin} allReports={recentReports} isSamePatient={isSamePatient} status={getStatus(metrics.hemoglobin, 12, 17)} subtitle="Oxygen carrier" onInfoClick={setSelectedMetric} />
          <MetricCard metricKey="bloodSugar" value={metrics.bloodSugar} previousValue={previousMetrics.bloodSugar} allReports={recentReports} isSamePatient={isSamePatient} status={getStatus(metrics.bloodSugar, 70, 100)} subtitle="Fasting glucose" onInfoClick={setSelectedMetric} />
          <MetricCard metricKey="thyroid" value={metrics.tsh} previousValue={previousMetrics.tsh} allReports={recentReports} isSamePatient={isSamePatient} status={getStatus(metrics.tsh, 0.4, 4.0)} subtitle="Metabolism control" onInfoClick={setSelectedMetric} />
          <MetricCard metricKey="vitaminC" value={metrics.vitaminC} previousValue={previousMetrics.vitaminC} allReports={recentReports} isSamePatient={isSamePatient} status={getStatus(metrics.vitaminC, 0.6, 2.0)} subtitle="Immune & healing" onInfoClick={setSelectedMetric} />
        </div>
      </div>


      {/* Health Trend Analysis - Only show if user has reports */}
      {hasReports && healthScoreTrend.length > 1 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-500" />
              Health Improvement Tracking
            </h3>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Clock className="w-4 h-4" />
              Last updated: {new Date().toLocaleDateString()}
            </div>
          </div>

          {/* Health Status Indicators */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-600 text-sm">Overall Trend</span>
                <ArrowUp className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-green-500">Improved</span>
                <span className="text-xs text-slate-400">vs last month</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Based on lab values and wearable data</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-600 text-sm">Stable Metrics</span>
                <Minus className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-blue-500">6</span>
                <span className="text-xs text-slate-400">out of 12</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Maintaining healthy ranges</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-600 text-sm">Needs Attention</span>
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-yellow-500">2</span>
                <span className="text-xs text-slate-400">metrics</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Vitamin D, Iron levels</p>
            </div>
          </div>

          {/* Historical Lab Values Chart */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-slate-800 font-medium">Lab Values Trend</h4>
              <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-slate-700 text-sm">
                <option>Vitamin D</option>
                <option>Iron</option>
                <option>B12</option>
                <option>Hemoglobin</option>
              </select>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={healthScoreTrend.map((item, i) => ({
                date: item.date,
                score: item.score
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  labelStyle={{ color: '#64748b' }}
                />
                <Line type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span className="text-slate-600">Health Score Trend</span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-green-500" />
                <span className="text-slate-500">Target: 80+ score</span>
              </div>
            </div>
          </div>

          {/* Health Improvement Recommendations */}
          {analysisToUse?.recommendations && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h4 className="text-slate-800 font-medium mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-cyan-500" />
                Personalized Recommendations
              </h4>
              <div className="space-y-3">
                {analysisToUse.recommendations.lifestyle?.slice(0, 3).map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-slate-800 font-medium text-sm">{rec}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - AI Analysis */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Analysis Card */}
          <div className="rounded-2xl p-6" style={{ backgroundColor: '#F5F1EA', border: '2px solid #E5DFD3' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="px-3 py-1 rounded-full flex items-center gap-2" style={{ backgroundColor: '#E5DFD3' }}>
                  <Sparkles className="w-4 h-4 text-cyan-600" />
                  <span className="text-cyan-700 text-sm font-medium">AI ANALYSIS</span>
                </div>
              </div>
              <span className="text-slate-500 text-sm">
                {latestAnalysis ? 'Based on your reports' : 'No reports yet'}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">
              {analysisToUse?.summary?.split('.')[0] || 'Upload a health report to get AI insights'}
            </h3>
            <p className="text-slate-600 mb-6">
              {analysisToUse 
                ? analysisToUse.summary 
                : 'Our AI will analyze your health reports and provide personalized insights, recommendations, and track your health trends over time.'}
            </p>
            <div className="flex flex-wrap gap-3">
              {!hasReports && (
                <Link to="/upload" className="px-6 py-2 text-white rounded-xl font-medium hover:shadow-lg flex items-center gap-2" style={{ backgroundColor: '#8B7355' }}>
                  <Upload className="w-4 h-4" />
                  Upload Your First Report
                </Link>
              )}
              {hasWearableData && (
                <Link to="/wearables" className="px-6 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50">View Wearable Data</Link>
              )}
            </div>
          </div>

          {/* Key Findings */}
          {analysisToUse?.keyFindings?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Key Findings from Your Reports</h3>
              <div className="space-y-3">
                {analysisToUse.keyFindings.slice(0, 4).map((finding, idx) => {
                  const findingText = typeof finding === 'string' ? finding : (finding.title || finding.finding || JSON.stringify(finding));
                  const findingDesc = typeof finding === 'object' ? finding.description : null;
                  const severity = typeof finding === 'object' ? finding.severity : 'low';
                  return (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        severity === 'high' ? 'bg-red-500' : 
                        severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                      <div>
                        <p className="text-slate-800 font-medium">{findingText}</p>
                        {findingDesc && <p className="text-slate-500 text-sm mt-1">{findingDesc}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Devices & Reports */}
        <div className="space-y-6">
          {/* Recent Reports */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Recent Reports</h3>
              <Link to="/profile" className="text-cyan-500 text-sm hover:text-cyan-600">View All</Link>
            </div>
            <div className="space-y-3">
              {recentReports?.length > 0 ? (
                recentReports.slice(0, 3).map((report) => (
                  <Link key={report._id} to={`/reports/${report._id}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-800 font-medium truncate">{report.reportType}</p>
                      <p className="text-slate-400 text-sm">
                        {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      report.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      {report.status === 'completed' ? 'ANALYZED' : 'PENDING'}
                    </span>
                  </Link>
                ))
              ) : (
                <div className="text-center py-4">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">No reports uploaded yet</p>
                  <Link to="/upload" className="text-cyan-500 text-sm hover:text-cyan-600">
                    + Upload Report
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
