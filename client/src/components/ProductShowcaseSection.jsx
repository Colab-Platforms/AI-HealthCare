import { Activity, Smartphone, BarChart3 } from 'lucide-react';

const ProductShowcaseSection = () => {
  return (
    <section className="bg-transparent py-20">
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
            <div className="absolute bottom-8 left-8 right-8 bg-gradient-to-r from-[#0a3d5c]/90 to-[#0d5a8a]/90 backdrop-blur-sm rounded-2xl p-6 border border-cyan-400/30">
              <h3 className="text-2xl font-serif text-white mb-2">
                AI-Powered Nutrition
              </h3>
              <p className="text-sm text-cyan-100">
                Smart meal recognition and instant calorie calculation with advanced AI technology.
              </p>
            </div>
          </div>

          {/* Right Side - Two Stacked Cards */}
          <div className="flex flex-col gap-8">
            {/* Top Card - Features */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#0a3d5c]/80 to-[#0d5a8a]/80 backdrop-blur-sm p-6 sm:p-8 border border-cyan-400/30">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-xl sm:text-2xl font-serif text-white mb-2">
                    Track Everything
                  </h3>
                  <h4 className="text-lg sm:text-xl font-serif text-cyan-300 mb-4">
                    Achieve Anything
                  </h4>
                  <ul className="space-y-2 text-sm text-cyan-100 inline-block sm:block text-left">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                      Calorie & Macro Tracking
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                      Meal Planning & Recipes
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                      Progress Analytics
                    </li>
                  </ul>
                </div>
                <div className="flex-shrink-0 w-full sm:w-auto">
                  <img
                    src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/calorie_trcaker.jpg?v=1773466485"
                    alt="Healthy Food"
                    className="w-full sm:w-52 md:w-64 h-auto max-h-72 object-contain rounded-2xl"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Card - Mobile App */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#0a3d5c]/80 to-[#0d5a8a]/80 backdrop-blur-sm p-6 sm:p-8 border border-cyan-400/30">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-400/50">
                    <Activity className="w-7 h-7 sm:w-8 sm:h-8 text-cyan-300" />
                  </div>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-lg sm:text-xl font-serif text-white mb-2">
                    Report Analyzer
                  </h3>
                  <p className="text-sm text-cyan-100">
                    AI-powered medical report analysis. Get instant health insights from your lab results and medical documents.
                  </p>
                </div>
                <div className="flex-shrink-0 w-full sm:w-auto">
                  <img
                    src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/40326.jpg?v=1773466050"
                    alt="Report Analysis"
                    className="w-full sm:w-32 h-32 sm:h-32 object-cover rounded-xl"
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
