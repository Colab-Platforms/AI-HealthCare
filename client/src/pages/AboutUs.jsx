import React, { lazy, Suspense } from "react";
import SEO from "../hooks/useSEO";
import AboutHero from "../components/landing/about-components/AboutHero";
import { AboutParagraph } from "../components/landing/about-components/AboutParagraph";
import WhatDoesTakeHealth from "../components/landing/about-components/WhatDoesTakeHealth";
import UpdatedFooter from "../components/landing/landing-components/UpdatedFooter";
import HealthcareRedefined from "../components/landing/about-components/HealthcareRedefined";
import Faq from "../components/landing/about-components/Faq";
import UpdatedNavbar from "../components/landing/landing-components/UpdatedNavbar";

const AboutUs = () => {
  return (
    <section className="bg-landing-light-bg text-landing-text font-landing-body">
      <SEO pageName="about" />
      <UpdatedNavbar />
      <AboutHero />
      <Suspense fallback={<div className="h-20" />}>
        <AboutParagraph />
        <WhatDoesTakeHealth />
        <HealthcareRedefined />
        <Faq />
        <UpdatedFooter />
      </Suspense>
    </section>
  );
};

export default AboutUs;
