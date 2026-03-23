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
      <div className="bg-white/80 backdrop-blur-md rounded-[28px] border border-white/40 shadow-2xl shadow-black/10">
        <div className="px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Navigation Links */}
            <nav className="hidden lg:flex items-center gap-6">
              <a href="#features" className="text-sm text-gray-700 hover:text-gray-900 transition-colors font-medium">
                Features
              </a>
                <a href="#experience" className="text-sm text-gray-700 hover:text-gray-900 transition-colors font-medium">
                  Experience
                </a>
              </nav>

              {/* Center: Logo */}
              <Link to="/" className="absolute left-1/2 -translate-x-1/2">
                <img 
                  src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/logo_with_text-1.png?v=1774261099" 
                  alt="take.health AI Platform" 
                  className="h-20 w-auto object-contain"
                />
              </Link>

            {/* Right: Navigation Links + Profile */}
            <div className="hidden lg:flex items-center gap-6">
              <a href="#testimonials" className="text-sm text-gray-700 hover:text-gray-900 transition-colors font-medium">
                Testimonials
              </a>
              <a href="#faq" className="text-sm text-gray-700 hover:text-gray-900 transition-colors font-medium">
                FAQ
              </a>
              
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center hover:bg-cyan-400 transition-colors ml-2"
                >
                  <User className="w-5 h-5 text-white" />
                </button>

                {/* Dropdown Menu */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-3 w-48 bg-white backdrop-blur-2xl rounded-2xl shadow-xl border border-gray-200 py-2 animate-fade-in">
                    <Link
                      to="/login"
                      className="block px-6 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors font-medium"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/register"
                      className="block px-6 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors font-medium"
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
              className="lg:hidden p-2 text-gray-900 ml-auto" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
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
