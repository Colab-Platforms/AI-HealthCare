import React from "react";

const SHOP_URL = "https://shop.take.health";
const APP_STORE_URL = "https://apps.apple.com/in/app/take-health/id6809424667";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.takehealth.app";

// iOS visitors go to the App Store, everyone else to Play Store. Computed at
// click time (not render) so it never mismatches during prerender/SSR.
const openAppStore = (e) => {
  e.preventDefault();
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  window.open(isIOS ? APP_STORE_URL : PLAY_STORE_URL, "_blank", "noopener,noreferrer");
};

const banners = [
  {
    src: "/updated-landing/promo-berberine.jpg",
    alt: "TAKE Liposomal Berberine 1000mg - 99% pure, 6x better absorption",
    href: SHOP_URL,
  },
  {
    src: "/updated-landing/promo-diet.jpg",
    alt: "Stop following someone else's diet - build a nutrition routine around your own goals",
    href: PLAY_STORE_URL,
    onClick: openAppStore,
  },
  {
    src: "/updated-landing/promo-health-data.jpg",
    alt: "Bring your health data together - 14 days free on the Take app",
    href: PLAY_STORE_URL,
    onClick: openAppStore,
  },
];

const UpdatedPromoBanners = () => {
  return (
    <div className="w-full bg-[#FAF9F8] py-10 sm:py-14 lg:py-20 font-landing-body">
      <div className="max-w-[1400px] mx-auto">
        {/* Mobile: swipeable row with a peek of the next card. Desktop: 3-column grid. */}
        <div className="flex sm:grid sm:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 overflow-x-auto sm:overflow-visible snap-x snap-mandatory px-4 sm:px-8 lg:px-16 pb-2 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {banners.map((b) => (
            <a
              key={b.src}
              href={b.href}
              onClick={b.onClick}
              target="_blank"
              rel="noopener noreferrer"
              className="group shrink-0 w-[85%] sm:w-auto snap-center rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-shadow duration-300"
            >
              <img
                src={b.src}
                alt={b.alt}
                width="1600"
                height="1600"
                loading="lazy"
                decoding="async"
                className="w-full h-auto aspect-square object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UpdatedPromoBanners;
