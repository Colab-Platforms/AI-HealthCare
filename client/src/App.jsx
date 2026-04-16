import { useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { PedometerProvider } from "./context/PedometerContext";
import Layout from "./components/Layout";
import GenericSkeleton from "./components/skeletons/GenericSkeleton";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import DashboardEnhanced from "./pages/DashboardEnhanced";
import UploadReport from "./pages/UploadReport";
import ReportAnalysisMobile from "./pages/ReportAnalysisMobile";
import Profile from "./pages/Profile";
import DemoPreview from "./pages/DemoPreview";
import AdminDashboard from "./pages/AdminDashboard";
import Subscription from "./pages/Subscription";

import DietPlan from "./pages/DietPlan";
import AIChat from "./pages/AIChat";
import Nutrition from "./pages/Nutrition";
import AllReports from "./pages/AllReports";
import Challenge30Days from "./pages/Challenge30Days";
import DiabetesCare from "./pages/DiabetesCare";
import ReportSummary from "./pages/ReportSummary";
import VitalSigns from "./pages/VitalSigns";
import Supplements from "./pages/Supplements";
import MedicalVault from "./pages/MedicalVault";
import GlucoseLog from "./pages/GlucoseLog";
import LogVitals from "./pages/LogVitals";
import AdminUsers from "./pages/AdminUsers";
import AdminReports from "./pages/AdminReports";
import AdminFoodCache from "./pages/AdminFoodCache";

import StepTracker from "./pages/StepTracker";
import FoodSafety from "./pages/FoodSafety";
import CompleteAnalysis from "./pages/CompleteAnalysis";
import Onboarding from "./pages/Onboarding";
import LandingPage from "./pages/LandingPage";
import HowItWorks from "./pages/HowItWorks";
import TermsAndCondition from "./pages/TermsAndCondition";
// import HealthDNA from './pages/HealthDNA';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) return <GenericSkeleton />;
  if (!user) return <Navigate to="/login" replace />;

  // Check onboarding for regular users
  const hasSeenOnboarding =
    localStorage.getItem("has_seen_onboarding") ||
    user?.profile?.hasSeenMobileTour;
  if (
    user.role === "user" &&
    !hasSeenOnboarding &&
    location.pathname !== "/onboarding"
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  // New users or default 'user' role should be treated as patients/clients
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === "admin" || user.role === "superadmin") {
      if (location.pathname !== "/admin")
        return <Navigate to="/admin" replace />;
    } else {
      if (location.pathname !== "/dashboard")
        return <Navigate to="/dashboard" replace />;
    }
    // If we're already on target path but still failing, let's allow it if it's 'user'
    if (user.role !== "user") return <Navigate to="/login" replace />;
  }

  return children;
};

const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) return <GenericSkeleton />;
  if (!user) return <Navigate to="/login" replace />;

  if (!isAdmin()) {
    if (location.pathname !== "/dashboard")
      return <Navigate to="/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default function App() {
  const { user, isAdmin, isDoctor } = useAuth();

  const getLoginRedirect = () => {
    if (!user) return <Login />;
    if (isAdmin()) return <Navigate to="/admin" />;
    return <Navigate to="/dashboard" />;
  };

  const location = useLocation();
  const navigate = useNavigate();

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
  }, [location.pathname, navigate]);

  console.log("Rendering App", {
    userEmail: user?.email,
    isAuth: !!user,
    path: location.pathname,
  });

  useEffect(() => {
    console.log("📍 Route Changed:", location.pathname);
  }, [location.pathname]);

  return (
    <PedometerProvider>
      <div className="min-h-screen bg-[#F9FCF3]">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={getLoginRedirect()} />
          <Route path="/register" element={<Register />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route
            path="/forgot-password"
            element={user ? <Navigate to="/dashboard" /> : <ForgotPassword />}
          />
          <Route path="/terms-and-conditions" element={<TermsAndCondition />} />

          {/* Patient Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <DashboardEnhanced />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/upload"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <UploadReport />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <AllReports />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/:id"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <ReportAnalysisMobile />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/report/:id"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <ReportAnalysisMobile />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/:id/summary"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <ReportSummary />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/challenge"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <Challenge30Days />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/diabetes"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <DiabetesCare />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/nutrition"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <Nutrition />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/glucose-log"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <GlucoseLog />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/vital-signs"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <VitalSigns />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/medical-vault"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <MedicalVault />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/supplements"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <Supplements />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscription"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <Subscription />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/diet-plan"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <DietPlan />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/complete-analysis"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <CompleteAnalysis />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/log-vitals/:metric"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <LogVitals />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/step-tracker"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <StepTracker />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-chat"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <AIChat />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/food-safety"
            element={
              <ProtectedRoute
                allowedRoles={["user", "patient", "client", "admin", "doctor"]}
              >
                <Layout>
                  <FoodSafety />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Shared Routes */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Layout>
                  <Profile />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Layout isAdmin>
                  <AdminDashboard />
                </Layout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <Layout isAdmin>
                  <AdminUsers />
                </Layout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <AdminRoute>
                <Layout isAdmin>
                  <AdminReports />
                </Layout>
              </AdminRoute>
            }
          />

          <Route
            path="/admin/food-cache"
            element={
              <AdminRoute>
                <Layout isAdmin>
                  <AdminFoodCache />
                </Layout>
              </AdminRoute>
            }
          />

          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />
          <Route path="/demo" element={<DemoPreview />} />
        </Routes>
      </div>
    </PedometerProvider>
  );
}
