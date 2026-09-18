import { Crown, Check, Zap, Star } from "lucide-react";

// Free is lifetime access; Pro and Pro Plus are separate plans (not the same plan
// billed two ways) — Pro autopays every month, Pro Plus every 3 months. There is no
// monthly/yearly toggle: each tier has exactly one fixed billing cadence.
const plans = [
  {
    id: "free",
    name: "Free",
    tagline: "Ideal for getting started with your health journey — free for life.",
    price: 0,
    billingCycle: "monthly", // matches the Free Plan doc's stored billingCycle; irrelevant since price is 0
    icon: Star,
    features: [
      "Water, weight, sleep & activity logging",
      "Health score & timeline insights",
      "Medical vault (secure document storage)",
      "Streaks, badges & health challenges",
      "Detailed nutrition logging & smart alerts",
    ],
  },
  {
    id: "basic",
    name: "Pro",
    tagline: "Built for people actively tracking their health.",
    price: 299,
    billingCycle: "monthly",
    cadenceLabel: "billed every month",
    icon: Zap,
    popular: true,
    features: [
      "Everything in Free",
      "AI Health Coach",
      "AI food analysis",
      "AI medical report analysis",
      "Personalized meal recommendations",
      "Goal planner",
    ],
  },
  {
    id: "premium",
    name: "Pro Plus",
    tagline: "Same Pro features, billed quarterly — save vs. paying monthly.",
    price: 799,
    billingCycle: "quarterly",
    cadenceLabel: "billed every 3 months",
    icon: Crown,
    features: [
      "Everything in Pro",
      "Same features as Pro",
      "3 months of access per charge",
      "Fewer renewal charges",
    ],
  },
];

export { plans };

export default function PricingSection({
  currentPlan = null,
  onSelectPlan,
  ctaLabel,
}) {
  return (
    <div className="space-y-10">
      {/* Plans Grid */}
      <div className="grid md:grid-cols-3 gap-6 items-stretch max-w-5xl mx-auto">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isCurrentPlan = currentPlan === plan.id;
          const price = plan.price;
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
                      /{plan.billingCycle === "quarterly" ? "3 months" : "month"}
                    </span>
                  )}
                </div>
                {plan.cadenceLabel && (
                  <p className={`text-xs mt-1 capitalize ${dark ? "text-white/50" : "text-landing-text/50"}`}>
                    {plan.cadenceLabel}, auto-renews
                  </p>
                )}
              </div>

              <button
                onClick={() => !isCurrentPlan && onSelectPlan?.({ ...plan, price, billingCycle: plan.billingCycle })}
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
