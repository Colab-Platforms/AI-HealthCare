import { useEffect, useRef, useState } from "react";

const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadGsiScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  const existing = document.querySelector(`script[src="${GSI_SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve) => existing.addEventListener("load", resolve, { once: true }));
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// A fully custom-styled "Continue with Google" button matching the app's
// theme. Google's own renderButton() draws into a cross-origin iframe that
// can't be restyled (fixed font/border/radius) — so instead we use the
// OAuth2 token-client popup (google.accounts.oauth2), which just needs a
// normal button click to open Google's consent popup and hands back an
// access token we verify server-side.
export default function GoogleSignInButton({ onAccessToken, label = "Continue with Google" }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const tokenClientRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    loadGsiScript()
      .then(() => {
        if (cancelled) return;
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "openid email profile",
          callback: (response) => {
            if (response.access_token) onAccessToken(response.access_token);
          },
        });
        setReady(true);
      })
      .catch((err) => console.error("Failed to load Google Sign-In:", err));

    return () => {
      cancelled = true;
    };
  }, [clientId, onAccessToken]);

  if (!clientId) return null;

  return (
    <button
      type="button"
      disabled={!ready}
      onClick={() => tokenClientRef.current?.requestAccessToken()}
      className="w-full flex items-center justify-center gap-2.5 bg-white border border-gray-200 rounded-xl py-2.5 px-4 font-medium text-gray-600 text-[13.5px] tracking-normal normal-case shadow-sm hover:shadow-md hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.27-2.09 3.59-5.17 3.59-8.81z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.87-3c-1.08.72-2.45 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.96H1.26v3.11A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.25 14.27a7.2 7.2 0 0 1 0-4.54V6.62H1.26a12 12 0 0 0 0 10.76l3.99-3.11z" />
        <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.62l3.99 3.11C6.2 6.89 8.86 4.77 12 4.77z" />
      </svg>
      {label}
    </button>
  );
}
