import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const CONFETTI_COLORS = ["#4872ff", "#6d54eb", "#2dd4bf", "#f59e0b", "#f472b6", "#34d399"];

// Dedicated route so Meta/Google Ads can track this join as a plain
// "page visited" conversion rule (URL contains /waitlist/thank-you),
// independent of the custom JS events which some browsers/extensions block.
export default function WaitlistThankYou() {
  const [confettiPieces, setConfettiPieces] = useState([]);

  useEffect(() => {
    const pieces = Array.from({ length: 28 }, (_, i) => ({
      id: `${Date.now()}-${i}`,
      left: Math.random() * 100,
      delay: Math.random() * 0.3,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotate: Math.random() * 360
    }));
    setConfettiPieces(pieces);

    try {
      if (typeof window.fbq === "function") {
        window.fbq("track", "Lead", { content_name: "waitlist_signup" });
      }
    } catch (err) {
      console.error("fbq tracking failed", err);
    }

    try {
      if (typeof window.gtag === "function") {
        window.gtag("event", "page_view", {
          page_path: "/waitlist/thank-you",
          page_title: "Waitlist Thank You",
        });
        window.gtag("event", "waitlist_signup", {
          event_category: "engagement",
          event_label: "waitlist_page",
        });
      }
    } catch (err) {
      console.error("gtag tracking failed", err);
    }

    try {
      if (typeof window.gtag_report_conversion === "function") {
        window.gtag_report_conversion();
      }
    } catch (err) {
      console.error("gtag_report_conversion failed", err);
    }
  }, []);

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#0a0d16] px-4"
      style={{ backgroundImage: "url(/waitlist/image.png)", backgroundSize: "cover", backgroundPosition: "center 72%" }}
    >
      <div className="relative w-full max-w-[440px] overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,#1C2C4C_0%,#3A4D78_100%)] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)] sm:p-8">
        <div className="relative flex flex-col items-center py-4 text-center">
          <div className="pointer-events-none absolute inset-x-0 -top-4 h-0">
            {confettiPieces.map((p) => (
              <span
                key={p.id}
                className="waitlist-confetti-piece"
                style={{
                  left: `${p.left}%`,
                  backgroundColor: p.color,
                  animationDelay: `${p.delay}s`,
                  transform: `rotate(${p.rotate}deg)`
                }}
              />
            ))}
          </div>

          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/15 text-3xl">
            🎉
          </span>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-white sm:text-[28px]">
            Congratulations!
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/60 sm:text-base">
            You're on the waitlist. We'll email you as soon as it's your turn to get early access.
          </p>

          <Link
            to="/waitlist"
            className="mt-6 rounded-full bg-gradient-to-r from-[#4872ff] via-[#4a5fe0] to-[#6d54eb] px-6 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(83,92,255,0.45)] transition hover:brightness-110"
          >
            Done
          </Link>
        </div>
      </div>
    </div>
  );
}
