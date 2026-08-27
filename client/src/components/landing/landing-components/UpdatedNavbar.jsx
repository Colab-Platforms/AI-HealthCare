import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

// `hash` marks an in-page target rather than a route. It needs handling by hand:
// React Router never scrolls to a hash on its own, and App.jsx runs
// window.scrollTo(0, 0) on every route change, which would undo it anyway.
const navLinks = [
  { label: "ABOUT US", to: "/about" },
  { label: "HOW IT WORKS", to: "/how-it-works" },
  { label: "FAQ", to: "/", hash: "faqs-section" },
];

// The target may not be mounted yet — arriving from another page means waiting
// on the route chunk, and the landing page's sections render lazily on scroll.
// Poll briefly rather than failing on the first miss.
const scrollToSection = (id, deadline = Date.now() + 3000) => {
  const el = document.getElementById(id);
  if (!el) {
    if (Date.now() < deadline) setTimeout(() => scrollToSection(id, deadline), 100);
    return;
  }
  el.scrollIntoView({ behavior: "smooth" });
  // Sections above this one mount as they scroll past, growing the page and
  // pulling the target away mid-flight — correct once the motion has settled.
  setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 700);
};

const UpdatedNavbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastScrollY = useRef(0);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const handleNavClick = (e, link) => {
    if (!link.hash) return; // ordinary route links keep their default behaviour
    e.preventDefault();
    setMobileMenuOpen(false);

    if (pathname === link.to) {
      scrollToSection(link.hash);
    } else {
      navigate(link.to);
      // Let the route commit (and App.jsx's scroll-to-top fire) before scrolling.
      setTimeout(() => scrollToSection(link.hash), 100);
    }
  };

  const isHomePage = pathname === "/";
  const isLight = isHomePage || !scrolled;

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrolledDown = currentScrollY > lastScrollY.current;

      setScrolled(currentScrollY > 20);

      if (scrolledDown && currentScrollY > 120) {
        setHidden(true);
        setMobileMenuOpen(false);
      } else {
        setHidden(false);
      }

      lastScrollY.current = currentScrollY;
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
        className={`fixed top-0 left-0 right-0 z-[999] w-full transition-[transform,background-color,box-shadow,border-color,backdrop-filter] duration-500 ease-in-out ${
          hidden ? "-translate-y-full" : "translate-y-0"
        } ${
          !scrolled
            ? "bg-transparent border-b border-transparent"
            : isHomePage
            ? "bg-[#014343]/80 border-b border-white/10 backdrop-blur-md"
            : "bg-white/95 border-b border-slate-200 shadow-sm backdrop-blur-md"
        }`}
      >
      <div className="max-w-[1920px] mx-auto px-4 sm:px-8 lg:px-20 h-16 sm:h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/updated-landing/take_health_new_logo.png"
            alt="Take Health"
            className={`h-5 sm:h-7 w-auto transition-[filter] duration-300 ${isLight ? "" : "brightness-0"}`}
          />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
          {navLinks.map((link, idx) => (
            <Link
              key={idx}
              to={link.to}
              onClick={(e) => handleNavClick(e, link)}
              className={`text-xs xl:text-sm font-semibold tracking-wider uppercase transition-colors ${
                isLight
                  ? "text-white/90 hover:text-white"
                  : "text-slate-700 hover:text-[#014343]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Right Action Buttons */}
        <div className="hidden lg:flex items-center gap-4">
          {/* <Link
            to="/waitlist"
            className={`text-xs xl:text-sm font-semibold tracking-wider uppercase transition-colors px-3 py-2 ${
              isLight
                ? "text-white hover:text-emerald-200"
                : "text-slate-700 hover:text-[#014343]"
            }`}
          >
            LOG IN
          </Link>
          <Link
            to="/waitlist"
            className={`text-xs xl:text-sm font-bold uppercase tracking-wider px-6 py-2.5 rounded-full transition-all shadow-sm active:scale-95 ${
              isLight
                ? "text-white bg-white/20 hover:bg-white/30 border border-white/40 backdrop-blur-md"
                : "text-white bg-[#014343] hover:bg-[#014343]/90 border border-[#014343]"
            }`}
          >
            Sign Up
          </Link> */}
          <Link
            to="/waitlist"
            className={`text-xs xl:text-sm font-bold tracking-wider px-6 py-2.5 rounded-full transition-all shadow-sm active:scale-95 ${
              isLight
                ? "text-white bg-white/20 hover:bg-white/30 border border-white/40 backdrop-blur-md"
                : "text-white bg-[#014343] hover:bg-[#014343]/90 border border-[#014343]"
            }`}
          >
            TAKE Your Spot
          </Link>
        </div>

        {/* Mobile Header Controls: Join Waitlist Button + Hamburger */}
        <div className="flex lg:hidden items-center gap-3">
          {/* <Link
            to="/waitlist"
            className={`text-xs font-semibold tracking-wide px-4 py-1.5 rounded-full transition-all ${
              isLight
                ? "text-white bg-white/15 hover:bg-white/25 border border-white/40 backdrop-blur-md"
                : "text-white bg-[#014343] hover:bg-[#014343]/90 border border-[#014343]"
            }`}
          >
            Sign Up
          </Link> */}
          <Link
            to="/waitlist"
            className={`text-xs font-semibold tracking-wide px-4 py-1.5 rounded-full transition-all ${
              isLight
                ? "text-white bg-white/15 hover:bg-white/25 border border-white/40 backdrop-blur-md"
                : "text-white bg-[#014343] hover:bg-[#014343]/90 border border-[#014343]"
            }`}
          >
            Join Waitlist
          </Link>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight ? "text-white hover:bg-white/10" : "text-slate-700 hover:bg-slate-100"
            }`}
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
      {mobileMenuOpen   && (
        <div
          className={`lg:hidden backdrop-blur-xl px-6 py-6 flex flex-col gap-4 ${
            isLight
              ? "bg-[#014343]/95 border-t border-white/10"
              : "bg-white border-t border-slate-200"
          }`}
        >
          {navLinks.map((link, idx) => (
            <Link
              key={idx}
              to={link.to}
              onClick={(e) => {
                setMobileMenuOpen(false);
                handleNavClick(e, link);
              }}
              className={`text-sm font-semibold tracking-wider uppercase py-1 ${
                isLight
                  ? "text-white/90 hover:text-white"
                  : "text-slate-700 hover:text-[#014343]"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div
            className={`pt-4 flex flex-col gap-3 ${
              isLight ? "border-t border-white/10" : "border-t border-slate-200"
            }`}
          >
            {/* <Link
              to="/waitlist"
              onClick={() => setMobileMenuOpen(false)}
              className={`text-center text-sm font-semibold uppercase tracking-wider py-2 ${
                isLight ? "text-white" : "text-slate-700"
              }`}
            >
              LOG IN
            </Link>
            <Link
              to="/waitlist"
              onClick={() => setMobileMenuOpen(false)}
              className={`text-center text-sm font-bold uppercase tracking-wider py-2.5 rounded-full ${
                isLight
                  ? "text-white bg-white/20 border border-white/40"
                  : "text-white bg-[#014343] border border-[#014343]"
              }`}
            >
              Sign Up
            </Link> */}
            <Link
              to="/waitlist"
              onClick={() => setMobileMenuOpen(false)}
              className={`text-center text-sm font-bold uppercase tracking-wider py-2.5 rounded-full ${
                isLight
                  ? "text-white bg-white/20 border border-white/40"
                  : "text-white bg-[#014343] border border-[#014343]"
              }`}
            >
              Join Waitlist
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default UpdatedNavbar;
