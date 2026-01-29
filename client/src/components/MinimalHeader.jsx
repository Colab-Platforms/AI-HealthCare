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
    <header className="fixed top-5 z-50 left-1/2 -translate-x-1/2 w-[calc(100%-200px)] max-w-5xl max-md:w-[calc(100%-40px)]">
      <div className="bg-white/50 backdrop-blur-3xl rounded-[28px] border border-white/60 shadow-2xl shadow-black/10">
        <div className="px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Navigation Links */}
            <nav className="hidden lg:flex items-center gap-6">
              <a href="#features" className="text-sm text-[#5C4F3D] hover:text-[#2C2416] transition-colors font-medium">
                Features
              </a>
              <a href="#showcase" className="text-sm text-[#5C4F3D] hover:text-[#2C2416] transition-colors font-medium">
                Showcase
              </a>
            </nav>

            {/* Center: Logo */}
            <Link to="/" className="absolute left-1/2 -translate-x-1/2">
              <span className="text-xl lg:text-2xl font-serif text-[#2C2416]">HealthAI</span>
            </Link>

            {/* Right: Navigation Links + Profile */}
            <div className="hidden lg:flex items-center gap-6">
              <a href="#testimonials" className="text-sm text-[#5C4F3D] hover:text-[#2C2416] transition-colors font-medium">
                Testimonials
              </a>
              <a href="#faq" className="text-sm text-[#5C4F3D] hover:text-[#2C2416] transition-colors font-medium">
                FAQ
              </a>
              
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="w-10 h-10 rounded-full bg-[#8B7355] flex items-center justify-center hover:bg-[#6F5A43] transition-colors ml-2"
                >
                  <User className="w-5 h-5 text-white" />
                </button>

                {/* Dropdown Menu */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-3 w-48 bg-white/90 backdrop-blur-2xl rounded-2xl shadow-xl border border-white/40 py-2 animate-fade-in">
                    <Link
                      to="/login"
                      className="block px-6 py-3 text-sm text-[#5C4F3D] hover:bg-[#F5F1EA]/50 transition-colors font-medium"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/register"
                      className="block px-6 py-3 text-sm text-[#5C4F3D] hover:bg-[#F5F1EA]/50 transition-colors font-medium"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      Get Started
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile menu button */}
            <button 
              className="lg:hidden p-2 text-[#5C4F3D] ml-auto" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="lg:hidden py-6 border-t border-white/20">
              <nav className="flex flex-col gap-4">
                <a href="#features" className="text-sm text-[#5C4F3D] hover:text-[#2C2416] py-2 font-medium">
                  Features
                </a>
                <a href="#showcase" className="text-sm text-[#5C4F3D] hover:text-[#2C2416] py-2 font-medium">
                  Showcase
                </a>
                <a href="#testimonials" className="text-sm text-[#5C4F3D] hover:text-[#2C2416] py-2 font-medium">
                  Testimonials
                </a>
                <a href="#faq" className="text-sm text-[#5C4F3D] hover:text-[#2C2416] py-2 font-medium">
                  FAQ
                </a>
                <div className="flex flex-col gap-2 pt-4 border-t border-white/20">
                  <Link to="/login" className="text-sm text-[#5C4F3D] hover:text-[#2C2416] py-2 font-medium">
                    Sign In
                  </Link>
                  <Link to="/register" className="text-sm text-[#5C4F3D] hover:text-[#2C2416] py-2 font-medium">
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
