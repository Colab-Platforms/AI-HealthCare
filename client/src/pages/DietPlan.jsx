import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { healthService } from '../services/api';
import { 
  Apple, Coffee, Sun, Moon, Utensils, AlertCircle, 
  CheckCircle, Lightbulb, Plus, ChevronDown, ChevronUp, Leaf, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

// Diet recommendations based on deficiencies with dietary tags - Indian style
const dietRecommendations = {
  'Vitamin D': {
    foods: [
      { name: 'Fish (salmon, mackerel, rohu)', diet: ['non-vegetarian'] },
      { name: 'Egg yolks', diet: ['eggetarian', 'non-vegetarian'] },
      { name: 'Fortified milk', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Mushrooms', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Paneer', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] }
    ],
    breakfast: [
      { name: 'Egg bhurji with paneer', diet: ['eggetarian', 'non-vegetarian'] },
      { name: 'Dalia with milk', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Mushroom omelette', diet: ['eggetarian', 'non-vegetarian'] },
      { name: 'Almond milk smoothie', diet: ['vegan'] }
    ],
    lunch: [
      { name: 'Fish fry with salad', diet: ['non-vegetarian'] },
      { name: 'Fish curry with rice', diet: ['non-vegetarian'] },
      { name: 'Egg curry with rice', diet: ['eggetarian', 'non-vegetarian'] },
      { name: 'Mushroom pulao', diet: ['vegan', 'vegetarian'] }
    ],
    dinner: [
      { name: 'Tandoori fish with vegetables', diet: ['non-vegetarian'] },
      { name: 'Paneer tikka', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Mushroom masala', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] }
    ],
    snacks: [
      { name: 'Paneer cubes', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Boiled eggs', diet: ['eggetarian', 'non-vegetarian'] },
      { name: 'Orange juice', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] }
    ],
    tips: ['Get 15-20 minutes of morning sunlight daily', 'Include fortified foods in your diet']
  },
  'Vitamin B12': {
    foods: [
      { name: 'Chicken, mutton', diet: ['non-vegetarian'] },
      { name: 'Fish', diet: ['non-vegetarian'] },
      { name: 'Eggs', diet: ['eggetarian', 'non-vegetarian'] },
      { name: 'Yogurt, milk, paneer', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Fortified cereals', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Nutritional yeast', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] }
    ],
    breakfast: [
      { name: 'Eggs with whole wheat bread', diet: ['eggetarian', 'non-vegetarian'] },
      { name: 'Yogurt with muesli', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Milk smoothie', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Fortified dalia with almond milk', diet: ['vegan'] }
    ],
    lunch: [
      { name: 'Chicken with rice', diet: ['non-vegetarian'] },
      { name: 'Fish curry', diet: ['non-vegetarian'] },
      { name: 'Paneer salad', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Tofu bhurji', diet: ['vegan'] }
    ],
    dinner: [
      { name: 'Tandoori chicken', diet: ['non-vegetarian'] },
      { name: 'Mutton curry', diet: ['non-vegetarian'] },
      { name: 'Paneer butter masala', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Soya chunks curry', diet: ['vegan'] }
    ],
    snacks: [
      { name: 'Paneer', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Yogurt', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Milk', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Almond milk', diet: ['vegan'] }
    ],
    tips: ['Vegetarians and vegans should consider B12 supplements', 'Include fortified foods in every meal']
  },
  'Iron': {
    foods: [
      { name: 'Red meat', diet: ['non-vegetarian'] },
      { name: 'Spinach (palak)', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Dal', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Rajma, chana', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Fortified cereals', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Pumpkin seeds', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] }
    ],
    breakfast: [
      { name: 'Spinach smoothie', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Fortified dalia', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Poha with peanuts', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] }
    ],
    lunch: [
      { name: 'Dal rice', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Palak paneer', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Liver curry', diet: ['non-vegetarian'] },
      { name: 'Rajma rice', diet: ['vegan'] }
    ],
    dinner: [
      { name: 'Dal soup', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Spinach dal', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Grilled meat with vegetables', diet: ['non-vegetarian'] }
    ],
    snacks: [
      { name: 'Pumpkin seeds', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Dates', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Dried apricots', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] }
    ],
    tips: ['Eat iron-rich foods with Vitamin C for better absorption', 'Avoid tea/coffee with meals']
  },
  'Calcium': {
    foods: [
      { name: 'Milk', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Yogurt', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Paneer', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Leafy green vegetables', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Almonds', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Tofu', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Fortified almond milk', diet: ['vegan'] }
    ],
    breakfast: [
      { name: 'Milk with dalia', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Yogurt with fruits', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Paneer paratha', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Almond milk smoothie', diet: ['vegan'] }
    ],
    lunch: [
      { name: 'Paneer curry', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Spinach dal', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Tofu bhurji', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] }
    ],
    dinner: [
      { name: 'Palak paneer', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Fish curry', diet: ['non-vegetarian'] },
      { name: 'Broccoli soup', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] }
    ],
    snacks: [
      { name: 'Almonds', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Paneer', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Yogurt', diet: ['vegetarian', 'eggetarian', 'non-vegetarian'] }
    ],
    tips: ['Include calcium-rich foods in every meal', 'Get adequate Vitamin D for calcium absorption']
  },
  'Hemoglobin': {
    foods: [
      { name: 'Red meat', diet: ['non-vegetarian'] },
      { name: 'Liver', diet: ['non-vegetarian'] },
      { name: 'Spinach (palak)', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Beetroot', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Pomegranate', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Dates', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] }
    ],
    breakfast: [
      { name: 'Beetroot juice', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Spinach paratha', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Pomegranate smoothie', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] }
    ],
    lunch: [
      { name: 'Liver curry', diet: ['non-vegetarian'] },
      { name: 'Spinach dal', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Beetroot salad', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] }
    ],
    dinner: [
      { name: 'Grilled meat', diet: ['non-vegetarian'] },
      { name: 'Spinach soup', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Dal curry', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] }
    ],
    snacks: [
      { name: 'Dates', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Pomegranate', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] },
      { name: 'Jaggery', diet: ['vegan', 'vegetarian', 'eggetarian', 'non-vegetarian'] }
    ],
    tips: ['Eat iron-rich foods with Vitamin C', 'Avoid calcium with iron-rich meals']
  }
};

// Supplement recommendations
const supplementRecommendations = {
  'Vitamin D': {
    category: 'Vitamin D3 Supplements',
    description: 'Vitamin D3 (cholecalciferol) supplements can help maintain healthy vitamin D levels, especially for those with limited sun exposure.',
    note: 'Consult your doctor for appropriate dosage based on your deficiency level.'
  },
  'Vitamin B12': {
    category: 'Vitamin B12 Supplements',
    description: 'B12 supplements are available as tablets, sublingual forms, or injections. Methylcobalamin is a well-absorbed form.',
    note: 'Especially important for vegetarians and vegans who may not get enough from diet.'
  },
  'Iron': {
    category: 'Iron Supplements',
    description: 'Iron supplements (ferrous sulfate, ferrous gluconate) can help address iron deficiency anemia.',
    note: 'Take with Vitamin C for better absorption. May cause stomach upset - take with food if needed.'
  },
  'Calcium': {
    category: 'Calcium Supplements',
    description: 'Calcium carbonate or calcium citrate supplements can help meet daily calcium requirements.',
    note: 'Best absorbed when taken in smaller doses throughout the day with food.'
  }
};

export default function DietPlan() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deficiencies, setDeficiencies] = useState([]);
  const [personalizedPlan, setPersonalizedPlan] = useState(null);
  const [supplementRecommendations, setSupplementRecommendations] = useState(null);
  const [manualDeficiencies, setManualDeficiencies] = useState('');
  const [showAddDeficiency, setShowAddDeficiency] = useState(false);
  const [expandedMeal, setExpandedMeal] = useState(null);
  const [dietOptIn, setDietOptIn] = useState(true);
  const [showAIPlan, setShowAIPlan] = useState(false);

  useEffect(() => {
    fetchHealthData();
    fetchPersonalizedPlan();
    fetchSupplementRecommendations();
  }, []);

  const fetchHealthData = async () => {
    try {
      const { data } = await healthService.getDashboard();
      const detected = data.latestAnalysis?.deficiencies || [];
      setDeficiencies(detected.map(d => typeof d === 'string' ? d : d.name || d.nutrient));
    } catch (error) {
      console.error('Failed to fetch health data:', error);
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
      const data = await response.json();
      if (data.success && data.dietPlan) {
        setPersonalizedPlan(data.dietPlan);
        setShowAIPlan(true);
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
      const data = await response.json();
      if (data.success) {
        setPersonalizedPlan(data.dietPlan);
        setShowAIPlan(true);
        toast.success('AI-powered diet plan generated!');
      } else {
        toast.error(data.message || 'Failed to generate plan');
      }
    } catch (error) {
      console.error('Failed to generate AI plan:', error);
      toast.error('Failed to generate personalized plan');
    } finally {
      setGenerating(false);
    }
  };

  const generateSupplements = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/diet-recommendations/supplements/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        setSupplementRecommendations(data.recommendations);
        toast.success('Supplement recommendations generated!');
      } else {
        toast.error(data.message || 'Failed to generate recommendations');
      }
    } catch (error) {
      console.error('Failed to generate supplements:', error);
      toast.error('Failed to generate supplement recommendations');
    }
  };

  const addManualDeficiency = () => {
    if (manualDeficiencies.trim()) {
      const newDefs = manualDeficiencies.split(',').map(d => d.trim()).filter(Boolean);
      setDeficiencies([...new Set([...deficiencies, ...newDefs])]);
      setManualDeficiencies('');
      setShowAddDeficiency(false);
      toast.success('Deficiencies added');
    }
  };

  const removeDeficiency = (def) => {
    setDeficiencies(deficiencies.filter(d => d !== def));
  };

  // Get diet plan based on deficiencies and dietary preference
  const getDietPlan = () => {
    const plan = { breakfast: [], lunch: [], dinner: [], snacks: [], tips: [], foods: [] };
    const userDiet = user?.profile?.dietaryPreference || 'non-vegetarian';
    
    deficiencies.forEach(def => {
      const rec = Object.entries(dietRecommendations).find(([key]) => 
        def.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(def.toLowerCase())
      );
      
      if (rec) {
        const [, data] = rec;
        
        // Filter foods based on dietary preference
        const filterByDiet = (items) => {
          return items
            .filter(item => item.diet.includes(userDiet))
            .map(item => item.name);
        };
        
        plan.breakfast.push(...filterByDiet(data.breakfast || []));
        plan.lunch.push(...filterByDiet(data.lunch || []));
        plan.dinner.push(...filterByDiet(data.dinner || []));
        plan.snacks.push(...filterByDiet(data.snacks || []));
        plan.foods.push(...filterByDiet(data.foods || []));
        plan.tips.push(...(data.tips || []));
      }
    });

    // Remove duplicates
    Object.keys(plan).forEach(key => {
      plan[key] = [...new Set(plan[key])];
    });

    return plan;
  };

  // Get supplement recommendations
  const getSupplements = () => {
    if (!supplementRecommendations) return [];
    return deficiencies.map(def => {
      const rec = Object.entries(supplementRecommendations).find(([key]) => 
        def.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(def.toLowerCase())
      );
      return rec ? { deficiency: def, ...rec[1] } : null;
    }).filter(Boolean);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading your personalized plan...</p>
        </div>
      </div>
    );
  }

  const dietPlan = getDietPlan();
  const supplements = getSupplements();
  const hasPlan = deficiencies.length > 0 && (dietPlan.breakfast.length > 0 || dietPlan.lunch.length > 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Personalized Diet Plan</h1>
          <p className="text-slate-500 mt-1">
            AI-generated nutrition guidance based on your health data
            {user?.profile?.age && ` • ${user.profile.age} years`}
            {user?.profile?.gender && ` • ${user.profile.gender}`}
            {user?.profile?.dietaryPreference && ` • ${user.profile.dietaryPreference.charAt(0).toUpperCase() + user.profile.dietaryPreference.slice(1)}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!personalizedPlan && (
            <button
              onClick={generateAIPlan}
              disabled={generating}
              className="px-6 py-3 text-white rounded-xl font-medium hover:shadow-lg flex items-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: '#8B7355' }}
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate AI Plan
                </>
              )}
            </button>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dietOptIn}
              onChange={(e) => setDietOptIn(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 focus:ring-2"
              style={{ accentColor: '#8B7355' }}
            />
            <span className="text-sm text-slate-600">Enable diet recommendations</span>
          </label>
        </div>
      </div>

      {!dietOptIn ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <Apple className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Diet Recommendations Disabled</h3>
          <p className="text-slate-500">Enable diet recommendations to see your personalized plan.</p>
        </div>
      ) : (
        <>
          {/* Detected Deficiencies */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Detected Deficiencies
              </h2>
              <button
                onClick={() => setShowAddDeficiency(!showAddDeficiency)}
                className="flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-700"
              >
                <Plus className="w-4 h-4" /> Add Manually
              </button>
            </div>

            {user?.profile?.dietaryPreference && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
                <p className="text-sm text-green-700">
                  <strong>Dietary Preference:</strong> {user.profile.dietaryPreference.charAt(0).toUpperCase() + user.profile.dietaryPreference.slice(1)}
                  {' '}- All recommendations are filtered to match your preference.
                  <Link to="/profile" className="ml-2 text-cyan-600 hover:text-cyan-700 underline">
                    Change in Profile
                  </Link>
                </p>
              </div>
            )}

            {showAddDeficiency && (
              <div className="mb-4 p-4 bg-slate-50 rounded-xl">
                <p className="text-sm text-slate-600 mb-2">
                  Don't have reports? Add your known deficiencies manually:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualDeficiencies}
                    onChange={(e) => setManualDeficiencies(e.target.value)}
                    placeholder="e.g., Vitamin D, Iron, B12"
                    className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none"
                  />
                  <button
                    onClick={addManualDeficiency}
                    className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {deficiencies.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {deficiencies.map((def, i) => (
                  <span key={i} className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm">
                    {def}
                    <button onClick={() => removeDeficiency(def)} className="hover:text-amber-900">×</button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">
                No deficiencies detected. Upload a health report or add deficiencies manually to get personalized recommendations.
              </p>
            )}
          </div>

          {/* AI-Powered Personalized Plan */}
          {personalizedPlan && showAIPlan && (
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl border-2 border-purple-200 p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-purple-900 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                  AI-Powered Personalized Diet Plan
                </h2>
                <button
                  onClick={() => setShowAIPlan(false)}
                  className="text-purple-600 hover:text-purple-800 text-sm"
                >
                  Show Basic Plan
                </button>
              </div>

              <p className="text-sm text-purple-700 mb-4">
                Generated on {new Date(personalizedPlan.generatedAt).toLocaleDateString()} • 
                Valid until {new Date(personalizedPlan.validUntil).toLocaleDateString()}
              </p>

              {/* Calorie & Macro Targets */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 text-center">
                  <p className="text-sm text-slate-600">Daily Calories</p>
                  <p className="text-2xl font-bold text-purple-900">{personalizedPlan.dailyCalorieTarget}</p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center">
                  <p className="text-sm text-slate-600">Protein</p>
                  <p className="text-2xl font-bold text-blue-900">{personalizedPlan.macroTargets?.protein}g</p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center">
                  <p className="text-sm text-slate-600">Carbs</p>
                  <p className="text-2xl font-bold text-green-900">{personalizedPlan.macroTargets?.carbs}g</p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center">
                  <p className="text-sm text-slate-600">Fats</p>
                  <p className="text-2xl font-bold text-orange-900">{personalizedPlan.macroTargets?.fats}g</p>
                </div>
              </div>

              {/* AI Meal Plan */}
              <div className="space-y-4">
                {Object.entries(personalizedPlan.mealPlan || {}).map(([mealType, meals]) => (
                  meals && meals.length > 0 && (
                    <div key={mealType} className="bg-white rounded-xl p-4">
                      <h3 className="font-semibold text-purple-900 mb-3 capitalize">
                        {mealType.replace(/([A-Z])/g, ' $1').trim()}
                      </h3>
                      <div className="space-y-2">
                        {meals.map((meal, idx) => (
                          <div key={idx} className="p-3 bg-purple-50 rounded-lg">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-purple-900">{meal.name}</p>
                                <p className="text-sm text-purple-700 mt-1">{meal.description}</p>
                                {meal.benefits && (
                                  <p className="text-xs text-green-700 mt-1">✓ {meal.benefits}</p>
                                )}
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-sm font-semibold text-purple-900">{meal.calories} cal</p>
                                {meal.protein && (
                                  <p className="text-xs text-purple-600">{meal.protein}g protein</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>

              {/* Key Foods */}
              {personalizedPlan.keyFoods && personalizedPlan.keyFoods.length > 0 && (
                <div className="mt-6 bg-white rounded-xl p-4">
                  <h3 className="font-semibold text-purple-900 mb-3">Key Foods to Include</h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {personalizedPlan.keyFoods.map((food, idx) => (
                      <div key={idx} className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <p className="font-medium text-green-900">{food.name}</p>
                        <p className="text-sm text-green-700 mt-1">{food.reason}</p>
                        <p className="text-xs text-green-600 mt-1">Frequency: {food.frequency}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Deficiency Corrections */}
              {personalizedPlan.deficiencyCorrections && personalizedPlan.deficiencyCorrections.length > 0 && (
                <div className="mt-6 bg-white rounded-xl p-4">
                  <h3 className="font-semibold text-purple-900 mb-3">Deficiency Corrections</h3>
                  <div className="space-y-3">
                    {personalizedPlan.deficiencyCorrections.map((correction, idx) => (
                      <div key={idx} className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <p className="font-medium text-amber-900">{correction.deficiency}</p>
                        <p className="text-sm text-amber-700 mt-1">
                          <strong>Foods:</strong> {correction.indianFoods.join(', ')}
                        </p>
                        <p className="text-sm text-amber-700 mt-1">
                          <strong>Meals:</strong> {correction.mealSuggestions.join(', ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lifestyle Recommendations */}
              {personalizedPlan.lifestyleRecommendations && personalizedPlan.lifestyleRecommendations.length > 0 && (
                <div className="mt-6 bg-white rounded-xl p-4">
                  <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-purple-600" />
                    Lifestyle Tips
                  </h3>
                  <ul className="space-y-2">
                    {personalizedPlan.lifestyleRecommendations.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-purple-700">
                        <CheckCircle className="w-4 h-4 mt-0.5 text-purple-500 shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Foods to Avoid */}
              {personalizedPlan.avoidFoods && personalizedPlan.avoidFoods.length > 0 && (
                <div className="mt-6 bg-white rounded-xl p-4">
                  <h3 className="font-semibold text-red-900 mb-3">Foods to Avoid</h3>
                  <div className="space-y-2">
                    {personalizedPlan.avoidFoods.map((item, idx) => (
                      <div key={idx} className="p-3 bg-red-50 rounded-lg border border-red-200">
                        <p className="font-medium text-red-900">{item.food}</p>
                        <p className="text-sm text-red-700 mt-1">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={generateAIPlan}
                disabled={generating}
                className="mt-6 w-full px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {generating ? 'Regenerating...' : 'Regenerate Plan'}
              </button>
            </div>
          )}

          {hasPlan && !showAIPlan && (
            <>
              {/* Recommended Foods */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Leaf className="w-5 h-5 text-green-500" />
                  Recommended Foods
                </h2>
                <div className="flex flex-wrap gap-2">
                  {dietPlan.foods.slice(0, 15).map((food, i) => (
                    <span key={i} className="px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm border border-green-200">
                      {food}
                    </span>
                  ))}
                </div>
              </div>

              {/* Meal Plan */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Breakfast */}
                <MealCard
                  icon={Coffee}
                  title="Breakfast"
                  color="amber"
                  items={dietPlan.breakfast}
                  expanded={expandedMeal === 'breakfast'}
                  onToggle={() => setExpandedMeal(expandedMeal === 'breakfast' ? null : 'breakfast')}
                />
                
                {/* Lunch */}
                <MealCard
                  icon={Sun}
                  title="Lunch"
                  color="orange"
                  items={dietPlan.lunch}
                  expanded={expandedMeal === 'lunch'}
                  onToggle={() => setExpandedMeal(expandedMeal === 'lunch' ? null : 'lunch')}
                />
                
                {/* Dinner */}
                <MealCard
                  icon={Moon}
                  title="Dinner"
                  color="indigo"
                  items={dietPlan.dinner}
                  expanded={expandedMeal === 'dinner'}
                  onToggle={() => setExpandedMeal(expandedMeal === 'dinner' ? null : 'dinner')}
                />
                
                {/* Snacks */}
                <MealCard
                  icon={Apple}
                  title="Snacks"
                  color="green"
                  items={dietPlan.snacks}
                  expanded={expandedMeal === 'snacks'}
                  onToggle={() => setExpandedMeal(expandedMeal === 'snacks' ? null : 'snacks')}
                />
              </div>

              {/* Nutritional Tips */}
              {dietPlan.tips.length > 0 && (
                <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-cyan-800 mb-4 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5" />
                    Nutritional Tips
                  </h2>
                  <ul className="space-y-2">
                    {dietPlan.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-cyan-700">
                        <CheckCircle className="w-4 h-4 mt-0.5 text-cyan-500 shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Supplement Recommendations */}
              {supplementRecommendations && supplementRecommendations.supplements && supplementRecommendations.supplements.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                      <Utensils className="w-5 h-5 text-purple-500" />
                      AI-Powered Supplement Recommendations
                    </h2>
                    <button
                      onClick={generateSupplements}
                      className="text-sm text-purple-600 hover:text-purple-700"
                    >
                      Regenerate
                    </button>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">
                    {supplementRecommendations.consultationNote || 'Always consult a healthcare provider before starting supplements.'}
                  </p>
                  <div className="space-y-4">
                    {supplementRecommendations.supplements.map((supp, i) => (
                      <div key={i} className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-medium text-purple-800">{supp.name}</h3>
                          {supp.priority && (
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              supp.priority === 'high' ? 'bg-red-100 text-red-700' :
                              supp.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {supp.priority} priority
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-purple-700 mb-2">
                          <strong>For:</strong> {supp.deficiency}
                        </p>
                        <p className="text-sm text-purple-700 mb-2">{supp.reason}</p>
                        <div className="grid md:grid-cols-2 gap-2 mt-3">
                          <div className="text-sm">
                            <strong className="text-purple-800">Dosage:</strong>
                            <p className="text-purple-600">{supp.dosage}</p>
                          </div>
                          <div className="text-sm">
                            <strong className="text-purple-800">Timing:</strong>
                            <p className="text-purple-600">{supp.timing}</p>
                          </div>
                        </div>
                        {supp.foodAlternatives && supp.foodAlternatives.length > 0 && (
                          <div className="mt-3 p-2 bg-green-50 rounded-lg">
                            <p className="text-xs text-green-700">
                              <strong>Food alternatives:</strong> {supp.foodAlternatives.join(', ')}
                            </p>
                          </div>
                        )}
                        {supp.indianBrands && supp.indianBrands.length > 0 && (
                          <div className="mt-2 text-xs text-purple-600">
                            <strong>Available brands:</strong> {supp.indianBrands.join(', ')}
                          </div>
                        )}
                        {supp.precautions && (
                          <div className="mt-2 p-2 bg-amber-50 rounded-lg">
                            <p className="text-xs text-amber-700">
                              <strong>⚠️ Precautions:</strong> {supp.precautions}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {supplementRecommendations.generalGuidance && supplementRecommendations.generalGuidance.length > 0 && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-xl">
                      <h4 className="font-medium text-blue-900 mb-2">General Guidance</h4>
                      <ul className="space-y-1">
                        {supplementRecommendations.generalGuidance.map((tip, idx) => (
                          <li key={idx} className="text-sm text-blue-700 flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : supplements.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                      <Utensils className="w-5 h-5 text-purple-500" />
                      Supplement Recommendations
                    </h2>
                    <button
                      onClick={generateSupplements}
                      className="px-4 py-2 text-sm text-white rounded-lg hover:shadow-lg"
                      style={{ backgroundColor: '#8B7355' }}
                    >
                      Get AI Recommendations
                    </button>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">
                    General wellness guidance based on your deficiencies. Always consult a healthcare provider before starting supplements.
                  </p>
                  <div className="space-y-4">
                    {supplements.map((supp, i) => (
                      <div key={i} className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                        <h3 className="font-medium text-purple-800">{supp.category}</h3>
                        <p className="text-sm text-purple-700 mt-1">{supp.description}</p>
                        <p className="text-xs text-purple-600 mt-2 italic">{supp.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* No Data State */}
          {!hasPlan && deficiencies.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <Apple className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-800 mb-2">No Diet Plan Available</h3>
              <p className="text-slate-500 mb-4">
                Upload a health report to get AI-analyzed deficiencies and personalized diet recommendations, 
                or add your known deficiencies manually.
              </p>
              <button
                onClick={() => setShowAddDeficiency(true)}
                className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                Add Deficiencies Manually
              </button>
            </div>
          )}

          {/* Disclaimer */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-500">
            <strong>Disclaimer:</strong> This diet plan is AI-generated for informational purposes only. 
            It is not a substitute for professional medical advice. Please consult a healthcare provider 
            or registered dietitian before making significant changes to your diet.
          </div>
        </>
      )}
    </div>
  );
}

function MealCard({ icon: Icon, title, color, items, expanded, onToggle }) {
  const colorClasses = {
    amber: 'bg-amber-100 text-amber-700',
    orange: 'bg-orange-100 text-orange-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    green: 'bg-green-100 text-green-700'
  };

  const borderClasses = {
    amber: 'border-amber-200',
    orange: 'border-orange-200',
    indigo: 'border-indigo-200',
    green: 'border-green-200'
  };

  return (
    <div className={`bg-white rounded-2xl border-2 ${borderClasses[color]} p-5 shadow-sm hover:shadow-md transition-shadow`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${colorClasses[color]} flex items-center justify-center`}>
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-800 text-lg">{title}</h3>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>
      
      {expanded && items.length > 0 && (
        <ul className="mt-4 space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-slate-700 text-sm font-medium">
              <div className={`w-1.5 h-1.5 rounded-full ${colorClasses[color].split(' ')[1].replace('text-', 'bg-')}`}></div>
              {item}
            </li>
          ))}
        </ul>
      )}
      
      {!expanded && items.length > 0 && (
        <p className="mt-2 text-sm text-slate-600 font-medium">{items.length} options available</p>
      )}
    </div>
  );
}
