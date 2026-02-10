import { useState, useEffect, useRef } from 'react';
import { Activity, Heart, Utensils, TrendingUp, Moon, Pill, Calendar, MessageSquare } from 'lucide-react';

const ScrollPhoneShowcase = () => {
  const [activeSection, setActiveSection] = useState(0);
  const containerRef = useRef(null);

  // Features data with different screens and floating cards
  const features = [
    {
      title: "Track Your Health Metrics",
      description: "Monitor vital signs, lab results, and health trends all in one place with AI-powered insights.",
      phoneScreen: "dashboard",
      cards: [
        { icon: Heart, title: "Heart Rate", value: "72 bpm", color: "rose", position: "left-top" },
        { icon: Activity, title: "Blood Pressure", value: "120/80", color: "blue", position: "left-bottom" },
        { icon: TrendingUp, title: "Health Score", value: "85/100", color: "emerald", position: "right-top" },
        { icon: Pill, title: "Vitamin D", value: "45 ng/mL", color: "amber", position: "right-bottom" }
      ]
    },
    {
      title: "Smart Nutrition Tracking",
      description: "Track your meals and get actionable feedback that helps you build a better relationship with food.",
      phoneScreen: "nutrition",
      cards: [
        { icon: Utensils, title: "Today's Meals", value: "3 logged", color: "emerald", position: "left-top" },
        { icon: Activity, title: "Calories", value: "1,850 kcal", color: "orange", position: "left-bottom" },
        { icon: TrendingUp, title: "Protein", value: "95g", color: "blue", position: "right-top" },
        { icon: Heart, title: "Macro Balance", value: "Optimal", color: "purple", position: "right-bottom" }
      ]
    },
    {
      title: "AI-Powered Health Insights",
      description: "Get personalized recommendations based on your medical reports and wearable data.",
      phoneScreen: "ai-chat",
      cards: [
        { icon: MessageSquare, title: "AI Assistant", value: "24/7 Available", color: "cyan", position: "left-top" },
        { icon: TrendingUp, title: "Insights", value: "12 new", color: "indigo", position: "left-bottom" },
        { icon: Calendar, title: "Reminders", value: "5 today", color: "pink", position: "right-top" },
        { icon: Heart, title: "Health Tips", value: "Updated", color: "red", position: "right-bottom" }
      ]
    },
    {
      title: "Sleep & Recovery Tracking",
      description: "Improve your sleep by understanding patterns, identifying disruptions, and building habits.",
      phoneScreen: "sleep",
      cards: [
        { icon: Moon, title: "Sleep Quality", value: "85%", color: "indigo", position: "left-top" },
        { icon: Activity, title: "Sleep Duration", value: "7h 45m", color: "blue", position: "left-bottom" },
        { icon: TrendingUp, title: "Deep Sleep", value: "2h 15m", color: "purple", position: "right-top" },
        { icon: Heart, title: "REM Sleep", value: "1h 30m", color: "pink", position: "right-bottom" }
      ]
    }
  ];

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      
      const container = containerRef.current;
      const { top, height } = container.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // Calculate scroll progress through the container
      const scrollProgress = (windowHeight / 2 - top) / (height - windowHeight / 2);
      const clampedProgress = Math.max(0, Math.min(1, scrollProgress));
      
      // Determine which section should be active
      const sectionIndex = Math.floor(clampedProgress * features.length);
      const finalIndex = Math.min(sectionIndex, features.length - 1);
      
      setActiveSection(finalIndex);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [features.length]);

  const getCardPosition = (position) => {
    // Mobile-first positioning - cards closer and more visible on small screens
    const positions = {
      'left-top': 'left-[1%] sm:left-[3%] md:left-[8%] top-[8%] sm:top-[10%] md:top-[12%]',
      'left-bottom': 'left-[1%] sm:left-[5%] md:left-[10%] bottom-[12%] sm:bottom-[15%] md:bottom-[18%]',
      'right-top': 'right-[1%] sm:right-[3%] md:right-[8%] top-[14%] sm:top-[16%] md:top-[18%]',
      'right-bottom': 'right-[1%] sm:right-[5%] md:right-[10%] bottom-[6%] sm:bottom-[9%] md:bottom-[12%]'
    };
    return positions[position] || 'left-[10%] top-[20%]';
  };

  const getCardAnimation = (position, isActive) => {
    // Cards start from center (behind phone) and move outward
    const baseTransform = isActive ? '' : 'scale-75';
    
    const animations = {
      'left-top': isActive 
        ? 'opacity-100 translate-x-0 translate-y-0 scale-100' 
        : 'opacity-0 translate-x-32 translate-y-16 scale-75',
      'left-bottom': isActive 
        ? 'opacity-100 translate-x-0 translate-y-0 scale-100' 
        : 'opacity-0 translate-x-32 -translate-y-16 scale-75',
      'right-top': isActive 
        ? 'opacity-100 translate-x-0 translate-y-0 scale-100' 
        : 'opacity-0 -translate-x-32 translate-y-16 scale-75',
      'right-bottom': isActive 
        ? 'opacity-100 translate-x-0 translate-y-0 scale-100' 
        : 'opacity-0 -translate-x-32 -translate-y-16 scale-75'
    };
    return animations[position];
  };

  const getPhoneScreenGradient = (screen) => {
    const gradients = {
      dashboard: 'from-blue-500 to-cyan-500',
      nutrition: 'from-emerald-500 to-green-500',
      'ai-chat': 'from-purple-500 to-pink-500',
      sleep: 'from-indigo-500 to-blue-500'
    };
    return gradients[screen] || 'from-cyan-500 to-blue-500';
  };

  return (
    <div id="showcase" ref={containerRef} className="relative bg-transparent" style={{ height: `${features.length * 100}vh` }}>
      {/* Sticky container for phone and cards */}
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden pt-20 sm:pt-24 px-2 sm:px-4">
        <div className="relative w-full max-w-7xl mx-auto">
          
          {/* Center content */}
          <div className="relative flex flex-col items-center">
            {/* Text content */}
            <div className="text-center mb-2 sm:mb-3 max-w-2xl px-4 transition-all duration-700 transform relative z-30">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif text-white mb-6 sm:mb-8 leading-tight">
                {features[activeSection].title}
              </h2>
              {/* <p className="text-cyan-100 text-sm sm:text-base md:text-lg leading-relaxed">
                {features[activeSection].description}
              </p> */}
            </div>

            {/* Cards layer - ABOVE phone on all screens (z-index higher) */}
            <div className="absolute inset-0 pointer-events-none z-40">
              {features[activeSection].cards.map((card, idx) => {
                const Icon = card.icon;
                const colorMap = {
                  rose: { bg: 'bg-rose-50', icon: 'text-rose-500', value: 'text-rose-600', border: 'border-rose-100' },
                  blue: { bg: 'bg-blue-50', icon: 'text-blue-500', value: 'text-blue-600', border: 'border-blue-100' },
                  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-500', value: 'text-emerald-600', border: 'border-emerald-100' },
                  amber: { bg: 'bg-amber-50', icon: 'text-amber-500', value: 'text-amber-600', border: 'border-amber-100' },
                  orange: { bg: 'bg-orange-50', icon: 'text-orange-500', value: 'text-orange-600', border: 'border-orange-100' },
                  purple: { bg: 'bg-purple-50', icon: 'text-purple-500', value: 'text-purple-600', border: 'border-purple-100' },
                  cyan: { bg: 'bg-cyan-50', icon: 'text-cyan-500', value: 'text-cyan-600', border: 'border-cyan-100' },
                  indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-500', value: 'text-indigo-600', border: 'border-indigo-100' },
                  pink: { bg: 'bg-pink-50', icon: 'text-pink-500', value: 'text-pink-600', border: 'border-pink-100' },
                  red: { bg: 'bg-red-50', icon: 'text-red-500', value: 'text-red-600', border: 'border-red-100' }
                };
                const colors = colorMap[card.color] || colorMap.blue;
                
                return (
                  <div
                    key={idx}
                    className={`absolute ${getCardPosition(card.position)} ${getCardAnimation(card.position, true)} 
                      transition-all duration-1000 ease-out`}
                    style={{ 
                      transitionDelay: `${idx * 150}ms`
                    }}
                  >
                    <div className={`bg-gradient-to-br from-[#0a3d5c]/90 to-[#0d5a8a]/90 rounded-xl sm:rounded-2xl shadow-xl p-3 sm:p-4 md:p-6 border border-cyan-400/40 
                      hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 w-32 sm:w-40 md:w-48 backdrop-blur-sm`}>
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-cyan-500/20 flex items-center justify-center mb-2 sm:mb-3 border border-cyan-400/30`}>
                        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-cyan-300`} strokeWidth={2} />
                      </div>
                      <h4 className="text-white font-medium text-xs sm:text-sm md:text-base mb-1 leading-tight">{card.title}</h4>
                      <p className={`text-cyan-300 font-bold text-base sm:text-lg md:text-xl`}>{card.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Phone mockup - BEHIND cards (z-index lower) */}
            <div className="relative transform perspective-1000 z-10">
              {/* Phone frame */}
              <div className="relative w-[240px] sm:w-[280px] md:w-[320px] lg:w-[340px] h-[480px] sm:h-[560px] md:h-[640px] lg:h-[680px] bg-slate-900 rounded-[2.5rem] sm:rounded-[3rem] md:rounded-[3.5rem] p-2 sm:p-3 shadow-2xl">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 sm:w-32 md:w-36 h-5 sm:h-6 md:h-7 bg-slate-900 rounded-b-2xl sm:rounded-b-3xl z-10" />
                
                {/* Screen */}
                <div className="relative w-full h-full bg-white rounded-[2rem] sm:rounded-[2.5rem] md:rounded-[3rem] overflow-hidden">
                  {/* Screen content with gradient background */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${getPhoneScreenGradient(features[activeSection].phoneScreen)} 
                    transition-all duration-1000 ease-in-out`}>
                    
                    {/* Status bar */}
                    <div className="flex items-center justify-between px-4 sm:px-5 md:px-6 pt-2 sm:pt-3 text-white text-[10px] sm:text-xs">
                      <span>9:41</span>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-2 sm:w-4 sm:h-3 border border-white rounded-sm" />
                        <div className="w-0.5 h-2 sm:w-1 sm:h-3 bg-white rounded-sm" />
                      </div>
                    </div>

                    {/* Screen title */}
                    <div className="px-4 sm:px-5 md:px-6 pt-6 sm:pt-7 md:pt-8">
                      <h3 className="text-white text-lg sm:text-xl md:text-2xl font-bold">
                        {features[activeSection].phoneScreen === 'dashboard' && 'Dashboard'}
                        {features[activeSection].phoneScreen === 'nutrition' && 'Nutrition'}
                        {features[activeSection].phoneScreen === 'ai-chat' && 'AI Assistant'}
                        {features[activeSection].phoneScreen === 'sleep' && 'Sleep'}
                      </h3>
                      <p className="text-white/80 text-[10px] sm:text-xs md:text-sm mt-1">
                        {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>

                    {/* Animated content preview */}
                    <div className="absolute inset-x-4 sm:inset-x-5 md:inset-x-6 top-24 sm:top-28 md:top-32 bottom-4 sm:bottom-5 md:bottom-6 bg-white/10 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-white/20 p-4 sm:p-5 md:p-6 
                      transition-all duration-1000 shadow-inner">
                      <div className="space-y-3 sm:space-y-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="bg-white/20 rounded-xl sm:rounded-2xl h-14 sm:h-16 md:h-20 animate-pulse shadow-lg" 
                            style={{ animationDelay: `${i * 200}ms`, animationDuration: '2s' }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced phone shadow */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/10 to-slate-900/30 rounded-[2.5rem] sm:rounded-[3rem] md:rounded-[3.5rem] -z-10 blur-2xl sm:blur-3xl transform scale-105" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScrollPhoneShowcase;
