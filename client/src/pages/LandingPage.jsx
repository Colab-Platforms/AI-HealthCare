import { lazy, Suspense } from "react";
import SEO from "../hooks/useSEO";
import Hero from "../components/landing/landing-components/Hero";
import UpdatedNavbar from "../components/landing/landing-components/UpdatedNavbar";

const CTA = lazy(() => import("../components/landing/landing-components/CTA"));
const FAQs = lazy(
  () => import("../components/landing/landing-components/FAQs"),
);
const UpdatedFooter = lazy(
  () => import("../components/landing/landing-components/UpdatedFooter"),
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
const Demo = lazy(
  () => import("../components/landing/landing-components/Demo"),
);

const LandingPage = () => {
  return (
    <section className="bg-landing-light-bg text-landing-text font-landing-body relative">
      <SEO pageName="home" />
      <UpdatedNavbar />
      <Hero />
      <Suspense fallback={<div className="h-20" />}>
        <Stats />
        <Demo />
        <ImgPointer />
        <Potential />
        <CTA />
        <Testimonials />
        <FAQs />
        <UpdatedFooter />
      </Suspense>
    </section>
  );
};

export default LandingPage;
