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

  const getNeedleAngle = () => {
    if (bmi < 16) return 0;
    if (bmi >= 40) return 180;
    return ((bmi - 16) / 24) * 180;
  };

  const angle = getNeedleAngle();

  const zones = [
    { start: 0, end: 30, color: '#ef4444' },
    { start: 30, end: 82.5, color: '#22c55e' },
    { start: 82.5, end: 120, color: '#eab308' },
    { start: 120, end: 157.5, color: '#f97316' },
    { start: 157.5, end: 180, color: '#dc2626' }
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
            <path
              key={idx}
              d={`M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`}
              fill="none"
              stroke={zone.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
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

      <div className="absolute bottom-0 left-0 text-[10px] text-slate-600 font-medium">16</div>
      <div className="absolute bottom-0 right-0 text-[10px] text-slate-600 font-medium">40</div>
    </div>
  );
};

// BMI Gauge Component - Mobile (Top half circle)
const BMIGaugeMobile = ({ bmi }) => {
  const size = 200;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;

  const getNeedleAngle = () => {
    if (bmi < 16) return 0;
    if (bmi >= 40) return 180;
    return ((bmi - 16) / 24) * 180;
  };

  const angle = getNeedleAngle();

  const zones = [
    { start: 0, end: 30, color: '#ef4444' },
    { start: 30, end: 82.5, color: '#22c55e' },
    { start: 82.5, end: 120, color: '#eab308' },
    { start: 120, end: 157.5, color: '#f97316' },
    { start: 157.5, end: 180, color: '#dc2626' }
  ];

  return (
    <div className="relative flex flex-col items-center justify-center w-full">
      <svg width={size} height={size / 2 + 40} viewBox={`0 0 ${size} ${size / 2 + 40}`} className="overflow-visible">
        {zones.map((zone, idx) => {
          const startAngle = zone.start;
          const endAngle = zone.end;
          const largeArc = endAngle - startAngle > 180 ? 1 : 0;
          
          const startX = size / 2 + radius * Math.cos(((180 - startAngle) * Math.PI) / 180);
          const startY = size / 2 - radius * Math.sin(((180 - startAngle) * Math.PI) / 180);
          const endX = size / 2 + radius * Math.cos(((180 - endAngle) * Math.PI) / 180);
          const endY = size / 2 - radius * Math.sin(((180 - endAngle) * Math.PI) / 180);

          return (
            <path
              key={idx}
              d={`M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 0 ${endX} ${endY}`}
              fill="none"
              stroke={zone.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          );
        })}

        <g transform={`rotate(${-angle} ${size / 2} ${size / 2})`}>
          <line
            x1={size / 2}
            y1={size / 2}
            x2={size / 2}
            y2={size / 2 - radius + 10}
            stroke="#1e293b"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx={size / 2} cy={size / 2} r="8" fill="#1e293b" />
        </g>

        <text x={size / 2} y={size / 2 + 20} textAnchor="middle" className="text-3xl font-bold fill-slate-800">
          {bmi.toFixed(1)}
        </text>
        <text x={size / 2} y={size / 2 + 38} textAnchor="middle" className="text-xs fill-slate-500">
          kg/m²
        </text>

        <text x="20" y={size / 2 + 5} className="text-[10px] fill-slate-600 font-medium">16</text>
        <text x={size - 30} y={size / 2 + 5} className="text-[10px] fill-slate-600 font-medium">40</text>
      </svg>
      
      <p className="text-xs text-slate-600 font-medium mt-2">Your BMI</p>
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
    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 ${category.color} font-semibold text-sm`}>
      <Icon className="w-4 h-4" />
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
      <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl border-2 border-cyan-200 p-6">
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
      <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl border-2 border-cyan-200 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-6">
          {/* BMI Gauge - Mobile version (top half-circle) visible only on mobile */}
          <div className="lg:hidden w-full max-w-xs">
            <BMIGaugeMobile bmi={bmi} />
          </div>

          {/* BMI Gauge - Desktop version (right-side half-circle) visible only on desktop */}
          <div className="hidden lg:block flex-shrink-0">
            <BMIGaugeDesktop bmi={bmi} />
          </div>

          {/* BMI Info */}
          <div className="flex-1 w-full space-y-4 text-center lg:text-left">
            <div className="flex flex-col lg:flex-row lg:items-center gap-2">
              <h3 className="hidden lg:block text-2xl font-bold text-slate-800">Your BMI</h3>
              <BMICategory bmi={bmi} />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-3 border border-slate-200">
                <p className="text-xs text-slate-600 mb-1">Healthy BMI Range</p>
                <p className="text-sm font-bold text-slate-800">18.5 - 25 kg/m²</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-slate-200">
                <p className="text-xs text-slate-600 mb-1">Healthy Weight</p>
                <p className="text-sm font-bold text-slate-800">
                  {healthyWeightRange?.min} - {healthyWeightRange?.max} kg
                </p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-slate-200">
                <p className="text-xs text-slate-600 mb-1">BMI Prime</p>
                <p className="text-sm font-bold text-slate-800">{bmiPrime?.toFixed(2)}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-slate-200">
                <p className="text-xs text-slate-600 mb-1">Ponderal Index</p>
                <p className="text-sm font-bold text-slate-800">{ponderalIndex?.toFixed(1)} kg/m³</p>
              </div>
            </div>

            {/* Current Goal or Set Goal Button */}
            {currentGoal?.goal ? (
              <div className="bg-white rounded-xl p-4 border-2 border-cyan-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-center sm:text-left">
                    <p className="text-xs text-slate-600 mb-1">Current Goal</p>
                    <p className="text-sm font-bold text-slate-800 capitalize">
                      {currentGoal.goal.replace('_', ' ')}
                      {currentGoal.targetWeight && ` - ${currentGoal.targetWeight} kg`}
                    </p>
                  </div>
                  <Link
                    to="/profile?tab=goals"
                    className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 transition-colors whitespace-nowrap"
                  >
                    Change
                  </Link>
                </div>
              </div>
            ) : (
              <Link
                to="/profile?tab=goals"
                className="w-full py-3 bg-cyan-500 text-white rounded-xl font-semibold hover:bg-cyan-600 transition-colors flex items-center justify-center gap-2"
              >
                <Target className="w-5 h-5" />
                Set Your Goal
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
