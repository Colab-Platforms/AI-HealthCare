import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { healthService } from '../services/api';
import { 
  Apple, Coffee, Sun, Moon, Utensils, 
  CheckCircle, Lightbulb, ChevronDown, ChevronUp, Leaf, Sparkles,
  Target, TrendingUp, Zap, Heart, ArrowRight, Calendar, Clock, FileText, AlertCircle, Bell
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DietPlan() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [personalizedPlan, setPersonalizedPlan] = useState(null);
  const [supplementRecommendations, setSupplementRecommendations] = useState(null);
  const [expandedMeal, setExpandedMeal] = useState(null);
  const [allReports, setAllReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [hasNutritionGoal, setHasNutritionGoal] = useState(false);
  const [nutritionGoal, setNutritionGoal] = useState(null);
  const [isPlanOutdated, setIsPlanOutdated] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    checkNutritionGoal();
    fetchAllReports();
    fetchPersonalizedPlan();
    fetchSupplementRecommendations();
  }, []);

  // Check if plan is outdated when both nutritionGoal and personalizedPlan are loaded
  useEffect(() => {
    if (nutritionGoal && personalizedPlan && personalizedPlan.generatedAt) {
      const planDate = new Date(personalizedPlan.generatedAt);
      const goalDate = new Date(nutritionGoal.updatedAt || nutritionGoal.createdAt);
      
      console.log('🔍 Checking if plan is outdated...');
      console.log('📅 Plan generated:', planDate);
      console.log('📅 Goal updated:', goalDate);
      
      if (goalDate > planDate) {
        setIsPlanOutdated(true);
        console.log('⚠️ Diet plan is OUTDATED - goals were updated after plan generation');
      } else {
        setIsPlanOutdated(false);
        console.log('✅ Diet plan is up-to-date');
      }
    }
  }, [nutritionGoal, personalizedPlan]);

  useEffect(() => {
    if (selectedReportId) {
      fetchReportDietPlan(selectedReportId);
    }
  }, [selectedReportId]);

  // Check if user has set nutrition goals
  const checkNutritionGoal = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/nutrition/goals', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('🔍 Nutrition goal response status:', response.status);
      
      // Handle 404 - no goal set yet
      if (response.status === 404) {
        setHasNutritionGoal(false);
        console.log('❌ No nutrition goal set (404)');
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        console.log('📦 Full response data:', JSON.stringify(data, null, 2));
        console.log('📦 data.success:', data.success);
        console.log('📦 data.healthGoal:', data.healthGoal);
        console.log('📦 data.healthGoal?.goalType:', data.healthGoal?.goalType);
        
        if (data.success && data.healthGoal && data.healthGoal.goalType) {
          setHasNutritionGoal(true);
          setNutritionGoal(data.healthGoal);
          console.log('✅ User has nutrition goal:', data.healthGoal.goalType);
        } else {
          setHasNutritionGoal(false);
          console.log('❌ No nutrition goal in response');
        }
      } else {
        setHasNutritionGoal(false);
        console.log('❌ Failed to fetch nutrition goal, status:', response.status);
      }
    } catch (error) {
      console.error('Failed to check nutrition goal:', error);
      setHasNutritionGoal(false);
    }
  };

  // Auto-generate plan if user has goals but no plan
  // DISABLED: Requires manual generation until server routes are available
  /*
  useEffect(() => {
    const autoGeneratePlan = async () => {
      // Wait for initial load to complete
      if (loading) return;
      
      // Check if user has nutrition goals set
      const hasGoals = user?.nutritionGoal?.goal;
      
      // If no plan exists and user has goals, auto-generate
      if (!personalizedPlan && hasGoals && !generating) {
        console.log('🎯 Auto-generating diet plan based on user goals...');
        await generateAIPlan();
      }
    };

    autoGeneratePlan();
  }, [loading, personalizedPlan, user]);
  */

  const fetchAllReports = async () => {
    try {
      const { data } = await healthService.getReports();
      // Handle both array and object response formats
      const reports = Array.isArray(data) ? data : (data.reports || []);
      const reportsWithDietPlan = reports.filter(r => r.aiAnalysis?.dietPlan);
      setAllReports(reportsWithDietPlan);
      
      // Auto-select the latest report with diet plan
      if (reportsWithDietPlan.length > 0 && !selectedReportId) {
        const latestReport = reportsWithDietPlan[0];
        setSelectedReportId(latestReport._id);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReportDietPlan = async (reportId) => {
    try {
      setLoading(true);
      const { data } = await healthService.getReport(reportId);
      const report = data.report;
      
      console.log('📊 Report Data:', report);
      console.log('📊 AI Analysis:', report.aiAnalysis);
      console.log('📊 Diet Plan:', report.aiAnalysis?.dietPlan);
      
      if (report.aiAnalysis?.dietPlan) {
        const dietPlan = report.aiAnalysis.dietPlan;
        console.log('🍽️ Breakfast:', dietPlan.breakfast);
        console.log('🍽️ Lunch:', dietPlan.lunch);
        console.log('🍽️ Dinner:', dietPlan.dinner);
        console.log('🍽️ Snacks:', dietPlan.snacks);
        
        // Try to get user's fitness goals for accurate macro targets
        let macroTargets = { protein: 150, carbs: 250, fats: 65 };
        let dailyCalorieTarget = 2000;
        let hasGoals = false;
        
        try {
          const token = localStorage.getItem('token');
          const goalsResponse = await fetch('/api/nutrition/goals', {
            headers: { Authorization: `Bearer ${token}` }
          });
          const goalsData = await goalsResponse.json();
          
          if (goalsData.healthGoal) {
            dailyCalorieTarget = goalsData.healthGoal.dailyCalorieTarget || 2000;
            macroTargets = goalsData.healthGoal.macroTargets || macroTargets;
            hasGoals = true;
          }
        } catch (goalError) {
          console.log('Using default macro targets');
        }
        
        // Convert report diet plan to personalized plan format
        const planData = {
          mealPlan: {
            breakfast: Array.isArray(dietPlan.breakfast) ? dietPlan.breakfast : [],
            lunch: Array.isArray(dietPlan.lunch) ? dietPlan.lunch : [],
            dinner: Array.isArray(dietPlan.dinner) ? dietPlan.dinner : [],
            snacks: Array.isArray(dietPlan.snacks) ? dietPlan.snacks : []
          },
          dailyCalorieTarget,
          macroTargets,
          hasGoals,
          keyFoods: [],
          lifestyleRecommendations: Array.isArray(dietPlan.tips) ? dietPlan.tips : [],
          createdAt: report.createdAt,
          source: 'report',
          reportId: reportId
        };
        
        console.log('✅ Setting personalized plan:', planData);
        console.log('✅ Meal counts:', {
          breakfast: planData.mealPlan.breakfast.length,
          lunch: planData.mealPlan.lunch.length,
          dinner: planData.mealPlan.dinner.length,
          snacks: planData.mealPlan.snacks.length
        });
        
        setPersonalizedPlan(planData);
        
        if (planData.mealPlan.breakfast.length === 0 && 
            planData.mealPlan.lunch.length === 0 && 
            planData.mealPlan.dinner.length === 0 && 
            planData.mealPlan.snacks.length === 0) {
          toast.error('Diet plan is empty. The AI analysis may not have generated meal recommendations.');
        }
      } else {
        console.log('❌ No diet plan in AI analysis');
        setPersonalizedPlan(null);
        toast.error('This report does not contain a diet plan');
      }
    } catch (error) {
      console.error('❌ Failed to fetch report diet plan:', error);
      toast.error('Failed to load diet plan from report');
      setPersonalizedPlan(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchPersonalizedPlan = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/diet-recommendations/diet-plan/active', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Handle 404 - routes not available
      if (response.status === 404) {
        console.log('Diet recommendation routes not available');
        return;
      }
      
      const data = await response.json();
      if (data.success && data.dietPlan) {
        setPersonalizedPlan(data.dietPlan);
        console.log('✅ Fetched diet plan:', data.dietPlan.generatedAt);
      }
    } catch (error) {
      console.error('Failed to fetch personalized plan:', error);
    }
  };

  const fetchSupplementRecommendations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/diet-recommendations/supplements/active', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Handle 404 - routes not available
      if (response.status === 404) {
        console.log('Supplement recommendation routes not available');
        return;
      }
      
      const data = await response.json();
      if (data.success && data.recommendations) {
        setSupplementRecommendations(data.recommendations);
      }
    } catch (error) {
      console.error('Failed to fetch supplement recommendations:', error);
    }
  };

  const generateAIPlan = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/diet-recommendations/diet-plan/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Handle 404 - routes not available
      if (response.status === 404) {
        toast.error('Diet plan service is not available. Please restart the server.');
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        setPersonalizedPlan(data.dietPlan);
        setIsPlanOutdated(false); // Reset outdated flag
        toast.success('AI-powered diet plan generated!');
      } else {
        toast.error(data.message || 'Failed to generate plan');
      }
    } catch (error) {
      console.error('Failed to generate AI plan:', error);
      toast.error('Failed to generate personalized plan. Please restart the server.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading your personalized plan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-cyan-100 pb-20">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in p-4">
        
        {/* Welcome Message - Mobile Only */}
        <div className="md:hidden flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-md flex-shrink-0">
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

        {/* Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 rounded-3xl p-8 text-white shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Apple className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold">Your Personalized Diet Plan</h1>
                <p className="text-emerald-100 mt-1">AI-powered nutrition guidance tailored for you</p>
              </div>
            </div>
            
            {user?.profile && (
              <div className="flex flex-wrap gap-3 mt-6">
                {user.profile.age && (
                  <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm font-medium">{user.profile.age} years</span>
                  </div>
                )}
                {user.profile.gender && (
                  <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    <span className="text-sm font-medium capitalize">{user.profile.gender}</span>
                  </div>
                )}
                {user.profile.dietaryPreference && (
                  <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl flex items-center gap-2">
                    <Leaf className="w-4 h-4" />
                    <span className="text-sm font-medium capitalize">{user.profile.dietaryPreference}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Report Selector */}
        {allReports.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-6 h-6 text-cyan-500" />
                Select Report for Diet Plan
              </h2>
              <Link
                to="/upload"
                className="px-3 py-1.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 transition-colors flex items-center gap-1"
              >
                <TrendingUp className="w-3 h-3" />
                Upload New
              </Link>
            </div>
            <select
              value={selectedReportId || ''}
              onChange={(e) => setSelectedReportId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-800 font-medium focus:border-cyan-500 focus:outline-none cursor-pointer"
            >
              {allReports.map((report) => (
                <option key={report._id} value={report._id}>
                  {report.reportType} - {new Date(report.createdAt).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  })} {report.aiAnalysis?.healthScore ? `(Score: ${report.aiAnalysis.healthScore})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Upload Report Button - Small */}
        {allReports.length === 0 && (
          <div className="text-center">
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              Upload Report
            </Link>
          </div>
        )}

        {/* AI-Powered Plan */}
        {personalizedPlan && (
          <>
            {/* Outdated Plan Banner */}
            {isPlanOutdated && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-6 flex items-start gap-4 shadow-lg">
                <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-amber-900 mb-2">Your Goals Have Changed!</h3>
                  <p className="text-amber-800 mb-4">
                    You've updated your nutrition goals since this diet plan was created. Generate a new plan to match your current goals.
                  </p>
                  <button
                    onClick={generateAIPlan}
                    disabled={generating}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Generating New Plan...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Generate New Diet Plan
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Macro Targets */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl shadow-lg p-5 text-center hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <p className="text-sm text-slate-600 mb-1">Daily Calories</p>
                <p className="text-2xl font-bold text-slate-800">{personalizedPlan.dailyCalorieTarget}</p>
                {personalizedPlan.source === 'report' && !personalizedPlan.hasGoals && (
                  <Link to="/profile?tab=goals" className="text-xs text-cyan-600 hover:underline mt-1 block">
                    Set Goals
                  </Link>
                )}
              </div>
              <div className="bg-white rounded-2xl shadow-lg p-5 text-center hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center mx-auto mb-3">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <p className="text-sm text-slate-600 mb-1">Protein</p>
                <p className="text-2xl font-bold text-slate-800">{personalizedPlan.macroTargets?.protein}g</p>
              </div>
              <div className="bg-white rounded-2xl shadow-lg p-5 text-center hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-3">
                  <Leaf className="w-6 h-6 text-white" />
                </div>
                <p className="text-sm text-slate-600 mb-1">Carbs</p>
                <p className="text-2xl font-bold text-slate-800">{personalizedPlan.macroTargets?.carbs}g</p>
              </div>
              <div className="bg-white rounded-2xl shadow-lg p-5 text-center hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-3">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <p className="text-sm text-slate-600 mb-1">Fats</p>
                <p className="text-2xl font-bold text-slate-800">{personalizedPlan.macroTargets?.fats}g</p>
              </div>
            </div>

            {/* Info Banner if using defaults */}
            {personalizedPlan.source === 'report' && !personalizedPlan.hasGoals && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-amber-900">
                    <strong>Using default macro targets.</strong> For personalized calorie and macro goals based on your body metrics, 
                    <Link to="/profile?tab=goals" className="text-amber-700 hover:underline font-semibold ml-1">
                      set your fitness goals →
                    </Link>
                  </p>
                </div>
              </div>
            )}

            {/* Meal Plan */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Utensils className="w-6 h-6 text-emerald-500" />
                Your Daily Meal Plan
              </h2>
              <div className="space-y-4">
                {Object.entries(personalizedPlan.mealPlan || {}).map(([mealType, meals]) => (
                  meals && meals.length > 0 && (
                    <MealCard
                      key={mealType}
                      mealType={mealType}
                      meals={meals}
                      expanded={expandedMeal === mealType}
                      onToggle={() => setExpandedMeal(expandedMeal === mealType ? null : mealType)}
                    />
                  )
                ))}
              </div>
            </div>

            {/* Key Foods */}
            {personalizedPlan.keyFoods && personalizedPlan.keyFoods.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Leaf className="w-6 h-6 text-green-500" />
                  Key Foods to Include
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {personalizedPlan.keyFoods.map((food, idx) => (
                    <div key={idx} className="p-4 bg-green-50 rounded-xl border-2 border-green-200 hover:shadow-md transition-shadow">
                      <p className="font-bold text-green-900 mb-1">{food.name}</p>
                      <p className="text-sm text-green-700 mb-2">{food.reason}</p>
                      <div className="flex items-center gap-2 text-xs text-green-600">
                        <Clock className="w-3 h-3" />
                        <span className="font-medium">{food.frequency}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lifestyle Tips */}
            {personalizedPlan.lifestyleRecommendations && personalizedPlan.lifestyleRecommendations.length > 0 && (
              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl border-2 border-cyan-200 p-6">
                <h2 className="text-xl font-bold text-cyan-900 mb-4 flex items-center gap-2">
                  <Lightbulb className="w-6 h-6 text-cyan-600" />
                  Lifestyle Tips
                </h2>
                <ul className="space-y-3">
                  {personalizedPlan.lifestyleRecommendations.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-cyan-800">
                      <CheckCircle className="w-5 h-5 mt-0.5 text-cyan-500 shrink-0" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Supplements */}
            {supplementRecommendations?.supplements && supplementRecommendations.supplements.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-purple-500" />
                  Supplement Recommendations
                </h2>
                <p className="text-sm text-slate-600 mb-6">
                  {supplementRecommendations.consultationNote || 'Always consult a healthcare provider before starting supplements.'}
                </p>
                <div className="space-y-4">
                  {supplementRecommendations.supplements.map((supp, i) => (
                    <div key={i} className="p-5 bg-purple-50 border-2 border-purple-200 rounded-xl hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-purple-900 text-lg">{supp.name}</h3>
                        {supp.priority && (
                          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                            supp.priority === 'high' ? 'bg-red-100 text-red-700' :
                            supp.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {supp.priority.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-purple-700 mb-3">{supp.reason}</p>
                      <div className="grid sm:grid-cols-2 gap-3 mb-3">
                        <div className="p-3 bg-white rounded-lg">
                          <p className="text-xs text-purple-600 font-semibold mb-1">Dosage</p>
                          <p className="text-sm text-purple-900">{supp.dosage}</p>
                        </div>
                        <div className="p-3 bg-white rounded-lg">
                          <p className="text-xs text-purple-600 font-semibold mb-1">Timing</p>
                          <p className="text-sm text-purple-900">{supp.timing}</p>
                        </div>
                      </div>
                      {supp.precautions && (
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <p className="text-xs text-amber-700">
                            <strong>⚠️ Precautions:</strong> {supp.precautions}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* No Plan State */}
        {!personalizedPlan && !loading && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center mx-auto mb-6">
              <Apple className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-3">
              {hasNutritionGoal ? 'Generate Your Diet Plan' : 'Set Your Goals First'}
            </h3>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              {hasNutritionGoal 
                ? 'Click the button below to generate a personalized AI-powered diet plan based on your nutrition goals.'
                : 'Set your nutrition goals in your profile to get a personalized diet plan. You can also upload health reports for more detailed recommendations.'
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {hasNutritionGoal ? (
                <button
                  onClick={generateAIPlan}
                  disabled={generating}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate AI Diet Plan
                    </>
                  )}
                </button>
              ) : (
                <Link
                  to="/profile?tab=goals"
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Target className="w-5 h-5" />
                  Set Your Goals
                </Link>
              )}
              <Link
                to="/upload"
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                Upload Report
              </Link>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="bg-slate-100 border-2 border-slate-200 rounded-xl p-4 text-sm text-slate-600">
          <strong className="text-slate-800">Disclaimer:</strong> This diet plan is AI-generated for informational purposes only. 
          It is not a substitute for professional medical advice. Please consult a healthcare provider 
          or registered dietitian before making significant changes to your diet.
        </div>
      </div>
    </div>
  );
}

function MealCard({ mealType, meals, expanded, onToggle }) {
  const mealIcons = {
    breakfast: { icon: Coffee, color: 'from-amber-400 to-orange-500', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    lunch: { icon: Sun, color: 'from-orange-400 to-red-500', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
    dinner: { icon: Moon, color: 'from-indigo-400 to-purple-500', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
    snacks: { icon: Apple, color: 'from-green-400 to-emerald-500', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' }
  };

  const config = mealIcons[mealType.toLowerCase()] || mealIcons.breakfast;
  const Icon = config.icon;

  // Ensure meals is an array
  const mealsArray = Array.isArray(meals) ? meals : [];

  return (
    <div className={`${config.bg} border-2 ${config.border} rounded-xl p-5 hover:shadow-md transition-all`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-slate-800 text-lg capitalize">
              {mealType.replace(/([A-Z])/g, ' $1').trim()}
            </h3>
            <p className="text-sm text-slate-600">{mealsArray.length} options</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-6 h-6 text-slate-400" /> : <ChevronDown className="w-6 h-6 text-slate-400" />}
      </button>
      
      {expanded && mealsArray.length > 0 && (
        <div className="mt-4 space-y-3">
          {mealsArray.map((mealItem, idx) => {
            // Handle different meal data formats
            let mealName = 'Meal';
            let mealDescription = '';
            let mealBenefits = '';
            let mealCalories = '';
            let mealProtein = '';
            
            try {
              if (typeof mealItem === 'string') {
                // Simple string format
                mealName = mealItem;
              } else if (mealItem && typeof mealItem === 'object') {
                // Object format - handle both old and new structures
                mealName = String(mealItem.name || mealItem.meal || 'Meal');
                mealDescription = String(mealItem.description || mealItem.tip || '');
                mealBenefits = String(mealItem.benefits || '');
                
                // Handle nutrients object or direct properties
                if (mealItem.nutrients && typeof mealItem.nutrients === 'object') {
                  mealCalories = String(mealItem.nutrients.calories || mealItem.nutrients.Calories || '');
                  mealProtein = String(mealItem.nutrients.protein || mealItem.nutrients.Protein || '');
                } else {
                  mealCalories = String(mealItem.calories || '');
                  mealProtein = String(mealItem.protein || '');
                }
              }
            } catch (error) {
              console.error('Error parsing meal item:', error, mealItem);
              mealName = 'Meal';
            }
            
            return (
              <div key={idx} className="p-4 bg-white rounded-xl border border-slate-200">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">{mealName}</p>
                    {mealDescription && <p className="text-sm text-slate-600 mt-1">{mealDescription}</p>}
                    {mealBenefits && (
                      <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>{mealBenefits}</span>
                      </p>
                    )}
                  </div>
                  {mealCalories && (
                    <div className="text-right ml-4">
                      <p className="text-lg font-bold text-slate-800">{mealCalories}</p>
                      <p className="text-xs text-slate-500">calories</p>
                      {mealProtein && (
                        <p className="text-xs text-blue-600 mt-1">{mealProtein}g protein</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {expanded && mealsArray.length === 0 && (
        <div className="mt-4 p-4 bg-white rounded-xl border border-slate-200 text-center text-slate-500">
          No meals available for this category
        </div>
      )}
    </div>
  );
}
