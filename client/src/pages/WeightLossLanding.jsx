import Hero from "../components/weight-loss/Hero";
import Footer from "../components/landing/landing-components/Footer";
import NavbarOld from "../components/landing/landing-components/NavbarOld";
import Features from "../components/weight-loss/Features";
import Difference from "../components/weight-loss/Difference";
import Testimonials from "../components/weight-loss/Testimonials";
import FAQs from "../components/weight-loss/FAQs";

const WeightLossLanding = () => {
  return (
    <section className="bg-white text-landing-text">
      <NavbarOld />
      <Hero />
      <Features />
      <Difference />
      <Testimonials />
      <FAQs />
      <Footer />
    </section>
  );
};

export default WeightLossLanding;
