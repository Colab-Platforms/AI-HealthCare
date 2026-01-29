import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const VideoHero = () => {
  return (
    <div className="relative min-h-screen flex items-center overflow-hidden bg-[#F5F1EA]">
      {/* Video Background - Clear and visible */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        >
          <source src="https://cdn.shopify.com/videos/c/o/v/dcb48db72fdb4641a2af2df51c03aad5.mp4" type="video/mp4" />
          {/* Fallback for browsers that don't support video */}
          <img 
            src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1920&h=1080&fit=crop" 
            alt="Healthcare" 
            className="w-full h-full object-cover"
          />
        </video>
        {/* Minimal overlay for text readability only */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-white/30 to-transparent lg:from-white/60 lg:via-white/20 lg:to-transparent" />
      </div>

      {/* Content - Left aligned on large screens */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-32">
        <div className="max-w-xl lg:max-w-2xl text-center lg:text-left">
          {/* Subtitle */}
          <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-black mb-6 font-medium">
            SMART NUTRITION TRACKING
          </p>

          {/* Main Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-serif text-black mb-6 leading-[1.1]">
            Track calories.
            <br />
            <span className="italic">Naturally</span> healthy.
          </h1>

          {/* Description */}
          <p className="text-base sm:text-lg md:text-xl text-black mb-10 leading-relaxed max-w-lg">
            Discover nutrition tracking that works with you. AI-powered insights, personalized meal plans, effortless calorie counting.
          </p>

          {/* CTA Button */}
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-[#8B7355] text-white rounded-full font-medium hover:bg-[#6F5A43] transition-all group shadow-lg"
          >
            Start Tracking
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Scroll Indicator - Centered at bottom */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
        <span className="text-xs uppercase tracking-wider text-black font-medium">SCROLL</span>
        <div className="w-px h-12 bg-black/30" />
      </div>
    </div>
  );
};

export default VideoHero;
