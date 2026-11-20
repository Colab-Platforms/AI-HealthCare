// Routes anyone can open without logging in. Shared by App.jsx (HelpWidget
// visibility) and api.js (an expired session on these pages must not bounce
// the visitor to /login). Keep in sync with the public <Route>s in App.jsx.
export const PUBLIC_PATHS = [
  "/",
  "/updated-landing",
  "/diabetes-landing",
  "/weight-loss",
  "/old-landing",
  "/about",
  "/login",
  "/register",
  "/waitlist",
  "/how-it-works",
  "/terms-and-conditions",
  "/privacy-policy",
  "/pages/manufacturers-details",
  "/forgot-password",
  "/delete-account",
  "/support",
  "/demo",
  "/creator",
];

// "/" matches only itself; every other entry also covers its sub-paths
// (e.g. /waitlist/join).
export const isPublicPath = (pathname) =>
  PUBLIC_PATHS.some((p) => pathname === p || (p !== "/" && pathname.startsWith(p + "/")));
