import { useNavigate } from "react-router-dom";
import SEO from "../hooks/useSEO";
import UpdatedNavbar from "../components/landing/landing-components/UpdatedNavbar";
import UpdatedFooter from "../components/landing/landing-components/UpdatedFooter";
import PricingSection from "../components/landing/PricingSection";

const Pricing = () => {
  const navigate = useNavigate();

  return (
    <section className="bg-landing-light-bg text-landing-text font-landing-body min-h-screen">
      <SEO pageName="subscription" />
      <UpdatedNavbar />

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

      <UpdatedFooter />
    </section>
  );
};

export default Pricing;
