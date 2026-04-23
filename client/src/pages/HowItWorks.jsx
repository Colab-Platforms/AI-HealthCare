import { lazy, Suspense } from "react";
import Navbar from "../components/landing/landing-components/Navbar";
import Hero from "../components/how-it-works/Hero";
import Steps from "../components/how-it-works/Steps";
import CTA from "../components/how-it-works/CTA";
import NavbarOld from "../components/landing/landing-components/NavbarOld";

const Footer = lazy(
  () => import("../components/landing/landing-components/Footer"),
);

const HowItWorks = () => {
  return (
    <section className="bg-landing-light-bg text-landing-text font-landing-body">
      <NavbarOld />
      <Hero />
      <Suspense fallback={<div className="h-20" />}>
        <Steps />
        <CTA />
        <Footer />
      </Suspense>
    </section>
  );
};

export default HowItWorks;
