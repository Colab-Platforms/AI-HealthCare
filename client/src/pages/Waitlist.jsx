import React from "react";
import { Link, useNavigate } from "react-router-dom";

const CarouselItems = () => (
  <>
    {/* Next meal — food photo */}
    <div className="relative h-[338px] w-[260px] shrink-0 overflow-hidden rounded-[24px] border border-white/10 ">
      <img
        src="/waitlist/wait_1.png"
        alt="Recommended lunch: paneer, roti and seasonal salad"
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>

    {/* App download — phone mockup */}
    <div className="relative h-[468px] w-[372px] shrink-0">
      <img
        src="/waitlist/wait_2.png"
        alt="Take Health app dashboard on a phone"
        className="absolute left-0 top-0 h-full w-full object-cover object-top"
      />
    </div>

    {/* Lab markers — man portrait */}
    <div className="relative h-[310px] w-[277px] shrink-0 overflow-hidden rounded-[24px] border border-white/10">
      <img
        src="/waitlist/wait_3.png"
        alt="Full body health check portrait"
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>

    {/* TAKE Noticed — insight card, no photo */}
    <div
      className="relative flex h-[218px] w-[329px] shrink-0 flex-col justify-between overflow-hidden rounded-[24px] p-5"
      style={{ background: "radial-gradient(circle 170px at 82% 48%, rgba(90,150,255,0.95), rgba(60,100,220,0.3) 42%, transparent 68%), #020305" }}
    >
      <div className="flex items-center gap-3 text-base font-medium text-white lg:text-lg">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full lg:h-11 lg:w-11">
          <video
            src="/waitlist/waitlist_bolb.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full scale-[2.2] object-cover"
          />
          <svg
            viewBox="0 0 40 40"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <circle cx="20" cy="10" r="2.4" fill="#fff" />
            <circle cx="14.5" cy="18" r="2" fill="#fff" fillOpacity="0.9" />
            <circle cx="25.5" cy="18" r="2" fill="#fff" fillOpacity="0.9" />
            <circle cx="9" cy="26" r="1.7" fill="#fff" fillOpacity="0.75" />
            <circle cx="20" cy="26" r="1.7" fill="#fff" fillOpacity="0.75" />
            <circle cx="31" cy="26" r="1.7" fill="#fff" fillOpacity="0.75" />
          </svg>
        </span>
        TAKE Noticed
      </div>
      <div>
        <p className="font-landing-title text-base font-medium leading-snug text-white lg:text-xl">
          Your sleep has been more consistent this week.
        </p>
        <p className="mt-4 font-mono text-[11px] text-white/50 lg:text-sm">7h 12m average</p>
      </div>
    </div>

    {/* Supplement recommendation — woman portrait */}
    <div className="relative h-[471px] w-[283px] shrink-0 overflow-hidden rounded-[24px] border border-white/10">
      <img
        src="/waitlist/wait_5.png"
        alt="Supplement recommended from lab results"
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  </>
);export default function WaitlistPage() {
  const navigate = useNavigate();

  const trackCtaClick = () => {
    try {
      if (typeof window.fbq === "function") {
        window.fbq("trackCustom", "WaitlistCTAClick", { content_name: "take_your_spot" });
      }
    } catch (err) {
      console.error("fbq CTA tracking failed", err);
    }

    try {
      if (typeof window.gtag === "function") {
        window.gtag("event", "waitlist_cta_click", {
          event_category: "engagement",
          event_label: "take_your_spot_button",
        });
      }
    } catch (err) {
      console.error("gtag CTA tracking failed", err);
    }
  };

  const handleCtaClick = () => {
    trackCtaClick();
    navigate("/waitlist/join");
  };

  return (
    <div
      className="min-h-screen overflow-hidden bg-[#0a0d16] bg-cover bg-no-repeat text-white"
      style={{ backgroundImage: "url(/waitlist/image.png)", backgroundPosition: "center 72%" }}
    >
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col items-center justify-between px-4 py-8 sm:px-8 lg:px-12">
        <div className="w-full max-w-[1560px]">
          <div className="relative mb-10 flex justify-center">
            <img
              src="/assets/logos/take_logo.png"
              alt="Take Health logo"
              className="h-[46px] w-auto sm:h-[56px]"
            />
            <Link
              to="/login"
              className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full border border-white/15 px-4 py-2 text-xs font-medium text-white/80 transition-colors hover:border-white/30 hover:text-white sm:px-5 sm:py-2.5 sm:text-sm"
            >
              Log in
            </Link>
          </div>

          <div className="text-center">
            <h1
              className="mx-auto max-w-[750px] text-center text-[#FFF] text-[44px] not-italic font-medium leading-[104%] capitalize font-landing-title sm:text-[44px] lg:text-[64px] lg:leading-[100%]"
            >
              Your Health Is About To Get Smarter
            </h1>

            <p
              className="mx-auto mt-4 max-w-[760px] text-center text-[rgba(255,255,255,0.80)] text-[15px] not-italic font-normal leading-[150%] sm:mt-7 sm:text-lg lg:text-[28px] lg:leading-[140%]"
              style={{ fontFamily: '"Founders Grotesk", sans-serif' }}
            >
              Take brings your health data, habits, lifestyle and insights together —
              turning them into a clear picture of where you are today and where your
              health is headed.
            </p>

            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:mt-8 sm:gap-4">
              <button
                type="button"
                onClick={handleCtaClick}
                style={{
                  borderRadius: "173.517px",
                  background: "linear-gradient(90deg, #080277 0%, #4F46E5 50%, #080277 100%)",
                }}
                className="inline-flex flex-col items-center justify-center px-8 py-3 text-white shadow-[0_18px_40px_rgba(64,87,255,0.45)] transition-transform hover:scale-[1.02] sm:px-10 sm:py-4"
              >
                <span className="text-[9px] font-bold uppercase tracking-[0.17em] sm:text-[11px]">
                  Be Among The First
                </span>
                <span className="text-lg font-bold uppercase tracking-wide sm:text-2xl">
                  TAKE YOUR SPOT
                </span>
              </button>
              <div
                className="text-center text-[rgba(255,255,255,0.80)] text-[13px] not-italic font-medium leading-[160%] sm:text-lg lg:text-[24px]"
                style={{ fontFamily: '"Geist Mono", monospace' }}
              >
                30-Day Free Trial
              </div>
            </div>
          </div>

          <div className="mt-14 w-full overflow-hidden pb-3 sm:pb-5 lg:mt-16 lg:pb-0 relative">
            
            <style>
              {`
                @keyframes waitlist-slide {
                  0% { transform: translateX(0); }
                  100% { transform: translateX(-50%); }
                }
                .animate-waitlist-slide {
                  animation: waitlist-slide 35s linear infinite;
                  width: max-content;
                }
                .animate-waitlist-slide:hover {
                  animation-play-state: paused;
                }
              `}
            </style>
            
            <div className="flex flex-nowrap items-center gap-4 sm:gap-5 lg:gap-6 animate-waitlist-slide">
              <CarouselItems />
              <CarouselItems />
            </div>
          </div>
        </div>

        <div className="mt-10 flex items-center justify-center gap-4 text-[11px] text-white/70 sm:mt-16 sm:gap-8 sm:text-sm lg:gap-12">
          <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link to="/terms-and-conditions" className="hover:text-white transition-colors">Terms of Use</Link>
        </div>

        <div className="mt-6 flex items-center justify-center gap-6 text-white/70">
          <a
            href="https://www.instagram.com/takehealth_?utm_source=qr&igsi=MnhpZG5ocG9nbG5q"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Take Health on Instagram"
            className="h-6 w-6 rounded-full sm:h-7 sm:w-7"
          >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <g opacity="0.6" clip-path="url(#clip0_2878_8279)">
              <path d="M9.74146 0C7.09606 0 6.76408 0.0115672 5.72507 0.05885C4.6881 0.106336 3.98028 0.270506 3.36093 0.511385C2.72028 0.760177 2.17683 1.09298 1.63541 1.6346C1.09359 2.17602 0.760786 2.71947 0.511181 3.35992C0.269695 3.97947 0.105321 4.68748 0.0586467 5.72406C0.0121757 6.76306 0 7.09525 0 9.74066C0 12.3861 0.0117701 12.717 0.0588499 13.7561C0.106539 14.793 0.270709 15.5009 0.511385 16.1202C0.760379 16.7609 1.09319 17.3043 1.63481 17.8457C2.17602 18.3875 2.71947 18.7211 3.35971 18.9699C3.97947 19.2109 4.68748 19.375 5.72426 19.4224C6.76327 19.4697 7.09506 19.4814 9.74025 19.4814C12.3859 19.4814 12.7168 19.4697 13.7558 19.4224C14.7928 19.375 15.5014 19.2109 16.1211 18.9699C16.7617 18.7211 17.3043 18.3875 17.8455 17.8457C18.3873 17.3043 18.7201 16.7609 18.9697 16.1203C19.2092 15.5009 19.3736 14.7928 19.4223 13.7562C19.4689 12.7172 19.4811 12.3861 19.4811 9.74066C19.4811 7.09525 19.4689 6.76327 19.4223 5.72426C19.3736 4.68729 19.2092 3.97947 18.9697 3.36012C18.7201 2.71947 18.3873 2.17602 17.8455 1.6346C17.3037 1.09278 16.7618 0.759974 16.1206 0.511385C15.4996 0.270506 14.7913 0.106336 13.7544 0.05885C12.7154 0.0115672 12.3846 0 9.73842 0H9.74146ZM8.86765 1.75535C9.12699 1.75494 9.41638 1.75535 9.74146 1.75535C12.3422 1.75535 12.6505 1.76468 13.6775 1.81135C14.6272 1.85479 15.1427 2.01348 15.486 2.1468C15.9405 2.32334 16.2646 2.5344 16.6054 2.87532C16.9463 3.21624 17.1573 3.54094 17.3344 3.9955C17.4677 4.33845 17.6265 4.85389 17.6698 5.80361C17.7164 6.83043 17.7266 7.13888 17.7266 9.73843C17.7266 12.338 17.7164 12.6464 17.6698 13.6732C17.6263 14.6229 17.4677 15.1384 17.3344 15.4814C17.1577 15.936 16.9463 16.2596 16.6054 16.6003C16.2645 16.9412 15.9408 17.1522 15.486 17.3289C15.1431 17.4628 14.6272 17.6211 13.6775 17.6644C12.6507 17.7112 12.3422 17.7213 9.74146 17.7213C7.1405 17.7213 6.83226 17.7112 5.80543 17.6644C4.85572 17.6207 4.34028 17.4619 3.99671 17.3286C3.54215 17.1521 3.21746 16.9411 2.87654 16.6002C2.53561 16.2592 2.32457 15.9353 2.14761 15.4806C2.01429 15.1376 1.85539 14.6221 1.81216 13.6724C1.76549 12.6456 1.75616 12.3372 1.75616 9.73599C1.75616 7.13483 1.76549 6.828 1.81216 5.80117C1.8556 4.85146 2.01429 4.33602 2.14761 3.99265C2.32416 3.53809 2.53561 3.21341 2.87654 2.87248C3.21746 2.53156 3.54215 2.32051 3.99671 2.14355C4.34007 2.00961 4.85572 1.85134 5.80543 1.80771C6.70401 1.76712 7.05224 1.75494 8.86765 1.75291V1.75535ZM14.9409 3.3727C14.2956 3.3727 13.772 3.89566 13.772 4.54118C13.772 5.1865 14.2956 5.71005 14.9409 5.71005C15.5863 5.71005 16.1098 5.1865 16.1098 4.54118C16.1098 3.89585 15.5863 3.3727 14.9409 3.3727ZM9.74146 4.73843C6.97897 4.73843 4.73924 6.97816 4.73924 9.74066C4.73924 12.5032 6.97897 14.7419 9.74146 14.7419C12.504 14.7419 14.7429 12.5032 14.7429 9.74066C14.7429 6.97816 12.504 4.73843 9.74146 4.73843ZM9.74146 6.49377C11.5346 6.49377 12.9883 7.94737 12.9883 9.74066C12.9883 11.5337 11.5346 12.9875 9.74146 12.9875C7.94817 12.9875 6.49458 11.5337 6.49458 9.74066C6.49458 7.94737 7.94817 6.49377 9.74146 6.49377Z" fill="white"/>
            </g>
            <defs>
              <clipPath id="clip0_2878_8279">
                <rect width="19.6" height="19.6" fill="white"/>
              </clipPath>
            </defs>
          </svg>
          </a>
          <a
            href="https://x.com/Take_Limited"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Take Health on X"
            className="h-6 w-6 rounded-full sm:h-7 sm:w-7"
          >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <g opacity="0.6" clip-path="url(#clip0_2878_8282)">
              <path d="M15.3425 0.65332H18.3298L11.8035 8.11236L19.4811 18.2625H13.4696L8.76121 12.1065L3.37372 18.2625H0.384692L7.36513 10.2841L0 0.65332H6.1641L10.4201 6.28011L15.3425 0.65332ZM14.2941 16.4744H15.9493L5.26468 2.34741H3.48841L14.2941 16.4744Z" fill="white"/>
            </g>
            <defs>
              <clipPath id="clip0_2878_8282">
                <rect width="19.6" height="19.6" fill="white"/>
              </clipPath>
            </defs>
          </svg>
          </a>
          <a
            href="https://www.linkedin.com/company/take-ltd/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Take Health on LinkedIn"
            className="h-6 w-6 rounded-full sm:h-7 sm:w-7"
          >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <g opacity="0.6" clip-path="url(#clip0_2878_8285)">
              <path d="M18.0896 0C18.8288 0 19.4811 0.65227 19.4811 1.43499V18.0896C19.4811 18.8723 18.8288 19.4811 18.0896 19.4811H1.34802C0.608785 19.4811 0 18.8723 0 18.0896V1.43499C0 0.65227 0.608785 0 1.34802 0H18.0896ZM5.87042 16.6982V7.43587H3.00043V16.6982H5.87042ZM4.43543 6.13132C5.34861 6.13132 6.08785 5.39209 6.08785 4.47891C6.08785 3.56574 5.34861 2.78302 4.43543 2.78302C3.47876 2.78302 2.73953 3.56574 2.73953 4.47891C2.73953 5.39209 3.47876 6.13132 4.43543 6.13132ZM16.6982 16.6982V11.6104C16.6982 9.13177 16.1328 7.17496 13.2193 7.17496C11.8278 7.17496 10.8712 7.95768 10.4798 8.69693H10.4363V7.43587H7.69678V16.6982H10.5668V12.1322C10.5668 10.9146 10.7842 9.74055 12.3061 9.74055C13.7847 9.74055 13.7847 11.1321 13.7847 12.1757V16.6982H16.6982Z" fill="white"/>
            </g>
            <defs>
              <clipPath id="clip0_2878_8285">
                <rect width="19.6" height="19.6" fill="white"/>
              </clipPath>
            </defs>
          </svg>
          </a>
        </div>

        <div className="mt-6 pb-4 text-center text-[11px] text-white/60 sm:text-sm">
          © 2026 Take Health. All rights reserved.
        </div>
      </div>

    </div>
  );
}
