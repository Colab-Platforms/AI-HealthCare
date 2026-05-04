import { useEffect, useRef, useState } from "react";

/**
 * Returns [ref, hasEnteredViewport].
 * Once the element enters the viewport, hasEnteredViewport becomes true
 * and stays true (it never resets). This is used to gate component mounting
 * so that off-screen sections never execute their JS or load their images
 * until the user actually scrolls close to them.
 *
 * @param {string} rootMargin - IntersectionObserver rootMargin (e.g. "200px 0px")
 */
export function useInViewport(rootMargin = "200px 0px") {
  const ref = useRef(null);
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    if (hasEntered) return; // already triggered, skip re-observing
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasEntered(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasEntered, rootMargin]);

  return [ref, hasEntered];
}
