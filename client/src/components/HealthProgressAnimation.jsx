import { Heart, Activity, Stethoscope, Target, Utensils, Dumbbell } from 'lucide-react';

export default function HealthProgressAnimation({ step }) {
  // Calculate progress percentage based on step (2-7 maps to 16%-100%)
  const progress = ((step - 1) / 6) * 100;
  
  // Select icon based on step
  const getIcon = () => {
    switch(step) {
      case 2: return <Heart className="w-12 h-12" />;
      case 3: return <Activity className="w-12 h-12" />;
      case 4: return <Stethoscope className="w-12 h-12" />;
      case 5: return <Utensils className="w-12 h-12" />;
      case 6: return <Dumbbell className="w-12 h-12" />;
      case 7: return <Target className="w-12 h-12" />;
      default: return <Heart className="w-12 h-12" />;
    }
  };

  const getMessage = () => {
    switch(step) {
      case 2: return "Building Your Profile";
      case 3: return "Analyzing Your Health";
      case 4: return "Understanding Diabetes";
      case 5: return "Diet Preferences";
      case 6: return "Fitness & Goals";
      case 7: return "Almost Complete!";
      default: return "Getting Started";
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      {/* Animated Icon Container */}
      <div className="relative w-32 h-32 mb-4">
        {/* Outer pulse ring */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-orange-500 rounded-full opacity-20 animate-pulse"></div>
        
        {/* Middle ring */}
        <div className="absolute inset-4 bg-gradient-to-br from-purple-400 to-orange-500 rounded-full opacity-30 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
        
        {/* Inner icon container */}
        <div className="absolute inset-8 bg-gradient-to-br from-purple-500 to-orange-600 rounded-full flex items-center justify-center text-white shadow-lg">
          {getIcon()}
        </div>
        
        {/* Progress Ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90">
          <circle 
            cx="64" 
            cy="64" 
            r="60" 
            stroke="currentColor" 
            strokeOpacity="0.1" 
            strokeWidth="4" 
            fill="none"
            className="text-cyan-500"
          />
          <circle 
            cx="64" 
            cy="64" 
            r="60" 
            stroke="currentColor" 
            strokeWidth="4" 
            fill="none"
            strokeDasharray="377"
            strokeDashoffset={377 - (377 * (progress / 100))}
            className="text-cyan-500 transition-all duration-500"
            strokeLinecap="round"
          />
        </svg>
      </div>
      
      {/* Progress Message */}
      <div className="text-center">
        <p className="text-lg font-semibold text-cyan-600 mb-1">{getMessage()}</p>
        <p className="text-sm text-gray-600">{Math.round(progress)}% Complete</p>
      </div>
      
      {/* Step Dots */}
      <div className="flex items-center gap-2 mt-4">
        {[2, 3, 4, 5, 6, 7].map((dot) => (
          <div
            key={dot}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              dot < step ? 'bg-cyan-500 w-8' : dot === step ? 'bg-cyan-500 w-3 h-3' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
