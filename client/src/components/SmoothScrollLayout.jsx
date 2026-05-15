import { useEffect, useRef } from "react";
import Lenis from "lenis";

/**
 * SmoothScrollLayout
 *
 * Wrap any landing page with this component to get the bevel.health-style
 * smooth momentum scrolling. Lenis hijacks the native scroll and replaces it
 * with a physics-based ease-out animation.
 *
 * Usage:
 *   <SmoothScrollLayout>
 *     <YourPage />
 *   </SmoothScrollLayout>
 */
export default function SmoothScrollLayout({ children }) {
  const lenisRef = useRef(null);

  useEffect(() => {
    const lenis = new Lenis({
      // How long (in seconds) the momentum scroll takes to settle
      duration: 1.2,

      // Exponential ease-out — fast start, slow stop (bevel.health feel)
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),

      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,

      // How fast the wheel scrolls (1 = default speed)
      wheelMultiplier: 1,

      // Slightly faster on touch (mobile swipe)
      touchMultiplier: 2,
    });

    lenisRef.current = lenis;

    // Drive Lenis on every animation frame
    let rafId;
    function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    // Cleanup on unmount / route change
    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
