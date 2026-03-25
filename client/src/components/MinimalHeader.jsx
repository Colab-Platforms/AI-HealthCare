import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Menu, X, User } from 'lucide-react';

const MinimalHeader = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="fixed top-5 z-50 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-5xl">
        <div className="bg-white/80 backdrop-blur-md rounded-[28px] border border-white/40 shadow-2xl shadow-black/10 transition-all duration-300">
          <div className="px-5 lg:px-8">
            <div className="flex items-center justify-between h-16 lg:h-20 relative">
              {/* Left: Navigation Links (Desktop) */}
              <nav className="hidden lg:flex items-center gap-8">
                <a href="#features" className="text-sm text-gray-700 hover:text-gray-900 transition-colors font-bold tracking-tight">
                  Features
                </a>
                <a href="#experience" className="text-sm text-gray-700 hover:text-gray-900 transition-colors font-bold tracking-tight">
                  Experience
                </a>
              </nav>

              {/* Logo - Centered flexibly on mobile if no nav, else absolute */}
              <div className="flex-1 flex justify-center lg:absolute lg:left-1/2 lg:-translate-x-1/2">
                <Link to="/">
                  <img 
                    src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/logo_with_text-1.png?v=1774261099" 
                    alt="take.health AI Platform" 
                    className="h-14 md:h-20 w-auto object-contain"
                  />
                </Link>
              </div>

              {/* Right: Desktop Navigation / Mobile Menu Button */}
              <div className="flex items-center">
                <nav className="hidden lg:flex items-center gap-8 mr-6">
                  <a href="#testimonials" className="text-sm text-gray-700 hover:text-gray-900 transition-colors font-bold tracking-tight">
                    Testimonials
                  </a>
                  <a href="#faq" className="text-sm text-gray-700 hover:text-gray-900 transition-colors font-bold tracking-tight">
                    FAQ
                  </a>
                </nav>

                <div className="flex items-center gap-3">
                  <div className="relative hidden lg:block" ref={dropdownRef}>
                    <button 
                      onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                      className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center hover:bg-cyan-400 transition-all active:scale-95 shadow-lg shadow-cyan-500/20"
                    >
                      <User className="w-5 h-5 text-white" />
                    </button>

                    {profileDropdownOpen && (
                      <div className="absolute right-0 mt-4 w-56 bg-white rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-gray-100 py-3 animate-slide-up">
                        <Link to="/login" className="block px-6 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-bold">Sign In</Link>
                        <Link to="/register" className="block px-6 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-bold">Get Started</Link>
                      </div>
                    )}
                  </div>

                  <button 
                    className="lg:hidden p-2 text-gray-900 ml-2" 
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  >
                    {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                  </button>
                </div>
              </div>
            </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="lg:hidden py-6 border-t border-gray-200">
              <nav className="flex flex-col gap-4">
                <a href="#features" className="text-sm text-gray-700 hover:text-gray-900 py-2 font-medium">
                  Features
                </a>
                <a href="#experience" className="text-sm text-gray-700 hover:text-gray-900 py-2 font-medium">
                  Experience
                </a>
                <a href="#testimonials" className="text-sm text-gray-700 hover:text-gray-900 py-2 font-medium">
                  Testimonials
                </a>
                <a href="#faq" className="text-sm text-gray-700 hover:text-gray-900 py-2 font-medium">
                  FAQ
                </a>
                <div className="flex flex-col gap-2 pt-4 border-t border-gray-200">
                  <Link to="/login" className="text-sm text-gray-700 hover:text-gray-900 py-2 font-medium">
                    Sign In
                  </Link>
                  <Link to="/register" className="text-sm text-gray-700 hover:text-gray-900 py-2 font-medium">
                    Get Started
                  </Link>
                </div>
              </nav>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default MinimalHeader;
