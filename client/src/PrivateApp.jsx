import { Suspense, lazy, useState, useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { PedometerProvider } from "./context/PedometerContext";
import GenericSkeleton from "./components/skeletons/GenericSkeleton";
import PageLoader from "./components/PageLoader";
import NotFound from "./pages/NotFound";
import ConsentModal from "./components/ConsentModal";

const Layout = lazy(() => import("./components/Layout"));
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const TakeAdminLayout = lazy(() => import("./components/admin/TakeAdminLayout"));
const TakeAdminDashboard = lazy(() => import("./pages/takeadmin/TakeAdminDashboard"));
const TakeAdminRegional = lazy(() => import("./pages/takeadmin/TakeAdminRegional"));
const TakeAdminBehaviour = lazy(() => import("./pages/takeadmin/TakeAdminBehaviour"));
const TakeAdminFeatures = lazy(() => import("./pages/takeadmin/TakeAdminFeatures"));
const TakeAdminMarketing = lazy(() => import("./pages/takeadmin/TakeAdminMarketing"));
const MyRequests = lazy(() => import("./pages/adminshared/MyRequests"));
const MyActivity = lazy(() => import("./pages/adminshared/MyActivity"));
const DashboardEnhanced = lazy(() => import("./pages/DashboardEnhanced"));
const UploadReport = lazy(() => import("./pages/UploadReport"));
const ReportAnalysisMobile = lazy(() => import("./pages/ReportAnalysisMobile"));
const Profile = lazy(() => import("./pages/Profile"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Subscription = lazy(() => import("./pages/Subscription"));
// const Shop = lazy(() => import("./pages/Shop"));

const DietPlan = lazy(() => import("./pages/DietPlan"));
const AIChat = lazy(() => import("./pages/AIChat"));
const Nutrition = lazy(() => import("./pages/Nutrition"));
const Fitness = lazy(() => import("./pages/Fitness"));
const AllReports = lazy(() => import("./pages/AllReports"));
const Challenge30Days = lazy(() => import("./pages/Challenge30Days"));

const ReportSummary = lazy(() => import("./pages/ReportSummary"));
const VitalSigns = lazy(() => import("./pages/VitalSigns"));
const Supplements = lazy(() => import("./pages/Supplements"));
const MedicalVault = lazy(() => import("./pages/MedicalVault"));
const GlucoseLog = lazy(() => import("./pages/GlucoseLog"));
const LogVitals = lazy(() => import("./pages/LogVitals"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminFoodCache = lazy(() => import("./pages/AdminFoodCache"));
const AdminActivity = lazy(() => import("./pages/UserActivity"));
const AdminSupport = lazy(() => import("./pages/AdminSupport"));
const AdminAIUsage = lazy(() => import("./pages/AdminAIUsage"));
const AdminCreatorApplications = lazy(() => import("./pages/AdminCreatorApplications"));
const AdminAppVersion = lazy(() => import("./pages/AdminAppVersion"));
const AdminShop = lazy(() => import("./pages/AdminShop"));
const AdminShopOrder = lazy(() => import("./pages/AdminShopOrder"));
const AdminShopCustomer = lazy(() => import("./pages/AdminShopCustomer"));
// const AdminSubscriptions = lazy(() => import("./pages/AdminSubscriptions"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const PrivacySettings = lazy(() => import("./pages/PrivacySettings"));
const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));

const StepTracker = lazy(() => import("./pages/StepTracker"));
const SmokeTracker = lazy(() => import("./pages/SmokeTracker"));
const AlcoholTracker = lazy(() => import("./pages/AlcoholTracker"));
const FoodSafety = lazy(() => import("./pages/FoodSafety"));
const CompleteAnalysis = lazy(() => import("./pages/CompleteAnalysis"));
const Onboarding = lazy(() => import("./pages/Onboarding"));

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) return <GenericSkeleton />;
  // Preserve where they were headed (e.g. a "Cancel Deletion" email link to
  // /privacy-settings) so Login can send them back here instead of always
  // dropping them on /dashboard after signing in.
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;

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
  if (!user) return <Navigate to="/waitlist" replace />;

  if (!isAdmin()) {
    if (location.pathname !== "/dashboard")
      return <Navigate to="/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Role-based gate for the three-level admin panels. The server enforces permissions too;
// this only keeps people out of screens that are not theirs.
const RoleRoute = ({ roles, children }) => {
  const { user, loading, hasRole } = useAuth();
  if (loading) return <GenericSkeleton />;
  if (!user) return <Navigate to="/waitlist" replace />;
  if (!hasRole(...roles)) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  }
  return children;
};

// Keep in sync with CONSENT_VERSION in server/controllers/privacyController.js
const CONSENT_VERSION = '1.0';

function ConsentGate({ children }) {
  const { user, refreshUser } = useAuth();
  const [needsConsent, setNeedsConsent] = useState(false);

  useEffect(() => {
    // Show consent modal if user hasn't consented yet, or consented to an older policy version
    if (user && (!user.consent?.given || user.consent?.version !== CONSENT_VERSION)) {
      setNeedsConsent(true);
    }
  }, [user]);

  const handleAccept = async () => {
    // Pull the fresh consent record from the backend into context + localStorage,
    // otherwise a page refresh reads the stale pre-consent snapshot and re-shows this modal.
    await refreshUser();
    setNeedsConsent(false);
  };

  if (needsConsent) {
    return <ConsentModal onAccept={handleAccept} />;
  }
  return children;
}

export default function PrivateApp() {
  // DataProvider is deliberately NOT re-declared here. main.jsx already wraps
  // the whole app in one, and mounting a second created two independent
  // instances: two sets of state, two subscriptions, and every fetch issued
  // twice — including the score refetch after a log. Components here use the
  // outer provider, which sits inside AuthProvider just the same.
  return (
    <>
      <PedometerProvider>
        <ConsentGate>
        <div className="min-h-screen bg-[#F9FCF3]">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Patient Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
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
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
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
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
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
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
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
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
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
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
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
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
                  >
                    <Layout>
                      <Challenge30Days />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/nutrition"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
                  >
                    <Layout>
                      <Nutrition />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/fitness"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
                  >
                    <Layout>
                      <Fitness />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/glucose-log"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
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
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
                  >
                    <Layout>
                      <VitalSigns />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/medical-vault/*"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
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
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
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
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
                  >
                    <Layout>
                      <Subscription />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              {/* <Route
                path="/shop"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
                  >
                    <Layout>
                      <Shop />
                    </Layout>
                  </ProtectedRoute>
                }
              /> */}
              <Route
                path="/diet-plan"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
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
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
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
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
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
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
                  >
                    <Layout>
                      <StepTracker />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/smoke-tracker"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
                  >
                    <Layout>
                      <SmokeTracker />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/alcohol-tracker"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
                  >
                    <Layout>
                      <AlcoholTracker />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ai-chat"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
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
                    allowedRoles={[
                      "user",
                      "patient",
                      "client",
                      "admin",
                      "doctor",
                      "superadmin",
                    ]}
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
              
              <Route
                path="/notification-settings"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <NotificationSettings />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/privacy-settings"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <PrivacySettings />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/delete-account"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <DeleteAccount />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Take Admin Routes */}
              <Route
                path="/take-admin"
                element={
                  <RoleRoute roles={["takeadmin", "superadmin"]}>
                    <TakeAdminLayout>
                      <TakeAdminDashboard />
                    </TakeAdminLayout>
                  </RoleRoute>
                }
              />
              <Route
                path="/take-admin/regional"
                element={
                  <RoleRoute roles={["takeadmin", "superadmin"]}>
                    <TakeAdminLayout>
                      <TakeAdminRegional />
                    </TakeAdminLayout>
                  </RoleRoute>
                }
              />
              <Route
                path="/take-admin/behaviour"
                element={
                  <RoleRoute roles={["takeadmin", "superadmin"]}>
                    <TakeAdminLayout>
                      <TakeAdminBehaviour />
                    </TakeAdminLayout>
                  </RoleRoute>
                }
              />
              <Route
                path="/take-admin/features"
                element={
                  <RoleRoute roles={["takeadmin", "superadmin"]}>
                    <TakeAdminLayout>
                      <TakeAdminFeatures />
                    </TakeAdminLayout>
                  </RoleRoute>
                }
              />
              <Route
                path="/take-admin/marketing"
                element={
                  <RoleRoute roles={["takeadmin", "superadmin"]}>
                    <TakeAdminLayout>
                      <TakeAdminMarketing />
                    </TakeAdminLayout>
                  </RoleRoute>
                }
              />
              <Route
                path="/take-admin/requests"
                element={
                  <RoleRoute roles={["takeadmin", "superadmin"]}>
                    <TakeAdminLayout>
                      <MyRequests />
                    </TakeAdminLayout>
                  </RoleRoute>
                }
              />
              <Route
                path="/take-admin/activity"
                element={
                  <RoleRoute roles={["takeadmin", "superadmin"]}>
                    <TakeAdminLayout>
                      <MyActivity />
                    </TakeAdminLayout>
                  </RoleRoute>
                }
              />

              {/* Admin Routes */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminLayout>
                      <AdminDashboard />
                    </AdminLayout>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <AdminRoute>
                    <AdminLayout>
                      <AdminUsers />
                    </AdminLayout>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/reports"
                element={
                  <AdminRoute>
                    <AdminLayout>
                      <AdminReports />
                    </AdminLayout>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/food-cache"
                element={
                  <AdminRoute>
                    <AdminLayout>
                      <AdminFoodCache />
                    </AdminLayout>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/activity"
                element={
                  <AdminRoute>
                    <AdminLayout>
                      <AdminActivity />
                    </AdminLayout>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/support"
                element={
                  <AdminRoute>
                    <AdminLayout>
                      <AdminSupport />
                    </AdminLayout>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/app-version"
                element={
                  <AdminRoute>
                    <AdminLayout>
                      <AdminAppVersion />
                    </AdminLayout>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/shop"
                element={
                  <AdminRoute>
                    <AdminLayout>
                      <AdminShop />
                    </AdminLayout>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/shop/orders/:orderId"
                element={
                  <AdminRoute>
                    <AdminLayout>
                      <AdminShopOrder />
                    </AdminLayout>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/shop/customers/:userId"
                element={
                  <AdminRoute>
                    <AdminLayout>
                      <AdminShopCustomer />
                    </AdminLayout>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/ai-usage"
                element={
                  <AdminRoute>
                    <AdminLayout>
                      <AdminAIUsage />
                    </AdminLayout>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/creator-applications"
                element={
                  <AdminRoute>
                    <AdminLayout>
                      <AdminCreatorApplications />
                    </AdminLayout>
                  </AdminRoute>
                }
              />
              {/* <Route
                path="/admin/subscriptions"
                element={
                  <AdminRoute>
                    <AdminLayout>
                      <AdminSubscriptions />
                    </AdminLayout>
                  </AdminRoute>
                }
              /> */}

              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <Onboarding />
                  </ProtectedRoute>
                }
              />

              {/* 404 Not Found - Catch all unmatched routes */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
        </ConsentGate>
      </PedometerProvider>
    </>
  );
}
