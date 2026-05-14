import { useState } from "react";
import { Plus } from "lucide-react";

const Difference = () => {
  const data = [
    {
      id: 1,
      title: "Snap Your Meals, We Handle the Rest",
      description:
        "From photo to full nutrition breakdown in seconds effortless tracking made real.",
      image: "/weight-loss/difference/1.webp",
      icon: "/weight-loss/difference/1.1.svg",
    },
    {
      id: 2,
      title: "We Analyze Macros & Micros for Better Results",
      description:
        "Track proteins, carbs, fats, vitamins, and minerals with precision to improve your overall health and performance.",
      image: "/weight-loss/difference/2.webp",
      icon: "/weight-loss/difference/2.1.svg",
    },
    {
      id: 3,
      title: "We give you detailed insights of your Personalised Diet",
      description:
        "Get detailed nutritional insights and personalized meal recommendations tailored to your body and health goals.",
      image: "/weight-loss/difference/3.webp",
      icon: "/weight-loss/difference/3.1.svg",
    },
    {
      id: 4,
      title: "Lose Weight Naturally with a Personalized Diet Plan",
      description:
        "Sustainable weight loss strategies designed to help you eat better without extreme restrictions.",
      image: "/weight-loss/difference/4.webp",
      icon: "/weight-loss/difference/4.1.svg",
    },
    {
      id: 5,
      title: "Move More, Track Every Step",
      description:
        "Monitor your daily activity, steps, and movement to stay consistent and build healthier habits every day.",
      image: "/weight-loss/difference/5.webp",
      icon: "/weight-loss/difference/5.1.svg",
    },
  ];

  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <section className="container mx-auto pb-10 md:pt-10 px-5 lg:px-20 overflow-hidden flex flex-col-reverse lg:flex-row md:items-center justify-between md:gap-12">
      {/* Left — title + accordion list */}
      <div className="flex-1 max-w-xl">
        <h2 className="text-landing-text font-landing-title font-semibold text-xl md:text-4xl hidden md:block">
          See the{" "}
          <span className="text-landing-primary-hover italic">Difference</span>{" "}
          It Makes.
        </h2>

        <ul className="mt-8 divide-y divide-gray-200">
          {data.map((item, i) => {
            const isActive = i === activeIndex;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActiveIndex(i)}
                  className="w-full text-left flex items-start gap-3 py-4 transition-colors duration-300"
                >
                  {/* Icon */}
                  <img
                    src={item.icon}
                    alt=""
                    className={`w-7 h-7 md:w-9 md:h-9 flex-shrink-0 mt-0.5 transition-opacity duration-300 ${
                      isActive ? "opacity-100" : "opacity-80"
                    }`}
                  />

                  {/* Title + description */}
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-lg font-landing-body font-semibold transition-all duration-300 `}
                    >
                      {item.title}
                    </span>

                    {/* Description — only shown when active */}
                    <div
                      className={`overflow-hidden transition-all duration-500 ${
                        isActive
                          ? "max-h-24 opacity-100 mt-1"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      <p className=" text-black/80 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <Plus
                    className={`w-5 h-5 flex-shrink-0 text-gray-800 mt-0.5 transition-all duration-500 ${
                      isActive ? "transform rotate-45" : ""
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Right — image */}
      <div className="relative flex-shrink-0 w-full lg:w-auto">
        <div className="relative overflow-hidden rounded-2xl w-full lg:w-[600px]">
          {data.map((item, i) => (
            <img
              key={item.id}
              src={item.image}
              alt={item.title}
              className={`w-full object-cover rounded-2xl transition-opacity duration-700 ${
                i === activeIndex
                  ? "opacity-100 relative"
                  : "opacity-0 absolute inset-0"
              }`}
            />
          ))}
        </div>
      </div>

      <h2 className="text-landing-text font-landing-title font-semibold text-xl md:text-4xl md:hidden mb-10">
        See the{" "}
        <span className="text-landing-primary-hover italic">Difference</span> It
        Makes.
      </h2>
    </section>
  );
};

export default Difference;
