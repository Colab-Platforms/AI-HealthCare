import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { healthService } from '../services/api';
import { 
  Apple, Coffee, Sun, Moon, Utensils, AlertCircle, 
  CheckCircle, Lightbulb, Plus, ChevronDown, ChevronUp, Leaf
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
  const [deficiencies, setDeficiencies] = useState([]);
  const [manualDeficiencies, setManualDeficiencies] = useState('');
  const [showAddDeficiency, setShowAddDeficiency] = useState(false);
  const [expandedMeal, setExpandedMeal] = useState(null);
  const [dietOptIn, setDietOptIn] = useState(true);

  useEffect(() => {
    fetchHealthData();
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
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dietOptIn}
              onChange={(e) => setDietOptIn(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
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

          {hasPlan && (
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
              {supplements.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Utensils className="w-5 h-5 text-purple-500" />
                    Supplement Recommendations
                  </h2>
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
