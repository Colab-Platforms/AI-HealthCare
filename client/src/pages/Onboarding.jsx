import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';
import api from '../services/api';

const ONBOARDING_SCREENS = [
  {
    image: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/340a5e6c11c24e2e1b9f9df487363c27f071a7c8.jpg?v=1775711007",
    title: "Here Better Health Begins",
    subtitle: "We interpret a broad spectrum of biomarkers to identify early signals and support timely, personalised care."
  },
  {
    image: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/97ffcab42b7d104864d628c380fc51bb0ec68af1.png?v=1775711412",
    title: "Measure Every Meal",
    subtitle: "Refine your dietary habits with intelligent recommendations tailored to your body's needs."
  },
  {
    image: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/864b4ed77417a276749c9ad3b84c7a3567f97fb1.jpg?v=1775711430",
    title: "Track Your Movement",
    subtitle: "Track steps, activity, and daily movement effortlessly"
  },
  {
    image: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/9d4df035edb88c974c5598e76f8595590b856b83.png?v=1775711470",
    title: "Optimize Your Sleep",
    subtitle: "Gain clarity into your rest quality and take simple steps to improve recovery over time."
  }
];

export default function Onboarding() {
  const [currentScreen, setCurrentScreen] = useState(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentScreen < ONBOARDING_SCREENS.length - 1) {
      setCurrentScreen(prev => prev + 1);
    } else {
      finishOnboarding();
    }
  };

  const finishOnboarding = async () => {
    localStorage.setItem('has_seen_onboarding', 'true');
    try {
      // Sync with database so they don't see it on other devices
      await api.put('auth/profile', {
        profile: { hasSeenMobileTour: true }
      });
    } catch (e) {
      console.error('Failed to sync tour status', e);
    }
    navigate('/dashboard');
  };

  const screen = ONBOARDING_SCREENS[currentScreen];

  return (
    <div className="fixed inset-0 bg-white z-[9999] flex flex-col font-sans overflow-hidden">
      {/* Skip Button */}
      <button
        onClick={finishOnboarding}
        className="absolute top-6 right-6 z-20 px-4 py-1.5 bg-white/60 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-[#64748b] border border-white shadow-sm"
      >
        Skip
      </button>

      {/* Image Section */}
      <div className="relative h-[60vh] w-full overflow-hidden bg-white">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.6, ease: "circOut" }}
            className="w-full h-full relative"
          >
            <img
              src={screen.image}
              alt={screen.title}
              className={`w-full h-full object-cover transition-transform duration-700 ease-out ${currentScreen === 1 ? 'scale-125 -translate-x-[20%]' : 'scale-100 translate-x-0'
                }`}
            />
            {/* Seamless Gradient Overlay to remove any "lines" */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-white" />
          </motion.div>
        </AnimatePresence>

        {/* Pagination Dots */}
        <div className="absolute bottom-12 left-0 w-full flex justify-center gap-2 z-10">
          {ONBOARDING_SCREENS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === currentScreen ? 'w-6 bg-black' : 'w-1.5 bg-slate-200'
                }`}
            />
          ))}
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 px-10 flex flex-col items-center justify-between pt-12 pb-6 relative z-10 bg-white">
        <div className="w-full flex flex-col items-center gap-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScreen}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex flex-col items-center gap-5 max-w-sm"
            >
              <h1 className={`font-bold text-black leading-tight tracking-tight text-center ${currentScreen === 0 ? 'text-[24px] whitespace-nowrap' : 'text-[28px]'
                }`}>
                {screen.title}
              </h1>
              <p className="text-[16px] font-medium text-slate-600 leading-relaxed text-center px-2">
                {screen.subtitle}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Next Button */}
        <div className="w-full px-4 mb-8 mt-2">
          <button
            onClick={handleNext}
            className="w-full h-[60px] bg-white border border-[#69A38D] rounded-[20px] text-black font-bold text-xl transition-all flex items-center justify-center active:scale-[0.98] shadow-sm hover:bg-slate-50"
          >
            {currentScreen === ONBOARDING_SCREENS.length - 1 ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
