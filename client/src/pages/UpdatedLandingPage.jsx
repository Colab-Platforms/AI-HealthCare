import React from "react";
import { useInViewport } from "../hooks/useInViewport";
import SEO from "../hooks/useSEO";
import UpdatedHero from "../components/landing/landing-components/UpdatedHero";
import UpdatedWellnessIntelligence from "../components/landing/landing-components/UpdatedWellnessIntelligence";
import UpdatedHowItWorks from "../components/landing/landing-components/UpdatedHowItWorks";
import UpdatedBetterWellness from "../components/landing/landing-components/UpdatedBetterWellness";
import UpdatedFullPictureCTA from "../components/landing/landing-components/UpdatedFullPictureCTA";
import UpdatedTestimonials from "../components/landing/landing-components/UpdatedTestimonials";
import UpdatedFAQs from "../components/landing/landing-components/UpdatedFAQs";
import UpdatedFooter from "../components/landing/landing-components/UpdatedFooter";

// ─── IntersectionObserver Lazy Section Wrapper ──────────────────────────────
// `id` goes on the wrapper rather than the lazily-rendered children so anchor
// links have something to target: until the observer fires, `children` (and any
// id inside them) simply isn't in the DOM.
const LazySection = ({ children, id, className, minHeight = "300px", rootMargin = "300px 0px" }) => {
  const [ref, hasEntered] = useInViewport(rootMargin);
  return (
    <div
      id={id}
      ref={ref}
      className={className}
      style={{ minHeight: hasEntered ? undefined : minHeight }}
    >
      {hasEntered && children}
    </div>
  );
};

// ─── Updated Landing Page Component ──────────────────────────────────────────
const UpdatedLandingPage = () => {
  return (
    <section className="bg-landing-light-bg text-landing-text font-landing-body relative min-h-screen">
      <SEO pageName="home" />

      {/* Main Content Area */}
      <main className="w-full relative z-10 overflow-hidden">
        
        {/* SECTION 1: HERO SECTION & STATS BAR */}
        <section id="hero-section" className="w-full">
          <UpdatedHero />
        </section>

        {/* SECTION 2: WELLNESS INTELLIGENCE & VIDEO HOOK */}
        <LazySection minHeight="400px">
          <section id="wellness-intelligence-section" className="w-full">
            <UpdatedWellnessIntelligence videoSrc="" />
          </section>
        </LazySection>

        {/* SECTION 3: HOW IT WORKS (TURNING COMPLEXITY INTO CLARITY) */}
        <LazySection minHeight="600px">
          <section id="how-it-works-section" className="w-full">
            <UpdatedHowItWorks />
          </section>
        </LazySection>

        {/* SECTION 4: BETTER WELLNESS ROTATING CAROUSEL */}
        <LazySection minHeight="500px">
          <section id="better-wellness-section" className="w-full">
            <UpdatedBetterWellness />
          </section>
        </LazySection>

        {/* SECTION 5: START SEEING THE FULL PICTURE (CTA) */}
        <LazySection minHeight="400px">
          <section id="cta-section" className="w-full">
            <UpdatedFullPictureCTA bgImage="" />
          </section>
        </LazySection>

        {/* SECTION 6: TESTIMONIALS (THE DIFFERENCE YOU CAN FEEL) */}
        <LazySection minHeight="400px">
          <section id="testimonials-section" className="w-full">
            <UpdatedTestimonials />
          </section>
        </LazySection>

        {/* SECTION 7: FREQUENTLY ASKED QUESTIONS (FAQS) */}
        {/* scroll-mt clears the fixed navbar so the heading isn't hidden under it */}
        <LazySection id="faqs-section" className="scroll-mt-16 sm:scroll-mt-20" minHeight="400px">
          <section className="w-full">
            <UpdatedFAQs />
          </section>
        </LazySection>

      </main>

      {/* Footer */}
      <UpdatedFooter />
    </section>
  );
};

export default UpdatedLandingPage;
