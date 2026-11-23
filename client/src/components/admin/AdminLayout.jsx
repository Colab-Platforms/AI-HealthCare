import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Activity,
  UserPlus,
  FileText,
  Utensils,
  MessageCircle,
  Smartphone,
  ShoppingBag,
  CreditCard,
  Zap,
  Bell,
  Menu,
  X,
  LogOut,
  User,
  ShieldCheck,
  ChevronDown,
  ExternalLink,
  BarChart3,
  Globe2,
  Route,
  Boxes,
  ClipboardList,
  History,
  Megaphone,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { notificationService } from "../../services/api";
import NotificationPanel from "../NotificationPanel";
import { EASE } from "./adminTheme";

// Navigation grouped by job. Backend permissions still decide what each role may do;
// this only controls what is shown.
export const ADMIN_NAV_GROUPS = [
  {
    title: "Overview",
    items: [{ path: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true }],
  },
  {
    title: "People",
    items: [
      { path: "/admin/users", icon: Users, label: "Users" },
      { path: "/admin/activity", icon: Activity, label: "User Intelligence" },
      { path: "/admin/creator-applications", icon: UserPlus, label: "Creator Applications" },
    ],
  },
  {
    title: "Health & Nutrition",
    items: [
      { path: "/admin/reports", icon: FileText, label: "Health Reports" },
      { path: "/admin/food-cache", icon: Utensils, label: "Food Database" },
    ],
  },
  {
    title: "Operations",
    items: [
      { path: "/admin/support", icon: MessageCircle, label: "Support Tickets" },
      { path: "/admin/subscriptions", icon: CreditCard, label: "Subscriptions" },
      { path: "/admin/shop", icon: ShoppingBag, label: "Shop" },
      { path: "/admin/app-version", icon: Smartphone, label: "App Version" },
    ],
  },
  {
    title: "Intelligence",
    items: [{ path: "/admin/ai-usage", icon: Zap, label: "AI Usage & Cost" }],
  },
];

export const TAKE_ADMIN_NAV_GROUPS = [
  {
    title: "Analytics",
    items: [
      { path: "/take-admin", icon: BarChart3, label: "Dashboard", exact: true },
      { path: "/take-admin/regional", icon: Globe2, label: "Regional" },
      { path: "/take-admin/behaviour", icon: Route, label: "User Behaviour" },
      { path: "/take-admin/features", icon: Boxes, label: "Feature Usage" },
    ],
  },
  {
    title: "Growth",
    items: [{ path: "/take-admin/marketing", icon: Megaphone, label: "Marketing & Campaigns" }],
  },
  {
    title: "My work",
    items: [
      { path: "/take-admin/requests", icon: ClipboardList, label: "My Requests" },
      { path: "/take-admin/activity", icon: History, label: "My Activity" },
    ],
  },
];

const ROLE_LABEL = { admin: "Admin", takeadmin: "Take Admin", superadmin: "Super Admin" };

const pageTitleFor = (pathname, groups) => {
  const flatNav = groups.flatMap((g) => g.items);
  if (pathname.startsWith("/admin/shop/")) return "Shop";
  const hit = [...flatNav].sort((a, b) => b.path.length - a.path.length).find((i) => pathname === i.path || pathname.startsWith(i.path + "/"));
  return hit?.label || "Admin";
};

const SIDEBAR_OPEN = 264;
const SIDEBAR_RAIL = 76;

