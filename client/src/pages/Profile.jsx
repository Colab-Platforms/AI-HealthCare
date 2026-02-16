import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  User, Activity, Heart, Mail, Calendar, Ruler, Scale, Droplet, 
  Pill, Apple, Dumbbell, Moon, Target, TrendingUp, Edit2, Save, X,
  CheckCircle, AlertCircle, Syringe, Utensils, Award, ChevronRight, TrendingDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [activeSection, setActiveSection] = useState('profile');
  const [goalLoading, setGoalLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    profile: user?.profile || {}
  });

  const [goalData, setGoalData] = useState({
    primaryGoal: '',
    targetWeight: '',
    timeframe: '',
    activityLevel: '',
    exercisePreference: [],
    biggestChallenge: '',
    motivation: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        profile: user.profile || {}
      });
      
      // Load existing fitness goals
      const fitnessProfile = user.profile?.fitnessProfile || {};
      setGoalData({
        primaryGoal: fitnessProfile.primaryGoal || '',
        targetWeight: fitnessProfile.targetWeight || '',
        timeframe: fitnessProfile.timeframe || '',
        activityLevel: user.profile?.activityLevel || '',
        exercisePreference: fitnessProfile.exercisePreference || [],
        biggestChallenge: fitnessProfile.biggestChallenge || '',
        motivation: fitnessProfile.motivation || ''
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

  const handleGoalSave = async () => {
    setGoalLoading(true);
    try {
      const updatedProfile = {
        ...formData.profile,
        activityLevel: goalData.activityLevel,
        fitnessProfile: {
          primaryGoal: goalData.primaryGoal,
          targetWeight: goalData.targetWeight,
          timeframe: goalData.timeframe,
          exercisePreference: goalData.exercisePreference,
          biggestChallenge: goalData.biggestChallenge,
          motivation: goalData.motivation
        }
      };

      const response = await api.put('/auth/profile', {
        name: formData.name,
        profile: updatedProfile
      });
      
      updateUser(response.data);
      toast.success('Fitness goals updated successfully!');
    } catch (error) {
      toast.error('Failed to update fitness goals');
    } finally {
      setGoalLoading(false);
    }
  };

  const toggleExercise = (exercise) => {
    setGoalData(prev => ({
      ...prev,
      exercisePreference: prev.exercisePreference.includes(exercise)
        ? prev.exercisePreference.filter(e => e !== exercise)
        : [...prev.exercisePreference, exercise]
    }));
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
          <div className="flex gap-8">
            {[
              { id: 'profile', label: 'Profile', icon: User },
              { id: 'goal', label: 'Set Goal', icon: Target }
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
        {/* Profile Section */}
        {activeSection === 'profile' && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

            {/* Diabetes Profile */}
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

            {/* Body Metrics */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Scale className="w-6 h-6 text-cyan-600" />
                Physical Measurements
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InfoCard label="Height" value={formData.profile.height ? `${formData.profile.height} cm` : '--'} icon={Ruler} />
                <InfoCard label="Weight" value={formData.profile.weight ? `${formData.profile.weight} kg` : '--'} icon={Scale} />
                <InfoCard label="Blood Group" value={formData.profile.bloodGroup || 'Not specified'} icon={Droplet} />
              </div>
            </div>

            {/* Diet & Nutrition */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Apple className="w-6 h-6 text-green-600" />
                Dietary Preferences
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoCard label="Diet Type" value={formData.profile.dietaryPreference || 'Not specified'} icon={Apple} />
                <InfoCard label="Cuisine Preference" value={dietPreferences.cuisinePreference || 'Not specified'} icon={Utensils} />
              </div>
              {formData.profile.allergies?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">Food Restrictions & Allergies</p>
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

            {/* Medication */}
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
                </div>
              </div>
            )}
          </div>
        )}

        {/* Set Goal Section */}
        {activeSection === 'goal' && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                  <Target className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Set Your Fitness Goals</h2>
                  <p className="text-gray-600">Define your health and fitness objectives</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Primary Goal */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    What is your primary fitness goal?
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { value: 'weight_loss', label: 'Weight Loss', icon: TrendingDown },
                      { value: 'weight_gain', label: 'Weight Gain', icon: TrendingUp },
                      { value: 'muscle_building', label: 'Muscle Building', icon: Dumbbell },
                      { value: 'maintain_health', label: 'Maintain Health', icon: Heart },
                      { value: 'improve_fitness', label: 'Improve Fitness', icon: Activity },
                      { value: 'diabetes_management', label: 'Diabetes Management', icon: Activity }
                    ].map(goal => (
                      <button
                        key={goal.value}
                        onClick={() => setGoalData({ ...goalData, primaryGoal: goal.value })}
                        className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                          goalData.primaryGoal === goal.value
                            ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <goal.icon className="w-5 h-5" />
                        <span className="font-medium">{goal.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Weight */}
                {(goalData.primaryGoal === 'weight_loss' || goalData.primaryGoal === 'weight_gain') && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Target Weight (kg)
                    </label>
                    <input
                      type="number"
                      value={goalData.targetWeight}
                      onChange={(e) => setGoalData({ ...goalData, targetWeight: e.target.value })}
                      placeholder="Enter your target weight"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                    {formData.profile.weight && goalData.targetWeight && (
                      <p className="text-sm text-gray-600 mt-2">
                        Current: {formData.profile.weight} kg → Target: {goalData.targetWeight} kg 
                        ({Math.abs(formData.profile.weight - goalData.targetWeight).toFixed(1)} kg difference)
                      </p>
                    )}
                  </div>
                )}

                {/* Timeframe */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Timeframe to achieve your goal
                  </label>
                  <select
                    value={goalData.timeframe}
                    onChange={(e) => setGoalData({ ...goalData, timeframe: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="">Select timeframe</option>
                    <option value="1">1 month</option>
                    <option value="2">2 months</option>
                    <option value="3">3 months</option>
                    <option value="6">6 months</option>
                    <option value="12">1 year</option>
                    <option value="24">2 years</option>
                  </select>
                </div>

                {/* Activity Level */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Current Activity Level
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise' },
                      { value: 'lightly_active', label: 'Lightly Active', desc: 'Light exercise 1-3 days/week' },
                      { value: 'moderately_active', label: 'Moderately Active', desc: 'Moderate exercise 3-5 days/week' },
                      { value: 'very_active', label: 'Very Active', desc: 'Hard exercise 6-7 days/week' },
                      { value: 'extremely_active', label: 'Extremely Active', desc: 'Very hard exercise & physical job' }
                    ].map(level => (
                      <button
                        key={level.value}
                        onClick={() => setGoalData({ ...goalData, activityLevel: level.value })}
                        className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                          goalData.activityLevel === level.value
                            ? 'border-cyan-500 bg-cyan-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-gray-900">{level.label}</div>
                        <div className="text-sm text-gray-600">{level.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exercise Preferences */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Preferred Exercise Types (Select all that apply)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      'Walking', 'Running', 'Cycling', 'Swimming', 
                      'Yoga', 'Gym', 'Sports', 'Dancing', 'Home Workouts'
                    ].map(exercise => (
                      <button
                        key={exercise}
                        onClick={() => toggleExercise(exercise)}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          goalData.exercisePreference.includes(exercise)
                            ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {exercise}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Biggest Challenge */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    What's your biggest challenge?
                  </label>
                  <select
                    value={goalData.biggestChallenge}
                    onChange={(e) => setGoalData({ ...goalData, biggestChallenge: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="">Select challenge</option>
                    <option value="time_management">Time Management</option>
                    <option value="motivation">Staying Motivated</option>
                    <option value="diet_control">Diet Control</option>
                    <option value="exercise_routine">Sticking to Exercise Routine</option>
                    <option value="stress">Managing Stress</option>
                    <option value="sleep">Getting Enough Sleep</option>
                  </select>
                </div>

                {/* Motivation */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    What motivates you? (Optional)
                  </label>
                  <textarea
                    value={goalData.motivation}
                    onChange={(e) => setGoalData({ ...goalData, motivation: e.target.value })}
                    placeholder="Share what drives you to achieve your fitness goals..."
                    rows="3"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Save Button */}
                <button
                  onClick={handleGoalSave}
                  disabled={goalLoading || !goalData.primaryGoal}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {goalLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Fitness Goals
                    </>
                  )}
                </button>
              </div>
            </div>
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
