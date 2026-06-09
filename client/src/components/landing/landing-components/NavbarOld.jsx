import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

const NavbarOld = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { pathname } = useLocation();
  const isHomePage = pathname === "/";

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/about", label: "About Us" },
    { to: "/how-it-works", label: "How It Works" },
    { to: "/weight-loss", label: "Weight Loss" },
    { to: "/diabetes-landing", label: "Diabetes Management" },
  ];

  const brandTextClass = isScrolled
    ? "text-landing-text hover:text-landing-primary"
    : "text-landing-light-bg hover:text-white";
  const linkClass = `${brandTextClass} uppercase font-landing-accent cursor-pointer transition whitespace-nowrap ${
    isScrolled ? "text-xs tracking-wider" : "text-sm tracking-widest"
  }`;
  const ctaButtonClass = isScrolled
    ? "px-5 py-2 bg-landing-primary text-white font-bold uppercase font-landing-accent rounded-full hover:bg-landing-primary-hover transition tracking-wider active:scale-95 text-xs whitespace-nowrap"
    : "px-6 py-1.5 bg-landing-primary text-white uppercase font-landing-accent rounded-full hover:bg-landing-primary-hover transition tracking-wider active:scale-95 text-sm whitespace-nowrap";
  const menuButtonClass = isScrolled
    ? "text-landing-text hover:text-landing-primary transition"
    : "text-white hover:text-white transition";
  const logoSrc = "/landing/logo.png";

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 flex justify-center w-full transition-[padding] duration-300 pointer-events-none ${
      isScrolled ? "pt-4 px-4" : "pt-0 px-0"
    }`}>
      <motion.nav
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`pointer-events-auto flex items-center justify-between transition-[max-width,background-color,backdrop-filter,box-shadow,border-radius,padding,height] duration-300 w-full z-50 overflow-visible lg:overflow-hidden ${
          isScrolled
            ? "max-w-6xl bg-white/80 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.08)] rounded-full px-4 sm:px-8 h-16"
            : "container mx-auto bg-transparent px-5 lg:px-20 py-6 h-24"
        }`}
      >
        <div>
          <img
            src={logoSrc}
            alt="AI HealthCare"
            width={208}
            height={48}
            className={`transition-all duration-300 h-auto ${
              isScrolled ? "w-28 sm:w-36 lg:w-40 brightness-0 opacity-80" : "w-36 sm:w-48 lg:w-52"
            }`}
          />
        </div>

        <div className="hidden lg:block">
          <ul className={`flex items-center transition-all duration-300 ${isScrolled ? "gap-6" : "gap-10"}`}>
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} className={linkClass}>
                {link.label}
              </Link>
            ))}
          </ul>
        </div>

        <div className="hidden lg:flex items-center">
          <Link
            to="/login"
            className={`${brandTextClass} uppercase font-landing-accent cursor-pointer transition mr-4 whitespace-nowrap ${
              isScrolled ? "text-xs" : "text-sm"
            }`}
          >
            Log in
          </Link>
          <Link to="/register">
            <button className={ctaButtonClass}>SIGN UP</button>
          </Link>
        </div>

        <div className="lg:hidden flex items-center gap-2 sm:gap-3">
          <Link to="/register" onClick={() => setIsMenuOpen(false)}>
            <button className="px-4 py-1.5 sm:px-6 sm:py-2.5 bg-landing-primary text-white font-landing-accent font-black uppercase text-[10px] sm:text-xs tracking-wider rounded-full hover:bg-landing-primary-hover transition shadow-[0_10px_20px_rgba(62,118,97,0.1)] active:scale-95 whitespace-nowrap">
              Sign Up
            </button>
          </Link>

          <button
            type="button"
            className={menuButtonClass}
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              {isMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {isMenuOpen && (
          <div className="absolute top-full left-0 right-0 px-5 lg:hidden z-50 mt-2">
            <div className={`rounded-2xl backdrop-blur-md p-5 ${
              isScrolled ? "bg-white/95 shadow-lg border border-slate-100" : "bg-black/20 border border-white/10"
            }`}>
              <ul className="flex flex-col gap-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={linkClass}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </ul>
            </div>
          </div>
        )}
      </motion.nav>
    </div>
  );
};

export default NavbarOld;
