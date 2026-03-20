import { useState, useEffect, useRef } from 'react';
import { Brain, Heart, Activity, Pill, Utensils, Moon, TrendingUp, Shield } from 'lucide-react';

const ScrollCardShowcase = () => {
  const [activeCard, setActiveCard] = useState(0);
  const containerRef = useRef(null);

  // Healthcare AI features with different themes
  const features = [
    {
      title: "AI-Powered Health Analysis",
      description: "From comprehensive health report analysis to personalized recommendations, our AI services empower you to take control of your health journey. Get instant insights from your medical reports.",
      subtitle: "Advanced machine learning algorithms analyze your health data",
      icon: Brain,
      gradient: "from-purple-500 via-pink-500 to-orange-500",
      image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=600&fit=crop",
      stats: [
        { label: "Accuracy", value: "98%" },
        { label: "Reports Analyzed", value: "50K+" },
        { label: "Insights Generated", value: "1M+" }
      ]
    },
    {
      title: "Personalized Nutrition Plans",
      description: "Track your meals and get actionable feedback that helps you build a better relationship with food. Our AI calculates your perfect macro balance based on your goals and activity level.",
      subtitle: "Smart nutrition tracking with AI-powered recommendations",
      icon: Utensils,
      gradient: "from-purple-500 via-pink-500 to-orange-500",
      image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=600&fit=crop",
      stats: [
        { label: "Meal Plans", value: "10K+" },
        { label: "Calories Tracked", value: "50M+" },
        { label: "Goals Achieved", value: "85%" }
      ]
    },
    {
      title: "Real-Time Health Monitoring",
      description: "Connect your wearables and track vital signs, sleep patterns, and activity levels. Get alerts when something needs attention and see your health trends over time.",
      subtitle: "Continuous monitoring with smart alerts and insights",
      icon: Activity,
      gradient: "from-purple-500 via-pink-500 to-orange-500",
      image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&h=600&fit=crop",
      stats: [
        { label: "Devices Connected", value: "25K+" },
        { label: "Data Points", value: "100M+" },
        { label: "Alerts Sent", value: "500K+" }
      ]
    },
    {
      title: "Smart Medication Management",
      description: "Never miss a dose with intelligent reminders. Track your medications, get interaction warnings, and receive refill alerts. Your complete medication companion.",
      subtitle: "AI-powered medication tracking and reminders",
      icon: Pill,
      gradient: "from-purple-500 via-pink-500 to-orange-500",
      image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&h=600&fit=crop",
      stats: [
        { label: "Reminders Set", value: "100K+" },
        { label: "Adherence Rate", value: "92%" },
        { label: "Interactions Checked", value: "1M+" }
      ]
    },
    {
      title: "Sleep & Recovery Insights",
      description: "Improve your sleep by understanding patterns, identifying disruptions, and building habits that support deeper rest. Wake up refreshed and energized every day.",
      subtitle: "Advanced sleep analysis with personalized recommendations",
      icon: Moon,
      gradient: "from-purple-500 via-pink-500 to-orange-500",
      image: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=800&h=600&fit=crop",
      stats: [
        { label: "Sleep Tracked", value: "1M+ nights" },
        { label: "Quality Score", value: "8.5/10" },
        { label: "Recovery Rate", value: "88%" }
      ]
    },
    {
      title: "Preventive Health Insights",
      description: "Stay ahead of health issues with predictive analytics. Our AI identifies potential risks early and provides actionable steps to maintain optimal health.",
      subtitle: "Proactive health management with AI predictions",
      icon: Shield,
      gradient: "from-purple-500 via-pink-500 to-orange-500",
      image: "https://images.unsplash.com/photo-1559757175-5700dde675bc?w=800&h=600&fit=crop",
      stats: [
        { label: "Risk Assessments", value: "75K+" },
        { label: "Early Detections", value: "15K+" },
        { label: "Prevention Rate", value: "94%" }
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
      const scrollStart = windowHeight * 0.3; // Start changing when container is 30% into view
      const scrollProgress = (scrollStart - top) / (height - windowHeight);
      const clampedProgress = Math.max(0, Math.min(1, scrollProgress));
      
      // Determine which card should be active based on scroll progress
      const cardIndex = Math.floor(clampedProgress * features.length);
      const finalIndex = Math.min(cardIndex, features.length - 1);
      
      if (finalIndex !== activeCard) {
        setActiveCard(finalIndex);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeCard, features.length]);

  const currentFeature = features[activeCard];
  const Icon = currentFeature.icon;

  return (
    <div 
      ref={containerRef} 
      className="relative bg-slate-900" 
      style={{ height: `${features.length * 100}vh` }}
    >
      {/* Sticky container */}
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Main Card */}
          <div className="relative">
            {/* Background gradient that changes */}
            <div 
              className={`absolute inset-0 bg-gradient-to-r ${currentFeature.gradient} opacity-10 rounded-3xl blur-3xl transition-all duration-1000`}
              style={{ transform: `scale(${1 + activeCard * 0.1})` }}
            />
            
            {/* Card Content */}
            <div className="relative bg-slate-800/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 overflow-hidden shadow-2xl">
              <div className="grid lg:grid-cols-2 gap-8 p-8 lg:p-12">
                
                {/* Left Side - Text Content */}
                <div className="flex flex-col justify-center space-y-6">
                  {/* Icon */}
                  <div 
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${currentFeature.gradient} flex items-center justify-center transform transition-all duration-700`}
                    style={{ 
                      transform: `scale(${activeCard === features.indexOf(currentFeature) ? 1 : 0.8})`,
                      opacity: activeCard === features.indexOf(currentFeature) ? 1 : 0
                    }}
                  >
                    <Icon className="w-8 h-8 text-white" />
                  </div>

                  {/* Title */}
                  <div>
                    <h2 
                      className="text-4xl lg:text-5xl font-bold text-white mb-4 transition-all duration-700"
                      style={{
                        transform: `translateY(${activeCard === features.indexOf(currentFeature) ? 0 : 20}px)`,
                        opacity: activeCard === features.indexOf(currentFeature) ? 1 : 0
                      }}
                    >
                      {currentFeature.title}
                    </h2>
                    <p 
                      className="text-slate-400 text-sm transition-all duration-700 delay-100"
                      style={{
                        transform: `translateY(${activeCard === features.indexOf(currentFeature) ? 0 : 20}px)`,
                        opacity: activeCard === features.indexOf(currentFeature) ? 1 : 0
                      }}
                    >
                      {currentFeature.subtitle}
                    </p>
                  </div>

                  {/* Description */}
                  <p 
                    className="text-slate-300 text-lg leading-relaxed transition-all duration-700 delay-200"
                    style={{
                      transform: `translateY(${activeCard === features.indexOf(currentFeature) ? 0 : 20}px)`,
                      opacity: activeCard === features.indexOf(currentFeature) ? 1 : 0
                    }}
                  >
                    {currentFeature.description}
                  </p>

                  {/* Stats */}
                  <div 
                    className="grid grid-cols-3 gap-4 pt-4 transition-all duration-700 delay-300"
                    style={{
                      transform: `translateY(${activeCard === features.indexOf(currentFeature) ? 0 : 20}px)`,
                      opacity: activeCard === features.indexOf(currentFeature) ? 1 : 0
                    }}
                  >
                    {currentFeature.stats.map((stat, idx) => (
                      <div key={idx} className="text-center">
                        <div className={`text-2xl font-bold bg-gradient-to-r ${currentFeature.gradient} bg-clip-text text-transparent`}>
                          {stat.value}
                        </div>
                        <div className="text-slate-400 text-xs mt-1">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <button 
                    className={`inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r ${currentFeature.gradient} text-white rounded-xl font-medium hover:shadow-lg transition-all duration-700 delay-400 w-fit`}
                    style={{
                      transform: `translateY(${activeCard === features.indexOf(currentFeature) ? 0 : 20}px)`,
                      opacity: activeCard === features.indexOf(currentFeature) ? 1 : 0
                    }}
                  >
                    Discover More
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </button>
                </div>

                {/* Right Side - Image */}
                <div className="relative h-[400px] lg:h-auto">
                  <div 
                    className="absolute inset-0 rounded-2xl overflow-hidden transition-all duration-700"
                    style={{
                      transform: `scale(${activeCard === features.indexOf(currentFeature) ? 1 : 0.95})`,
                      opacity: activeCard === features.indexOf(currentFeature) ? 1 : 0
                    }}
                  >
                    <img 
                      src={currentFeature.image} 
                      alt={currentFeature.title}
                      className="w-full h-full object-cover"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-t ${currentFeature.gradient} opacity-20`} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="flex justify-center gap-2 mt-8">
            {features.map((_, idx) => (
              <div
                key={idx}
                className={`h-1 rounded-full transition-all duration-500 ${
                  idx === activeCard 
                    ? 'w-12 bg-white' 
                    : 'w-8 bg-slate-600'
                }`}
              />
            ))}
          </div>

          {/* Scroll Hint */}
          {activeCard < features.length - 1 && (
            <div className="text-center mt-8 animate-bounce">
              <p className="text-slate-400 text-sm mb-2">Scroll to explore more</p>
              <svg className="w-6 h-6 mx-auto text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScrollCardShowcase;
