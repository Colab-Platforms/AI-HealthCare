import { Link } from 'react-router-dom';
import { ArrowRight, Activity, Apple, TrendingUp } from 'lucide-react';

const HealthCardsSection = () => {
  return (
    <section className="py-20 md:py-32 bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Card - Full Width */}
        <div className="mb-8 rounded-[32px] bg-gradient-to-br from-[#0a3d5c]/90 to-[#0d5a8a]/90 backdrop-blur-sm overflow-hidden relative min-h-[500px] flex items-center justify-center border border-cyan-400/30">
          <div className="relative z-10 text-center px-8 py-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif text-white mb-6 leading-tight">
              Access personalized
              <br />
              nutrition tracking
            </h2>
            
            <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[#0a3d5c] rounded-full font-medium hover:bg-cyan-100 transition-all shadow-lg"
              >
                Get started
                <ArrowRight className="w-5 h-5" />
              </Link>
              <button className="inline-flex items-center gap-2 px-8 py-4 bg-white/20 backdrop-blur-md text-white rounded-full font-medium hover:bg-white/30 transition-all border border-white/30">
                See if I'm eligible
              </button>
            </div>
          </div>

          {/* Decorative Wave */}
          <svg
            className="absolute bottom-0 left-0 w-full h-32 opacity-20"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path
              d="M0,50 Q300,10 600,50 T1200,50 L1200,120 L0,120 Z"
              fill="currentColor"
              className="text-[#6F5A43]"
            />
          </svg>
        </div>

        {/* Bottom Two Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Card - Tracking */}
          <div className="rounded-[32px] bg-gradient-to-br from-[#0a3d5c]/80 to-[#0d5a8a]/80 overflow-hidden relative min-h-[500px] p-8 md:p-12 border border-cyan-400/30">
            {/* Glassmorphic Inner Card */}
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-cyan-400/20 h-full flex flex-col justify-between shadow-2xl">
              <div>
                <h3 className="text-3xl md:text-4xl font-serif text-white mb-4 leading-tight">
                  Track your health,
                  <br />
                  <span className="text-cyan-300">stay on track</span>
                </h3>
                <p className="text-cyan-100 text-base mb-6">
                  Monitor your daily nutrition intake with AI-powered insights to help you maintain optimal health.
                </p>
                <Link
                  to="/register"
                  className="inline-flex items-center text-white font-medium hover:gap-3 gap-2 transition-all"
                >
                  Get started <ArrowRight className="w-5 h-5" />
                </Link>
              </div>

              {/* Icon/Image Placeholder */}
              <div className="mt-8 flex items-center justify-center">
                <div className="w-32 h-32 rounded-2xl bg-cyan-500/10 backdrop-blur-sm flex items-center justify-center border border-cyan-400/30">
                  <Activity className="w-16 h-16 text-cyan-300" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Card - Nutrition */}
          <div className="rounded-[32px] bg-gradient-to-br from-[#0a3d5c]/80 to-[#0d5a8a]/80 overflow-hidden relative min-h-[500px] p-8 md:p-12 border border-cyan-400/30">
            {/* Glassmorphic Inner Card */}
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-cyan-400/20 h-full flex flex-col justify-between shadow-2xl">
              <div>
                <h3 className="text-3xl md:text-4xl font-serif text-white mb-4 leading-tight">
                  Eat healthy,
                  <br />
                  <span className="text-cyan-300">get strong</span>
                </h3>
                <p className="text-cyan-100 text-base mb-6">
                  Find nutritional, protein-packed meal plans to help you maintain muscle mass and achieve your goals.
                </p>
                <button className="inline-flex items-center text-white font-medium hover:gap-3 gap-2 transition-all">
                  <span className="w-5 h-5 rounded-full border border-white flex items-center justify-center">
                    <span className="text-xs">i</span>
                  </span>
                  Learn more about nutrition
                </button>
              </div>

              {/* Food Grid Placeholder */}
              <div className="mt-8 grid grid-cols-4 gap-2">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-lg bg-cyan-500/10 backdrop-blur-sm flex items-center justify-center border border-cyan-400/20"
                  >
                    <Apple className="w-6 h-6 text-cyan-300" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Card - Personalized Plan */}
        <div className="mt-8 rounded-[32px] bg-gradient-to-br from-[#0a3d5c]/80 to-[#0d5a8a]/80 overflow-hidden relative min-h-[400px] p-8 md:p-12 border border-cyan-400/30">
          {/* Glassmorphic Inner Card */}
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 md:p-12 border border-cyan-400/20 shadow-2xl">
            <div className="text-center max-w-3xl mx-auto">
              <h3 className="text-3xl md:text-5xl font-serif text-white mb-4 leading-tight">
                It's more than a plan,
                <br />
                <span className="text-cyan-300">it's personal</span>
              </h3>
              <p className="text-cyan-100 text-base mb-8 max-w-2xl mx-auto">
                A healthcare provider will review your information, so that they can combine guidance on nutrition, activity, sleep, and more into a plan designed around your body's needs.
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[#0a3d5c] rounded-full font-medium hover:bg-cyan-100 transition-all shadow-lg"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HealthCardsSection;
