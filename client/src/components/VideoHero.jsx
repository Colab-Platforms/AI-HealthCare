import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const VideoHero = () => {
  return (
    <div className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-b from-[#0a3d5c] to-[#0d5a8a]">
      {/* Video Background - Clear and visible */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-60"
        >
          <source src="https://cdn.shopify.com/videos/c/o/v/dcb48db72fdb4641a2af2df51c03aad5.mp4" type="video/mp4" />
          {/* Fallback for browsers that don't support video */}
          <img 
            src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1920&h=1080&fit=crop" 
            alt="Healthcare" 
            className="w-full h-full object-cover opacity-60"
          />
        </video>
        {/* Overlay for text readability - lighter overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/20 to-transparent" />
      </div>

      {/* Content - Left aligned on large screens */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-32">
        <div className="max-w-xl lg:max-w-2xl text-center lg:text-left">
          {/* Subtitle */}
          <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-cyan-300 mb-6 font-medium">
            SMART NUTRITION TRACKING
          </p>

          {/* Main Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-serif text-white mb-6 leading-[1.1]">
            Track calories.
            <br />
            <span className="italic">Naturally</span> healthy.
          </h1>

          {/* Description */}
          <p className="text-base sm:text-lg md:text-xl text-cyan-100 mb-10 leading-relaxed max-w-lg">
            Discover nutrition tracking that works with you. AI-powered insights, personalized meal plans, effortless calorie counting.
          </p>

          {/* CTA Button */}
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-cyan-500 text-white rounded-full font-medium hover:bg-cyan-400 transition-all group shadow-lg"
          >
            Start Tracking
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Scroll Indicator - Centered at bottom */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
        <span className="text-xs uppercase tracking-wider text-cyan-300 font-medium">SCROLL</span>
        <div className="w-px h-12 bg-cyan-300/30" />
      </div>
    </div>
  );
};

export default VideoHero;
