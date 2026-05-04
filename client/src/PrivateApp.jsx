import { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import { PedometerProvider } from "./context/PedometerContext";
import GenericSkeleton from "./components/skeletons/GenericSkeleton";
import PageLoader from "./components/PageLoader";

const Layout = lazy(() => import("./components/Layout"));
const DashboardEnhanced = lazy(() => import("./pages/DashboardEnhanced"));
const UploadReport = lazy(() => import("./pages/UploadReport"));
const ReportAnalysisMobile = lazy(() => import("./pages/ReportAnalysisMobile"));
const Profile = lazy(() => import("./pages/Profile"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Subscription = lazy(() => import("./pages/Subscription"));

const DietPlan = lazy(() => import("./pages/DietPlan"));
const AIChat = lazy(() => import("./pages/AIChat"));
const Nutrition = lazy(() => import("./pages/Nutrition"));
const AllReports = lazy(() => import("./pages/AllReports"));
const Challenge30Days = lazy(() => import("./pages/Challenge30Days"));
const DiabetesCare = lazy(() => import("./pages/DiabetesCare"));
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

const StepTracker = lazy(() => import("./pages/StepTracker"));
const FoodSafety = lazy(() => import("./pages/FoodSafety"));
const CompleteAnalysis = lazy(() => import("./pages/CompleteAnalysis"));
const Onboarding = lazy(() => import("./pages/Onboarding"));

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

export default function PrivateApp() {
    return (
        <DataProvider>
            <PedometerProvider>
                <div className="min-h-screen bg-[#F9FCF3]">
                    <Suspense fallback={<PageLoader />}>
                        <Routes>
                            {/* Patient Routes */}
                            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><DashboardEnhanced /></Layout></ProtectedRoute>} />
                            <Route path="/upload" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><UploadReport /></Layout></ProtectedRoute>} />
                            <Route path="/reports" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><AllReports /></Layout></ProtectedRoute>} />
                            <Route path="/reports/:id" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><ReportAnalysisMobile /></Layout></ProtectedRoute>} />
                            <Route path="/report/:id" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><ReportAnalysisMobile /></Layout></ProtectedRoute>} />
                            <Route path="/reports/:id/summary" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><ReportSummary /></Layout></ProtectedRoute>} />
                            <Route path="/challenge" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><Challenge30Days /></Layout></ProtectedRoute>} />
                            <Route path="/diabetes" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><DiabetesCare /></Layout></ProtectedRoute>} />
                            <Route path="/nutrition" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><Nutrition /></Layout></ProtectedRoute>} />
                            <Route path="/glucose-log" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><GlucoseLog /></Layout></ProtectedRoute>} />
                            <Route path="/vital-signs" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><VitalSigns /></Layout></ProtectedRoute>} />
                            <Route path="/medical-vault" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><MedicalVault /></Layout></ProtectedRoute>} />
                            <Route path="/supplements" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><Supplements /></Layout></ProtectedRoute>} />
                            <Route path="/subscription" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><Subscription /></Layout></ProtectedRoute>} />
                            <Route path="/diet-plan" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><DietPlan /></Layout></ProtectedRoute>} />
                            <Route path="/complete-analysis" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><CompleteAnalysis /></Layout></ProtectedRoute>} />
                            <Route path="/log-vitals/:metric" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><LogVitals /></Layout></ProtectedRoute>} />
                            <Route path="/step-tracker" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><StepTracker /></Layout></ProtectedRoute>} />
                            <Route path="/ai-chat" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><AIChat /></Layout></ProtectedRoute>} />
                            <Route path="/food-safety" element={<ProtectedRoute allowedRoles={["user", "patient", "client", "admin", "doctor"]}><Layout><FoodSafety /></Layout></ProtectedRoute>} />

                            {/* Shared Routes */}
                            <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />

                            {/* Admin Routes */}
                            <Route path="/admin" element={<AdminRoute><Layout isAdmin><AdminDashboard /></Layout></AdminRoute>} />
                            <Route path="/admin/users" element={<AdminRoute><Layout isAdmin><AdminUsers /></Layout></AdminRoute>} />
                            <Route path="/admin/reports" element={<AdminRoute><Layout isAdmin><AdminReports /></Layout></AdminRoute>} />
                            <Route path="/admin/food-cache" element={<AdminRoute><Layout isAdmin><AdminFoodCache /></Layout></AdminRoute>} />
                            <Route path="/admin/activity" element={<AdminRoute><Layout isAdmin><AdminActivity /></Layout></AdminRoute>} />
                            <Route path="/admin/support" element={<AdminRoute><Layout isAdmin><AdminSupport /></Layout></AdminRoute>} />

                            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                        </Routes>
                    </Suspense>
                </div>
            </PedometerProvider>
        </DataProvider>
    );
}
