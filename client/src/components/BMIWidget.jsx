import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Target, TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// BMI Gauge Component - Desktop (Right-side half circle)
const BMIGaugeDesktop = ({ bmi }) => {
  const size = 200;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const [hoveredZone, setHoveredZone] = useState(null);

  const getNeedleAngle = () => {
    if (bmi < 16) return 0;
    if (bmi >= 40) return 180;
    return ((bmi - 16) / 24) * 180;
  };

  const angle = getNeedleAngle();

  const zones = [
    { start: 0, end: 30, color: '#ef4444', label: 'Underweight', range: '< 18.5' },
    { start: 30, end: 82.5, color: '#22c55e', label: 'Normal', range: '18.5 - 25' },
    { start: 82.5, end: 120, color: '#eab308', label: 'Overweight', range: '25 - 30' },
    { start: 120, end: 157.5, color: '#f97316', label: 'Obese', range: '30 - 35' },
    { start: 157.5, end: 180, color: '#dc2626', label: 'Severely Obese', range: '> 35' }
  ];

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size / 2 + 20} className="overflow-visible">
        {zones.map((zone, idx) => {
          const startAngle = zone.start - 90;
          const endAngle = zone.end - 90;
          const largeArc = endAngle - startAngle > 180 ? 1 : 0;
          
          const startX = size / 2 + radius * Math.cos((startAngle * Math.PI) / 180);
          const startY = size / 2 + radius * Math.sin((startAngle * Math.PI) / 180);
          const endX = size / 2 + radius * Math.cos((endAngle * Math.PI) / 180);
          const endY = size / 2 + radius * Math.sin((endAngle * Math.PI) / 180);

          return (
            <g key={idx}>
              <path
                d={`M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`}
                fill="none"
                stroke={zone.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                className="cursor-pointer transition-opacity hover:opacity-80"
                onMouseEnter={() => setHoveredZone(idx)}
                onMouseLeave={() => setHoveredZone(null)}
              />
            </g>
          );
        })}

        <g transform={`rotate(${angle - 90} ${size / 2} ${size / 2})`}>
          <line
            x1={size / 2}
            y1={size / 2}
            x2={size / 2 + radius - 10}
            y2={size / 2}
            stroke="#1e293b"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx={size / 2} cy={size / 2} r="8" fill="#1e293b" />
        </g>

        <text x={size / 2} y={size / 2 + 35} textAnchor="middle" className="text-3xl font-bold fill-slate-800">
          {bmi.toFixed(1)}
        </text>
        <text x={size / 2} y={size / 2 + 55} textAnchor="middle" className="text-xs fill-slate-500">
          kg/m²
        </text>
      </svg>

      {/* Hover Tooltip */}
      {hoveredZone !== null && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-2 px-3 py-2 bg-slate-800 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap z-10">
          <div className="font-semibold">{zones[hoveredZone].label}</div>
          <div className="text-slate-300">BMI: {zones[hoveredZone].range}</div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
        </div>
      )}
    </div>
  );
};

