import { useState, useEffect } from 'react';
import { Target, TrendingUp, TrendingDown, AlertCircle, CheckCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// BMI Gauge Component
const BMIGauge = ({ bmi }) => {
  const size = 200;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // Half circle

  // Calculate angle for needle (0-180 degrees)
  // BMI ranges: <16 (severe underweight), 16-18.5 (underweight), 18.5-25 (normal), 25-30 (overweight), 30-35 (obese), >35 (severely obese)
  const getNeedleAngle = () => {
    if (bmi < 16) return 0;
    if (bmi >= 40) return 180;
    // Map BMI 16-40 to 0-180 degrees
    return ((bmi - 16) / 24) * 180;
  };

  const angle = getNeedleAngle();

  // Define color zones
  const zones = [
    { start: 0, end: 30, color: '#ef4444', label: 'Underweight' }, // Red (0-30 degrees = BMI 16-18.5)
    { start: 30, end: 82.5, color: '#22c55e', label: 'Normal' }, // Green (30-82.5 degrees = BMI 18.5-25)
    { start: 82.5, end: 120, color: '#eab308', label: 'Overweight' }, // Yellow (82.5-120 degrees = BMI 25-30)
    { start: 120, end: 157.5, color: '#f97316', label: 'Obese' }, // Orange (120-157.5 degrees = BMI 30-35)
    { start: 157.5, end: 180, color: '#dc2626', label: 'Severely Obese' } // Dark Red (157.5-180 degrees = BMI 35-40)
  ];

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size / 2 + 20} className="overflow-visible">
        {/* Background arc zones */}
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

        {/* Needle */}
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

        {/* Center text */}
        <text
          x={size / 2}
          y={size / 2 + 35}
          textAnchor="middle"
          className="text-3xl font-bold fill-slate-800"
        >
          {bmi.toFixed(1)}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 55}
          textAnchor="middle"
          className="text-xs fill-slate-500"
        >
          kg/m²
        </text>
      </svg>

      {/* Labels */}
      <div className="absolute bottom-0 left-0 text-[10px] text-slate-600 font-medium">16</div>
      <div className="absolute bottom-0 right-0 text-[10px] text-slate-600 font-medium">40</div>
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

// Goal Setting Modal
const GoalModal = ({ isOpen, onClose, currentBMI, onSave }) => {
  const [goalType, setGoalType] = useState('maintain');
  const [targetWeight, setTargetWeight] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (goalType !== 'maintain' && !targetWeight) {
      toast.error('Please enter target weight');
      return;
    }

    setLoading(true);
    try {
      await onSave({ goalType, targetWeight: parseFloat(targetWeight) || null });
      onClose();
    } catch (error) {
      toast.error('Failed to save goal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-800">Set Your BMI Goal</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Goal Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">What's your goal?</label>
            <div className="space-y-2">
              {[
                { value: 'weight_loss', label: 'Lose Weight', icon: TrendingDown },
                { value: 'maintain', label: 'Maintain Weight', icon: Target },
                { value: 'weight_gain', label: 'Gain Weight', icon: TrendingUp }
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setGoalType(value)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    goalType === value
                      ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Target Weight */}
          {goalType !== 'maintain' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Target Weight (kg)</label>
              <input
                type="number"
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
                placeholder="Enter target weight"
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-cyan-500 focus:outline-none"
              />
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-3 bg-cyan-500 text-white rounded-xl font-semibold hover:bg-cyan-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Goal'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Main BMI Widget Component
export default function BMIWidget() {
  const { user } = useAuth();
  const [bmi, setBMI] = useState(null);
  const [bmiPrime, setBMIPrime] = useState(null);
  const [ponderalIndex, setPonderalIndex] = useState(null);
  const [healthyWeightRange, setHealthyWeightRange] = useState(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
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

  const handleSaveGoal = async (goal) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/api/auth/profile`,
        {
          nutritionGoal: {
            goal: goal.goalType,
            targetWeight: goal.targetWeight,
            lastUpdated: new Date()
          }
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Goal saved successfully!');
      fetchCurrentGoal();
    } catch (error) {
      throw error;
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
      <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl border-2 border-cyan-200 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* BMI Gauge */}
          <div className="flex-shrink-0">
            <BMIGauge bmi={bmi} />
          </div>

          {/* BMI Info */}
          <div className="flex-1 space-y-4 text-center lg:text-left">
            <div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Your BMI</h3>
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
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Current Goal</p>
                    <p className="text-sm font-bold text-slate-800 capitalize">
                      {currentGoal.goal.replace('_', ' ')}
                      {currentGoal.targetWeight && ` - ${currentGoal.targetWeight} kg`}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowGoalModal(true)}
                    className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 transition-colors"
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowGoalModal(true)}
                className="w-full py-3 bg-cyan-500 text-white rounded-xl font-semibold hover:bg-cyan-600 transition-colors flex items-center justify-center gap-2"
              >
                <Target className="w-5 h-5" />
                Set Your Goal
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Goal Modal */}
      <GoalModal
        isOpen={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        currentBMI={bmi}
        onSave={handleSaveGoal}
      />
    </>
  );
}
