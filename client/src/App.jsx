import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import GenericSkeleton from './components/skeletons/GenericSkeleton';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import DiabetesRegister from './pages/DiabetesRegister';
import DoctorRegister from './pages/DoctorRegister';
import Dashboard from './pages/Dashboard';
import DashboardEnhanced from './pages/DashboardEnhanced';
import DoctorDashboard from './pages/DoctorDashboard';
import UploadReport from './pages/UploadReport';
import ReportDetails from './pages/ReportDetails';
import Doctors from './pages/Doctors';
import Profile from './pages/Profile';
import ProfileModern from './pages/ProfileModern';
import DemoPreview from './pages/DemoPreview';
import AdminDashboard from './pages/AdminDashboard';
import Subscription from './pages/Subscription';
import Wearables from './pages/Wearables';
import PatientProfile from './pages/PatientProfile';
import Consultation from './pages/Consultation';
import ConsultationSummary from './pages/ConsultationSummary';
import VideoTest from './pages/VideoTest';
import EmailTest from './pages/EmailTest';
import DoctorAvailability from './pages/DoctorAvailability';
import DietPlan from './pages/DietPlan';
import AIChat from './pages/AIChat';
import Nutrition from './pages/Nutrition';
import AllReports from './pages/AllReports';
import Challenge30Days from './pages/Challenge30Days';
import ReportSummary from './pages/ReportSummary';
import VitalSigns from './pages/VitalSigns';
import Supplements from './pages/Supplements';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <GenericSkeleton />;
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    if (user.role === 'admin') return <Navigate to="/admin" />;
    if (user.role === 'doctor') return <Navigate to="/doctor/dashboard" />;
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

const DoctorRoute = ({ children }) => {
  const { user, loading, isDoctor } = useAuth();
  if (loading) return <GenericSkeleton />;
  if (!user) return <Navigate to="/login" />;
  return isDoctor() ? children : <Navigate to="/dashboard" />;
};

export default function App() {
  const { user, isAdmin, isDoctor } = useAuth();

  const getLoginRedirect = () => {
    if (!user) return <Login />;
    if (isAdmin()) return <Navigate to="/admin" />;
    if (isDoctor()) return <Navigate to="/doctor/dashboard" />;
    return <Navigate to="/dashboard" />;
  };
  
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a3d5c 0%, #0d5a8a 20%, #1a7fa8 40%, #2b9ec9 60%, #1a7fa8 80%, #0f4f7f 100%)',
      backgroundAttachment: 'fixed'
    }}>
      <PWAInstallPrompt />
      <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={getLoginRedirect()} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <DiabetesRegister />} />
      <Route path="/register/old" element={user ? <Navigate to="/dashboard" /> : <Register />} />
      <Route path="/register/doctor" element={user ? <Navigate to="/doctor/dashboard" /> : <DoctorRegister />} />
      
      {/* Patient Routes */}
      <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><DashboardEnhanced /></Layout></ProtectedRoute>} />
      <Route path="/dashboard/classic" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/upload" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><UploadReport /></Layout></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><AllReports /></Layout></ProtectedRoute>} />
      <Route path="/reports/:id" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><ReportDetails /></Layout></ProtectedRoute>} />
      <Route path="/reports/:id/summary" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><ReportSummary /></Layout></ProtectedRoute>} />
      <Route path="/challenge" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><Challenge30Days /></Layout></ProtectedRoute>} />
      <Route path="/doctors" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><Doctors /></Layout></ProtectedRoute>} />
      <Route path="/consultation/:appointmentId" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Consultation /></ProtectedRoute>} />
      <Route path="/consultation-summary/:appointmentId" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><ConsultationSummary /></Layout></ProtectedRoute>} />
      <Route path="/wearables" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><Wearables /></Layout></ProtectedRoute>} />
      <Route path="/nutrition" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><Nutrition /></Layout></ProtectedRoute>} />
      <Route path="/vital-signs" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><VitalSigns /></Layout></ProtectedRoute>} />
      <Route path="/supplements" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><Supplements /></Layout></ProtectedRoute>} />
      <Route path="/subscription" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><Subscription /></Layout></ProtectedRoute>} />
      <Route path="/diet-plan" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><DietPlan /></Layout></ProtectedRoute>} />
      <Route path="/ai-chat" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><AIChat /></Layout></ProtectedRoute>} />
      
      {/* Doctor Routes */}
      <Route path="/doctor/dashboard" element={<DoctorRoute><Layout isDoctor><DoctorDashboard /></Layout></DoctorRoute>} />
      <Route path="/doctor/availability" element={<DoctorRoute><Layout isDoctor><DoctorAvailability /></Layout></DoctorRoute>} />
      <Route path="/patient/:patientId" element={<DoctorRoute><Layout isDoctor><PatientProfile /></Layout></DoctorRoute>} />
      
      {/* Shared Routes */}
      <Route path="/profile" element={<ProtectedRoute><Layout><ProfileModern /></Layout></ProtectedRoute>} />
      <Route path="/profile/old" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={<AdminRoute><Layout isAdmin><AdminDashboard /></Layout></AdminRoute>} />
      
      <Route path="/demo" element={<DemoPreview />} />
      <Route path="/video-test" element={<VideoTest />} />
      <Route path="/email-test" element={<EmailTest />} />
      </Routes>
    </div>
  );
}
