import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const isHomePage = pathname === "/";

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/about", label: "About Us" },
    { to: "/how-it-works", label: "How It Works" },
    { to: "#", label: "FAQ" },
  ];

  const brandTextClass = isHomePage
    ? "text-landing-text hover:text-landing-primary "
    : "text-landing-light-bg hover:text-white";
  const linkClass = `${brandTextClass} uppercase font-landing-accent cursor-pointer transition`;
  const ctaButtonClass =
    "px-6 py-2 bg-landing-primary text-white font-landing-accent rounded-full hover:bg-landing-primary/90 transition";
  const menuButtonClass = isHomePage
    ? "text-landing-primary hover:text-landing-primary-hover transition"
    : "text-landing-text hover:text-landing-primary transition";
  const logoSrc = isHomePage ? "/landing/logo_light.png" : "/landing/logo.png";

  return (
    <motion.nav
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="w-full py-6 flex items-center justify-between container px-5 lg:px-20 mx-auto bg-transparent h-24 lg:h-24 overflow-visible lg:overflow-hidden -mb-24 relative z-20"
    >
      <div>
        <img
          src={logoSrc}
          alt="AI HealthCare"
          width={208}
          height={48}
          className="w-44 sm:w-48 lg:w-52 h-auto"
        />
      </div>

      <div className="hidden lg:block">
        <ul className="flex items-center gap-10">
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
          className={`${brandTextClass} uppercase font-landing-accent cursor-pointer transition mr-4`}
        >
          Log in
        </Link>
        <Link to="/register">
          <button className={ctaButtonClass}>SIGN UP</button>
        </Link>
      </div>

      <div className="lg:hidden flex items-center gap-3">
        <Link to="/register" onClick={() => setIsMenuOpen(false)}>
          <button className="px-6 py-2.5 bg-landing-primary text-white font-landing-accent font-black uppercase text-xs tracking-wider rounded-full hover:bg-landing-primary/90 transition shadow-[0_10px_20px_rgba(62,118,97,0.2)] active:scale-95">
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
        <div className="absolute top-full left-0 right-0 px-5 lg:hidden z-50">
          <div
            className={`rounded-2xl backdrop-blur-sm p-5 ${
              isHomePage
                ? "bg-black/20"
                : "bg-white/90 border border-slate-200 shadow-lg"
            }`}
          >
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
  );
};

export default Navbar;
