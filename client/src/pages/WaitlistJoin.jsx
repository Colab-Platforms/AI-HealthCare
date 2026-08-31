import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { waitlistService } from "../services/api";

// Dedicated route (not a modal) so reaching the join form is a real
// navigation — Meta/Google Ads can then track "landed on /waitlist/join"
// as a plain page-visit signal, on top of the custom JS events.
export default function WaitlistJoin() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState(false);
  const [alreadyJoined, setAlreadyJoined] = useState(false);

  useEffect(() => {
    try {
      if (typeof window.gtag === "function") {
        window.gtag("event", "page_view", {
          page_path: "/waitlist/join",
          page_title: "Waitlist Join Form",
        });
      }
    } catch (err) {
      console.error("gtag tracking failed", err);
    }
  }, []);

  const handleJoinWaitlist = async () => {
    if (isSubmitting) return;
    setStatusError(false);

    if (!name.trim()) {
      setStatusError(true);
      setStatusMessage("Please enter your name.");
      return;
    }

    if (!/^[a-zA-Z\s'-]{2,50}$/.test(name.trim())) {
      setStatusError(true);
      setStatusMessage("Name can only contain letters, spaces, hyphens, and apostrophes.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setStatusError(true);
      setStatusMessage("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("");

    try {
      const response = await waitlistService.join(name.trim(), email.trim());

      if (response.status === 201) {
        // New user added — send to the dedicated thank-you route so the
        // conversion is also trackable as a plain "page visited" rule.
        setName("");
        setEmail("");
        navigate("/waitlist/thank-you");
      } else if (response.status === 200) {
        // Already on waitlist — not a new lead, stay on this page.
        setName("");
        setEmail("");
        setAlreadyJoined(true);
        setStatusMessage(response.data.message || "You're already on our waitlist!");
      } else {
        setStatusError(true);
        setStatusMessage(response.data.message || "Something went wrong. Please try again.");
      }
    } catch (error) {
      setStatusError(true);

      if (!error.response) {
        setStatusMessage("Network error. Please check your connection and try again.");
      } else if (error.response.status === 429) {
        setStatusMessage("Too many signup attempts. Please wait a few minutes and try again.");
      } else if (error.response.status === 400) {
        setStatusMessage(error.response.data?.message || "Please check your information and try again.");
      } else {
        setStatusMessage(error.response.data?.message || "Something went wrong. Please try again later.");
      }

      console.error('Waitlist join error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0d16] px-4 text-white">
      <div className="relative w-full max-w-[440px] overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,#1C2C4C_0%,#3A4D78_100%)] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)] sm:p-8">
        <Link
          to="/waitlist"
          aria-label="Back to waitlist page"
          className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm text-white/70 transition hover:bg-white/20"
        >
          ×
        </Link>

        {alreadyJoined ? (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/15 text-3xl">
              🎉
            </span>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-white sm:text-[28px]">
              You're already in!
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/60 sm:text-base">
              {statusMessage}
            </p>
            <Link
              to="/waitlist"
              className="mt-6 rounded-full bg-gradient-to-r from-[#4872ff] via-[#4a5fe0] to-[#6d54eb] px-6 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(83,92,255,0.45)] transition hover:brightness-110"
            >
              Done
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-[28px]">
              Get Early Access
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/60 sm:text-base">
              Understand your health better. Make better choices every day. Join the waitlist.
            </p>

            <div className="mt-6 flex items-center rounded-full bg-black/30 p-1.5">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinWaitlist()}
                placeholder="Your Name"
                autoComplete="off"
                style={{ WebkitTextFillColor: "#fff", WebkitBoxShadow: "0 0 0px 1000px transparent inset", transition: "background-color 9999s ease-in-out 0s" }}
                className="min-w-0 flex-1 appearance-none border-0 bg-transparent px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none autofill:bg-transparent"
              />
            </div>

            <div className="mt-3 flex items-center gap-1.5 rounded-full bg-black/30 p-1.5">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinWaitlist()}
                placeholder="Your Email Address"
                autoComplete="off"
                style={{ WebkitTextFillColor: "#fff", WebkitBoxShadow: "0 0 0px 1000px transparent inset", transition: "background-color 9999s ease-in-out 0s" }}
                className="min-w-0 flex-1 appearance-none border-0 bg-transparent px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none autofill:bg-transparent"
              />
              <button
                type="button"
                onClick={handleJoinWaitlist}
                disabled={isSubmitting}
                className="shrink-0 rounded-full bg-gradient-to-r from-[#4872ff] via-[#4a5fe0] to-[#6d54eb] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(83,92,255,0.45)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Joining..." : "Join Waitlist"}
              </button>
            </div>

            {statusMessage && (
              <div className={`mt-3 text-center text-xs sm:text-sm ${statusError ? "text-red-400" : "text-emerald-400"}`}>
                {statusMessage}
              </div>
            )}

            <div className="mt-5 text-center text-xs font-medium text-white/50 sm:text-sm">
              30-Day <span className="font-bold text-white/70">FREE</span> Trial
            </div>
          </>
        )}
      </div>
    </div>
  );
}
