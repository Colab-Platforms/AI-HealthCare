import { lazy, Suspense } from "react";
import Hero from "../components/landing/landing-components/Hero";
import NavbarOld from "../components/landing/landing-components/NavbarOld";
import { useInViewport } from "../hooks/useInViewport";

// ─── Lazy imports ──────────────────────────────────────────────────────────────
const NewStats = lazy(
  () => import("../components/landing/landing-components/NewStats"),
);
const ImgPointer = lazy(
  () => import("../components/landing/landing-components/ImgPointer"),
);
const Potential = lazy(
  () => import("../components/landing/landing-components/Potential"),
);
const CTA = lazy(
  () => import("../components/landing/landing-components/CTA"),
);
const Testimonials = lazy(
  () => import("../components/landing/landing-components/Testimonials"),
);
const FAQs = lazy(
  () => import("../components/landing/landing-components/FAQs"),
);
const Footer = lazy(
  () => import("../components/landing/landing-components/Footer"),
);

// ─── IntersectionObserver-gated section wrapper ────────────────────────────────
// 'minHeight' reserves layout space so the page doesn't jump when the component mounts.
// 'rootMargin' controls how early (in px) before the section enters the viewport
// we start loading — 300px gives a comfortable pre-load buffer.
const LazySection = ({ children, minHeight = "200px", rootMargin = "300px 0px" }) => {
  const [ref, hasEntered] = useInViewport(rootMargin);
  return (
    <div ref={ref} style={{ minHeight: hasEntered ? undefined : minHeight }}>
      {hasEntered && (
        <Suspense fallback={<div style={{ minHeight }} />}>
          {children}
        </Suspense>
      )}
    </div>
  );
};

// ─── Page ──────────────────────────────────────────────────────────────────────
const NewLandingPage = () => {
  return (
    <section className="bg-landing-light-bg text-landing-text font-landing-body relative">
      {/* Above-the-fold: loaded eagerly, no gate needed */}
      <NavbarOld />
      <Hero />

      {/* Below-the-fold sections: each has its own observer gate.
          They only mount (and trigger JS + image loads) once the user
          scrolls within ~300px of the section.                        */}
      <LazySection minHeight="600px">
        <NewStats />
      </LazySection>

      <LazySection minHeight="700px">
        <ImgPointer />
      </LazySection>

      <LazySection minHeight="600px">
        <Potential />
      </LazySection>

      <LazySection minHeight="300px">
        <CTA />
      </LazySection>

      {/* Testimonials: the Embla autoplay setInterval should NOT start
          until this section is actually visible.                        */}
      <LazySection minHeight="400px" rootMargin="200px 0px">
        <Testimonials />
      </LazySection>

      <LazySection minHeight="300px">
        <FAQs />
      </LazySection>

      <LazySection minHeight="200px">
        <Footer />
      </LazySection>
    </section>
  );
};

export default NewLandingPage;