export default function AdminLayout({ children, navGroups = ADMIN_NAV_GROUPS, homePath = "/admin" }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const profileRef = useRef(null);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Close menus when the route changes.
  useEffect(() => {
    setDrawerOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!profileOpen) return;
    const h = (e) => profileRef.current && !profileRef.current.contains(e.target) && setProfileOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [profileOpen]);

  const refreshUnread = () =>
    notificationService
      .getUnreadCount()
      .then(({ data }) => {
        const c = typeof data?.unreadCount === "object" ? data.unreadCount.unreadCount : data?.unreadCount;
        setUnread(Number(c) || 0);
      })
      .catch(() => {});

  useEffect(() => {
    if (!user) return;
    refreshUnread();
    const id = setInterval(refreshUnread, 60000);
    return () => clearInterval(id);
  }, [user]);

  const isImpersonating = !!localStorage.getItem("originalAdminToken");
  const handleRestoreAdmin = () => {
    const t = localStorage.getItem("originalAdminToken");
    const u = localStorage.getItem("originalAdminUser");
    if (t && u) {
      localStorage.setItem("token", t);
      localStorage.setItem("user", u);
      localStorage.removeItem("originalAdminToken");
      localStorage.removeItem("originalAdminUser");
      window.location.href = "/admin/users";
    }
  };
  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const railMode = isDesktop && collapsed;
  const sidebarWidth = isDesktop ? (collapsed ? SIDEBAR_RAIL : SIDEBAR_OPEN) : SIDEBAR_OPEN;
  const initial = user?.name?.[0]?.toUpperCase() || "A";
  const roleLabel = ROLE_LABEL[user?.role] || "Admin";

  const SidebarBody = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="h-[72px] shrink-0 flex items-center justify-between px-4 border-b border-tk-line">
        <Link to={homePath} className="flex items-center min-w-0 overflow-hidden" aria-label="Take Health admin home">
          <img
            src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/logo_with_text-1.png?v=1774261099"
            alt="Take Health"
            className={`h-11 w-auto object-contain transition-opacity duration-200 ${railMode ? "opacity-0 w-0" : "opacity-100"}`}
          />
        </Link>
        <button
          onClick={() => (isDesktop ? setCollapsed((c) => !c) : setDrawerOpen(false))}
          className="w-9 h-9 grid place-items-center rounded-xl text-tk-muted hover:text-tk-blue hover:bg-tk-blue/10 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-tk-blue/20"
          aria-label={isDesktop ? (collapsed ? "Expand sidebar" : "Collapse sidebar") : "Close menu"}
        >
          {isDesktop ? <Menu className="w-[18px] h-[18px]" /> : <X className="w-[18px] h-[18px]" />}
        </button>
      </div>

      {/* Role chip */}
      <div className={`px-4 pt-4 ${railMode ? "hidden" : "block"}`}>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tk-teal-soft text-tk-teal text-[11px] font-bold">
          <ShieldCheck className="w-3.5 h-3.5" /> {roleLabel} Panel
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-5" aria-label="Admin navigation">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className={`px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-tk-muted/80 ${railMode ? "hidden" : "block"}`}>
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ path, icon: Icon, label, exact }) => (
                <li key={path}>
                  <NavLink
                    to={path}
                    end={exact}
                    title={railMode ? label : undefined}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 h-11 rounded-xl px-3 text-[13.5px] font-semibold transition-colors
                       focus:outline-none focus-visible:ring-4 focus-visible:ring-tk-blue/20
                       ${isActive ? "text-tk-blue" : "text-slate-600 hover:text-tk-ink hover:bg-slate-100/80"}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.span
                            layoutId="admin-nav-active"
                            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                            className="absolute inset-0 rounded-xl bg-tk-blue/10"
                          />
                        )}
                        {isActive && <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-tk-blue" />}
                        <Icon className={`relative w-[19px] h-[19px] shrink-0 transition-transform duration-200 ${isActive ? "" : "group-hover:scale-110"}`} />
                        <span className={`relative truncate transition-opacity duration-200 ${railMode ? "opacity-0 w-0" : "opacity-100"}`}>{label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: patient app link + profile */}
      <div className="shrink-0 border-t border-tk-line p-3 space-y-2" ref={profileRef}>
        <Link
          to="/dashboard"
          title={railMode ? "Open patient app" : undefined}
          className="flex items-center gap-3 h-10 px-3 rounded-xl text-xs font-semibold text-tk-muted hover:text-tk-blue hover:bg-tk-blue/10 transition-colors"
        >
          <ExternalLink className="w-4 h-4 shrink-0" />
          <span className={`truncate ${railMode ? "hidden" : "block"}`}>Open patient app</span>
        </Link>

        <div className="relative">
          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="absolute bottom-[calc(100%+8px)] left-0 right-0 min-w-[200px] bg-white rounded-2xl border border-tk-line shadow-[0_16px_40px_-12px_rgba(11,27,58,0.25)] overflow-hidden z-50"
              >
                <button
                  onClick={() => navigate("/profile")}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-tk-ink hover:bg-slate-50 transition-colors"
                >
                  <User className="w-4 h-4 text-tk-blue" /> Account details
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-tk-error hover:bg-tk-error/5 transition-colors border-t border-tk-line"
                >
                  <LogOut className="w-4 h-4" /> Log out
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => (railMode ? setCollapsed(false) : setProfileOpen((p) => !p))}
            className="w-full flex items-center gap-3 p-2 rounded-xl border border-tk-line bg-white hover:border-tk-action hover:shadow-sm transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-tk-blue/20"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
          >
            <span className="w-9 h-9 rounded-lg grid place-items-center overflow-hidden shrink-0 bg-gradient-to-br from-tk-blue to-tk-action text-white font-extrabold text-sm">
              {user?.profilePicture ? <img src={user.profilePicture} alt="" className="w-full h-full object-cover" /> : initial}
            </span>
            <span className={`flex-1 min-w-0 text-left ${railMode ? "hidden" : "block"}`}>
              <span className="block text-[12px] font-bold text-tk-ink truncate">{user?.name}</span>
              <span className="block text-[11px] text-tk-muted truncate">{user?.email}</span>
            </span>
            <ChevronDown className={`w-4 h-4 text-tk-muted shrink-0 transition-transform ${profileOpen ? "rotate-180" : ""} ${railMode ? "hidden" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="tk-admin min-h-screen bg-tk-bg text-tk-ink">
      {isImpersonating && (
        <div className="sticky top-0 z-[70] bg-tk-ink text-white px-4 py-2 flex items-center justify-between text-xs font-bold">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-tk-warn animate-pulse" />
            Impersonating <span className="text-tk-warn">{user?.name}</span>
          </span>
          <button onClick={handleRestoreAdmin} className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
            Stop &amp; return
          </button>
        </div>
      )}

      <div className="flex">
        {/* Desktop sidebar */}
        {isDesktop && (
          <motion.aside
            initial={false}
            animate={{ width: sidebarWidth }}
            transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
            className="sticky top-0 h-screen shrink-0 bg-white border-r border-tk-line overflow-hidden z-30"
          >
            {SidebarBody}
          </motion.aside>
        )}

        {/* Mobile drawer */}
        <AnimatePresence>
          {!isDesktop && drawerOpen && (
            <>
              <motion.div
                key="scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-tk-ink/40 backdrop-blur-[2px]"
                onClick={() => setDrawerOpen(false)}
              />
              <motion.aside
                key="drawer"
                initial={{ x: -SIDEBAR_OPEN }}
                animate={{ x: 0 }}
                exit={{ x: -SIDEBAR_OPEN }}
                transition={{ duration: 0.28, ease: EASE }}
                className="fixed inset-y-0 left-0 z-50 w-[264px] bg-white shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
              >
                {SidebarBody}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main column */}
        <div className="flex-1 min-w-0 flex flex-col min-h-screen">
          <header className="sticky top-0 z-20 h-[72px] flex items-center gap-3 px-4 md:px-8 bg-white/85 backdrop-blur-md border-b border-tk-line">
            {!isDesktop && (
              <button
                onClick={() => setDrawerOpen(true)}
                className="w-10 h-10 grid place-items-center rounded-xl border border-tk-line text-tk-ink hover:border-tk-action hover:text-tk-blue transition-colors"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-tk-muted">{roleLabel} panel</p>
              <AnimatePresence mode="wait">
                <motion.h2
                  key={location.pathname}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="text-lg font-extrabold tracking-tight truncate"
                >
                  {pageTitleFor(location.pathname, navGroups)}
                </motion.h2>
              </AnimatePresence>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <motion.button
                  whileTap={reduce ? undefined : { scale: 0.93 }}
                  onClick={() => setNotifOpen((o) => !o)}
                  className="relative w-10 h-10 grid place-items-center rounded-xl border border-tk-line text-tk-ink hover:border-tk-action hover:text-tk-blue transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-tk-blue/20"
                  aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
                >
                  <Bell className="w-[18px] h-[18px]" />
                  <AnimatePresence>
                    {unread > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-tk-error text-white text-[10px] font-bold grid place-items-center"
                      >
                        {unread > 9 ? "9+" : unread}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
                <NotificationPanel
                  isOpen={notifOpen}
                  onClose={() => {
                    setNotifOpen(false);
                    refreshUnread();
                  }}
                />
              </div>

              <span className="hidden sm:grid w-10 h-10 rounded-xl place-items-center overflow-hidden bg-gradient-to-br from-tk-blue to-tk-action text-white font-extrabold text-sm" aria-hidden>
                {user?.profilePicture ? <img src={user.profilePicture} alt="" className="w-full h-full object-cover" /> : initial}
              </span>
            </div>
          </header>

          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: EASE }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
