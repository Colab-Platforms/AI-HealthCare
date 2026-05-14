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
              bg-[url('/weight-loss/hero/1.webp')]
              bg-cover bg-center md:bg-top-left flex overflow-hidden
            "
          >
            <div className="absolute inset-0 bg-black/30" />
            <div className="container mx-auto px-3 md:px-16 lg:px-32 relative z-10">
              <div className="text-white absolute bottom-8 md:bottom-20 left-5 right-[5px] md:right-0 md:left-20 z-10">
                <h1 className="text-2xl md:text-5xl font-bold !leading-tight mb-5">
                  Feel Better & Live Longer With{" "}
                  <span className="font-medium md:block">
                    Free Weight Loss Management.
                  </span>
                </h1>
                <Link className="bg-white rounded-full text-landing-text md:px-10 md:py-4 px-5 py-2 inline-block font-semibold">
                  Start Your Transformation
                </Link>
              </div>
            </div>
          </section>
        </div>

        {/* Slide 2 */}
        <div style={{ flex: "0 0 100%", minWidth: 0 }}>
          <section
            className="
              h-[75svh] md:h-screen relative
              bg-[url('/weight-loss/hero/2.webp')]
              bg-cover bg-bottom flex overflow-hidden
            "
          >
            <div className="absolute inset-0 bg-black/50 md:bg-black/30" />
            <div className="container mx-auto px-3 md:px-16 lg:px-32 relative z-10">
              <div className="text-white absolute bottom-8 md:bottom-20 left-5 md:left-20 z-10">
                <h1 className="text-2xl md:text-5xl font-bold !leading-tight mb-5 text-balance">
                  We Analyze. We Personalize.{" "}
                  <span className="font-medium md:block">You Just Follow.</span>
                </h1>
                <Link className="bg-white rounded-full text-landing-text md:px-10 md:py-4 px-5 py-2 inline-block font-semibold">
                  Start Your Transformation
                </Link>
              </div>
            </div>
          </section>
        </div>

        {/* Slide 3 */}
        <div style={{ flex: "0 0 100%", minWidth: 0 }}>
          <section
            className="
              h-[75svh] md:h-screen relative
              bg-[url('/weight-loss/hero/3.webp')]
              bg-cover bg-top flex overflow-hidden
            "
          >
            <div className="absolute inset-0 bg-black/30" />
            <div className="container mx-auto px-3 md:px-16 lg:px-32 relative z-10">
              <div className="text-white absolute bottom-8 md:bottom-20 left-5 md:left-20 z-10">
                <h1 className="text-2xl md:text-5xl font-bold !leading-tight  mb-5 text-balance">
                  Lose the Weight{" "}
                  <span className="font-medium block">
                    6 Months Is All It Takes.
                  </span>
                </h1>
                <Link className="bg-white rounded-full text-landing-text md:px-10 md:py-4 px-5 py-2 inline-block font-semibold">
                  Start Your Transformation
                </Link>
              </div>
            </div>
            <img
              src="/weight-loss/3.1.svg"
              alt="main3"
              className="w-[20%] hidden lg:block absolute right-64 bottom-48 backdrop-blur-sm"
            />
          </section>
        </div>

        {/* Slide 4 */}
        <div style={{ flex: "0 0 100%", minWidth: 0 }}>
          <section
            className="
              h-[75svh] md:h-screen relative
              bg-[url('/weight-loss/hero/4.webp')]
              bg-cover bg-top flex overflow-hidden
            "
          >
            <div className="absolute inset-0 bg-black/30" />
            <div className="container mx-auto px-3 md:px-16 lg:px-32 relative z-10">
              <div className="text-white absolute bottom-8 md:bottom-20 left-5 md:left-20 z-10">
                <h1 className="text-2xl md:text-5xl font-bold !leading-tight  mb-5 text-balance">
                  We Help You Move Right{" "}
                  <span className="font-medium block">for Better Results</span>
                </h1>
                <Link className="bg-white rounded-full text-landing-text md:px-10 md:py-4 px-5 py-2 inline-block font-semibold">
                  Start Your Transformation
                </Link>
              </div>
            </div>
            <img
              src="/weight-loss/4.1.svg"
              alt="main3"
              className="w-[16%] hidden lg:block absolute right-[25%] top-[23%] backdrop-blur-sm"
            />
            <img
              src="/weight-loss/4.2.svg"
              alt="main3"
              className="w-[16%] hidden lg:block absolute right-[20%] top-[50%] backdrop-blur-sm"
            />
          </section>
        </div>
      </div>
    </div>
  );
};

export default Hero;
