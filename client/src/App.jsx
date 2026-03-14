import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { PedometerProvider } from './context/PedometerContext';
import Layout from './components/Layout';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import GenericSkeleton from './components/skeletons/GenericSkeleton';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import DashboardEnhanced from './pages/DashboardEnhanced';
import UploadReport from './pages/UploadReport';
import ReportAnalysisMobile from './pages/ReportAnalysisMobile';
import Profile from './pages/Profile';
import DemoPreview from './pages/DemoPreview';
import AdminDashboard from './pages/AdminDashboard';
import Subscription from './pages/Subscription';

import DietPlan from './pages/DietPlan';
import AIChat from './pages/AIChat';
import Nutrition from './pages/Nutrition';
import AllReports from './pages/AllReports';
import Challenge30Days from './pages/Challenge30Days';
import DiabetesCare from './pages/DiabetesCare';
import ReportSummary from './pages/ReportSummary';
import VitalSigns from './pages/VitalSigns';
import Supplements from './pages/Supplements';
import GlucoseLog from './pages/GlucoseLog';
import LogVitals from './pages/LogVitals';
import AdminUsers from './pages/AdminUsers';
import AdminReports from './pages/AdminReports';
import AdminAnalytics from './pages/AdminAnalytics';

import StepTracker from './pages/StepTracker';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <GenericSkeleton />;
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    if (user.role === 'admin') return <Navigate to="/admin" />;
    return <Navigate to="/dashboard" />;
  }
  return children;
};

const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <GenericSkeleton />;
  if (!user) return <Navigate to="/login" />;
  return isAdmin() ? children : <Navigate to="/dashboard" />;
};

export default function App() {
  const { user, isAdmin } = useAuth();

  const getLoginRedirect = () => {
    if (!user) return <Login />;
    if (isAdmin()) return <Navigate to="/admin" />;
    return <Navigate to="/dashboard" />;
  };

  return (
    <PedometerProvider>
      <div className="min-h-screen bg-white">
        <PWAInstallPrompt />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={getLoginRedirect()} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" /> : <ForgotPassword />} />

          {/* Patient Routes */}
          <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><DashboardEnhanced /></Layout></ProtectedRoute>} />
          <Route path="/upload" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><UploadReport /></Layout></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><AllReports /></Layout></ProtectedRoute>} />
          <Route path="/reports/:id" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><ReportAnalysisMobile /></Layout></ProtectedRoute>} />
          <Route path="/reports/:id/summary" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><ReportSummary /></Layout></ProtectedRoute>} />
          <Route path="/challenge" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><Challenge30Days /></Layout></ProtectedRoute>} />
          <Route path="/diabetes" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><DiabetesCare /></Layout></ProtectedRoute>} />
          <Route path="/nutrition" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><Nutrition /></Layout></ProtectedRoute>} />
          <Route path="/glucose-log" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><GlucoseLog /></Layout></ProtectedRoute>} />
          <Route path="/vital-signs" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><VitalSigns /></Layout></ProtectedRoute>} />
          <Route path="/supplements" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><Supplements /></Layout></ProtectedRoute>} />
          <Route path="/subscription" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><Subscription /></Layout></ProtectedRoute>} />
          <Route path="/diet-plan" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><DietPlan /></Layout></ProtectedRoute>} />
          <Route path="/log-vitals/:metric" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><LogVitals /></Layout></ProtectedRoute>} />
          <Route path="/step-tracker" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><StepTracker /></Layout></ProtectedRoute>} />
          <Route path="/ai-chat" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><AIChat /></Layout></ProtectedRoute>} />

          {/* Shared Routes */}
          <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminRoute><Layout isAdmin><AdminDashboard /></Layout></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><Layout isAdmin><AdminUsers /></Layout></AdminRoute>} />
          <Route path="/admin/reports" element={<AdminRoute><Layout isAdmin><AdminReports /></Layout></AdminRoute>} />
          <Route path="/admin/analytics" element={<AdminRoute><Layout isAdmin><AdminAnalytics /></Layout></AdminRoute>} />

          <Route path="/demo" element={<DemoPreview />} />
        </Routes>
      </div>
    </PedometerProvider>
  );
}