// BMI Gauge Component - Mobile (Top half circle) - Smooth design matching desktop
const BMIGaugeMobile = ({ bmi }) => {
  const size = 240;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const [hoveredZone, setHoveredZone] = useState(null);

  const getNeedleAngle = () => {
    if (bmi < 16) return 0;
    if (bmi >= 40) return 180;
    return ((bmi - 16) / 24) * 180;
  };

  const angle = getNeedleAngle();

  const zones = [
    { start: 0, end: 30, color: '#ef4444', label: 'Underweight', range: '< 18.5' },
    { start: 30, end: 82.5, color: '#22c55e', label: 'Normal', range: '18.5 - 25' },
    { start: 82.5, end: 120, color: '#eab308', label: 'Overweight', range: '25 - 30' },
    { start: 120, end: 157.5, color: '#f97316', label: 'Obese', range: '30 - 35' },
    { start: 157.5, end: 180, color: '#dc2626', label: 'Severely Obese', range: '> 35' }
  ];

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size / 2 + 30} className="overflow-visible">
        {zones.map((zone, idx) => {
          const startAngle = zone.start;
          const endAngle = zone.end;
          const largeArc = 0;
          
          const startX = size / 2 - radius * Math.cos((startAngle * Math.PI) / 180);
          const startY = size / 2 - radius * Math.sin((startAngle * Math.PI) / 180);
          const endX = size / 2 - radius * Math.cos((endAngle * Math.PI) / 180);
          const endY = size / 2 - radius * Math.sin((endAngle * Math.PI) / 180);

          return (
            <g key={idx}>
              <path
                d={`M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`}
                fill="none"
                stroke={zone.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                className="cursor-pointer transition-opacity active:opacity-80"
                onTouchStart={() => setHoveredZone(idx)}
                onTouchEnd={() => setHoveredZone(null)}
                onMouseEnter={() => setHoveredZone(idx)}
                onMouseLeave={() => setHoveredZone(null)}
              />
            </g>
          );
        })}

        <g transform={`rotate(${angle} ${size / 2} ${size / 2})`}>
          <line
            x1={size / 2}
            y1={size / 2}
            x2={size / 2 - radius + 12}
            y2={size / 2}
            stroke="#1e293b"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx={size / 2} cy={size / 2} r="9" fill="#1e293b" />
        </g>

        <text x={size / 2} y={size / 2 + 25} textAnchor="middle" className="text-4xl font-bold fill-slate-800">
          {bmi.toFixed(1)}
        </text>
        <text x={size / 2} y={size / 2 + 45} textAnchor="middle" className="text-sm fill-slate-500 font-medium">
          kg/m²
        </text>
      </svg>

      {/* Hover/Touch Tooltip */}
      {hoveredZone !== null && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap z-10 animate-fade-in">
          <div className="font-semibold">{zones[hoveredZone].label}</div>
          <div className="text-slate-300">BMI: {zones[hoveredZone].range}</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
        </div>
      )}
    </div>
  );
};

