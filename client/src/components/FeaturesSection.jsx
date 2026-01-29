import { Activity, TrendingUp, Target, Heart } from 'lucide-react';

const FeaturesSection = () => {
  const features = [
    {
      icon: Activity,
      title: "Calorie Tracking",
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
    <section id="features" className="py-20 bg-[#F5F1EA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="text-center">
                {/* Icon */}
                <div className="inline-flex items-center justify-center w-16 h-16 mb-6">
                  <Icon className="w-12 h-12 text-[#8B7355] stroke-[1.5]" />
                </div>

                {/* Title */}
                <h3 className="text-lg font-serif text-[#2C2416] mb-2">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-[#5C4F3D]">
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
