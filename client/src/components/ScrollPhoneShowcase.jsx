import { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'framer-motion';
import { Activity, Heart, Utensils, TrendingUp, Moon, Pill, Calendar, MessageSquare } from 'lucide-react';

const ScrollPhoneShowcase = () => {
  const containerRef = useRef(null);

  // High-performance scroll tracking
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Smoothen the scroll progress for a buttery feel
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // Features data with different screens and floating cards
  const features = useMemo(() => [
    {
      title: "Track Your Health Metrics",
      description: "Monitor vital signs, lab results, and health trends all in one place with AI-powered insights.",
      phoneScreen: "dashboard",
      color: "from-purple-500 to-orange-500",
      cards: [
        { icon: Heart, title: "Heart Rate", value: "72 bpm", color: "rose", offset: { x: -280, y: -180 } },
        { icon: Activity, title: "Blood Pressure", value: "120/80", color: "blue", offset: { x: -220, y: 150 } },
        { icon: TrendingUp, title: "Health Score", value: "85/100", color: "emerald", offset: { x: 260, y: -120 } },
        { icon: Pill, title: "Vitamin D", value: "45 ng/mL", color: "amber", offset: { x: 240, y: 180 } }
      ]
    },
    {
      title: "Smart Nutrition Tracking",
      description: "Track your meals and get actionable feedback that helps you build a better relationship with food.",
      phoneScreen: "nutrition",
      color: "from-emerald-500 to-cyan-500",
      cards: [
        { icon: Utensils, title: "Today's Meals", value: "3 logged", color: "emerald", offset: { x: -260, y: -160 } },
        { icon: Activity, title: "Calories", value: "1,850 kcal", color: "orange", offset: { x: -240, y: 120 } },
        { icon: TrendingUp, title: "Protein", value: "95g", color: "blue", offset: { x: 280, y: -140 } },
        { icon: Heart, title: "Macro Balance", value: "Optimal", color: "purple", offset: { x: 220, y: 160 } }
      ]
    },
    {
      title: "AI-Powered Health Insights",
      description: "Get personalized recommendations based on your medical reports and wearable data.",
      phoneScreen: "ai-chat",
      color: "from-blue-600 to-indigo-600",
      cards: [
        { icon: MessageSquare, title: "AI Assistant", value: "24/7 Available", color: "cyan", offset: { x: -240, y: -190 } },
        { icon: TrendingUp, title: "Insights", value: "12 new", color: "indigo", offset: { x: -260, y: 90 } },
        { icon: Calendar, title: "Reminders", value: "5 today", color: "pink", offset: { x: 240, y: -100 } },
        { icon: Heart, title: "Health Tips", value: "Updated", color: "red", offset: { x: 260, y: 140 } }
      ]
    },
    {
      title: "Sleep Quality & Recovery",
      description: "Improve your sleep by understanding patterns, identifying disruptions, and building habits.",
      phoneScreen: "sleep",
      color: "from-indigo-600 to-purple-800",
      cards: [
        { icon: Moon, title: "Sleep Quality", value: "85%", color: "indigo", offset: { x: -220, y: -140 } },
        { icon: Activity, title: "Sleep Duration", value: "7h 45m", color: "blue", offset: { x: -280, y: 100 } },
        { icon: TrendingUp, title: "Deep Sleep", value: "2h 15m", color: "purple", offset: { x: 240, y: -160 } },
        { icon: Heart, title: "REM Sleep", value: "1h 30m", color: "pink", offset: { x: 220, y: 80 } }
      ]
    }
  ], []);

  // Determine active section based on scroll progress
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
      {/* Centered Phone UI that stays behind initial cards */}
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">

        {/* The Phone - Base Layer */}
        <motion.div
          className="relative z-20 perspective-1000"
          style={{
            scale: useTransform(smoothProgress, [0, 0.1], [0.8, 1])
          }}
        >
          {/* Phone Frame */}
          <div className="relative w-[280px] sm:w-[320px] md:w-[340px] h-[560px] sm:h-[640px] md:h-[680px] bg-slate-900 rounded-[3rem] p-3 shadow-[0_0_80px_rgba(0,0,0,0.5)] border-4 border-slate-800">
            {/* Screen */}
            <div className="relative w-full h-full bg-slate-900 rounded-[2.5rem] overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  className={`absolute inset-0 bg-gradient-to-br ${features[activeSection].color}`}
                >
                  {/* Mock UI Content */}
                  <div className="p-6 pt-12 text-white">
                    <div className="flex justify-between items-center mb-10">
                      <div>
                        <h4 className="text-2xl font-bold">{features[activeSection].phoneScreen.toUpperCase()}</h4>
                        <p className="text-white/60 text-sm">March 4, 2026</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                        <Activity className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-24 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 p-4">
                          <div className="w-1/2 h-4 bg-white/20 rounded-full mb-3" />
                          <div className="w-full h-2 bg-white/10 rounded-full" />
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-8 bg-slate-900 rounded-b-3xl z-30" />
          </div>
        </motion.div>

        {/* Floating Cards Layer - Coming from BEHIND (Z-INDEX 10) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <AnimatePresence mode="popLayout">
            {features[activeSection].cards.map((card, idx) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={`${activeSection}-${idx}`}
                  initial={{
                    x: 0,
                    y: 0,
                    opacity: 0,
                    scale: 0.5,
                    rotate: 0,
                    zIndex: 5
                  }}
                  animate={{
                    x: card.offset.x,
                    y: card.offset.y,
                    opacity: 1,
                    scale: 1,
                    rotate: (card.offset.x > 0 ? 5 : -5),
                    zIndex: 40 // Moves to front once out
                  }}
                  exit={{
                    x: 0,
                    y: 0,
                    opacity: 0,
                    scale: 0.5,
                    rotate: 0,
                    zIndex: 5
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 70,
                    damping: 15,
                    delay: idx * 0.12,
                    ease: "easeInOut"
                  }}
                  className="absolute"
                >
                  <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-400/30 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-48 sm:w-56 md:w-64">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center mb-4 border border-cyan-400/20">
                      <Icon className="w-6 h-6 text-cyan-300" />
                    </div>
                    <h5 className="text-white font-bold text-sm md:text-base mb-1">{card.title}</h5>
                    <p className="text-cyan-400 font-black text-xl md:text-2xl">{card.value}</p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Text Layer - Top Fixed */}
        <div className="absolute top-[8vh] sm:top-[12vh] w-full text-center px-6 z-[60]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-white leading-tight mb-4 drop-shadow-2xl">
                {features[activeSection].title}
              </h2>
              <p className="text-cyan-200/80 text-sm sm:text-lg max-w-2xl mx-auto font-medium">
                {features[activeSection].description}
              </p>
            </motion.div>
          </AnimatePresence>
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
