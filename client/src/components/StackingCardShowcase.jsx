import { useState, useEffect, useRef } from 'react';
import { Brain, Heart, Activity, Pill, Utensils, Stethoscope, ArrowRight, Moon } from 'lucide-react';

const StackingCardShowcase = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);

  const cards = [
    {
      title: "Artificial Intelligence",
      description: "From strategic AI integration to building personalized AI applications to AI consulting, our comprehensive AI services empower businesses to drive growth and innovation. Connect with our team of experts and access the potential of AI development services.",
      subtitle: "Our team of experts and access the potential of AI development services.",
      gradient: "from-slate-700 via-slate-800 to-slate-900",
      tabColor: "bg-slate-600",
      image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=500&fit=crop",
      icon: Brain,
    },
    {
      title: "Sleep & Recovery",
      description: "Advanced sleep analysis with personalized recommendations. Improve your sleep by understanding patterns, identifying disruptions, and building habits that support deeper rest. Wake up refreshed and energized every day.",
      subtitle: "Advanced sleep analysis with personalized recommendations",
      gradient: "from-purple-700 via-pink-800 to-orange-900",
      tabColor: "bg-indigo-600",
      image: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=800&h=500&fit=crop",
      icon: Moon,
    },
    {
      title: "Health Monitoring",
      description: "Connect your wearables and track vital signs, sleep patterns, and activity levels. Get alerts when something needs attention and see your health trends over time with our advanced monitoring system.",
      subtitle: "Real-time health tracking with smart alerts",
      gradient: "from-purple-700 via-pink-800 to-orange-900",
      tabColor: "bg-cyan-600",
      image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&h=500&fit=crop",
      icon: Activity,
    },
    {
      title: "Personalized Nutrition",
      description: "Track your meals and get actionable feedback that helps you build a better relationship with food. Our AI calculates your perfect macro balance based on your goals and activity level.",
      subtitle: "Smart nutrition tracking with AI recommendations",
      gradient: "from-purple-700 via-pink-800 to-orange-900",
      tabColor: "bg-emerald-600",
      image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=500&fit=crop",
      icon: Utensils,
    },
    {
      title: "Expert Consultations",
      description: "Connect with verified healthcare professionals through video consultations. Get expert medical advice from the comfort of your home with our secure telemedicine platform.",
      subtitle: "24/7 access to healthcare professionals",
      gradient: "from-purple-700 via-pink-800 to-orange-900",
      tabColor: "bg-amber-600",
      image: "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=800&h=500&fit=crop",
      icon: Stethoscope,
    },
  ];

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const scrollProgress = -rect.top / (rect.height - window.innerHeight);
      
      const newIndex = Math.min(
        Math.floor(scrollProgress * cards.length),
        cards.length - 1
      );
      
      setActiveIndex(Math.max(0, newIndex));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [cards.length]);

  return (
    <div 
      ref={containerRef}
      className="relative bg-black"
      style={{ height: `${cards.length * 100}vh` }}
    >
      {/* Sticky Container */}
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden py-12">
        <div className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Title */}
          <div className="text-center mb-8 relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">
              Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-orange-500">Services</span>
            </h2>
            <p className="text-lg text-slate-400">Scroll to explore more</p>
          </div>

          {/* Tabbed Card Stack Container */}
          <div className="relative mx-auto" style={{ maxWidth: '900px', height: '550px' }}>
            {cards.map((card, index) => {
              const Icon = card.icon;
              const isActive = index === activeIndex;
              const isPassed = index < activeIndex;
              const isComing = index > activeIndex;
              
              // Tab stacking effect - like browser tabs
              let transform = '';
              let opacity = 1;
              let zIndex = cards.length - index;
              
              if (isPassed) {
                // Passed cards - slide up completely
                transform = `translateY(-100%)`;
                opacity = 0;
                zIndex = index;
              } else if (isActive) {
                // Active card - full view
                transform = 'translateY(0)';
                opacity = 1;
                zIndex = cards.length + 10;
              } else {
                // Cards in stack - only top tab visible
                const stackPosition = index - activeIndex;
                const tabHeight = 40; // Height of visible tab
                const yOffset = stackPosition * tabHeight; // Stack tabs on top
                
                transform = `translateY(-${100 - (yOffset / 5.5)}%)`; // Show only top portion
                opacity = 1;
                zIndex = cards.length - index;
              }

              return (
                <div
                  key={index}
                  className="absolute inset-0 transition-all duration-700 ease-out"
                  style={{
                    transform,
                    opacity,
                    zIndex,
                  }}
                >
                  {/* Card with Tab */}
                  <div className="relative h-full">
                    {/* Tab Header (visible when stacked) */}
                    <div className={`absolute top-0 left-0 right-0 h-12 ${card.tabColor} rounded-t-2xl flex items-center px-6 gap-3 border-t-4 border-white/20`}>
                      <Icon className="w-5 h-5 text-white" />
                      <span className="text-white font-semibold text-sm">{card.title}</span>
                      <div className="ml-auto flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-white/30" />
                        <div className="w-2 h-2 rounded-full bg-white/30" />
                        <div className="w-2 h-2 rounded-full bg-white/30" />
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className={`absolute top-12 left-0 right-0 bottom-0 rounded-b-2xl overflow-hidden bg-gradient-to-br ${card.gradient} shadow-2xl`}>
                      {/* Content */}
                      <div className="relative h-full flex items-center p-8 md:p-10">
                        <div className="grid md:grid-cols-2 gap-8 w-full items-center">
                          {/* Left: Text Content */}
                          <div className="text-white space-y-5">
                            {/* Title */}
                            <h3 className="text-3xl md:text-4xl font-bold leading-tight">
                              {card.title}
                            </h3>

                            {/* Description */}
                            <p className="text-base text-white/90 leading-relaxed">
                              {card.description}
                            </p>

                            {/* Subtitle */}
                            <p className="text-sm text-white/70">
                              {card.subtitle}
                            </p>

                            {/* CTA Button */}
                            <button className="inline-flex items-center gap-2 px-7 py-3 bg-white text-slate-900 rounded-full font-semibold hover:bg-white/90 transition-all group mt-2">
                              Discover More
                              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>

                          {/* Right: Image */}
                          <div className="hidden md:block">
                            <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: '16/10' }}>
                              <img
                                src={card.image}
                                alt={card.title}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Decorative Elements */}
                      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                      <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Indicators */}
          <div className="flex items-center justify-center gap-8 mt-8 relative z-10">
            {/* Card Counter */}
            <div className="inline-flex items-center gap-3 bg-slate-800/80 backdrop-blur-xl px-5 py-2.5 rounded-full border border-slate-700/50">
              <span className="text-xl font-bold text-white">{activeIndex + 1}</span>
              <span className="text-slate-400">/</span>
              <span className="text-base text-slate-400">{cards.length}</span>
            </div>

            {/* Progress Dots */}
            <div className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-xl px-5 py-2.5 rounded-full border border-slate-700/50">
              {cards.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === activeIndex 
                      ? 'w-6 bg-cyan-500' 
                      : index < activeIndex
                      ? 'w-1.5 bg-slate-600'
                      : 'w-1.5 bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Scroll Hint */}
          <div className="text-center mt-6 relative z-10">
            <p className="text-sm text-slate-500">Scroll to explore more</p>
            <div className="inline-block mt-2 animate-bounce">
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StackingCardShowcase;
