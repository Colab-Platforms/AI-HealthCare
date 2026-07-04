import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Settings,
  LogOut,
  Bell,
  Search,
  Activity,
  Watch,
  Clock,
  Apple,
  MessageSquare,
  Utensils,
  ArrowLeft,
  Droplet,
  Brain,
  TrendingUp,
  Sun,
  Moon,
  MessageCircle,
  BarChart3,
  Dumbbell,
  Users,
  ShieldCheck,
  Shield,
  ScrollText,
  ChevronRight,
  User,
  Target,
  Sparkles,
  RefreshCw,
  Menu,
  X,
} from "lucide-react";
import { ArrowUp } from "lucide-react";
import { useState, useEffect } from "react";
import { useData } from "../context/DataContext";
import TextSelectionPopup from "./TextSelectionPopup";
import MobileBottomNav from "./MobileBottomNav";
import PWAInstallPrompt from "./PWAInstallPrompt";
import api, { notificationService } from "../services/api";
import NotificationPanel from "./NotificationPanel";
import { useRef } from "react";
import GamificationMiniBadge from "./GamificationMiniBadge";

const patientNavItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/complete-analysis", icon: TrendingUp, label: "Analysis" },
  { path: "/reports", icon: ShieldCheck, label: "Medical Records" },
  { path: "/nutrition", icon: Utensils, label: "Nutrition" },
  { path: "/diet-plan", icon: FileText, label: "Diet Plan" },
  { path: "/glucose-log", icon: Droplet, label: "Glucose Tracking", isDiabeticOnly: true },
  { path: "/notification-settings", icon: Bell, label: "Notifications" },
  { path: "/privacy-settings", icon: ShieldCheck, label: "Data & Consent" }
];

const doctorNavItems = [
  { path: "/doctor/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/doctor/availability", icon: Clock, label: "Manage Slots" },
  { path: "/profile", icon: Settings, label: "Profile" },
];

const adminExtraNavItems = [
  { path: "/admin", icon: LayoutDashboard, label: "Admin Panel" },
  { path: "/admin/support", icon: MessageCircle, label: "Support Tickets" }
];

