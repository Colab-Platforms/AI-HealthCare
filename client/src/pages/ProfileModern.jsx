import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  User, Activity, Heart, Mail, Calendar, Ruler, Scale, Droplet, 
  Pill, Apple, Dumbbell, Moon, Target, TrendingUp, Edit2, Save, X,
  CheckCircle, AlertCircle, Syringe, Utensils, Award, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function ProfileModern() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    profile: user?.profile || {}
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        profile: user.profile || {}
      });
    }
  }, [user]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await api.put('/auth/profile', {
        name: formData.name,
        profile: formData.profile
      });
      updateUser(response.data);
      toast.success('Profile updated successfully!');
      setEditMode(false);
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const bmi = formData.profile?.height && formData.profile?.weight
    ? (formData.profile.weight / ((formData.profile.height / 100) ** 2)).toFixed(1)
    : null;

  const diabetesProfile = formData.profile?.diabetesProfile || {};
  const dietPreferences = formData.profile?.dietPreferences || {};
  const fitnessProfile = formData.profile?.fitnessProfile || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 pb-20">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center border-4 border-white/30">
                <User className="w-12 h-12" />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">{formData.name}</h1>
                <p className="text-white/80 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {formData.email}
                </p>
                {formData.profile?.age && (
                  <p className="text-white/80 flex items-center gap-2 mt-1">
                    <Calendar className="w-4 h-4" />
                    {formData.profile.age} years • {formData.profile.gender}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => editMode ? handleSave() : setEditMode(true)}
              disabled={loading}
              className="px-6 py-3 bg-white text-cyan-600 rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2"
            >
              {editMode ? (
                <>
                  <Save className="w-5 h-5" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </>
              ) : (
                <>
                  <Edit2 className="w-5 h-5" />
                  Edit Profile
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-8 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: User },
              { id: 'diabetes', label: 'Diabetes Profile', icon: Activity },
              { id: 'body', label: 'Body Metrics', icon: Scale },
              { id: 'diet', label: 'Diet & Nutrition', icon: Apple },
              { id: 'fitness', label: 'Fitness & Goals', icon: Target }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`flex items-center gap-2 py-4 px-2 border-b-2 transition-colors whitespace-nowrap ${
                  activeSection === tab.id
                    ? 'border-cyan-500 text-cyan-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Quick Stats */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center">
                  <Scale className="w-6 h-6 text-cyan-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">BMI</p>
                  <p className="text-2xl font-bold text-gray-900">{bmi || '--'}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {bmi ? (bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese') : 'Not calculated'}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Diabetes Type</p>
                  <p className="text-2xl font-bold text-gray-900">{diabetesProfile.type || '--'}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {diabetesProfile.status || 'Not specified'}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <Target className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Primary Goal</p>
                  <p className="text-lg font-bold text-gray-900">
                    {fitnessProfile.primaryGoal?.replace('_', ' ') || 'Not set'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {fitnessProfile.timeframe ? `${fitnessProfile.timeframe} months` : ''}
              </p>
            </div>
          </div>
        )}

        {/* Diabetes Profile Section */}
        {activeSection === 'diabetes' && diabetesProfile && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Activity className="w-6 h-6 text-cyan-600" />
                Diabetes Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoCard label="Diabetes Type" value={diabetesProfile.type} icon={Activity} />
                <InfoCard label="Year of Diagnosis" value={diabetesProfile.diagnosisYear} icon={Calendar} />
                <InfoCard label="Current Status" value={diabetesProfile.status} icon={CheckCircle} />
                <InfoCard label="Latest HbA1c" value={diabetesProfile.hba1c ? `${diabetesProfile.hba1c}%` : 'Not recorded'} icon={TrendingUp} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Droplet className="w-6 h-6 text-blue-600" />
                Glucose Monitoring
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoCard label="Monitoring Method" value={diabetesProfile.glucoseMonitoring} icon={Droplet} />
                <InfoCard label="Testing Frequency" value={diabetesProfile.testingFrequency} icon={Calendar} />
                <InfoCard label="Fasting Glucose" value={diabetesProfile.fastingGlucose || 'Not recorded'} icon={TrendingUp} />
                <InfoCard label="Post-Meal Glucose" value={diabetesProfile.postMealGlucose || 'Not recorded'} icon={TrendingUp} />
              </div>
            </div>

            {diabetesProfile.onMedication && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Pill className="w-6 h-6 text-purple-600" />
                  Medication Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Medication Types</p>
                    <div className="flex flex-wrap gap-2">
                      {diabetesProfile.medicationType?.map((med, idx) => (
                        <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                          {med}
                        </span>
                      ))}
                    </div>
                  </div>
                  {diabetesProfile.insulinTiming && (
                    <InfoCard label="Insulin Timing" value={diabetesProfile.insulinTiming} icon={Syringe} />
                  )}
                  {diabetesProfile.recentDosageChange && (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-xl">
                      <AlertCircle className="w-5 h-5" />
                      <span className="text-sm">Recent dosage change recorded</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Body Metrics Section */}
        {activeSection === 'body' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Scale className="w-6 h-6 text-cyan-600" />
                Physical Measurements
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InfoCard label="Height" value={formData.profile.height ? `${formData.profile.height} cm` : '--'} icon={Ruler} />
                <InfoCard label="Weight" value={formData.profile.weight ? `${formData.profile.weight} kg` : '--'} icon={Scale} />
                <InfoCard label="BMI" value={bmi || '--'} icon={Activity} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Health Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoCard label="Blood Group" value={formData.profile.bloodGroup || 'Not specified'} icon={Droplet} />
                <InfoCard label="Blood Pressure" value={formData.profile.bloodPressure || 'Not recorded'} icon={Heart} />
              </div>
            </div>

            {formData.profile.otherConditions?.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Other Health Conditions</h3>
                <div className="flex flex-wrap gap-2">
                  {formData.profile.otherConditions.map((condition, idx) => (
                    <span key={idx} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                      {condition}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Diet & Nutrition Section */}
        {activeSection === 'diet' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Apple className="w-6 h-6 text-green-600" />
                Dietary Preferences
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoCard label="Diet Type" value={formData.profile.dietaryPreference || 'Not specified'} icon={Apple} />
                <InfoCard label="Cuisine Preference" value={dietPreferences.cuisinePreference || 'Not specified'} icon={Utensils} />
                <InfoCard label="Meals Per Day" value={dietPreferences.mealsPerDay || 'Not specified'} icon={Utensils} />
              </div>
            </div>

            {formData.profile.allergies?.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Food Restrictions & Allergies</h3>
                <div className="flex flex-wrap gap-2">
                  {formData.profile.allergies.map((allergy, idx) => (
                    <span key={idx} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fitness & Goals Section */}
        {activeSection === 'fitness' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Dumbbell className="w-6 h-6 text-cyan-600" />
                Activity & Exercise
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoCard label="Activity Level" value={formData.profile.activityLevel?.replace('_', ' ') || 'Not specified'} icon={Activity} />
                <InfoCard label="Sleep Duration" value={formData.profile.lifestyle?.sleepHours ? `${formData.profile.lifestyle.sleepHours} hours` : 'Not recorded'} icon={Moon} />
              </div>
            </div>

            {fitnessProfile.exercisePreference?.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Exercise Preferences</h3>
                <div className="flex flex-wrap gap-2">
                  {fitnessProfile.exercisePreference.map((exercise, idx) => (
                    <span key={idx} className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm">
                      {exercise}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Target className="w-6 h-6 text-green-600" />
                Health Goals
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoCard label="Primary Goal" value={fitnessProfile.primaryGoal?.replace('_', ' ') || 'Not set'} icon={Target} />
                <InfoCard label="Timeframe" value={fitnessProfile.timeframe ? `${fitnessProfile.timeframe} months` : 'Not set'} icon={Calendar} />
                <InfoCard label="Biggest Challenge" value={fitnessProfile.biggestChallenge?.replace('_', ' ') || 'Not specified'} icon={AlertCircle} />
              </div>
            </div>

            {(formData.profile.lifestyle?.smoker || formData.profile.lifestyle?.alcohol) && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Lifestyle Factors</h3>
                <div className="flex flex-wrap gap-2">
                  {formData.profile.lifestyle.smoker && (
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                      Smoker
                    </span>
                  )}
                  {formData.profile.lifestyle.alcohol && (
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
                      Alcohol Consumer
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Component
function InfoCard({ label, value, icon: Icon }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-gray-600" />
      </div>
      <div>
        <p className="text-sm text-gray-600">{label}</p>
        <p className="text-lg font-semibold text-gray-900 capitalize">{value || '--'}</p>
      </div>
    </div>
  );
}
