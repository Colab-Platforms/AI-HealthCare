import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { creatorService } from "../services/api";

const CONTENT_CATEGORIES = [
  "Health Tech",
  "Consumer Tech",
  "Athlete",
  "Medical Professional",
  "Others"
];

const AGREEMENT_TEXT = `TAKE CREATOR PROGRAM AGREEMENT
Version 2026-07-17

This Creator Program Agreement ("Agreement") is entered into between TAKE Health ("TAKE," "we," "us") and the individual applying to the TAKE Creator Program ("Creator," "you"). By signing below, you agree to the following terms.

1. PROGRAM OVERVIEW
TAKE operates a creator program in which approved creators produce short-form video content about TAKE at-home blood testing service. TAKE may license, whitelist, and promote this content as paid advertising across platforms including Meta, YouTube, and X.

2. CONTENT REQUIREMENTS
Creators accepted into the program commit to posting at least 3 UGC (user-generated content) videos per month talking about their experience with TAKE. Content must be original, honest, and comply with all applicable advertising and endorsement guidelines.

3. PRODUCT & COMPENSATION
TAKE will ship one at-home testing kit to the address provided above at no cost to the Creator, in exchange for the content and usage rights described in this Agreement. Any additional compensation, if applicable, will be communicated separately in writing.

4. USAGE RIGHTS
By submitting content as part of this program, Creator grants TAKE a non-exclusive, worldwide, royalty-free license to use, reproduce, whitelist, and promote the content across TAKE's owned and paid channels.

5. TERM & TERMINATION
Either party may terminate this Agreement at any time with written notice. TAKE reserves the right to remove any Creator from the program for failure to meet content requirements or violation of platform guidelines.

By typing your full legal name below, you acknowledge that you have read, understood, and agree to be bound by this Agreement.`;

const sectionHeadingStyle = {
  color: "#242628",
  fontFamily: '"Founders Grotesk", "Founders-Grotesk", "Space Grotesk", sans-serif',
  fontSize: "32px",
  fontWeight: 400,
  lineHeight: "26.25px",
  letterSpacing: "-0.4px",
};

const inputClasses =
  "w-full rounded-[6px] border border-[#D3DAD5] bg-[#F6F6F6] px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900";

const Field = ({ label, hint, required, children }) => (
  <div>
    <label className="mb-1 block text-sm font-medium text-gray-900">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {hint && <p className="mb-1.5 text-xs text-gray-500">{hint}</p>}
    {children}
  </div>
);

const YesNoToggle = ({ value, onChange, containerRef }) => (
  <div ref={containerRef} className="grid grid-cols-2 gap-2">
    {["yes", "no"].map((option) => (
      <button
        key={option}
        type="button"
        onClick={() => onChange(option)}
        className={`rounded-md border px-4 py-2.5 text-sm font-medium capitalize transition ${
          value === option
            ? "border-gray-900 bg-gray-900 text-white"
            : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
        }`}
      >
        {option}
      </button>
    ))}
  </div>
);

