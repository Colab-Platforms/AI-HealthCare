import { useState } from "react";
import { Crown, Check, Zap, Star } from "lucide-react";

const plans = [
  {
    id: "free",
    name: "Free",
    tagline: "Ideal for getting started with your health journey.",
    price: 0,
    icon: Star,
    features: [
      "1 Report analysis per month",
      "Basic AI insights",
      "View doctor listings",
      "Email support",
    ],
  },
  {
    id: "basic",
    name: "Basic",
    tagline: "Built for people actively tracking their health.",
    price: 299,
    icon: Zap,
    popular: true,
    features: [
      "5 Report analyses per month",
      "Full AI analysis with deficiencies",
      "Personalized diet plans",
      "Supplement recommendations",
      "Health trend tracking",
      "Priority support",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "Everything, unlimited, for serious health management.",
    price: 599,
    icon: Crown,
    features: [
      "Unlimited report analyses",
      "Advanced AI insights",
      "Personalized diet & exercise plans",
      "Supplement recommendations",
      "Health trend analytics",
      "Chat with AI about reports",
      "Doctor recommendations",
      "24/7 Priority support",
    ],
  },
];

export { plans };

export default function PricingSection({
  currentPlan = null,
  onSelectPlan,
  ctaLabel,
}) {
  const [billingCycle, setBillingCycle] = useState("yearly");

  return (
    <div className="space-y-10">
      {/* Billing Toggle */}
      <div className="flex justify-center">
        <div className="flex items-center gap-1 p-1 bg-white/60 backdrop-blur-xl rounded-full border border-white/60 shadow-sm">
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-all ${billingCycle === "yearly" ? "bg-landing-primary text-white shadow-md" : "text-landing-text/60"}`}
          >
            Yearly
          </button>
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-all ${billingCycle === "monthly" ? "bg-landing-primary text-white shadow-md" : "text-landing-text/60"}`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-3 gap-6 items-stretch max-w-5xl mx-auto">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isCurrentPlan = currentPlan === plan.id;
          const price =
            billingCycle === "yearly"
              ? Math.round((plan.price * 12 * 0.8) / 12)
              : plan.price;
          const dark = plan.popular;

          return (
            <div
              key={plan.id}
              className={`relative rounded-[2rem] p-7 flex flex-col backdrop-blur-2xl border transition-all
                ${dark
                  ? "bg-landing-primary/95 border-white/10 shadow-[0_20px_50px_rgba(1,67,67,0.35)] md:scale-105"
                  : "bg-white/50 border-white/60 shadow-[0_8px_30px_rgba(1,67,67,0.06)]"
                }
                ${isCurrentPlan ? "ring-2 ring-landing-primary ring-offset-2 ring-offset-landing-light-bg" : ""}`}
            >
              {plan.popular && (
                <span className="absolute top-6 right-6 bg-white text-landing-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                  Best Choice
                </span>
              )}

              <div className="mb-6">
                <h3 className={`text-xl font-bold mb-2 ${dark ? "text-white" : "text-landing-text"}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm ${dark ? "text-white/60" : "text-landing-text/55"}`}>
                  {plan.tagline}
                </p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Check
                      className={`w-4 h-4 flex-shrink-0 mt-0.5 ${dark ? "text-white" : "text-landing-primary"}`}
                    />
                    <span className={dark ? "text-white/80" : "text-landing-text/70"}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mb-5">
                <div className="flex items-end gap-2">
                  <span className={`text-4xl font-black ${dark ? "text-white" : "text-landing-text"}`}>
                    {plan.price === 0 ? "Free" : `₹${price}`}
                  </span>
                  {plan.price !== 0 && (
                    <span className={`text-sm pb-1 ${dark ? "text-white/50" : "text-landing-text/50"}`}>
                      /month
                    </span>
                  )}
                </div>
                {plan.price !== 0 && billingCycle === "yearly" && (
                  <p className={`text-xs mt-1 ${dark ? "text-white/50" : "text-landing-text/50"}`}>
                    Billed ₹{price * 12}/year
                  </p>
                )}
              </div>

              <button
                onClick={() => !isCurrentPlan && onSelectPlan?.({ ...plan, price, billingCycle })}
                disabled={isCurrentPlan}
                className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all
                  ${isCurrentPlan
                    ? dark
                      ? "bg-white/10 text-white/40 cursor-not-allowed"
                      : "bg-landing-text/10 text-landing-text/40 cursor-not-allowed"
                    : dark
                      ? "bg-white text-landing-primary hover:bg-landing-accent-bg"
                      : "bg-landing-primary text-white hover:bg-landing-primary-hover"
                  }`}
              >
                {isCurrentPlan
                  ? "Current Plan"
                  : (ctaLabel ?? (plan.price === 0 ? "Downgrade" : "Upgrade"))}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
