import { useEffect, useState } from "react";

const APPLE_SDK_SRC = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

function loadAppleSdk() {
  if (window.AppleID?.auth) return Promise.resolve();
  const existing = document.querySelector(`script[src="${APPLE_SDK_SRC}"]`);
  if (existing) {
    return new Promise((resolve) => existing.addEventListener("load", resolve, { once: true }));
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = APPLE_SDK_SRC;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Mirrors GoogleSignInButton.jsx: a custom-styled button that drives Apple's
// JS SDK popup (AppleID.auth.signIn()) directly instead of Apple's own
// rendered button, and hands the resulting identity token (+ the one-time
// name payload, if present) to the caller for server-side verification.
export default function AppleSignInButton({ onIdentityToken, label = "Continue with Apple" }) {
  const clientId = import.meta.env.VITE_APPLE_CLIENT_ID;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    loadAppleSdk()
      .then(() => {
        if (cancelled) return;
        window.AppleID.auth.init({
          clientId,
          scope: "name email",
          redirectURI: window.location.origin,
          usePopup: true,
        });
        setReady(true);
      })
      .catch((err) => console.error("Failed to load Sign in with Apple:", err));

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId) return null;

  const handleClick = async () => {
    try {
      const response = await window.AppleID.auth.signIn();
      if (response?.authorization?.id_token) {
        onIdentityToken(response.authorization.id_token, response.user);
      }
    } catch (err) {
      // User closing the popup surfaces as an error too — not worth logging.
      if (err?.error !== "popup_closed_by_user") console.error("Apple sign-in failed:", err);
    }
  };

  return (
    <button
      type="button"
      disabled={!ready}
      onClick={handleClick}
      className="w-full flex items-center justify-center gap-2.5 bg-white border border-gray-200 rounded-xl py-2.5 px-4 font-medium text-gray-600 text-[13.5px] tracking-normal normal-case shadow-sm hover:shadow-md hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="#000">
        <path d="M16.365 1.43c0 1.14-.393 2.064-1.18 2.773-.8.702-1.732 1.1-2.795 1.02-.05-1.084.373-2.014 1.16-2.734.8-.72 1.755-1.14 2.815-1.06zm3.61 16.71c-.6 1.11-1.313 2.15-2.152 3.13-.87.997-1.762 1.49-2.673 1.457-.66-.02-1.318-.204-1.955-.55a4.42 4.42 0 0 0-1.955-.55c-.68 0-1.365.19-2.06.55-.68.35-1.31.53-1.89.55-.87.03-1.75-.46-2.622-1.457-.83-.98-1.523-2.02-2.13-3.13-.97-1.78-1.457-3.526-1.457-5.237 0-1.937.5-3.51 1.5-4.72.78-.94 1.79-1.41 3.03-1.41.75 0 1.5.19 2.24.57.55.28 1.02.42 1.4.42.28 0 .72-.14 1.32-.42.85-.4 1.66-.6 2.42-.57 1.55.06 2.72.65 3.51 1.77-1.39.85-2.08 2.04-2.08 3.58 0 1.16.4 2.14 1.2 2.93.42.42.9.75 1.44.98-.13.4-.27.78-.42 1.15z"/>
      </svg>
      {label}
    </button>
  );
}
