import React, { lazy, Suspense } from "react";
import Navbar from "../components/landing/landing-components/Navbar";
import Hero from "../components/landing/landing-components/Hero";

const CTA = lazy(() => import("../components/landing/landing-components/CTA"));
const Demo = lazy(
  () => import("../components/landing/landing-components/Demo"),
);
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
const Stats = lazy(
  () => import("../components/landing/landing-components/Stats"),
);
const Testimonials = lazy(
  () => import("../components/landing/landing-components/Testimonials"),
);

const LandingPage = () => {
  return (
    <section className="bg-landing-light-bg text-landing-text font-landing-body">
      <Navbar />
      <Hero />
      <Suspense fallback={<div className="h-20" />}>
        <Stats />
        <Demo />
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

export default LandingPage;
