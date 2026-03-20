import { useEffect, useState } from 'react';
import { Heart, Activity, Stethoscope, Pill, Droplets, Brain, Dumbbell, Apple } from 'lucide-react';

const healthMessages = [
  { icon: Heart, text: "Analyzing your health data...", color: "text-red-500" },
  { icon: Activity, text: "Processing vital signs...", color: "text-blue-500" },
  { icon: Stethoscope, text: "Consulting health records...", color: "text-green-500" },
  { icon: Pill, text: "Checking medication history...", color: "text-purple-500" },
  { icon: Droplets, text: "Evaluating hydration levels...", color: "text-cyan-500" },
  { icon: Brain, text: "Analyzing wellness patterns...", color: "text-indigo-500" },
  { icon: Dumbbell, text: "Reviewing fitness goals...", color: "text-orange-500" },
  { icon: Apple, text: "Assessing nutrition data...", color: "text-green-600" }
];

export default function HealthLoader({ message }) {
  const [currentMessage, setCurrentMessage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % healthMessages.length);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const { icon: Icon, text, color } = healthMessages[currentMessage];

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      {/* Animated Icon */}
      <div className="relative mb-6">
        {/* Pulse rings */}
        <div className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-75"></div>
        <div className="absolute inset-0 rounded-full bg-blue-200 animate-pulse"></div>
        
        {/* Icon container */}
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center shadow-lg">
          <Icon className={`w-10 h-10 text-white animate-pulse`} />
        </div>
      </div>

      {/* Message */}
      <div className="text-center space-y-2">
        <p className="text-lg font-semibold text-gray-800 animate-fade-in">
          {message || text}
        </p>
        <div className="flex items-center justify-center gap-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>

      {/* Health tip */}
      <div className="mt-8 max-w-md text-center">
        <p className="text-sm text-gray-500 italic">
          💡 Tip: Stay hydrated and maintain a balanced diet for optimal health
        </p>
      </div>
    </div>
  );
}