// BMI Category Component
const BMICategory = ({ bmi }) => {
  const getCategory = () => {
    if (bmi < 16) return { label: 'Severely Underweight', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle };
    if (bmi < 18.5) return { label: 'Underweight', color: 'bg-red-50 text-red-600 border-red-200', icon: AlertCircle };
    if (bmi < 25) return { label: 'Normal', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle };
    if (bmi < 30) return { label: 'Overweight', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: TrendingUp };
    if (bmi < 35) return { label: 'Obese', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: TrendingUp };
    return { label: 'Severely Obese', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle };
  };

  const category = getCategory();
  const Icon = category.icon;

  return (
    <div className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-1.5 lg:py-2 rounded-full border-2 ${category.color} font-semibold text-xs lg:text-sm`}>
      <Icon className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
      {category.label}
    </div>
  );
};

// No modal needed - will redirect to profile page

// Main BMI Widget Component
export default function BMIWidget() {
  const { user } = useAuth();
  const [bmi, setBMI] = useState(null);
  const [bmiPrime, setBMIPrime] = useState(null);
  const [ponderalIndex, setPonderalIndex] = useState(null);
  const [healthyWeightRange, setHealthyWeightRange] = useState(null);
  const [currentGoal, setCurrentGoal] = useState(null);

  useEffect(() => {
    calculateBMI();
    fetchCurrentGoal();
  }, [user]);

  const calculateBMI = () => {
    const height = user?.profile?.height; // in cm
    const weight = user?.profile?.weight; // in kg

    if (!height || !weight) {
      return;
    }

    // Calculate BMI
    const heightInMeters = height / 100;
    const calculatedBMI = weight / (heightInMeters * heightInMeters);
    setBMI(calculatedBMI);

    // Calculate BMI Prime (BMI / 25)
    const prime = calculatedBMI / 25;
    setBMIPrime(prime);

    // Calculate Ponderal Index (weight / height^3)
    const ponderal = weight / Math.pow(heightInMeters, 3);
    setPonderalIndex(ponderal);

    // Calculate healthy weight range (BMI 18.5-25)
    const minWeight = 18.5 * heightInMeters * heightInMeters;
    const maxWeight = 25 * heightInMeters * heightInMeters;
    setHealthyWeightRange({ min: minWeight.toFixed(1), max: maxWeight.toFixed(1) });
  };

  const fetchCurrentGoal = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`${API_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentGoal(data.user?.nutritionGoal);
    } catch (error) {
      console.error('Failed to fetch goal:', error);
    }
  };

  if (!bmi) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-orange-50 rounded-2xl border-2 border-cyan-200 p-6">
        <div className="text-center">
          <Target className="w-12 h-12 text-cyan-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800 mb-2">Complete Your Profile</h3>
          <p className="text-sm text-slate-600 mb-4">
            Add your height and weight to see your BMI and get personalized recommendations
          </p>
          <a
            href="/profile"
            className="inline-block px-6 py-2 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-600 transition-colors"
          >
            Update Profile
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-br from-purple-50 to-orange-50 rounded-2xl border-2 border-cyan-200 p-4 lg:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row items-center gap-3 lg:gap-6">
          {/* BMI Gauge - Mobile version (top half-circle) visible only on mobile */}
          <div className="lg:hidden w-full flex justify-center">
            <BMIGaugeMobile bmi={bmi} />
          </div>

          {/* BMI Gauge - Desktop version (right-side half-circle) visible only on desktop */}
          <div className="hidden lg:block flex-shrink-0">
            <BMIGaugeDesktop bmi={bmi} />
          </div>

          {/* BMI Info - Compact on mobile */}
          <div className="flex-1 w-full space-y-2 lg:space-y-4 text-center lg:text-left">
            {/* Category Badge - Compact on mobile */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-2 justify-center lg:justify-start">
              <h3 className="hidden lg:block text-2xl font-bold text-slate-800">Your BMI</h3>
              <BMICategory bmi={bmi} />
            </div>

            {/* Stats Grid - Smaller on mobile */}
            <div className="grid grid-cols-2 gap-2 lg:gap-3">
              <div className="bg-white rounded-lg lg:rounded-xl p-2 lg:p-3 border border-slate-200">
                <p className="text-[10px] lg:text-xs text-slate-600 mb-0.5 lg:mb-1">Healthy BMI</p>
                <p className="text-xs lg:text-sm font-bold text-slate-800">18.5 - 25</p>
              </div>
              <div className="bg-white rounded-lg lg:rounded-xl p-2 lg:p-3 border border-slate-200">
                <p className="text-[10px] lg:text-xs text-slate-600 mb-0.5 lg:mb-1">Healthy Weight</p>
                <p className="text-xs lg:text-sm font-bold text-slate-800">
                  {healthyWeightRange?.min} - {healthyWeightRange?.max} kg
                </p>
              </div>
              <div className="bg-white rounded-lg lg:rounded-xl p-2 lg:p-3 border border-slate-200">
                <p className="text-[10px] lg:text-xs text-slate-600 mb-0.5 lg:mb-1">BMI Prime</p>
                <p className="text-xs lg:text-sm font-bold text-slate-800">{bmiPrime?.toFixed(2)}</p>
              </div>
              <div className="bg-white rounded-lg lg:rounded-xl p-2 lg:p-3 border border-slate-200">
                <p className="text-[10px] lg:text-xs text-slate-600 mb-0.5 lg:mb-1">Ponderal Index</p>
                <p className="text-xs lg:text-sm font-bold text-slate-800">{ponderalIndex?.toFixed(1)} kg/m³</p>
              </div>
            </div>

            {/* Current Goal or Set Goal Button - Compact on mobile */}
            {currentGoal?.goal ? (
              <div className="bg-white rounded-lg lg:rounded-xl p-2.5 lg:p-4 border-2 border-cyan-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 lg:gap-3">
                  <div className="text-center sm:text-left">
                    <p className="text-[10px] lg:text-xs text-slate-600 mb-0.5 lg:mb-1">Current Goal</p>
                    <p className="text-xs lg:text-sm font-bold text-slate-800 capitalize">
                      {currentGoal.goal.replace('_', ' ')}
                      {currentGoal.targetWeight && ` - ${currentGoal.targetWeight} kg`}
                    </p>
                  </div>
                  <Link
                    to="/profile?tab=goals"
                    className="px-3 py-1.5 lg:px-4 lg:py-2 bg-cyan-500 text-white rounded-lg text-xs lg:text-sm font-medium hover:bg-cyan-600 transition-colors whitespace-nowrap"
                  >
                    Change
                  </Link>
                </div>
              </div>
            ) : (
              <Link
                to="/profile?tab=goals"
                className="w-full py-2 lg:py-3 bg-cyan-500 text-white rounded-lg lg:rounded-xl font-semibold hover:bg-cyan-600 transition-colors flex items-center justify-center gap-2 text-sm lg:text-base"
              >
                <Target className="w-4 h-4 lg:w-5 lg:h-5" />
                Set Your Goal
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