export default function CreatorApply() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    aptSuite: "",
    instagramLink: "",
    youtubeLink: "",
    twitterLink: "",
    bestVideoLink: "",
    whyCreator: "",
    instagramIsCreatorAccount: "",
    canPostThreePerMonth: "",
    followerCount: "",
    contentCategory: "",
    signature: "",
    agreedToAgreement: false,
    wantsUpdates: false,
    agreedToPolicies: false,
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const addressRef = useRef(null);
  const bestVideoLinkRef = useRef(null);
  const whyCreatorRef = useRef(null);
  const instagramToggleRef = useRef(null);
  const canPostToggleRef = useRef(null);
  const followerCountRef = useRef(null);
  const signatureRef = useRef(null);
  const agreedToAgreementRef = useRef(null);
  const agreedToPoliciesRef = useRef(null);

  useEffect(() => {
    document.title = "Apply to the Creator Program | TAKE Health";
  }, []);

  const focusInvalidField = (ref) => {
    const el = ref?.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (typeof el.focus === "function") {
      // Wait for the smooth scroll to land before focusing, otherwise the
      // browser jumps straight to the field and the scroll never animates.
      window.setTimeout(() => el.focus({ preventScroll: true }), 300);
    }
  };

  const update = (field) => (e) => {
    const value =
      e && e.target
        ? e.target.type === "checkbox"
          ? e.target.checked
          : e.target.value
        : e;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError("");

    const fieldValidations = [
      { valid: !!form.name.trim(), message: "Please enter your name.", ref: nameRef },
      { valid: !!form.email.trim(), message: "Please enter your email address.", ref: emailRef },
      {
        valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()),
        message: "Please enter a valid email address.",
        ref: emailRef,
      },
      { valid: !!form.phone.trim(), message: "Please enter your phone number.", ref: phoneRef },
      { valid: !!form.address.trim(), message: "Please enter your address.", ref: addressRef },
      {
        valid: !!form.bestVideoLink.trim(),
        message: "Please add a link to your best performing video.",
        ref: bestVideoLinkRef,
      },
      {
        valid: !!form.whyCreator.trim(),
        message: "Please tell us why you want to be a TAKE creator.",
        ref: whyCreatorRef,
      },
      {
        valid: !!form.instagramIsCreatorAccount,
        message: "Please answer whether your Instagram is a creator or business account.",
        ref: instagramToggleRef,
      },
      {
        valid: !!form.canPostThreePerMonth,
        message: "Please answer whether you can post 3 UGC videos per month.",
        ref: canPostToggleRef,
      },
      {
        valid: !!form.followerCount && !Number.isNaN(Number(form.followerCount)),
        message: "Please enter your follower count as a number.",
        ref: followerCountRef,
      },
      // Signature/agreement/policy consent checks disabled for now — sections are commented out above.
    ];

    const firstInvalid = fieldValidations.find((field) => !field.valid);
    if (firstInvalid) {
      setError(firstInvalid.message);
      focusInvalidField(firstInvalid.ref);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await creatorService.apply({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        aptSuite: form.aptSuite.trim(),
        instagramLink: form.instagramLink.trim(),
        youtubeLink: form.youtubeLink.trim(),
        twitterLink: form.twitterLink.trim(),
        bestVideoLink: form.bestVideoLink.trim(),
        whyCreator: form.whyCreator.trim(),
        instagramIsCreatorAccount: form.instagramIsCreatorAccount,
        canPostThreePerMonth: form.canPostThreePerMonth,
        followerCount: Number(form.followerCount),
        contentCategory: form.contentCategory,
        signature: form.signature.trim(),
        agreedToAgreement: form.agreedToAgreement,
        wantsUpdates: form.wantsUpdates,
        agreedToPolicies: form.agreedToPolicies,
      });

      if (response.status === 201) {
        setSubmitted(true);
      } else {
        setError(response.data?.message || "Something went wrong. Please try again.");
      }
    } catch (err) {
      if (!err.response) {
        setError("Network error. Please check your connection and try again.");
      } else if (err.response.status === 429) {
        setError("Too many attempts. Please wait a few minutes and try again.");
      } else {
        setError(err.response.data?.message || "Something went wrong. Please try again later.");
      }
      console.error("Creator application submit error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="max-w-md text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-900/5 text-3xl">
            🎉
          </span>
          <h1 className="mt-5 text-2xl font-bold text-gray-900">Application submitted</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            Thanks for applying to the TAKE Creator Program. We review every application by hand
             you'll hear from us by email either way.
          </p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div
        className="relative flex w-full items-center justify-center overflow-hidden bg-black px-4 text-center"
        style={{
          aspectRatio: "1938 / 781",
          minHeight: "340px",
          maxHeight: "781px",
          backgroundImage: "url('/creator/creator_bg.gif')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="relative z-10 max-w-2xl">
          <span
            className="inline-block rounded-full bg-white/10 px-4 py-1.5 uppercase text-white backdrop-blur-sm"
            style={{
              fontFamily: '"Neue Montreal", "PP Neue Montreal", sans-serif',
              fontSize: "15px",
              fontWeight: 400,
              lineHeight: "122%",
              letterSpacing: "1px",
            }}
          >
            No minimum follower requirement
          </span>
          <h1
            className="mt-5 text-center text-white"
            style={{
              fontFamily: '"ABC Diatype Expanded Unlicensed Trial", "Syne", "Space Grotesk", sans-serif',
              fontSize: "clamp(32px, 6vw, 60px)", 
              fontWeight: 500,
              lineHeight: "122%",
            }}
          >
            Create Content.
            <br />
            Shape Better Health.
          </h1>
          <p
            className="mx-auto mt-4 max-w-[620px]"
            style={{
              color: "#F6F6F6",
              fontFamily: '"Founders Grotesk", "Founders-Grotesk", "Space Grotesk", sans-serif',
              fontSize: "clamp(18px, 3vw, 24px)",
              fontWeight: 400,
              lineHeight: "122%",
            }}
          >
            Join the Take Creator Program and turn your creativity into content that helps
            people understand their health, habits and everyday wellbeing better.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto flex max-w-[1406px] flex-col items-start justify-between gap-60 px-5 py-12 sm:px-8 md:flex-row md:py-16">
        <div className="w-full shrink-0 md:w-[470px]">
          <h2
            style={{
              color: "#242628",
              fontFamily: '"ABC Diatype Expanded Unlicensed Trial", "Syne", "Space Grotesk", sans-serif',
              fontSize: "clamp(32px, 5vw, 56px)",
              fontWeight: 500,
              lineHeight: "120%",
              letterSpacing: "-1.6px",
            }}
          >
            Apply to the Creator Program
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Takes about two minutes. <span className="font-semibold text-gray-700">No minimum follower requirement.</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-10 md:max-w-[838px]">
          {/* About you */}
          <section className="flex flex-col gap-5">
            <h3 className="border-b border-gray-200 pb-3" style={sectionHeadingStyle}>
              About you
            </h3>
            <Field label="Name" required>
              <input ref={nameRef} type="text" value={form.name} onChange={update("name")} placeholder="Your full name" className={inputClasses} />
            </Field>
            <Field label="Email" required>
              <input ref={emailRef} type="email" value={form.email} onChange={update("email")} placeholder="you@example.com" className={inputClasses} />
            </Field>
            <Field label="Phone number" required>
              <input ref={phoneRef} type="tel" value={form.phone} onChange={update("phone")} placeholder="+1 (555) 555-5555" className={inputClasses} />
            </Field>
            <Field label="Address" required hint="We'll send your first kit here. We can currently only accept creators based in the Mumbai.">
              <input ref={addressRef} type="text" value={form.address} onChange={update("address")} placeholder="Street, city, state, ZIP" className={inputClasses} />
            </Field>
            <Field label="Apt, suite, unit" hint="(optional)">
              <input type="text" value={form.aptSuite} onChange={update("aptSuite")} placeholder="Apt 4B" className={inputClasses} />
            </Field>
          </section>

          {/* Your channels */}
          <section className="flex flex-col gap-5">
            <div className="border-b border-gray-200 pb-3">
              <h3 style={sectionHeadingStyle}>Your channels</h3>
              <p className="mt-1 text-sm text-gray-500">It's okay if you don't have accounts on every platform. Link what you have.</p>
            </div>
            <Field label="Instagram link">
              <input type="text" value={form.instagramLink} onChange={update("instagramLink")} placeholder="instagram.com/yourhandle" className={inputClasses} />
            </Field>
            <Field label="YouTube link">
              <input type="text" value={form.youtubeLink} onChange={update("youtubeLink")} placeholder="youtube.com/@yourchannel" className={inputClasses} />
            </Field>
            <Field label="Twitter/ X link">
              <input type="text" value={form.twitterLink} onChange={update("twitterLink")} placeholder="x.com/yourhandle" className={inputClasses} />
            </Field>
          </section>

          {/* Your content */}
          <section className="flex flex-col gap-5">
            <h3 className="border-b border-gray-200 pb-3" style={sectionHeadingStyle}>
              Your content
            </h3>
            <Field label="Add a link to your best performing video talking to camera" required hint="Any platform. Show us what you're proud of.">
              <input ref={bestVideoLinkRef} type="text" value={form.bestVideoLink} onChange={update("bestVideoLink")} placeholder="Link to the video" className={inputClasses} />
            </Field>
            <Field label="Why do you want to be a TAKE creator?" required>
              <textarea ref={whyCreatorRef} value={form.whyCreator} onChange={update("whyCreator")} placeholder="A few sentences is plenty." rows={4} className={`${inputClasses} resize-none`} />
            </Field>
            <Field label="Is your Instagram a creator or business account?" required hint="We need one of those to set up whitelisting.">
              <YesNoToggle containerRef={instagramToggleRef} value={form.instagramIsCreatorAccount} onChange={update("instagramIsCreatorAccount")} />
            </Field>
            <Field label="Can you post at least 3 UGC videos per month?" required hint="That's our minimum for active creators.">
              <YesNoToggle containerRef={canPostToggleRef} value={form.canPostThreePerMonth} onChange={update("canPostThreePerMonth")} />
            </Field>
            <Field label="Follower count (enter a number)" required hint="On your largest platform.">
              <input ref={followerCountRef} type="number" min="0" value={form.followerCount} onChange={update("followerCount")} placeholder="25000" className={inputClasses} />
            </Field>
            <Field label="Do you make content about any of the following?" hint="(optional) If so, pick the one that best fits.">
              <select value={form.contentCategory} onChange={update("contentCategory")} className={inputClasses}>
                <option value="">Select an option</option>
                {CONTENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </Field>
          </section>

          {/* Agreement */}
          {/*
          <section className="flex flex-col gap-4">
            <h3 className="border-b border-gray-200 pb-3 text-xl font-semibold text-gray-900">Creator Program Agreement</h3>
            <div className="max-h-56 overflow-y-auto whitespace-pre-line rounded-md border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-600">
              {AGREEMENT_TEXT}
            </div>
            <Field label="Signature: type your full legal name" required>
              <input ref={signatureRef} type="text" value={form.signature} onChange={update("signature")} placeholder="Your full legal name" className={inputClasses} />
            </Field>
            <label className="flex items-start gap-2.5 text-sm text-gray-600">
              <input ref={agreedToAgreementRef} type="checkbox" checked={form.agreedToAgreement} onChange={update("agreedToAgreement")} className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300" />
              <span>
                I have read and agree to the TAKE Creator Program Agreement.
                <span className="block text-xs text-gray-400">
                  I understand that typing my name above constitutes a legally binding electronic signature under the ESIGN Act and UETA.
                </span>
              </span>
            </label>
          </section>
          */}

          {/* Application updates */}
          {/*
          <section className="flex flex-col gap-3">
            <h3 className="border-b border-gray-200 pb-3 text-xl font-semibold text-gray-900">Application updates</h3>
            <label className="flex items-start gap-2.5 text-sm text-gray-600">
              <input type="checkbox" checked={form.wantsUpdates} onChange={update("wantsUpdates")} className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300" />
              <span>
                Text me updates about my application.
                <span className="block text-xs text-gray-400">
                  By checking this box, I consent to receive text messages from TAKE Health about my creator application and program updates at the phone number provided. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. See our{" "}
                  <Link to="/privacy-policy" className="underline hover:text-gray-600">privacy policy</Link>.
                </span>
              </span>
            </label>
          </section>
          */}

          {/* Policy consent */}
          {/*
          <section className="flex flex-col gap-3">
            <h3 className="text-xl font-semibold text-gray-900">Policy consent</h3>
            <label className="flex items-start gap-2.5 text-sm text-gray-600">
              <input ref={agreedToPoliciesRef} type="checkbox" checked={form.agreedToPolicies} onChange={update("agreedToPolicies")} className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300" required />
              <span>
                I agree to the{" "}
                <Link to="/terms-and-conditions" className="underline hover:text-gray-600">Terms of Service</Link>, Refund Policy,{" "}
                <Link to="/privacy-policy" className="underline hover:text-gray-600">Privacy Policy</Link>, Consumer Health Data Privacy Policy, and Physician Consent. <span className="text-red-500">*</span>
                <span className="block text-xs text-gray-400">We need this consent in order to ship your free product to you and feature in your content.</span>
              </span>
            </label>
          </section>
          */}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-[#4338ca] py-3.5 text-sm font-semibold text-white transition hover:bg-[#3730a3] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Submitting..." : "Submit application"}
          </button>
          <p className="-mt-6 text-center text-xs text-gray-400">
            We review every application by hand. You'll hear from us by email either way.
          </p>
        </form>
      </div>
    </div>
  );
}
