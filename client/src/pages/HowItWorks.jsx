import { lazy, Suspense } from "react";
import SEO from "../hooks/useSEO";
import Hero from "../components/how-it-works/Hero";
import Steps from "../components/how-it-works/Steps";
import CTA from "../components/how-it-works/CTA";
import UpdatedNavbar from "../components/landing/landing-components/UpdatedNavbar";

const UpdatedFooter = lazy(
  () => import("../components/landing/landing-components/UpdatedFooter"),
);

const HowItWorks = () => {
  return (
    <section className="bg-landing-light-bg text-landing-text font-landing-body">
      <SEO pageName="howItWorks" />
      <UpdatedNavbar />
      <Hero />
      <Suspense fallback={<div className="h-20" />}>
        <Steps />
        <CTA />
        <UpdatedFooter />
      </Suspense>
    </section>
  );
};

export default HowItWorks;
