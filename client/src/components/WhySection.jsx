import { Activity, TrendingUp, Target, Users } from 'lucide-react';

const WhySection = () => {
  const features = [
    {
      icon: Activity,
      title: "Smart Tracking",
      description: "AI-powered meal recognition and logging",
    },
    {
      icon: TrendingUp,
      title: "Progress Insights",
      description: "Real-time analytics and trends",
    },
    {
      icon: Target,
      title: "Goal Achievement",
      description: "Personalized nutrition targets",
    },
    {
      icon: Users,
      title: "Expert Support",
      description: "Nutritionist-approved guidance",
    },
  ];

  return (
    <section className="bg-[#F5F1EA] py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Image */}
          <div className="relative">
            <div className="rounded-3xl overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&h=1000&fit=crop"
                alt="Healthy Nutrition"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Right: Content */}
          <div>
            {/* Subtitle */}
            <p className="text-sm uppercase tracking-[0.2em] text-[#8B7355] mb-4 font-medium">
              WHY HEALTHAI
            </p>

            {/* Heading */}
            <h2 className="text-4xl md:text-5xl font-serif text-[#2C2416] mb-6 leading-tight">
              Nutrition that
              <br />
              works for you.
            </h2>

            {/* Description */}
            <p className="text-lg text-[#5C4F3D] mb-8 leading-relaxed">
              We believe nutrition tracking should be simple, not stressful. Every feature is designed with your health goals in mind, powered by AI for effortless tracking.
            </p>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div key={index} className="bg-white rounded-2xl p-6">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-full bg-[#F5F1EA] flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-[#8B7355]" />
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-serif text-[#2C2416] mb-2">
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
        </div>
      </div>
    </section>
  );
};

export default WhySection;