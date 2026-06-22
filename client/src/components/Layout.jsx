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

const patientNavItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/complete-analysis", icon: TrendingUp, label: "Analysis" },
  { path: "/medical-vault", icon: ShieldCheck, label: "Medical Records" },
  { path: "/nutrition", icon: Utensils, label: "Nutrition" },
  { path: "/diet-plan", icon: FileText, label: "Diet Plan" },
  { path: "/glucose-log", icon: Droplet, label: "Glucose Tracking", isDiabeticOnly: true },
  { path: "/notification-settings", icon: Bell, label: "Notifications" }
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [healthData, setHealthData] = useState({
    healthScore: 0,
    caloriesConsumed: 0,
    calorieTarget: 2000,
  });
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const notificationTriggerRef = useRef(null);

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
            width: sidebarOpen ? "256px" : "64px",
            transition: "width 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1)",
            background: "linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.25) 100%)",
            backdropFilter: "blur(32px) saturate(180%)",
            WebkitBackdropFilter: "blur(32px) saturate(180%)",
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
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
              {navItems.map(({ path, icon: Icon, label, comingSoon, badge, isDiabeticOnly }) => {
                const isDiabetic = user?.profile?.isDiabetic === "yes";
                if (isDiabeticOnly && !isDiabetic) return null;
                const isActive = location.pathname === path;

                if (comingSoon) {
                  return (
                    <div key={path} className="flex items-center rounded-2xl cursor-not-allowed opacity-40 px-3 py-3 gap-3">
                      <Icon className="w-5 h-5 text-slate-500 shrink-0" />
                      <span className="text-sm font-bold text-slate-500 truncate overflow-hidden whitespace-nowrap"
                        style={{ maxWidth: sidebarOpen ? "160px" : "0px", opacity: sidebarOpen ? 1 : 0, transition: "max-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease" }}>
                        {label}
                      </span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => { if(window.innerWidth < 1024) setSidebarOpen(false); }}
                    title={!sidebarOpen ? label : undefined}
                    className={`flex items-center rounded-2xl font-bold transition-all duration-200 group ${
                      sidebarOpen ? "px-4 py-3 gap-3 justify-start" : "px-0 py-3 justify-center"
                    } ${isActive ? "text-white shadow-lg" : "text-slate-600 hover:text-slate-900"}`}
                    style={isActive ? {
                      background: "linear-gradient(135deg, rgba(5,150,105,0.85) 0%, rgba(16,185,129,0.9) 100%)",
                      backdropFilter: "blur(8px)",
                      boxShadow: "0 4px 16px rgba(5,150,105,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
                    } : {}}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.5)"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = ""; }}
                  >
                    <Icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? "text-white" : "text-slate-500 group-hover:text-slate-800"}`} />
                    <span className="text-sm tracking-tight truncate overflow-hidden whitespace-nowrap"
                      style={{ maxWidth: sidebarOpen ? "160px" : "0px", opacity: sidebarOpen ? 1 : 0, transition: "max-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease" }}>
                      {label}
                    </span>
                    {badge && !isActive && (
                      <span className="ml-auto bg-white/60 text-slate-600 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center overflow-hidden whitespace-nowrap"
                        style={{ maxWidth: sidebarOpen ? "20px" : "0px", opacity: sidebarOpen ? 1 : 0, transition: "max-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease" }}>
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* User Footer */}
            <div className="p-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.4)" }}>
              <div className={`flex items-center p-2.5 rounded-2xl transition-all ${sidebarOpen ? "gap-3" : "justify-center"}`}
                style={{ background: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.6)" }}
              >
                {user?.profilePicture ? (
                  <img src={user.profilePicture} alt={user.name} className="w-8 h-8 rounded-xl object-cover shrink-0 shadow-md" />
                ) : (
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md"
                    style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}
                  >
                    <span className="font-black text-white text-sm">{user?.name?.[0]?.toUpperCase()}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0 overflow-hidden"
                  style={{ maxWidth: sidebarOpen ? "140px" : "0px", opacity: sidebarOpen ? 1 : 0, transition: "max-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease" }}>
                  <p className="text-xs font-black truncate text-slate-800 uppercase tracking-wider">
                    {isDoctor() ? `DR. ${user?.name}` : user?.name}
                  </p>
                  <p className="text-[10px] truncate text-slate-500 font-medium">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-xl transition-all shrink-0 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 overflow-hidden"
                  title="Logout"
                  style={{ maxWidth: sidebarOpen ? "32px" : "0px", opacity: sidebarOpen ? 1 : 0, padding: sidebarOpen ? undefined : 0, transition: "max-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, padding 0.35s ease" }}
                >
                  <LogOut className="w-4 h-4" />
                </button>
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
            <div className="flex items-center px-5 py-3 gap-4">
              {/* Back Button */}
              {(location.pathname === "/profile" || location.pathname === "/ai-chat") && (
                <button
                  onClick={() => navigate("/dashboard")}
                  className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all"
                  style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.8)" }}
                >
                  <ArrowLeft size={18} className="text-slate-700" strokeWidth={2.5} />
                </button>
              )}

              {location.pathname === "/profile" ? (
                <div className="flex-1 flex justify-center">
                  <span className="font-bold text-lg text-slate-800" style={{ fontFamily: "Poppins, sans-serif", letterSpacing: "-0.4px" }}>
                    My Profile
                  </span>
                </div>
              ) : (
                <>
                  {/* Profile avatar + greeting */}
                  <button
                    onClick={() => navigate("/profile")}
                    className="tour-profile shrink-0 rounded-full overflow-hidden transition-all hover:ring-4 hover:ring-emerald-100"
                    style={{ width: 42, height: 42, border: "2px solid rgba(255,255,255,0.9)", boxShadow: "0 2px 8px rgba(16,185,129,0.15)" }}
                  >
                    {user?.profilePicture ? (
                      <img src={user.profilePicture} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-black text-white"
                        style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}>
                        {user?.name?.[0] || "U"}
                      </div>
                    )}
                  </button>

                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-[15px] text-slate-800 leading-tight" style={{ fontFamily: "Poppins, sans-serif", letterSpacing: "-0.3px" }}>
                      Hello {user?.name?.split(" ")[0] || "User"}!
                    </span>
                    <span className="text-[12px] font-semibold text-emerald-600 leading-tight">{getGreeting()}</span>
                  </div>

                  <div className="flex-1" />

                  {/* Right side actions */}
                  <div className="flex items-center gap-2">
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
