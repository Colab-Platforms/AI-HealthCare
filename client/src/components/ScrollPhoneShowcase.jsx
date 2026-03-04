import { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'framer-motion';
import { Activity, Heart, Utensils, TrendingUp, Moon, Pill, Calendar, MessageSquare } from 'lucide-react';

const ScrollPhoneShowcase = () => {
  const containerRef = useRef(null);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;

  // Responsive offsets based on screen size to ensure cards clear the phone
  const getOffsets = (baseX, baseY) => {
    let multiplier = 1.1; // Desktop
    if (isMobile) multiplier = 0.55;
    else if (isTablet) multiplier = 0.85;

    return { x: baseX * multiplier, y: baseY * multiplier };
  };

  // High-performance scroll tracking
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // Features data with adaptive offsets
  const features = useMemo(() => [
    {
      title: "Health Metrics",
      description: "Monitor vitals and trends with AI insights.",
      phoneScreen: "dashboard",
      color: "from-purple-600 to-orange-500",
      cards: [
        { icon: Heart, title: "Heart Rate", value: "72 bpm", color: "rose", ...getOffsets(-300, -180) },
        { icon: Activity, title: "Pressure", value: "120/80", color: "blue", ...getOffsets(-260, 160) },
        { icon: TrendingUp, title: "Score", value: "85/100", color: "emerald", ...getOffsets(320, -120) },
        { icon: Pill, title: "Vitamin D", value: "45 ng/mL", color: "amber", ...getOffsets(280, 200) }
      ]
    },
    {
      title: "Smart Nutrition",
      description: "Track meals and get actionable feedback.",
      phoneScreen: "nutrition",
      color: "from-emerald-600 to-cyan-500",
      cards: [
        { icon: Utensils, title: "Meals", value: "3 logged", color: "emerald", ...getOffsets(-320, -160) },
        { icon: Activity, title: "Calories", value: "1,850 kcal", color: "orange", ...getOffsets(-240, 130) },
        { icon: TrendingUp, title: "Protein", value: "95g", color: "blue", ...getOffsets(300, -150) },
        { icon: Heart, title: "Macro", value: "Optimal", color: "purple", ...getOffsets(260, 170) }
      ]
    },
    {
      title: "AI Insights",
      description: "Personalized advice from your data.",
      phoneScreen: "ai-chat",
      color: "from-blue-600 to-indigo-600",
      cards: [
        { icon: MessageSquare, title: "Assistant", value: "24/7 Live", color: "cyan", ...getOffsets(-280, -200) },
        { icon: TrendingUp, title: "Insights", value: "12 new", color: "indigo", ...getOffsets(-320, 100) },
        { icon: Calendar, title: "Reminders", value: "5 today", color: "pink", ...getOffsets(260, -140) },
        { icon: Heart, title: "Tips", value: "Updated", color: "red", ...getOffsets(320, 180) }
      ]
    },
    {
      title: "Sleep Quality",
      description: "Understand patterns for better recovery.",
      phoneScreen: "sleep",
      color: "from-indigo-600 to-purple-800",
      cards: [
        { icon: Moon, title: "Efficiency", value: "85%", color: "indigo", ...getOffsets(-280, -150) },
        { icon: Activity, title: "Duration", value: "7h 45m", color: "blue", ...getOffsets(-300, 120) },
        { icon: TrendingUp, title: "Deep Sleep", value: "2h 15m", color: "purple", ...getOffsets(280, -160) },
        { icon: Heart, title: "REM", value: "1h 30m", color: "pink", ...getOffsets(300, 110) }
      ]
    }
  ], [windowWidth]);

  const [activeSection, setActiveSection] = useState(0);

  // Use a listener to update active section
  scrollYProgress.on("change", (latest) => {
    const sectionIndex = Math.min(
      Math.floor(latest * features.length),
      features.length - 1
    );
    if (sectionIndex !== activeSection) {
      setActiveSection(sectionIndex);
    }
  });

  return (
    <div id="showcase" ref={containerRef} className="relative bg-transparent" style={{ height: `${features.length * 100}vh` }}>
      {/* Sticky container for phone and cards */}
      <div className="sticky top-0 h-screen flex flex-col items-center justify-start sm:justify-center overflow-hidden pt-16 sm:pt-0">

        {/* Header Text - Repositioned to avoid overlap */}
        <div className="w-full text-center px-6 z-[60] mb-8 sm:mb-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="max-w-4xl mx-auto"
            >
              <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white leading-tight mb-4 drop-shadow-2xl tracking-tighter">
                {features[activeSection].title}
              </h2>
              <p className="text-cyan-200/90 text-sm sm:text-lg lg:text-xl max-w-2xl mx-auto font-medium px-4">
                {features[activeSection].description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Animation Zone */}
        <div className="relative flex items-center justify-center w-full max-w-7xl mx-auto h-[45vh] sm:h-auto">

          {/* Floating Cards Layer - Coming from BEHIND (Z-INDEX 10) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <AnimatePresence mode="popLayout">
              {features[activeSection].cards.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={`${activeSection}-${idx}`}
                    initial={{ x: 0, y: 0, opacity: 0, scale: 0.3, rotate: 0, zIndex: 5 }}
                    animate={{
                      x: card.x,
                      y: card.y,
                      opacity: 1,
                      scale: 1,
                      rotate: (card.x > 0 ? 5 : -5),
                      zIndex: 40 // Moves to front once out
                    }}
                    exit={{ x: 0, y: 0, opacity: 0, scale: 0.3, rotate: 0, zIndex: 5 }}
                    transition={{
                      type: "spring",
                      stiffness: 80,
                      damping: 18,
                      delay: idx * 0.1,
                    }}
                    className="absolute"
                  >
                    <div className="bg-[#0f172a]/95 backdrop-blur-2xl border border-cyan-400/40 rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)] w-32 sm:w-44 md:w-56 lg:w-64 transition-all">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-2 sm:mb-4 border border-cyan-400/20">
                        <Icon className="w-4 h-4 sm:w-6 sm:h-6 text-cyan-300" />
                      </div>
                      <h5 className="text-white font-extrabold text-[10px] sm:text-xs md:text-sm lg:text-base mb-0.5 tracking-tight uppercase">{card.title}</h5>
                      <p className="text-cyan-400 font-black text-xs sm:text-sm md:text-xl lg:text-2xl">{card.value}</p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* The Phone - Base Layer */}
          <motion.div
            className="relative z-20 perspective-1000"
            style={{
              scale: useTransform(smoothProgress, [0, 0.1], [isMobile ? 0.75 : 0.85, 1]),
              y: isMobile ? 30 : 0
            }}
          >
            {/* Phone Frame - Resized for mobile stability */}
            <div className="relative w-[180px] sm:w-[260px] md:w-[300px] lg:w-[320px] h-[360px] sm:h-[520px] md:h-[600px] lg:h-[640px] bg-slate-900 rounded-[2rem] sm:rounded-[3rem] p-2 sm:p-3 shadow-[0_0_100px_rgba(0,0,0,0.6)] border-4 border-slate-800/80">
              {/* Screen Content */}
              <div className="relative w-full h-full bg-slate-900 rounded-[1.8rem] sm:rounded-[2.5rem] overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSection}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    className={`absolute inset-0 bg-gradient-to-br ${features[activeSection].color}`}
                  >
                    {/* Mock App UI */}
                    <div className="p-4 sm:p-6 pt-10 sm:pt-14 text-white">
                      <div className="flex justify-between items-center mb-6 sm:mb-10">
                        <div>
                          <h4 className="text-lg sm:text-2xl font-black tracking-tight">{features[activeSection].phoneScreen.toUpperCase()}</h4>
                          <p className="text-white/60 text-[10px] sm:text-xs">March 4, 2026</p>
                        </div>
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                          <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                      </div>

                      <div className="space-y-3 sm:space-y-5">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-16 sm:h-24 bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 p-3 sm:p-4 shadow-xl">
                            <div className="w-1/2 h-2 sm:h-4 bg-white/30 rounded-full mb-2 sm:mb-4" />
                            <div className="w-full h-1 sm:h-2 bg-white/10 rounded-full" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 sm:w-36 h-5 sm:h-7 bg-slate-900 rounded-b-2xl sm:rounded-b-3xl z-30" />
            </div>

            {/* Phone Shadow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-10 bg-black/40 blur-3xl -z-10" />
          </motion.div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .perspective-1000 { perspective: 1000px; }
      `}} />
    </div>
  );
};

export default ScrollPhoneShowcase;
