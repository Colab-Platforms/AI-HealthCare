import { lazy, Suspense } from "react";
import Hero from "../components/landing/landing-components/Hero";
import NavbarOld from "../components/landing/landing-components/NavbarOld";

const CTA = lazy(() => import("../components/landing/landing-components/CTA"));
const FAQs = lazy(
  () => import("../components/landing/landing-components/FAQs"),
);
const Footer = lazy(
  () => import("../components/landing/landing-components/Footer"),
);
const ImgPointer = lazy(
  () => import("../components/landing/landing-components/ImgPointer"),
);
const Potential = lazy(
  () => import("../components/landing/landing-components/Potential"),
);

const NewStats = lazy(
  () => import("../components/landing/landing-components/NewStats"),
);
const Testimonials = lazy(
  () => import("../components/landing/landing-components/Testimonials"),
);

const NewLandingPage = () => {
  return (
    <section className="bg-landing-light-bg text-landing-text font-landing-body relative">
      <NavbarOld />
      <Hero />
      <Suspense fallback={<div className="h-20" />}>
        <NewStats />
        <ImgPointer />
        <Potential />
        <CTA />
        <Testimonials />
        <FAQs />
        <Footer />
      </Suspense>
    </section>
  );
};

export default NewLandingPage;
