import { Activity, TrendingUp, Target, Heart } from 'lucide-react';

const FeaturesSection = () => {
  const features = [
    {
      icon: Activity,
      title: "Health Tracking",
      description: "Effortless daily tracking",
    },
    {
      icon: TrendingUp,
      title: "Progress Analytics",
      description: "Real-time health insights",
    },
    {
      icon: Target,
      title: "Goal Setting",
      description: "Personalized targets",
    },
    {
      icon: Heart,
      title: "Wellness Plans",
      description: "AI-powered recommendations",
    },
  ];

  return (
    <section id="features" className="py-20 bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="text-center bg-gradient-to-br from-[#0a3d5c]/60 to-[#0d5a8a]/60 backdrop-blur-sm rounded-2xl p-8 border border-cyan-400/30 hover:border-cyan-400/60 transition-all hover:shadow-lg hover:shadow-cyan-500/20">
                {/* Icon */}
                <div className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-cyan-500/20 rounded-full border border-cyan-400/40">
                  <Icon className="w-12 h-12 text-cyan-300 stroke-[1.5]" />
                </div>

                {/* Title */}
                <h3 className="text-lg font-serif text-white mb-2">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-cyan-100">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
