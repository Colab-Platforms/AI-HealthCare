import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, Facebook, Twitter, Instagram, Youtube } from "lucide-react";

const UpdatedFooter = () => {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  // Starting the field readOnly stops Chrome from classifying it as an
  // autofillable email field at page-load time (its autofill/autocomplete
  // dropdown decision is made once, from the field's initial state) —
  // removing readOnly on first focus is the one workaround that reliably
  // survives Chrome ignoring autocomplete="off" on email-shaped inputs.
  const [emailFieldLocked, setEmailFieldLocked] = useState(true);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail("");
      setTimeout(() => setSubscribed(false), 4000);
    }
  };

  const navColumns = [
    {
      title: "PLATFORM",
      links: [
        { label: "Home", to: "/" },
        { label: "About us", to: "/about" },
        { label: "How it works", to: "/how-it-works" },
        { label: "Diabetes Management", to: "/diabetes-landing" },
        { label: "Weight Management", to: "/weight-loss" },
      ],
    },
    {
      title: "SUPPORT",
      links: [
        { label: "Help Center", to: "#" },
        { label: "Safety Guide", to: "#" },
        { label: "Contact", to: "#" },
      ],
    },
    {
      title: "LEGAL",
      links: [
        { label: "Privacy Policy", to: "/privacy-policy" },
        { label: "Terms of Service", to: "/terms-and-conditions" },
        // { label: "Medical Disclaimer", to: "#" },
      ],
    },
  ];

  return (
    <footer className="w-full bg-black text-white rounded-tl-[32px] rounded-tr-[32px] sm:rounded-tl-[60px] sm:rounded-tr-[60px] lg:rounded-tl-[80px] lg:rounded-tr-[80px] pt-10 sm:pt-20 pb-8 sm:pb-10 px-5 sm:px-12 lg:px-20 font-landing-body overflow-hidden">
      <div className="max-w-9xl mx-auto">

        {/* ─── MAIN FOOTER CONTENT GRID ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 sm:gap-10 lg:gap-12 pb-10 sm:pb-14 text-left items-start">

          {/* Brand & Mission Statement (col-span-3) */}
          <div className="lg:col-span-3 flex flex-col items-start pr-0 lg:pr-6">
            <Link to="/" className="inline-block mb-3 sm:mb-4">
              <img
                src="/updated-landing/take_health_new_logo.png"
                alt="Take Health"
                className="h-6 mb-5 sm:h-7 w-auto"
              />
            </Link>
            <p className="text-sm sm:text-lg text-white/80 font-light leading-relaxed max-w-sm">
              The definitive AI health companion for those who demand more from their bodies. Precision analytics from TAKE Solutions Limited.
            </p>
          </div>

          {/* Navigation Links Columns (col-span-6) */}
          <div className="lg:col-span-6 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8">
            {navColumns.map((col, idx) => (
              <div key={idx} className="flex flex-col items-start">
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white mb-3 sm:mb-4">
                  {col.title}
                </span>
                <ul className="flex flex-col gap-2.5 sm:gap-3 text-sm sm:text-base text-white/70 font-light">
                  {col.links.map((link, lIdx) => (
                    <li key={lIdx}>
                      <Link
                        to={link.to}
                        className="hover:text-white transition-colors duration-200"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Newsletter & Contacts (col-span-3) */}
          <div className="lg:col-span-3 flex flex-col items-start gap-6 sm:gap-8">

            {/* STAY UPDATED */}
            <div className="w-full text-left">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white mb-2 block">
                STAY UPDATED
              </span>
              <p className="text-xs sm:text-sm text-white/70 font-light mb-3">
                Join our newsletter for the latest in longevity research.
              </p>

              <form onSubmit={handleSubscribe} className="flex w-full items-center">
                <input
                  type="text"
                  inputMode="email"
                  name="nl-contact-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFieldLocked(false)}
                  placeholder="Enter your email address"
                  autoComplete="off"
                  readOnly={emailFieldLocked}
                  pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
                  title="Enter a valid email address"
                  required
                  className="footer-newsletter-input w-full bg-transparent border border-white/10 text-xs text-gray-300 placeholder-white/40 px-3 py-2.5 rounded-l-md focus:outline-none focus:border-emerald-500/50"
                  style={{ "--autofill-bg": "#000000", "--autofill-text": "#d1d5db" }}
                />
                <button
                  type="submit"
                  className="bg-[#333333] hover:bg-[#444444] text-white font-bold text-[10px] sm:text-[11px] tracking-wider uppercase px-3.5 py-2.5 rounded-r-md transition-colors whitespace-nowrap"
                >
                  SUBSCRIBE
                </button>
              </form>
              {subscribed && (
                <span className="text-[11px] text-emerald-400 font-bold mt-1.5 block">
                  Thank you for subscribing!
                </span>
              )}
            </div>

            {/* GET IN TOUCH */}
            <div className="w-full text-left">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white mb-2.5 block">
                GET IN TOUCH
              </span>
              <div className="flex flex-col gap-2 text-xs text-white/80 font-light">
                <a
                  href="mailto:support@takelimited.com"
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
                  <span className="text-xs sm:text-sm truncate">support@takelimited.com</span>
                </a>
                {/* <a
                  href="tel:8155020445"
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
                  <span className="text-xs sm:text-sm">8155020445</span>
                </a> */}
              </div>
            </div>

            {/* Social Links */}
            <div className="flex items-center gap-3 mt-1">
              <a
                href="https://www.facebook.com/share/1Es9isKBpo/?mibextid=wwXIfr"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:border-white transition-all"
                aria-label="Facebook"
              >
                <Facebook className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://x.com/Take_Limited"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:border-white transition-all"
                aria-label="X (Twitter)"
              >
                <Twitter className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://www.instagram.com/takehealth_"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:border-white transition-all"
                aria-label="Instagram"
              >
                <Instagram className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://www.youtube.com/@Takehealth21"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:border-white transition-all"
                aria-label="Youtube"
              >
                <Youtube className="w-3.5 h-3.5" />
              </a>
            </div>

          </div>

        </div>

        {/* ─── BOTTOM COPYRIGHT BAR ────────────────────────────────────────────── */}
        <div className="border-t border-white/10 pt-5 flex flex-col sm:flex-row items-center justify-between text-[11px] sm:text-xs text-white/50 font-light gap-2 text-center sm:text-left">
          <p>© 2026 Take Health Inc. All rights reserved.</p>
          <p>Designed with purpose. Priced with care.</p>
        </div>

      </div>
    </footer>
  );
};

export default UpdatedFooter;
