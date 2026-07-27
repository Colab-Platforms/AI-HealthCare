import { useNavigate } from "react-router-dom";
import SEO from "../hooks/useSEO";
import NavbarOld from "../components/landing/landing-components/NavbarOld";
import Footer from "../components/landing/landing-components/Footer";
import PricingSection from "../components/landing/PricingSection";

const Pricing = () => {
  const navigate = useNavigate();

  return (
    <section className="bg-landing-light-bg text-landing-text font-landing-body min-h-screen">
      <SEO pageName="subscription" />
      <NavbarOld forceSolid />

      <div className="pt-40 pb-24 px-5">
        <div className="text-center max-w-xl mx-auto mb-14">
          <h1 className="text-3xl md:text-4xl font-black text-landing-text mb-3 font-landing-title">
            Pricing Plans
          </h1>
          <p className="text-landing-text/60">
            Track, understand, and act on your health with a plan built for
            your needs.
          </p>
        </div>

        <PricingSection
          ctaLabel="Get Started"
          onSelectPlan={() => navigate("/register")}
        />
      </div>

      <Footer />
    </section>
  );
};

export default Pricing;
