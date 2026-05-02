import { useEffect, Suspense, lazy } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import PageLoader from "./components/PageLoader";
import Login from "./pages/Login";
import Register from "./pages/Register";
import LandingPage from "./pages/LandingPage";
import NewLandingPage from "./pages/NewLandingPage";

const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const TermsAndCondition = lazy(() => import("./pages/TermsAndCondition"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const DemoPreview = lazy(() => import("./pages/DemoPreview"));

// Lazy load the PrivateApp which contains all heavy providers and routes
const PrivateApp = lazy(() => import("./PrivateApp"));

export default function App() {
  const { user, isAdmin, isDoctor } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const getLoginRedirect = () => {
    if (!user) return <Login />;
    if (isAdmin()) return <Navigate to="/admin" />;
    return <Navigate to="/dashboard" />;
  };

  // PWA Standalone Redirect Logic
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone ||
      document.referrer.includes("android-app://");

    if (isStandalone && location.pathname === "/") {
      console.log("📱 PWA Standalone detected, redirecting...");
      if (isAdmin()) {
        navigate("/admin", { replace: true });
      } else if (isDoctor()) {
        navigate("/doctor/dashboard", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [location.pathname, navigate, isAdmin, isDoctor]);

  console.log("Rendering App", {
    userEmail: user?.email,
    isAuth: !!user,
    path: location.pathname,
  });

  useEffect(() => {
    console.log("📍 Route Changed:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#F9FCF3]">
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Lightweight Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/new-landing" element={<NewLandingPage />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/login" element={getLoginRedirect()} />
          <Route path="/register" element={<Register />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/terms-and-conditions" element={<TermsAndCondition />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route
            path="/forgot-password"
            element={user ? <Navigate to="/dashboard" /> : <ForgotPassword />}
          />
          <Route path="/demo" element={<DemoPreview />} />

          {/* All other routes go to the heavy PrivateApp */}
          <Route
            path="/*"
            element={
              <Suspense fallback={<PageLoader />}>
                <PrivateApp />
              </Suspense>
            }
          />
        </Routes>
      </Suspense>
    </div>
  );
}
