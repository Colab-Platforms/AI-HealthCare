import { useState, useEffect, useRef } from 'react';
import { Brain, Heart, Activity, Pill, Utensils, Moon, TrendingUp, Shield, Sparkles, Zap } from 'lucide-react';

const ScrollCardShowcaseV2 = () => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const containerRef = useRef(null);

  const features = [
    {
      title: "Artificial Intelligence",
      description: "From strategic AI integration to building personalized AI applications to AI consulting, our comprehensive AI services empower businesses to drive growth and innovation.",
      subtitle: "Connect with our team of experts and access the potential of AI development services",
      icon: Brain,
      gradient: "from-purple-600 via-pink-600 to-rose-600",
      accentColor: "purple",
      image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=600&fit=crop"
    },
    {
      title: "Health Analytics",
      description: "Advanced data analytics and machine learning models provide deep insights into your health patterns, helping you make informed decisions about your wellness journey.",
      subtitle: "Powerful analytics engine processing millions of health data points",
      icon: TrendingUp,
      gradient: "from-cyan-600 via-blue-600 to-indigo-600",
      accentColor: "cyan",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop"
    },
    {
      title: "Smart Diagnostics",
      description: "AI-powered diagnostic tools analyze your symptoms and medical history to provide accurate preliminary assessments and guide you to the right care.",
      subtitle: "Cutting-edge diagnostic algorithms with 98% accuracy",
      icon: Activity,
      gradient: "from-emerald-600 via-green-600 to-teal-600",
      accentColor: "emerald",
      image: "https://images.unsplash.com/photo-1579154204601-01588f351e67?w=800&h=600&fit=crop"
    },
    {
      title: "Personalized Care",
      description: "Every individual is unique. Our AI creates personalized health plans tailored to your specific needs, goals, and medical history for optimal results.",
      subtitle: "Customized health strategies powered by machine learning",
      icon: Heart,
      gradient: "from-rose-600 via-pink-600 to-fuchsia-600",
      accentColor: "rose",
      image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=600&fit=crop"
    },
    {
      title: "Preventive Medicine",
      description: "Stay ahead of health issues with predictive analytics that identify potential risks early, allowing for proactive intervention and better outcomes.",
      subtitle: "Predictive models analyzing thousands of health indicators",
      icon: Shield,
      gradient: "from-blue-600 via-indigo-600 to-purple-600",
      accentColor: "blue",
      image: "https://images.unsplash.com/photo-1559757175-5700dde675bc?w=800&h=600&fit=crop"
    }
  ];

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      
      const container = containerRef.current;
      const { top, height } = container.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // Calculate smooth scroll progress
      const start = windowHeight * 0.2;
      const progress = Math.max(0, Math.min(1, (start - top) / (height - windowHeight)));
      
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate which card is active and transition progress
  const totalCards = features.length;
  const cardProgress = scrollProgress * (totalCards - 1);
  const activeIndex = Math.floor(cardProgress);
  const transitionProgress = cardProgress - activeIndex;
  
  const currentCard = features[Math.min(activeIndex, totalCards - 1)];
  const nextCard = features[Math.min(activeIndex + 1, totalCards - 1)];

  return (
    <div 
      ref={containerRef} 
      className="relative bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" 
      style={{ height: `${totalCards * 120}vh` }}
    >
      {/* Sticky container */}
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
        
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className={`absolute inset-0 bg-gradient-to-br ${currentCard.gradient} opacity-20 transition-all duration-1000`}
            style={{
              transform: `scale(${1.2 + scrollProgress * 0.3}) rotate(${scrollProgress * 45}deg)`,
              filter: `blur(${100 - scrollProgress * 20}px)`
            }}
          />
          {/* Floating particles */}
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full opacity-20"
              style={{
                left: `${(i * 5) % 100}%`,
                top: `${(i * 7) % 100}%`,
                transform: `translateY(${Math.sin(scrollProgress * Math.PI * 2 + i) * 50}px)`,
                transition: 'transform 0.3s ease-out'
              }}
            />
          ))}
        </div>

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Main Card Container */}
          <div className="relative">
            
            {/* Card Stack Effect - Show multiple cards with depth */}
            {features.map((feature, idx) => {
              const isActive = idx === activeIndex;
              const isPast = idx < activeIndex;
              const isFuture = idx > activeIndex;
              const isNext = idx === activeIndex + 1;
              
              const Icon = feature.icon;
              
              // Calculate card position and scale
              let translateY = 0;
              let scale = 1;
              let opacity = 0;
              let zIndex = 0;
              
              if (isPast) {
                translateY = -100;
                scale = 0.8;
                opacity = 0;
                zIndex = 0;
              } else if (isActive) {
                translateY = transitionProgress * -100;
                scale = 1 - (transitionProgress * 0.2);
                opacity = 1 - (transitionProgress * 0.5);
                zIndex = 20;
              } else if (isNext) {
                translateY = 100 - (transitionProgress * 100);
                scale = 0.8 + (transitionProgress * 0.2);
                opacity = transitionProgress;
                zIndex = 10;
              } else if (isFuture) {
                translateY = 100;
                scale = 0.8;
                opacity = 0;
                zIndex = 0;
              }

              return (
                <div
                  key={idx}
                  className="absolute inset-0 transition-all duration-700 ease-out"
                  style={{
                    transform: `translateY(${translateY}%) scale(${scale})`,
                    opacity,
                    zIndex,
                    pointerEvents: isActive ? 'auto' : 'none'
                  }}
                >
                  {/* Glow effect */}
                  <div 
                    className={`absolute -inset-4 bg-gradient-to-r ${feature.gradient} opacity-20 blur-3xl rounded-3xl`}
                  />
                  
                  {/* Card */}
                  <div className="relative bg-slate-800/90 backdrop-blur-2xl rounded-3xl border border-slate-700/50 overflow-hidden shadow-2xl">
                    <div className="grid lg:grid-cols-5 gap-8">
                      
                      {/* Left Side - Content (3 columns) */}
                      <div className="lg:col-span-3 p-8 lg:p-12 flex flex-col justify-center space-y-6">
                        
                        {/* Icon with animated background */}
                        <div className="relative w-20 h-20">
                          <div className={`absolute inset-0 bg-gradient-to-r ${feature.gradient} rounded-2xl blur-xl opacity-50 animate-pulse`} />
                          <div className={`relative w-20 h-20 rounded-2xl bg-gradient-to-r ${feature.gradient} flex items-center justify-center`}>
                            <Icon className="w-10 h-10 text-white" />
                          </div>
                        </div>

                        {/* Title */}
                        <div>
                          <h2 className="text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
                            {feature.title}
                          </h2>
                          <p className={`text-${feature.accentColor}-400 text-sm font-medium`}>
                            {feature.subtitle}
                          </p>
                        </div>

                        {/* Description */}
                        <p className="text-slate-300 text-xl leading-relaxed">
                          {feature.description}
                        </p>

                        {/* Features list */}
                        <div className="flex flex-wrap gap-3">
                          {['AI-Powered', 'Real-time', 'Secure', 'Personalized'].map((tag, i) => (
                            <span 
                              key={i}
                              className={`px-4 py-2 rounded-full bg-${feature.accentColor}-500/10 border border-${feature.accentColor}-500/20 text-${feature.accentColor}-400 text-sm font-medium`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        {/* CTA */}
                        <button className={`inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r ${feature.gradient} text-white rounded-xl font-semibold hover:shadow-2xl transition-all duration-300 w-fit group`}>
                          Discover More
                          <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                        </button>
                      </div>

                      {/* Right Side - Image (2 columns) */}
                      <div className="lg:col-span-2 relative h-[400px] lg:h-auto">
                        <div className="absolute inset-0 lg:inset-y-8 lg:right-8">
                          <div className="relative h-full rounded-2xl overflow-hidden">
                            <img 
                              src={feature.image} 
                              alt={feature.title}
                              className="w-full h-full object-cover"
                            />
                            <div className={`absolute inset-0 bg-gradient-to-t ${feature.gradient} opacity-30`} />
                            
                            {/* Overlay pattern */}
                            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItaDJ2LTJoLTJ6bTAgNHYyaC0ydjJoMnYtMmgydi0yaC0yem0tMiAydi0yaC0ydjJoMnptMi0yaDJ2LTJoLTJ2MnptLTItNHYyaDJ2LTJoLTJ6bS0yLTJ2Mmgydi0yaC0yem0yLTJoMnYtMmgtMnYyem0wLTR2Mmgydi0yaC0yem0tMiAydjJoMnYtMmgtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress Bar */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3">
            {features.map((_, idx) => (
              <div
                key={idx}
                className="relative h-1 rounded-full bg-slate-700 overflow-hidden"
                style={{ width: idx === activeIndex ? '48px' : '24px' }}
              >
                <div 
                  className={`absolute inset-0 bg-gradient-to-r ${currentCard.gradient}`}
                  style={{
                    transform: `scaleX(${idx < activeIndex ? 1 : idx === activeIndex ? transitionProgress : 0})`,
                    transformOrigin: 'left',
                    transition: 'transform 0.3s ease-out'
                  }}
                />
              </div>
            ))}
          </div>

          {/* Card Counter */}
          <div className="absolute top-8 right-8 text-white/50 text-sm font-mono">
            {String(activeIndex + 1).padStart(2, '0')} / {String(totalCards).padStart(2, '0')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScrollCardShowcaseV2;
