import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

const navLinks = [
  { label: "ABOUT US", to: "/about" },
  { label: "DIABETES MANAGEMENT", to: "/diabetes-landing" },
  { label: "WEIGHT MANAGEMENT", to: "/weight-loss" },
  { label: "HOW IT WORKS", to: "/how-it-works" },
  { label: "FAQ", to: "#faqs-section" },
];

const UpdatedNavbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrolledDown = currentScrollY > lastScrollY.current;

      if (scrolledDown && currentScrollY > 120) {
        setHidden(true);
        setMobileMenuOpen(false);
      } else {
        setHidden(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-[999] w-full backdrop-blur-md bg-[#014343]/70 border-b border-white/10 transition-transform duration-500 ease-in-out ${
          hidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
      <div className="max-w-[1920px] mx-auto px-4 sm:px-8 lg:px-20 h-16 sm:h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/updated-landing/take_health_new_logo.png"
            alt="Take Health"
            className="h-5 sm:h-7 w-auto"
          />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
          {navLinks.map((link, idx) => (
            <Link
              key={idx}
              to={link.to}
              className="text-xs xl:text-sm font-semibold tracking-wider text-white/90 hover:text-white uppercase transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Right Action Buttons */}
        <div className="hidden lg:flex items-center gap-4">
          <Link
            to="/login"
            className="text-xs xl:text-sm font-semibold tracking-wider uppercase text-white hover:text-emerald-200 transition-colors px-3 py-2"
          >
            LOG IN
          </Link>
          <Link
            to="/register"
            className="text-xs xl:text-sm font-bold uppercase tracking-wider text-white bg-white/20 hover:bg-white/30 border border-white/40 backdrop-blur-md px-6 py-2.5 rounded-full transition-all shadow-sm active:scale-95"
          >
            Sign Up
          </Link>
        </div>

        {/* Mobile Header Controls: Sign Up Button + Hamburger */}
        <div className="flex lg:hidden items-center gap-3">
          <Link
            to="/register"
            className="text-xs font-semibold tracking-wide text-white bg-white/15 hover:bg-white/25 border border-white/40 backdrop-blur-md px-4 py-1.5 rounded-full transition-all"
          >
            Sign Up
          </Link>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#014343]/95 backdrop-blur-xl border-t border-white/10 px-6 py-6 flex flex-col gap-4">
          {navLinks.map((link, idx) => (
            <Link
              key={idx}
              to={link.to}
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-semibold tracking-wider text-white/90 hover:text-white uppercase py-1"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="text-center text-sm font-semibold uppercase tracking-wider text-white py-2"
            >
              LOG IN
            </Link>
            <Link
              to="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="text-center text-sm font-bold uppercase tracking-wider text-white bg-white/20 border border-white/40 py-2.5 rounded-full"
            >
              Sign Up
            </Link>
          </div>
        </div>
      )}
      </header>
      {/* Spacer to preserve layout space now that header is fixed */}
      <div className="h-16 sm:h-20" />
    </>
  );
};

export default UpdatedNavbar;
