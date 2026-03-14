import { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'framer-motion';
import { Activity, Heart, Utensils, TrendingUp, Moon, Pill, Calendar, MessageSquare, Droplets, Zap, BarChart3, Sparkles } from 'lucide-react';

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
    if (isMobile) multiplier = 0.45; // Tuned for standard mobile screens to stay within bounds
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
  // Features data with adaptive offsets and high-quality app screenshots
  const features = useMemo(() => [
    {
      title: "Health Dashboard",
      description: "A centralized hub for your vitals, goals, and comprehensive health monitoring.",
      phoneScreen: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=800",
      color: "from-purple-600/40 to-orange-500/40",
      cards: [
        { icon: Heart, title: "Heart Rate", value: "72 bpm", color: "rose", ...getOffsets(-300, -180) },
        { icon: Activity, title: "Pressure", value: "120/80", color: "blue", ...getOffsets(-260, 160) },
        { icon: TrendingUp, title: "Score", value: "85/100", color: "emerald", ...getOffsets(320, -120) },
        { icon: Pill, title: "Vitamin D", value: "45 ng/mL", color: "amber", ...getOffsets(280, 200) }
      ]
    },
    {
      title: "Smart Nutrition",
      description: "AI-powered food scanning and real-time nutritional breakdown of your meals.",
      phoneScreen: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=800",
      color: "from-emerald-600/40 to-cyan-500/40",
      cards: [
        { icon: Utensils, title: "Food Scan", value: "Instant", color: "emerald", ...getOffsets(-320, -160) },
        { icon: Activity, title: "Calories", value: "1,850 kcal", color: "orange", ...getOffsets(-240, 130) },
        { icon: TrendingUp, title: "Analysis", value: "Detailed", color: "blue", ...getOffsets(300, -150) },
        { icon: Heart, title: "Score", value: "Optimal", color: "purple", ...getOffsets(260, 170) }
      ]
    },
    {
      title: "AI Analysis",
      description: "Deep insights from your medical reports translated into actionable health plans.",
      phoneScreen: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/report-analysis.jpg?v=1768295338",
      color: "from-blue-600/40 to-indigo-600/40",
      cards: [
        { icon: MessageSquare, title: "Analysis", value: "Instant", color: "cyan", ...getOffsets(-280, -200) },
        { icon: TrendingUp, title: "Insights", value: "AI-Driven", color: "indigo", ...getOffsets(-320, 100) },
        { icon: Calendar, title: "Reports", value: "All Formats", color: "pink", ...getOffsets(260, -140) },
        { icon: Heart, title: "Plans", value: "Custom", color: "red", ...getOffsets(320, 180) }
      ]
    },
    {
      title: "Glucose Monitoring",
      description: "Real-time tracking of blood sugar levels with smart alerts and trend analysis.",
      phoneScreen: "https://images.unsplash.com/photo-1551076805-e1869033e561?q=80&w=800",
      color: "from-indigo-600/40 to-purple-800/40",
      cards: [
        { icon: Droplets, title: "Reading", value: "108 mg/dL", color: "red", ...getOffsets(-280, -150) },
        { icon: Activity, title: "Stability", value: "Normal", color: "emerald", ...getOffsets(-300, 120) },
        { icon: BarChart3, title: "HBA1C", value: "5.4%", color: "blue", ...getOffsets(280, -160) },
        { icon: Zap, title: "Alerts", value: "Active", color: "orange", ...getOffsets(300, 110) }
      ]
    }
  ], [windowWidth, isMobile, isTablet, isTablet]);

  const [activeSection, setActiveSection] = useState(0);

  // Use a listener to update active section
  scrollYProgress.on("change", (latest) => {
    const sectionIndex = Math.min(
      Math.floor(latest * (features.length + 1)),
      features.length - 1
    );
    if (sectionIndex !== activeSection) {
      setActiveSection(sectionIndex);
    }
  });

  return (
    <div id="showcase" ref={containerRef} className="relative bg-transparent" style={{ height: `${(features.length + 1) * 100}vh` }}>
      {/* Sticky container for phone and cards */}
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden pt-12 sm:pt-20 lg:pt-32">

        {/* Header Text - Increased top safety zone */}
        <div className="w-full text-center px-6 z-[60] mb-6 sm:mb-16">
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
                    <div className="bg-[#0f172a]/95 backdrop-blur-2xl border border-cyan-400/40 rounded-2xl sm:rounded-3xl p-0 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6)] w-32 sm:w-44 md:w-56 lg:w-64 transition-all">
                      {/* Feature Card Header with Image */}
                      <div className="h-20 sm:h-28 relative overflow-hidden">
                        <img
                          src={features[activeSection].phoneScreen}
                          className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] to-transparent" />
                        <div className="absolute bottom-2 left-3 w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-400/20 backdrop-blur-md">
                          <Icon className="w-4 h-4 sm:w-6 sm:h-6 text-cyan-300" />
                        </div>
                      </div>

                      <div className="p-3 sm:p-5">
                        <h5 className="text-slate-400 font-black text-[9px] sm:text-[10px] mb-0.5 tracking-widest uppercase">{card.title}</h5>
                        <p className="text-white font-black text-xs sm:text-lg md:text-xl">{card.value}</p>
                      </div>
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
              scale: useTransform(smoothProgress, [0, 0.1], [isMobile ? 0.7 : 0.8, isMobile ? 0.9 : 1]),
              y: isMobile ? 40 : 0
            }}
          >
            {/* Phone Frame - Resized and constrained to prevent cutting */}
            <div className="relative w-[180px] sm:w-[240px] md:w-[280px] lg:w-[310px] h-[370px] sm:h-[480px] md:h-[580px] lg:h-[620px] max-h-[75vh] bg-slate-900 rounded-[2rem] sm:rounded-[3rem] p-2 sm:p-3 shadow-[0_0_100px_rgba(0,0,0,0.6)] border-4 border-slate-800/80">
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
                    {/* Mock App UI - High Quality Screenshots */}
                    <div className="w-full h-full relative">
                      <img
                        src={features[activeSection].phoneScreen}
                        alt={features[activeSection].title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20" />

                      {/* Interactive UI Overlays */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full px-4 text-center">
                        <motion.div
                          key={activeSection}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.3 }}
                          className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-3xl"
                        >
                          <div className="w-12 h-1 bg-cyan-400 rounded-full mx-auto mb-4" />
                          <h4 className="text-sm sm:text-lg font-black text-white">{features[activeSection].title}</h4>
                          <p className="text-[10px] sm:text-xs text-white/70">Syncing live data...</p>
                        </motion.div>
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
