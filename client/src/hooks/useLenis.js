import { useEffect, useRef } from "react";
import Lenis from "lenis";

/**
 * useLenis — initializes Lenis smooth scrolling on the page.
 *
 * @param {object} options - Lenis constructor options (optional overrides)
 * @returns {React.MutableRefObject} lenisRef — ref to the Lenis instance
 *
 * Usage:
 *   const lenisRef = useLenis();
 *
 * To scroll to a specific element programmatically:
 *   lenisRef.current?.scrollTo("#section-id");
 */
export function useLenis(options = {}) {
  const lenisRef = useRef(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,          // scroll animation duration in seconds (higher = slower/smoother)
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // exponential ease-out
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
      infinite: false,
      ...options,
    });

    lenisRef.current = lenis;

    // RAF loop — drives the Lenis animation each frame
    let rafId;
    function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return lenisRef;
}