export default function Layout({
  children,
  isAdmin: isAdminLayout,
  isDoctor: isDoctorLayout,
}) {
  const { user, logout, isAdmin, isDoctor, refreshUser } = useAuth();
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };
  const { pendingAnalysisIds, pendingDietPlanIds } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [healthData, setHealthData] = useState({
    healthScore: 0,
    caloriesConsumed: 0,
    calorieTarget: 2000,
  });
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileProfileMenuOpen, setMobileProfileMenuOpen] = useState(false);
  const notificationTriggerRef = useRef(null);
  const profileMenuRef = useRef(null);
  const mobileProfileMenuRef = useRef(null);

  const aiPlaceholders = [
    "Ask anything about your health…",
    "What should I eat for dinner?",
    "How's my blood sugar trend?",
    "Am I hitting my protein goals?",
    "Suggest a workout for today…",
    "What does my HbA1c mean?",
  ];
  const [aiPlaceholderIdx, setAiPlaceholderIdx] = useState(0);
  const [aiPlaceholderVisible, setAiPlaceholderVisible] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => {
      setAiPlaceholderVisible(false);
      setTimeout(() => {
        setAiPlaceholderIdx(prev => (prev + 1) % aiPlaceholders.length);
        setAiPlaceholderVisible(true);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Close sidebar profile menu on outside click or sidebar collapse
  useEffect(() => {
    const handler = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    if (profileMenuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileMenuOpen]);

  // Close mobile profile menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (mobileProfileMenuRef.current && !mobileProfileMenuRef.current.contains(e.target)) {
        setMobileProfileMenuOpen(false);
      }
    };
    if (mobileProfileMenuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileProfileMenuOpen]);

  useEffect(() => {
    if (!sidebarOpen) setProfileMenuOpen(false);
  }, [sidebarOpen]);

  // Poll unread notification count for the bell badge
  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const { data } = await notificationService.getUnreadCount();
        const count = typeof data?.unreadCount === 'object' ? data.unreadCount.unreadCount : data?.unreadCount;
        setUnreadNotifCount(Number(count) || 0);
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, [user]);

  // Refresh user data on mount to get latest profile picture and data
  useEffect(() => {
    if (user && refreshUser) {
      refreshUser();
    }
  }, []);

  // Auto-close sidebar when screen shrinks to mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fetch real-time health data for dashboard
  useEffect(() => {
    const fetchHealthData = async () => {
      if (location.pathname === "/dashboard" && !isAdmin() && !isDoctor()) {
        try {
          // Fetch latest report for health score
          const reportsRes = await api.get("health/reports");
          const reports = Array.isArray(reportsRes.data)
            ? reportsRes.data
            : reportsRes.data.reports || [];
          const latestReport = reports[0];
          const healthScore =
            latestReport?.aiAnalysis?.healthScore ||
            latestReport?.healthScore ||
            0;

          // Fetch today's nutrition summary
          const today = new Date().toISOString().split("T")[0];
          const nutritionRes = await api.get(
            `nutrition/summary/daily?date=${today}`,
          );
          const caloriesConsumed =
            nutritionRes.data.summary?.totalCalories || 0;

          // Fetch health goal for calorie target
          const goalRes = await api
            .get("nutrition/goals")
            .catch(() => ({ data: { healthGoal: null } }));
          const calorieTarget =
            goalRes.data.healthGoal?.dailyCalorieTarget || 2000;

          setHealthData({ healthScore, caloriesConsumed, calorieTarget });
        } catch (error) {
          console.error("Failed to fetch health data:", error);
        }
      }
    };

    fetchHealthData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(interval);
  }, [location.pathname, isAdmin, isDoctor]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleRestoreAdmin = () => {
    const adminToken = localStorage.getItem("originalAdminToken");
    const adminUser = localStorage.getItem("originalAdminUser");
    if (adminToken && adminUser) {
      localStorage.setItem("token", adminToken);
      localStorage.setItem("user", adminUser);
      localStorage.removeItem("originalAdminToken");
      localStorage.removeItem("originalAdminUser");
      window.location.href = "/admin/users";
    }
  };

  const isImpersonating = !!localStorage.getItem("originalAdminToken");

  let navItems = patientNavItems;
  let homeLink = "/dashboard";
  let portalName = "Patient Portal";

  if (isAdmin() || isAdminLayout) {
    navItems = [...patientNavItems, ...adminExtraNavItems];
    homeLink = "/admin";
    portalName = "Admin Panel";
  } else if (isDoctor() || isDoctorLayout) {
    navItems = doctorNavItems;
    homeLink = "/doctor/dashboard";
    portalName = user?.doctorProfile?.specialization || "Doctor Portal";
  }

  // Consistent green gradient for all pages - 5 stops - Lighter & More Vibrant
  const bgColor =
    "bg-[linear-gradient(to_bottom,#F9FCF3_0%,#F5FAF0_25%,#F1F8ED_50%,#EDF6E9_75%,#E9F4E6_100%)]";

  const isDashboardPage =
    location.pathname === "/dashboard" ||
    location.pathname === "/doctor/dashboard" ||
    location.pathname === "/admin";

  console.log("Rendering Layout", {
    pathname: location.pathname,
    user: !!user,
  });
  return (
    <div className={`min-h-screen flex flex-col ${bgColor}`}>
      {/* Admin Session Banner */}
      {isImpersonating && (
        <div className="bg-slate-900 text-white py-2 px-6 flex items-center justify-between sticky top-0 z-[60] shadow-xl border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-[10px] font-black uppercase tracking-widest">
              Impersonation Mode:{" "}
              <span className="text-amber-400">{user?.name}</span>
            </p>
          </div>
          <button
            onClick={handleRestoreAdmin}
            className="flex items-center gap-2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-white/5 border-b-2 border-b-white/10 active:border-b-0 active:translate-y-px"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Stop View & Return
          </button>
        </div>
      )}

      <div className="flex-1 flex w-full h-full relative">
        {/* Sidebar - Liquid Glass Effect */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 h-screen shrink-0 flex flex-col lg:sticky lg:top-0 overflow-hidden
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
          style={{
            width: sidebarOpen ? "256px" : (window.innerWidth < 1024 ? "0px" : "64px"),
            transition: "width 0.22s cubic-bezier(0.4,0,0.2,1), transform 0.22s cubic-bezier(0.4,0,0.2,1)",
            transform: "translateZ(0)",
            willChange: "width",
            background: "rgba(240,248,240,0.92)",
            borderRight: "1px solid rgba(255,255,255,0.5)",
            boxShadow: "4px 0 24px rgba(16,185,129,0.08), inset 1px 0 0 rgba(255,255,255,0.6)",
          }}
        >
          {/* Glass inner highlight */}
          <div className="absolute inset-0 pointer-events-none rounded-r-none"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.05) 60%, transparent 100%)",
            }}
          />

          <div className="flex flex-col h-full relative z-10">
            {/* Logo + Toggle button */}
            <div className="p-4 shrink-0 flex items-center justify-between overflow-hidden"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.4)" }}
            >
              {/* Logo - hidden when collapsed on desktop */}
              <Link to={homeLink} className={`flex items-center transition-all duration-300 overflow-hidden ${sidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0 lg:w-0"}`} onClick={() => { if(window.innerWidth < 1024) setSidebarOpen(false); }}>
                <img
                  src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/logo_with_text-1.png?v=1774261099"
                  alt="take.health AI Platform"
                  className="h-16 w-auto object-contain"
                />
              </Link>
              {/* Toggle button - desktop & mobile close */}
              <button
                onClick={() => setSidebarOpen(prev => !prev)}
                className="p-2 rounded-xl transition-all text-slate-500 hover:text-slate-800 shrink-0"
                style={{ background: "rgba(255,255,255,0.4)" }}
              >
                {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
              {navItems.map(({ path, icon: Icon, label, comingSoon, badge, isDiabeticOnly }) => {
                const isDiabetic = user?.profile?.isDiabetic === "yes";
                if (isDiabeticOnly && !isDiabetic) return null;
                const isActive = location.pathname === path;
                const labelStyle = { maxWidth: sidebarOpen ? "160px" : "0px", opacity: sidebarOpen ? 1 : 0, transition: "max-width 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.15s ease" };

                if (comingSoon) {
                  return (
                    <div key={path} className="flex items-center cursor-not-allowed opacity-35 py-2.5 gap-3 mx-2 rounded-2xl" style={{ paddingLeft: "6px", paddingRight: "6px" }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Icon className="w-[18px] h-[18px] text-slate-500" />
                      </div>
                      <span className="text-sm font-bold text-slate-500 truncate overflow-hidden whitespace-nowrap" style={labelStyle}>
                        {label}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={path} className="px-2">
                    <Link
                      to={path}
                      onClick={() => { if(window.innerWidth < 1024) setSidebarOpen(false); }}
                      title={!sidebarOpen ? label : undefined}
                      className={`flex items-center rounded-2xl font-bold group py-2.5 gap-3 w-full ${
                        isActive ? "text-white shadow-lg" : "text-slate-600 hover:text-slate-900"
                      }`}
                      style={{
                        paddingLeft: "6px",
                        paddingRight: "6px",
                        ...(isActive ? {
                          background: "linear-gradient(135deg, rgba(5,150,105,0.85) 0%, rgba(16,185,129,0.9) 100%)",
                          backdropFilter: "blur(8px)",
                          boxShadow: "0 4px 16px rgba(5,150,105,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
                        } : {})
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.55)"; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = ""; }}
                    >
                      {/* Fixed-width icon well — always 40px so icon stays centered when collapsed */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${isActive ? "bg-white/20" : "bg-transparent"}`}>
                        <Icon className={`w-[18px] h-[18px] transition-colors ${isActive ? "text-white" : "text-slate-500 group-hover:text-slate-700"}`} />
                      </div>
                      <span className="text-sm tracking-tight truncate overflow-hidden whitespace-nowrap" style={labelStyle}>
                        {label}
                      </span>
                      {badge && !isActive && (
                        <span className="ml-auto bg-white/60 text-slate-600 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center overflow-hidden whitespace-nowrap flex-shrink-0"
                          style={{ opacity: sidebarOpen ? 1 : 0, transition: "opacity 0.15s ease" }}>
                          {badge}
                        </span>
                      )}
                    </Link>
                  </div>
                );
              })}
            </nav>


            {/* Privacy & Terms links */}
            <div className="px-2 py-2 shrink-0 flex flex-col gap-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.4)" }}>
              {[
                { icon: Shield, label: "Privacy Policy", url: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/take_health_privacy_policy.pdf?v=1776407816" },
                { icon: ScrollText, label: "Terms & Conditions", url: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Terrms_and_Conditions_take.health_revised.pdf?v=1776407779" },
              ].map(({ icon: Icon, label, url }) => (
                <button key={label} onClick={() => window.open(url, "_blank")}
                  className="flex items-center gap-3 rounded-xl px-1.5 py-1.5 hover:bg-white/50 transition-colors text-left w-full">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-[17px] h-[17px] text-slate-400" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 truncate whitespace-nowrap overflow-hidden"
                    style={{ maxWidth: sidebarOpen ? "160px" : "0px", opacity: sidebarOpen ? 1 : 0, transition: "max-width 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.15s ease" }}>
                    {label}
                  </span>
                </button>
              ))}
            </div>

            {/* User Footer */}
            <div className="px-2 py-2 shrink-0 relative" ref={profileMenuRef}>

              {/* Animated Profile Menu */}
              <AnimatePresence>
                {profileMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    className="absolute bottom-[68px] left-2 right-2 rounded-2xl overflow-hidden z-50"
                    style={{
                      background: "rgba(255,255,255,0.95)",
                      backdropFilter: "blur(20px) saturate(180%)",
                      WebkitBackdropFilter: "blur(20px) saturate(180%)",
                      border: "1px solid rgba(255,255,255,0.9)",
                      boxShadow: "0 -8px 32px rgba(16,185,129,0.1), 0 4px 16px rgba(0,0,0,0.08)",
                    }}
                  >
                    {/* Profile header inside menu */}
                    <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                      {user?.profilePicture ? (
                        <img src={user.profilePicture} alt={user.name} className="w-9 h-9 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}>
                          <span className="font-black text-white text-sm">{user?.name?.[0]?.toUpperCase()}</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-800 uppercase tracking-wider truncate">{isDoctor() ? `DR. ${user?.name}` : user?.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium truncate">{user?.email}</p>
                      </div>
                    </div>

                    {/* Menu Items */}
                    {[
                      { icon: User, label: "Account Details", action: () => navigate("/profile") },
                      { icon: Target, label: "Goal Settings", action: () => navigate("/profile") },
                      { icon: FileText, label: "Medical Records", action: () => navigate("/medical-vault") },
                      { icon: TrendingUp, label: "Progress Reports", action: () => navigate("/complete-analysis") },
                      { icon: ShieldCheck, label: "Data & Consent", action: () => navigate("/privacy-settings") },
                      { icon: ScrollText, label: "Terms & Conditions", action: () => window.open("https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Terrms_and_Conditions_take.health_revised.pdf?v=1776407779", "_blank") },
                      { icon: Shield, label: "Privacy Policy", action: () => window.open("https://cdn.shopify.com/s/files/1/0636/5226/6115/files/take_health_privacy_policy.pdf?v=1776407816", "_blank") },
                    ].map(({ icon: Icon, label, action }, i) => (
                      <motion.button
                        key={label}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.18 }}
                        onClick={() => { action(); setProfileMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50/60 transition-colors text-left"
                        style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}
                      >
                        <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: "rgba(91,140,111,0.08)" }}>
                          <Icon className="w-3.5 h-3.5 text-[#5B8C6F]" />
                        </div>
                        <span className="text-[13px] font-semibold text-slate-700">{label}</span>
                      </motion.button>
                    ))}

                    {/* Logout */}
                    <button
                      onClick={() => { handleLogout(); setProfileMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50/60 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(239,68,68,0.08)" }}>
                        <LogOut className="w-3.5 h-3.5 text-red-500" />
                      </div>
                      <span className="text-[13px] font-semibold text-red-500">Logout</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Profile Trigger Button */}
              <div
                onClick={() => {
                  if (!sidebarOpen) { setSidebarOpen(true); return; }
                  setProfileMenuOpen(prev => !prev);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && (sidebarOpen ? setProfileMenuOpen(prev => !prev) : setSidebarOpen(true))}
                className="w-full flex items-center gap-3 rounded-2xl cursor-pointer transition-all"
                style={{
                  padding: "6px 6px",
                  background: profileMenuOpen ? "rgba(91,140,111,0.12)" : "rgba(255,255,255,0.4)",
                  border: `1px solid ${profileMenuOpen ? "rgba(91,140,111,0.3)" : "rgba(255,255,255,0.6)"}`,
                }}
                onMouseEnter={e => { if (!profileMenuOpen) e.currentTarget.style.background = "rgba(255,255,255,0.65)"; }}
                onMouseLeave={e => { if (!profileMenuOpen) e.currentTarget.style.background = "rgba(255,255,255,0.4)"; }}
              >
                {/* Avatar — fixed 36px, always centered when collapsed */}
                <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden shadow-sm"
                  style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}>
                  {user?.profilePicture
                    ? <img src={user.profilePicture} alt={user.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center">
                        <span className="font-black text-white text-sm">{user?.name?.[0]?.toUpperCase()}</span>
                      </div>
                  }
                </div>
                {/* Name + email — fades out when collapsed */}
                <div className="flex-1 min-w-0 overflow-hidden text-left"
                  style={{ maxWidth: sidebarOpen ? "130px" : "0px", opacity: sidebarOpen ? 1 : 0, transition: "max-width 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.15s ease" }}>
                  <p className="text-[11px] font-black truncate text-slate-800 uppercase tracking-wide leading-tight">
                    {isDoctor() ? `DR. ${user?.name}` : user?.name}
                  </p>
                  <p className="text-[10px] truncate text-slate-400 font-medium leading-tight mt-0.5">{user?.email}</p>
                </div>
                {/* Chevron — fades out when collapsed */}
                <motion.div
                  animate={{ rotate: profileMenuOpen ? 180 : 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex-shrink-0 overflow-hidden"
                  style={{ maxWidth: sidebarOpen ? "16px" : "0px", opacity: sidebarOpen ? 1 : 0, transition: "max-width 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.15s ease" }}
                >
                  <ChevronRight className="w-4 h-4 text-slate-400 -rotate-90" />
                </motion.div>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Main Content - No left margin needed with sticky sidebar flow */}
        <div
          className="flex-1 flex flex-col min-h-screen relative bg-white/50"
          style={{ overflowX: "clip" }}
        >
          {/* Background Blobs - Visible on all pages using Layout */}
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-300/15 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
          <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-emerald-300/10 rounded-full blur-[100px] translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-emerald-200/10 rounded-full blur-[80px] pointer-events-none" />

          {/* Global Header */}
          <header className="fixed top-0 inset-x-0 z-40 lg:sticky lg:inset-auto lg:top-0 transition-all duration-300"
            style={{
              background: "rgba(240,250,245,0.72)",
              backdropFilter: "blur(36px) saturate(200%) brightness(1.04)",
              WebkitBackdropFilter: "blur(36px) saturate(200%) brightness(1.04)",
              borderBottom: "1px solid rgba(255,255,255,0.80)",
              boxShadow: "0 2px 24px rgba(16,185,129,0.08), inset 0 1px 0 rgba(255,255,255,0.95)",
            }}
          >
            <div className="flex items-center px-4 py-3 gap-3">
              {/* Back Button (profile/ai-chat pages) OR Profile Avatar (all other pages, mobile only) */}
              {(location.pathname === "/profile" || location.pathname === "/ai-chat") ? (
                <button
                  onClick={() => navigate("/dashboard")}
                  className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all shrink-0"
                  style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.8)" }}
                >
                  <ArrowLeft size={18} className="text-slate-700" strokeWidth={2.5} />
                </button>
              ) : (
                <div className="relative lg:hidden shrink-0" ref={mobileProfileMenuRef}>
                  {/* Avatar trigger */}
                  <button
                    onClick={() => setMobileProfileMenuOpen(p => !p)}
                    className="w-9 h-9 rounded-full overflow-hidden transition-all active:scale-95"
                    style={{ border: "2px solid rgba(91,140,111,0.4)", boxShadow: "0 2px 8px rgba(16,185,129,0.15)" }}
                  >
                    {user?.profilePicture ? (
                      <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#5B8C6F] flex items-center justify-center">
                        <span className="text-white text-xs font-black">
                          {user?.name?.charAt(0)?.toUpperCase() || "U"}
                        </span>
                      </div>
                    )}
                  </button>

                  {/* Mobile profile popup */}
                  <AnimatePresence>
                    {mobileProfileMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                        className="absolute top-12 left-0 w-56 rounded-2xl overflow-hidden z-50"
                        style={{
                          background: "rgba(255,255,255,0.97)",
                          backdropFilter: "blur(20px) saturate(180%)",
                          WebkitBackdropFilter: "blur(20px) saturate(180%)",
                          border: "1px solid rgba(255,255,255,0.9)",
                          boxShadow: "0 8px 32px rgba(16,185,129,0.12), 0 4px 16px rgba(0,0,0,0.08)",
                        }}
                      >
                        {/* User info header */}
                        <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0"
                            style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}>
                            {user?.profilePicture
                              ? <img src={user.profilePicture} alt={user.name} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center">
                                  <span className="font-black text-white text-sm">{user?.name?.[0]?.toUpperCase()}</span>
                                </div>
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-wide truncate">
                              {isDoctor() ? `DR. ${user?.name}` : user?.name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium truncate">{user?.email}</p>
                          </div>
                        </div>

                        {/* Menu items */}
                        {[
                          { icon: User, label: "Account Details", action: () => navigate("/profile") },
                          { icon: Target, label: "Goal Settings", action: () => navigate("/profile") },
                          { icon: FileText, label: "Medical Records", action: () => navigate("/medical-vault") },
                          { icon: TrendingUp, label: "Progress Reports", action: () => navigate("/complete-analysis") },
                          { icon: ShieldCheck, label: "Data & Consent", action: () => navigate("/privacy-settings") },
                          { icon: ScrollText, label: "Terms & Conditions", action: () => window.open("https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Terrms_and_Conditions_take.health_revised.pdf?v=1776407779", "_blank") },
                          { icon: Shield, label: "Privacy Policy", action: () => window.open("https://cdn.shopify.com/s/files/1/0636/5226/6115/files/take_health_privacy_policy.pdf?v=1776407816", "_blank") },
                        ].map(({ icon: Icon, label, action }, i) => (
                          <motion.button
                            key={label}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03, duration: 0.15 }}
                            onClick={() => { action(); setMobileProfileMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50/60 transition-colors text-left"
                            style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}
                          >
                            <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ background: "rgba(91,140,111,0.08)" }}>
                              <Icon className="w-3.5 h-3.5 text-[#5B8C6F]" />
                            </div>
                            <span className="text-[13px] font-semibold text-slate-700">{label}</span>
                          </motion.button>
                        ))}

                        {/* Logout */}
                        <button
                          onClick={() => { handleLogout(); setMobileProfileMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50/60 transition-colors"
                        >
                          <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: "rgba(239,68,68,0.08)" }}>
                            <LogOut className="w-3.5 h-3.5 text-red-500" />
                          </div>
                          <span className="text-[13px] font-semibold text-red-500">Logout</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {location.pathname === "/profile" ? (
                <div className="flex-1 flex justify-center">
                  <span className="font-bold text-lg text-slate-800" style={{ letterSpacing: "-0.4px" }}>
                    My Profile
                  </span>
                </div>
              ) : location.pathname === "/ai-chat" ? (
                <div className="flex-1" />
              ) : (
                <>
                  {/* AI search bar - full width */}
                  <div
                    className="flex flex-1 min-w-0 items-center gap-2 rounded-full px-3 cursor-pointer transition-all overflow-hidden"
                    style={{ height: "40px", background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 2px 8px rgba(16,185,129,0.08)" }}
                    onClick={() => navigate("/ai-chat")}
                  >
                    <div className="w-6 h-6 rounded-full bg-[#588975] flex items-center justify-center shrink-0">
                      <img src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Icon_11.png?v=1775649527" alt="" className="w-3.5 h-3.5 object-contain" />
                    </div>
                    <span
                      className="text-sm text-[#1a1a1a]/50 font-medium transition-all duration-300 truncate"
                      style={{ opacity: aiPlaceholderVisible ? 1 : 0, transform: aiPlaceholderVisible ? "translateY(0)" : "translateY(4px)" }}
                    >
                      {aiPlaceholders[aiPlaceholderIdx]}
                    </span>
                  </div>

                  {/* Right side actions */}
                  <div className="flex items-center gap-2">
                    {/* Gamification Points Badge */}
                    <GamificationMiniBadge />

                    {/* Bell */}
                    <div className="relative">
                      <button
                        ref={notificationTriggerRef}
                        onClick={() => setIsNotificationOpen(prev => !prev)}
                        className="relative w-9 h-9 rounded-2xl flex items-center justify-center transition-all hover:scale-105"
                        style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 2px 8px rgba(16,185,129,0.1)" }}
                      >
                        <Bell className="w-4 h-4 text-emerald-700" />
                        {unreadNotifCount > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                            {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                          </span>
                        )}
                      </button>
                      <NotificationPanel
                        isOpen={isNotificationOpen}
                        onClose={() => {
                          setIsNotificationOpen(false);
                          notificationService.getUnreadCount().then(({ data }) => {
                            const count = typeof data?.unreadCount === 'object' ? data.unreadCount.unreadCount : data?.unreadCount;
                            setUnreadNotifCount(Number(count) || 0);
                          }).catch(() => {});
                        }}
                        triggerRef={notificationTriggerRef}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </header>

          {/* Spacer for fixed header on mobile */}
          <div className="h-16 shrink-0 lg:hidden" />

          {/* Account Deletion Warning Banner */}
          {user?.dataRetention?.scheduledDeletion && (
            <div className="mx-3 mt-3 lg:mx-4 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-red-500 text-base flex-shrink-0">⚠️</span>
                <p className="text-red-600 text-xs font-semibold leading-snug">
                  Account deletion scheduled on{' '}
                  <span className="font-black">
                    {new Date(user.dataRetention.scheduledDeletion).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await api.post('/privacy/cancel-deletion');
                    await refreshUser();
                  } catch (e) {
                    navigate('/privacy-settings');
                  }
                }}
                className="flex-shrink-0 text-[11px] font-black text-white px-3 py-1.5 rounded-xl"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                Cancel Deletion
              </button>
            </div>
          )}

          {/* Page Content */}
          <main
            className={`flex-1 flex flex-col overflow-x-hidden w-full ${location.pathname === "/ai-chat" ? "" : "main-content-mobile"}`}
            style={
              location.pathname === "/nutrition" ||
                location.pathname === "/ai-chat"
                ? { padding: 0, backgroundColor: "transparent" }
                : { padding: 0 }
            }
          >
            {children}
          </main>
        </div>

        {/* Mobile Bottom Navigation - Outside main content wrapper for proper fixed positioning */}
        <MobileBottomNav />
        <PWAInstallPrompt />

        <AnimatePresence>
          {showBackToTop && (
            <motion.button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="fixed bottom-24 right-5 z-[260] flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-slate-900/85 text-white shadow-[0_12px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl transition-transform duration-200 hover:scale-105 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/30 focus:ring-offset-2 focus:ring-offset-transparent md:bottom-8 md:right-8"
              aria-label="Back to top"
              title="Back to top"
            >
              <ArrowUp className="h-5 w-5" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Text Selection Popup - Disabled on AI Chat page */}
        {location.pathname !== "/ai-chat" && <TextSelectionPopup />}

        {/* Global AI Generation Status Banner */}
        {(pendingAnalysisIds?.length > 0 || pendingDietPlanIds?.length > 0) && (
          <div
            onClick={() => {
              if (pendingAnalysisIds?.length > 0) {
                navigate(
                  `/reports/${pendingAnalysisIds[pendingAnalysisIds.length - 1]}`,
                );
              } else if (pendingDietPlanIds?.length > 0) {
                navigate("/diet-plan");
              }
            }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md pointer-events-none"
          >
            <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-4 rounded-[2rem] shadow-2xl flex items-center gap-4 cursor-pointer hover:bg-black/90 hover:scale-[1.02] active:scale-95 transition-all pointer-events-auto group">
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-white tracking-tight">
                  AI{" "}
                  {pendingAnalysisIds?.length > 0
                    ? "Analysis"
                    : "Diet Generation"}{" "}
                  in Progress
                </h4>
                <p className="text-[9px] font-medium text-slate-400 leading-tight">
                  {pendingAnalysisIds?.length > 0
                    ? "We are analyzing your medical report..."
                    : "Crafting your personalized nutrition protocol..."}
                </p>
              </div>
              <div className="shrink-0">
                <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
