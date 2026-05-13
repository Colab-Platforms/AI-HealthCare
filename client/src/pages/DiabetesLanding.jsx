import Hero from "../components/diabetes-landing/Hero";
import NavbarOld from "../components/landing/landing-components/NavbarOld";
import Footer from "../components/landing/landing-components/Footer";
import Features from "../components/diabetes-landing/Features";
import WhyUs from "../components/diabetes-landing/WhyUs";
import Testimonials from "../components/diabetes-landing/Testimonials";
import FAQs from "../components/diabetes-landing/FAQs";

const DiabetesLanding = () => {
  return (
    <section className="bg-white text-landing-text">
      <NavbarOld />
      <Hero />
      <Features />
      <WhyUs />
      <Testimonials />
      <FAQs />
      <Footer />
    </section>
  );
};

export default DiabetesLanding;
