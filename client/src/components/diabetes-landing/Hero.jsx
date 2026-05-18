import { Link } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

const Hero = () => {
  const [emblaRef] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 5000, stopOnInteraction: false }),
  ]);

  return (
    <div ref={emblaRef} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex" }}>
        {/* Slide 1 */}
        <div style={{ flex: "0 0 100%", minWidth: 0 }}>
          <section
            className="
              h-[75svh] md:h-screen relative
              bg-[url('/diabetes/hero/bg1.webp')]
              bg-cover bg-center flex overflow-hidden
            "
          >
            <div className="absolute inset-0 bg-black/30" />
            <div
              className="container mx-auto px-3 md
            :px-16 lg:px-32 relative z-10"
            >
              <div className="text-white absolute bottom-8 md:top-40 left-5 md:left-20 z-10">
                <h1 className="text-2xl md:text-7xl font-bold !leading-tight md:mb-10 mb-5 text-balance">
                  India's 1st Diabetes{" "}
                  <span className="font-medium md:block">
                    Reversal Tool At No Cost
                  </span>
                </h1>
                <Link
                  className="bg-white rounded-full text-landing-text md:px-10 md:py-4 px-5 py-2 inline-block font-semibold"
                  to={"/register"}
                >
                  Get Started Free
                </Link>
              </div>
              <img
                src="/diabetes/hero/main1.webp"
                alt="main1"
                className="w-full md:w-[45%] object-contain absolute right-0 bottom-0 md:-bottom-10 z-0"
              />
            </div>
          </section>
        </div>

        {/* Slide 2 */}
        <div style={{ flex: "0 0 100%", minWidth: 0 }}>
          <section
            className="
              h-[75svh] md:h-screen relative
              bg-[url('/diabetes/hero/bg2.webp')]
              bg-cover bg-top flex overflow-hidden
            "
          >
            <div className="absolute inset-0 bg-black/30" />
            <div className="container mx-auto px-3 md:px-16 lg:px-32 relative z-10">
              <div className="text-white absolute bottom-8 md:bottom-20 left-5 md:left-20 z-10">
                <h1 className="text-2xl md:text-5xl font-bold !leading-tight mb-5 text-balance">
                  Upload Your Reports.{" "}
                  <span className="font-medium block">
                    Get Detailed Health Insights.
                  </span>
                </h1>
                <Link
                  to={"/register"}
                  className="bg-white rounded-full text-landing-text md:px-10 md:py-4 px-5 py-2 inline-block font-semibold"
                >
                  Get Started Free
                </Link>
              </div>
            </div>
            <img
              src="/diabetes/hero/main2.1mob.svg"
              alt="main2"
              className="w-[30%] md:w-[12%] block md:hidden absolute right-8 top-24 backdrop-blur-sm"
            />
            <img
              src="/diabetes/hero/main2.1.svg"
              alt="main2"
              className="w-[12%] hidden lg:block absolute right-96 top-48 backdrop-blur-sm"
            />
            <img
              src="/diabetes/hero/main2.2.svg"
              alt="main2"
              className="w-[18%] hidden lg:block absolute right-56 bottom-36 backdrop-blur-sm"
            />
          </section>
        </div>

        {/* Slide 3 */}
        <div style={{ flex: "0 0 100%", minWidth: 0 }}>
          <section
            className="
              h-[75svh] md:h-screen relative
              bg-[url('/diabetes/hero/bg3.webp')]
              bg-cover bg-bottom flex overflow-hidden
            "
          >
            <div className="absolute inset-0 bg-black/50 md:bg-black/30" />
            <div className="container mx-auto px-3 md:px-16 lg:px-32 relative z-10">
              <div className="text-white absolute bottom-8 md:bottom-20 left-5 md:left-20 z-10">
                <h1 className="text-2xl md:text-5xl font-bold !leading-tight mb-5 text-balance">
                  We Help You Eat Right with{" "}
                  <span className="font-medium md:block">
                    Personalized Plans
                  </span>
                </h1>
                <Link
                  to={"/register"}
                  className="bg-white rounded-full text-landing-text md:px-10 md:py-4 px-5 py-2 inline-block font-semibold"
                >
                  Get Started Free
                </Link>
              </div>
            </div>
            <img
              src="/diabetes/hero/main3.1mob.svg"
              alt="main3"
              className="w-[50%] block lg:hidden absolute left-8 top-32 "
            />
            <img
              src="/diabetes/hero/main3.1.svg"
              alt="main3"
              className="w-[12%] hidden lg:block absolute right-56 top-48 "
            />
            <img
              src="/diabetes/hero/main3.2.png"
              alt="main2"
              className="w-[12%] hidden lg:block absolute right-56 top-[47%] "
            />
          </section>
        </div>

        {/* Slide 4 */}
        <div style={{ flex: "0 0 100%", minWidth: 0 }}>
          <section
            className="
              h-[75svh] md:h-screen relative
              bg-[url('/diabetes/hero/bg4.webp')]
              bg-cover bg-top flex overflow-hidden
            "
          >
            <div className="absolute inset-0 bg-black/30" />
            <div className="container mx-auto px-3 md:px-16 lg:px-32 relative z-10">
              <div className="text-white absolute bottom-8 md:bottom-20 left-5 md:left-20 z-10">
                <h1 className="text-2xl md:text-5xl font-bold !leading-tight  mb-5 text-balance">
                  We Help You Stay Active{" "}
                  <span className="font-medium block">
                    for Better Health Every Day
                  </span>
                </h1>
                <Link
                  to={"/register"}
                  className="bg-white rounded-full text-landing-text md:px-10 md:py-4 px-5 py-2 inline-block font-semibold"
                >
                  Get Started Free
                </Link>
              </div>
            </div>
            <img
              src="/diabetes/hero/main4.1mob.svg"
              alt="main3"
              className="w-[40%] block md:hidden absolute left-8 bottom-52 "
            />
            <img
              src="/diabetes/hero/main4.1.svg"
              alt="main3"
              className="w-[16%] hidden lg:block absolute right-64 top-48 "
            />
            <img
              src="/diabetes/hero/main4.2.svg"
              alt="main2"
              className="w-[16%] hidden lg:block absolute right-64 top-[47%] "
            />
          </section>
        </div>
      </div>
    </div>
  );
};

export default Hero;
