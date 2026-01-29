import { Activity, Smartphone, BarChart3 } from 'lucide-react';

const ProductShowcaseSection = () => {
  return (
    <section className="bg-[#8B7355] py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Card - Large Image with Overlay Text */}
          <div className="relative rounded-3xl overflow-hidden group">
            <img
              src="https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=600&fit=crop"
              alt="AI-Powered Nutrition"
              className="w-full h-full object-cover min-h-[400px]"
            />
            {/* Overlay Card */}
            <div className="absolute bottom-8 left-8 right-8 bg-white/95 backdrop-blur-sm rounded-2xl p-6">
              <h3 className="text-2xl font-serif text-[#2C2416] mb-2">
                AI-Powered Nutrition
              </h3>
              <p className="text-sm text-[#5C4F3D]">
                Smart meal recognition and instant calorie calculation with advanced AI technology.
              </p>
            </div>
          </div>

          {/* Right Side - Two Stacked Cards */}
          <div className="flex flex-col gap-8">
            {/* Top Card - Features */}
            <div className="relative rounded-3xl overflow-hidden bg-[#E5DFD3] p-8">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-2xl font-serif text-[#2C2416] mb-2">
                    Track Everything
                  </h3>
                  <h4 className="text-xl font-serif text-[#2C2416] mb-4">
                    Achieve Anything
                  </h4>
                  <ul className="space-y-2 text-sm text-[#5C4F3D]">
                    <li className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[#8B7355]"></span>
                      Calorie & Macro Tracking
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[#8B7355]"></span>
                      Meal Planning & Recipes
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[#8B7355]"></span>
                      Progress Analytics
                    </li>
                  </ul>
                </div>
                <div className="flex-shrink-0">
                  <img
                    src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&h=400&fit=crop"
                    alt="Healthy Food"
                    className="w-48 h-64 object-cover rounded-2xl"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Card - Mobile App */}
            <div className="relative rounded-3xl overflow-hidden bg-[#E5DFD3] p-8">
              <div className="flex items-center gap-6">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
                    <Smartphone className="w-8 h-8 text-[#8B7355]" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-serif text-[#2C2416] mb-2">
                    Mobile App
                  </h3>
                  <p className="text-sm text-[#5C4F3D]">
                    Track on-the-go with our iOS & Android app
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <img
                    src="https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=200&h=200&fit=crop"
                    alt="Mobile App"
                    className="w-32 h-32 object-cover rounded-xl"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductShowcaseSection;
