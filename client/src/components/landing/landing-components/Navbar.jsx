import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "#", label: "About Us" },
    { to: "/how-it-works", label: "How It Works" },
    { to: "#", label: "FAQ" },
  ];

  const linkClass =
    "text-landing-light-bg hover:text-white uppercase font-landing-accent cursor-pointer transition";
  const ctaButtonClass =
    "px-6 py-2 bg-landing-primary text-white font-landing-accent rounded-full hover:bg-landing-primary/90 transition";

  return (
    <motion.nav
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="w-full py-6 flex items-center justify-between container px-5 lg:px-20 mx-auto bg-transparent h-24 lg:h-24 overflow-visible lg:overflow-hidden -mb-24 relative z-20"
    >
      <div>
        <img
          src="/landing/logo.png"
          alt="AI HealthCare"
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
          className="text-landing-light-bg hover:text-white uppercase font-landing-accent cursor-pointer transition mr-4"
        >
          Log in
        </Link>
        <Link to="/register">
          <button className={ctaButtonClass}>SIGN UP</button>
        </Link>
      </div>

      <div className="lg:hidden flex items-center gap-3">
        <Link to="/register" onClick={() => setIsMenuOpen(false)}>
          <button className="px-5 py-2 bg-landing-primary text-white font-landing-accent rounded-full hover:bg-landing-primary/90 transition">
            Sign Up
          </button>
        </Link>

        <button
          type="button"
          className="text-landing-light-bg hover:text-white transition"
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
          <div className="rounded-2xl bg-black/20 backdrop-blur-sm p-5 ">
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
