import Hero from "../components/weight-loss/Hero";
import UpdatedFooter from "../components/landing/landing-components/UpdatedFooter";
import UpdatedNavbar from "../components/landing/landing-components/UpdatedNavbar";
import Features from "../components/weight-loss/Features";
import Difference from "../components/weight-loss/Difference";
import Testimonials from "../components/weight-loss/Testimonials";
import FAQs from "../components/weight-loss/FAQs";

const WeightLossLanding = () => {
  return (
    <section className="bg-white text-landing-text">
      <UpdatedNavbar />
      <Hero />
      <Features />
      <Difference />
      <Testimonials />
      <FAQs />
      <UpdatedFooter />
    </section>
  );
};

export default WeightLossLanding;
