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
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { ArrowUp } from "lucide-react";
import { useState, useEffect } from "react";
import { useData } from "../context/DataContext";
import TextSelectionPopup from "./TextSelectionPopup";
import MobileBottomNav from "./MobileBottomNav";
import PWAInstallPrompt from "./PWAInstallPrompt";
import api from "../services/api";
import NotificationPanel from "./NotificationPanel";
import { useRef } from "react";

const patientNavItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/diabetes", icon: Droplet, label: "Diabetes", isDiabeticOnly: true },
  { path: "/complete-analysis", icon: TrendingUp, label: "Analysis" },
  { path: "/upload", icon: Brain, label: "AI Analyzer" },
  { path: "/medical-vault", icon: ShieldCheck, label: "Medical Records" },
  { path: "/nutrition", icon: Utensils, label: "Nutrition" },
  { path: "/diet-plan", icon: FileText, label: "Diet Plan" }
];

const doctorNavItems = [
  { path: "/doctor/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/doctor/availability", icon: Clock, label: "Manage Slots" },
  { path: "/profile", icon: Settings, label: "Profile" },
];

const adminExtraNavItems = [
  { path: "/admin", icon: LayoutDashboard, label: "Admin Panel" },
  { path: "/admin/users", icon: Users, label: "Manage Users" },
  { path: "/admin/food-cache", icon: Utensils, label: "Food DB" },
  { path: "/admin/reports", icon: FileText, label: "Review Reports" },
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [healthData, setHealthData] = useState({
    healthScore: 0,
    caloriesConsumed: 0,
    calorieTarget: 2000,
  });
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const notificationTriggerRef = useRef(null);

  // Refresh user data on mount to get latest profile picture and data
  useEffect(() => {
    if (user && refreshUser) {
      refreshUser();
    }
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
        {/* Sidebar - Slide from RIGHT on mobile, sticky on desktop */}
        <aside
          className={`fixed inset-y-0 right-0 lg:sticky lg:left-0 z-50 w-64 h-screen shrink-0 transform transition-transform duration-300 hidden lg:flex lg:flex-col bg-white border-r border-slate-100 ${sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}`}
        >
          <div className="flex flex-col h-full">
            {/* Logo - Fixed at top */}
            <div className="p-8 shrink-0 border-b border-slate-50">
              <Link to={homeLink} className="flex items-center">
                <img
                  src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/logo_with_text-1.png?v=1774261099"
                  alt="take.health AI Platform"
                  className="h-18 w-auto object-contain"
                />
              </Link>
            </div>

            {/* Navigation - Scrollable middle section */}
            <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
              {navItems.map(
                ({
                  path,
                  icon: Icon,
                  label,
                  comingSoon,
                  badge,
                  isDiabeticOnly,
                }) => {
                  // Conditionally hide diabetes if not diabetic
                  const isDiabetic = user?.profile?.isDiabetic === "yes";
                  if (isDiabeticOnly && !isDiabetic) return null;

                  if (comingSoon) {
                    return (
                      <div
                        key={path}
                        className="flex items-center justify-between px-5 py-3.5 rounded-2xl transition-all cursor-not-allowed text-slate-400"
                      >
                        <div className="flex items-center gap-4">
                          <Icon className="w-5 h-5 opacity-40" />
                          <span className="text-sm font-bold tracking-tight">
                            {label}
                          </span>
                        </div>
                        {badge && (
                          <span className="bg-slate-100 text-slate-500 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                            {badge}
                          </span>
                        )}
                      </div>
                    );
                  }

                  const isActive = location.pathname === path;

                  return (
                    <Link
                      key={path}
                      to={path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center justify-between px-5 py-3.5 rounded-2xl font-bold transition-all group ${isActive
                        ? "bg-slate-900 text-white shadow-lg"
                        : "text-slate-400 hover:text-black hover:bg-slate-50"
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <Icon
                          className={`w-5 h-5 transition-colors ${isActive ? "text-white" : "text-slate-400 group-hover:text-black"}`}
                        />
                        <span className="text-sm tracking-tight">{label}</span>
                      </div>
                      {badge && !isActive && (
                        <span className="bg-slate-100 text-slate-500 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                },
              )}
            </nav>

            {/* User Footer - Fixed at bottom */}
            <div className="p-6 shrink-0 border-t border-slate-50">
              <div className="flex items-center gap-4 p-4 rounded-[1.25rem] bg-slate-50 hover:bg-slate-100 transition-all border border-slate-100">
                {user?.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={user.name}
                    className="w-10 h-10 rounded-xl object-cover shrink-0 shadow-lg"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-black shadow-lg">
                    <span className="font-black text-white">
                      {user?.name?.[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black truncate text-black uppercase tracking-wider">
                    {isDoctor() ? `DR. ${user?.name}` : user?.name}
                  </p>
                  <p className="text-[10px] truncate text-slate-500 font-bold lowercase">
                    {user?.email}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-xl transition-all shrink-0 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content - No left margin needed with sticky sidebar flow */}
        <div
          className="flex-1 flex flex-col min-h-screen relative bg-white/50"
          style={{ overflowX: "clip" }}
        >
          {/* Background Blobs - Visible on all pages using Layout */}
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-300/15 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
          <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-emerald-300/10 rounded-full blur-[100px] translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-emerald-200/10 rounded-full blur-[80px] pointer-events-none" />

          {/* Global Header - Fixed on mobile, Sticky on desktop */}
          <header className="fixed top-0 inset-x-0 z-50 lg:sticky lg:inset-auto lg:top-0 bg-[#EBF0E6]/60 backdrop-blur-xl border-b border-emerald-100/30 shadow-sm transition-all duration-300">
            <div className="flex items-center px-6 md:px-12 py-3 md:py-4 gap-4">
              {/* Back Button for Profile & AI Chat */}
              {(location.pathname === "/profile" ||
                location.pathname === "/ai-chat") && (
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="w-10 h-10 rounded-full bg-white/40 border border-white/20 flex items-center justify-center shadow-sm hover:bg-white/60 transition-all mr-2"
                  >
                    <ArrowLeft
                      size={20}
                      className="text-[#1a2138]"
                      strokeWidth={2.5}
                    />
                  </button>
                )}

              {/* Header Content - Conditional for Profile */}
              {location.pathname === "/profile" ? (
                <div className="flex-1 flex justify-center items-center">
                  <span
                    style={{
                      fontFamily: "Poppins, sans-serif",
                      fontWeight: "700",
                      fontSize: "18.29px",
                      lineHeight: "27.43px",
                      letterSpacing: "-0.46px",
                      color: "#1a1a1a",
                      width: "auto", // User gave 88 but auto is safer for centering
                      height: "28px",
                    }}
                  >
                    My Profile
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  {/* Profile Image - Now on Left */}
                  <button
                    onClick={() => navigate("/profile")}
                    className="tour-profile rounded-full overflow-hidden border border-slate-100 shadow-sm hover:ring-4 hover:ring-slate-100 transition-all pointer-events-auto"
                    style={{
                      width: "43.93733596801758px",
                      height: "43.93733596801758px",
                      marginTop: "0px",
                    }}
                  >
                    {user?.profilePicture ? (
                      <img
                        src={user.profilePicture}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-black flex items-center justify-center text-xs font-black text-white uppercase">
                        {user?.name?.[0] || "U"}
                      </div>
                    )}
                  </button>

                  {/* Welcome Message - Now in Header */}
                  <div className="flex flex-col">
                    <span
                      style={{
                        fontFamily: "Poppins, sans-serif",
                        fontWeight: "700",
                        fontSize: "16px",
                        lineHeight: "20.6px",
                        letterSpacing: "-0.41px",
                        color: "#1a1a1a",
                      }}
                    >
                      Hello {user?.name?.split(" ")[0] || "User"}!
                    </span>
                    <span
                      style={{
                        fontFamily: "Poppins, sans-serif",
                        fontWeight: "600",
                        fontSize: "14px",
                        lineHeight: "21.97px",
                        letterSpacing: "0px",
                        color: "#69A38D",
                        width: "160.7889404296875px",
                        height: "22px",
                      }}
                    >
                      {getGreeting()}
                    </span>
                  </div>
                </div>
              )}

              {location.pathname !== "/profile" && <div className="flex-1" />}

              {/* Bell icon on extreme right */}
              <button
                onClick={() => { }}
                className="w-10 h-10 rounded-full bg-white/40 border border-white/20 flex items-center justify-center shadow-sm hover:bg-white/60 transition-all"
              >
                <Bell className="w-5 h-5 text-[#5B8C6F]" />
              </button>
            </div>
          </header>

          {/* Spacer for fixed header on mobile */}
          <div className="h-16 shrink-0 lg:hidden" />

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
