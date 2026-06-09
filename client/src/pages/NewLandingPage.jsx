import Hero from "../components/landing/landing-components/Hero";
import NavbarOld from "../components/landing/landing-components/NavbarOld";
import NewStats from "../components/landing/landing-components/NewStats";
import ImgPointer from "../components/landing/landing-components/ImgPointer";
import Potential from "../components/landing/landing-components/Potential";
import CTA from "../components/landing/landing-components/CTA";
import Testimonials from "../components/landing/landing-components/Testimonials";
import FAQs from "../components/landing/landing-components/FAQs";
import Footer from "../components/landing/landing-components/Footer";
import { useInViewport } from "../hooks/useInViewport";
import SEO from "../hooks/useSEO";

// ─── IntersectionObserver-gated section wrapper ────────────────────────────────
// 'minHeight' reserves layout space so the page doesn't jump when sections appear.
// 'rootMargin' controls how early (in px) before the section enters the viewport
// we start rendering — 300px gives a comfortable pre-load buffer.
const LazySection = ({ children, minHeight = "200px", rootMargin = "300px 0px" }) => {
  const [ref, hasEntered] = useInViewport(rootMargin);
  return (
    <div ref={ref} style={{ minHeight: hasEntered ? undefined : minHeight }}>
      {hasEntered && children}
    </div>
  );
};

// ─── Page ──────────────────────────────────────────────────────────────────────
const NewLandingPage = () => {
  return (
    <section className="bg-landing-light-bg text-landing-text font-landing-body relative">
      <SEO pageName="home" />
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
