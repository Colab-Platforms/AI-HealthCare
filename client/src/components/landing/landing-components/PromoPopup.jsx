import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const SHOP_URL = "https://shop.take.health";
const APP_STORE_URL = "https://apps.apple.com/in/app/take-health/id6809424667";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.takehealth.app";

const SHOW_AFTER_MS = 5000; // Google penalises mobile popups shown on arrival — never open instantly
const SHOW_AT_SCROLL = 0.4; // ...or once the visitor has scrolled 40% of the page, whichever is first
const SLIDE_MS = 4000;

// iOS → App Store, everyone else → Play Store. Decided at click time.
const openAppStore = (e) => {
  e.preventDefault();
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  window.open(isIOS ? APP_STORE_URL : PLAY_STORE_URL, "_blank", "noopener,noreferrer");
};

const banners = [
  {
    src: "/updated-landing/promo-berberine.jpg",
    alt: "TAKE Liposomal Berberine 1000mg - 99% pure, 6x better absorption",
    href: SHOP_URL,
  },
  {
    src: "/updated-landing/promo-diet.jpg",
    alt: "Stop following someone else's diet - build a nutrition routine around your own goals",
    href: PLAY_STORE_URL,
    onClick: openAppStore,
  },
  {
    src: "/updated-landing/promo-health-data.jpg",
    alt: "Bring your health data together - 14 days free on the Take app",
    href: PLAY_STORE_URL,
    onClick: openAppStore,
  },
];

const PromoPopup = () => {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const overlayRef = useRef(null);
  const closeBtnRef = useRef(null);
  const touchStartX = useRef(null);

  const next = () => setIndex((i) => (i + 1) % banners.length);
  const prev = () => setIndex((i) => (i - 1 + banners.length) % banners.length);
  const close = () => setOpen(false);

  // Trigger: timer or scroll depth, on every page load (refresh included).
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= SHOW_AT_SCROLL) show();
    };
    const timer = setTimeout(() => show(), SHOW_AFTER_MS);
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
    function show() {
      cleanup();
      setOpen(true);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return cleanup;
  }, []);

  // Autoplay. `index` in deps restarts the timer after a manual slide change.
  useEffect(() => {
    if (!open || paused) return;
    const t = setInterval(next, SLIDE_MS);
    return () => clearInterval(t);
  }, [open, paused, index]);

  // Keyboard: Esc closes, arrows navigate. Focus the close button for a11y.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    closeBtnRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Lenis listens for wheel/touch on window and scrolls the page itself, so
  // overflow:hidden on <body> doesn't stop it. Swallow those events at the
  // overlay instead: preventDefault stops native scroll, stopPropagation keeps
  // them from ever reaching Lenis. Needs a native listener — React's are passive.
  useEffect(() => {
    const el = overlayRef.current;
    if (!open || !el) return;
    const block = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener("wheel", block, { passive: false });
    el.addEventListener("touchmove", block, { passive: false });
    return () => {
      el.removeEventListener("wheel", block);
      el.removeEventListener("touchmove", block);
    };
  }, [open]);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx < -40) next();
    else if (dx > 40) prev();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => e.target === e.currentTarget && close()}
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Take Health offers"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            className="relative w-full rounded-2xl overflow-hidden bg-white shadow-2xl"
            // Cap by viewport height too, so the square never overflows a short/landscape screen.
            style={{ maxWidth: "min(480px, calc(100vh - 7rem))" }}
          >
            <button
              ref={closeBtnRef}
              onClick={close}
              aria-label="Close"
              className="absolute top-3 right-3 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Slides: all three stacked and cross-faded, so switching never waits on a network fetch. */}
            <div
              className="relative w-full aspect-square bg-slate-100"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {banners.map((b, i) => {
                const active = i === index;
                return (
                  <a
                    key={b.src}
                    href={b.href}
                    onClick={b.onClick}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-hidden={!active}
                    tabIndex={active ? 0 : -1}
                    className={`absolute inset-0 transition-opacity duration-500 ${
                      active ? "opacity-100 z-10" : "opacity-0 pointer-events-none"
                    }`}
                  >
                    <img
                      src={b.src}
                      alt={b.alt}
                      width="1600"
                      height="1600"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  </a>
                );
              })}

              <button
                onClick={prev}
                aria-label="Previous offer"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 hidden sm:flex items-center justify-center rounded-full bg-white/80 text-slate-800 shadow hover:bg-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={next}
                aria-label="Next offer"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 hidden sm:flex items-center justify-center rounded-full bg-white/80 text-slate-800 shadow hover:bg-white transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Dots */}
            <div className="flex items-center justify-center gap-2 py-3">
              {banners.map((b, i) => (
                <button
                  key={b.src}
                  onClick={() => setIndex(i)}
                  aria-label={`Show offer ${i + 1}`}
                  aria-current={i === index}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === index ? "w-6 bg-[#1B47B9]" : "w-2 bg-slate-300 hover:bg-slate-400"
                  }`}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PromoPopup;
