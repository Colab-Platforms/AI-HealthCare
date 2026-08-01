import Hero from "../components/diabetes-landing/Hero";
import UpdatedNavbar from "../components/landing/landing-components/UpdatedNavbar";
import UpdatedFooter from "../components/landing/landing-components/UpdatedFooter";
import Features from "../components/diabetes-landing/Features";
import WhyUs from "../components/diabetes-landing/WhyUs";
import Testimonials from "../components/diabetes-landing/Testimonials";
import FAQs from "../components/diabetes-landing/FAQs";

const DiabetesLanding = () => {
  return (
    <section className="bg-white text-landing-text">
      <UpdatedNavbar />
      <Hero />
      <Features />
      <WhyUs />
      <Testimonials />
      <FAQs />
      <UpdatedFooter />
    </section>
  );
};

export default DiabetesLanding;
