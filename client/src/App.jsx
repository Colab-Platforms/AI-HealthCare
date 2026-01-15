import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import DoctorRegister from './pages/DoctorRegister';
import Dashboard from './pages/Dashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import UploadReport from './pages/UploadReport';
import ReportDetails from './pages/ReportDetails';
import Doctors from './pages/Doctors';
import Profile from './pages/Profile';
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

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
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
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return isAdmin() ? children : <Navigate to="/dashboard" />;
};

const DoctorRoute = ({ children }) => {
  const { user, loading, isDoctor } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return isDoctor() ? children : <Navigate to="/dashboard" />;
};

export default function App() {
  const { user, isAdmin, isDoctor } = useAuth();
  
  const getDefaultRoute = () => {
    if (!user) return <Landing />;
    if (isAdmin()) return <Navigate to="/admin" />;
    if (isDoctor()) return <Navigate to="/doctor/dashboard" />;
    return <Navigate to="/dashboard" />;
  };

  const getLoginRedirect = () => {
    if (!user) return <Login />;
    if (isAdmin()) return <Navigate to="/admin" />;
    if (isDoctor()) return <Navigate to="/doctor/dashboard" />;
    return <Navigate to="/dashboard" />;
  };
  
  return (
    <Routes>
      <Route path="/" element={getDefaultRoute()} />
      <Route path="/login" element={getLoginRedirect()} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
      <Route path="/register/doctor" element={user ? <Navigate to="/doctor/dashboard" /> : <DoctorRegister />} />
      
      {/* Patient Routes */}
      <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/upload" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><UploadReport /></Layout></ProtectedRoute>} />
      <Route path="/reports/:id" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><ReportDetails /></Layout></ProtectedRoute>} />
      <Route path="/doctors" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><Doctors /></Layout></ProtectedRoute>} />
      <Route path="/consultation/:appointmentId" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Consultation /></ProtectedRoute>} />
      <Route path="/consultation-summary/:appointmentId" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><ConsultationSummary /></Layout></ProtectedRoute>} />
      <Route path="/wearables" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><Wearables /></Layout></ProtectedRoute>} />
      <Route path="/subscription" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><Subscription /></Layout></ProtectedRoute>} />
      <Route path="/diet-plan" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><DietPlan /></Layout></ProtectedRoute>} />
      <Route path="/ai-chat" element={<ProtectedRoute allowedRoles={['patient', 'client']}><Layout><AIChat /></Layout></ProtectedRoute>} />
      
      {/* Doctor Routes */}
      <Route path="/doctor/dashboard" element={<DoctorRoute><Layout isDoctor><DoctorDashboard /></Layout></DoctorRoute>} />
      <Route path="/doctor/availability" element={<DoctorRoute><Layout isDoctor><DoctorAvailability /></Layout></DoctorRoute>} />
      <Route path="/patient/:patientId" element={<DoctorRoute><Layout isDoctor><PatientProfile /></Layout></DoctorRoute>} />
      
      {/* Shared Routes */}
      <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={<AdminRoute><Layout isAdmin><AdminDashboard /></Layout></AdminRoute>} />
      
      <Route path="/demo" element={<DemoPreview />} />
      <Route path="/video-test" element={<VideoTest />} />
      <Route path="/email-test" element={<EmailTest />} />
    </Routes>
  );
}
