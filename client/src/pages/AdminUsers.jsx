import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Search,
  UserCheck,
  UserX,
  Eye,
  X,
  Mail,
  Smartphone,
  Award,
  Activity,
  ExternalLink,
  Trash2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Users as UsersIcon,
  ShieldAlert,
} from "lucide-react";
import { adminService } from "../services/api";
import toast from "react-hot-toast";
import SEO from "../hooks/useSEO";
import { useAuth } from "../context/AuthContext";
import { Skeleton, EmptyState } from "../components/admin/AdminUI";
import { EASE, container, riseIn } from "../components/admin/adminTheme";
import { maskEmail, maskPhone } from "../components/admin/masking";

const EMPTY_FILTERS = {
  ageMin: "",
  ageMax: "",
  gender: "all",
  isDiabetic: "all",
  dietaryPreference: "all",
  isActive: "all",
  role: "all",
  startDate: "",
  endDate: "",
};

const ROLE_STYLE = {
  superadmin: "bg-tk-ink text-white",
  takeadmin: "bg-tk-info/15 text-sky-700",
  admin: "bg-tk-blue/10 text-tk-blue",
  doctor: "bg-tk-warn/20 text-amber-700",
  user: "bg-tk-teal-soft text-tk-teal",
};

const inputCls =
  "w-full h-10 px-3 bg-white border border-tk-line rounded-xl text-sm font-medium text-tk-ink placeholder:text-slate-400 " +
  "focus:outline-none focus:border-tk-blue focus:ring-4 focus:ring-tk-blue/10 transition-all";

const displayRole = (r) => (r === "patient" || r === "client" ? "user" : r);

function RolePill({ role }) {
  const r = displayRole(role);
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${ROLE_STYLE[r] || "bg-slate-100 text-slate-600"}`}>
      {r === "superadmin" ? "Super admin" : r === "takeadmin" ? "Take admin" : r}
    </span>
  );
}

function Avatar({ name, size = "w-10 h-10", text = "text-sm" }) {
  return (
    <span className={`${size} ${text} shrink-0 rounded-xl grid place-items-center font-extrabold text-white bg-gradient-to-br from-tk-blue to-tk-action`}>
      {name?.[0]?.toUpperCase() || "?"}
    </span>
  );
}

function FilterField({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-tk-muted mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="p-3.5 bg-white border border-tk-line rounded-2xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-tk-muted mb-1">{label}</p>
      <p className="text-sm font-bold text-tk-ink break-words">{value}</p>
    </div>
  );
}

function InfoCard({ icon: Icon, title, rows }) {
  return (
    <div className="p-4 bg-tk-bg rounded-2xl border border-tk-line">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted mb-3 flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-tk-blue" /> {title}
      </p>
      <dl className="space-y-2.5">
        {rows.map(([k, v, cls]) => (
          <div key={k} className="flex justify-between gap-3 text-sm">
            <dt className="text-tk-muted">{k}</dt>
            <dd className={`font-bold text-right ${cls || "text-tk-ink"}`}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function AdminUsers() {
  const { isSuperAdmin } = useAuth();
  const reduce = useReducedMotion();
  const superAdmin = isSuperAdmin();

  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [userDetail, setUserDetail] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState(EMPTY_FILTERS);

  const activeFilterCount = Object.entries(advancedFilters).filter(([k, v]) => v !== "" && v !== "all").length;

  // Contact details are masked unless the viewer is a Super Admin (spec: Admin/Take Admin see masked contacts).
  const showEmail = (e) => (superAdmin ? e : maskEmail(e));
  const showPhone = (p) => (superAdmin ? p : maskPhone(p));

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const queryParams = {
        page,
        limit: 12,
        search,
        ageMin: advancedFilters.ageMin,
        ageMax: advancedFilters.ageMax,
        gender: advancedFilters.gender !== "all" ? advancedFilters.gender : undefined,
        isDiabetic: advancedFilters.isDiabetic !== "all" ? advancedFilters.isDiabetic : undefined,
        dietaryPreference: advancedFilters.dietaryPreference !== "all" ? advancedFilters.dietaryPreference : undefined,
        isActive: advancedFilters.isActive !== "all" ? advancedFilters.isActive : undefined,
        role: advancedFilters.role !== "all" ? advancedFilters.role : undefined,
        startDate: advancedFilters.startDate,
        endDate: advancedFilters.endDate,
      };

      const { data } = await adminService.getUsers(queryParams);
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      const errorData = err.response?.data;
      const message = errorData?.message || "Connection failed";
      const hint = errorData?.hint ? ` (${errorData.hint})` : " - Check server status";
      toast.error(`Admin Registry: ${message}${hint}`);
      console.error("Admin API Failure:", errorData || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 400);
    return () => clearTimeout(timer);
  }, [page, search, advancedFilters]);

  useEffect(() => {
    if (!userDetail) return;
    const onKey = (e) => e.key === "Escape" && setUserDetail(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [userDetail]);

  const setFilter = (key, value) => {
    setAdvancedFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const handleUpdateRole = async (userId, newRole) => {
    setUpdating(true);
    try {
      await adminService.updateUserRole(userId, newRole);
      toast.success(`Role updated to ${newRole}`);
      if (userDetail?._id === userId) setUserDetail({ ...userDetail, role: newRole });
      fetchUsers();
    } catch (err) {
      toast.error("Role update failed");
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      await adminService.updateUserStatus(user._id, !user.isActive);
      toast.success(`User ${user.isActive ? "Deactivated" : "Activated"}`);
      if (userDetail?._id === user._id) setUserDetail({ ...userDetail, isActive: !user.isActive });
      fetchUsers();
    } catch (err) {
      toast.error("Status sync failed");
    }
  };

  const handleImpersonate = async (userId) => {
    try {
      const { data } = await adminService.impersonateUser(userId);
      if (!localStorage.getItem("originalAdminToken")) {
        localStorage.setItem("originalAdminToken", localStorage.getItem("token"));
        localStorage.setItem("originalAdminUser", localStorage.getItem("user"));
      }
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data));
      toast.success("Switching to user view...");
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error("Impersonation failed");
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`CRITICAL ACTION: Are you sure you want to PERMANENTLY delete user "${userName}"? .`)) return;
    try {
      await adminService.deleteUser(userId);
      toast.success("User permanently deleted");
      if (userDetail?._id === userId) setUserDetail(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Purge operation failed");
    }
  };

  const viewDetails = async (user) => {
    setDetailLoading(true);
    setUserDetail(user);
    try {
      const { data } = await adminService.getUserDetails(user._id);
      setUserDetail(data.user || user);
    } catch (err) {
      console.error("Detail fetch error:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const d = userDetail;
  const iconBtn =
    "w-9 h-9 grid place-items-center rounded-xl text-tk-muted transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-tk-blue/20";

  return (
    <div className="p-6 md:p-8 space-y-6 w-full max-w-[1600px] mx-auto">
      <SEO pageName="adminUsers" />

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        {/* Header */}
        <motion.div variants={riseIn} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-tk-blue grid place-items-center shadow-[0_10px_24px_-8px_rgba(32,90,226,0.55)]">
              <UsersIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-[26px] font-extrabold tracking-tight text-tk-ink leading-tight">User Registry</h1>
              <p className="text-sm text-tk-muted">{total.toLocaleString()} total identities</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-tk-muted pointer-events-none" />
              <input
                type="search"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                aria-label="Search users"
                className={inputCls + " !h-11 pl-10"}
              />
            </div>

            <motion.button
              whileTap={reduce ? undefined : { scale: 0.96 }}
              onClick={() => setShowAdvancedFilters((s) => !s)}
              aria-expanded={showAdvancedFilters}
              className={`relative h-11 px-4 rounded-xl border text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors
                focus:outline-none focus-visible:ring-4 focus-visible:ring-tk-blue/20 ${
                  showAdvancedFilters ? "bg-tk-blue text-white border-tk-blue" : "bg-white text-tk-blue border-tk-blue/25 hover:border-tk-blue"
                }`}
            >
              <SlidersHorizontal className="w-4 h-4" /> Filters
              {activeFilterCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-tk-error text-white text-[11px] font-bold grid place-items-center">
                  {activeFilterCount}
                </span>
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* Filters */}
        <AnimatePresence initial={false}>
          {showAdvancedFilters && (
            <motion.div
              key="filters"
              initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="bg-white border border-tk-line rounded-2xl p-5">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {["ageMin", "ageMax"].map((k) => (
                    <FilterField key={k} label={k === "ageMin" ? "Age min" : "Age max"}>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder={k === "ageMin" ? "Min" : "Max"}
                        value={advancedFilters[k]}
                        onChange={(e) => /^\d*$/.test(e.target.value) && setFilter(k, e.target.value)}
                        className={inputCls}
                      />
                    </FilterField>
                  ))}

                  <FilterField label="Gender">
                    <select value={advancedFilters.gender} onChange={(e) => setFilter("gender", e.target.value)} className={inputCls}>
                      <option value="all">All</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </FilterField>

                  <FilterField label="Diabetic">
                    <select value={advancedFilters.isDiabetic} onChange={(e) => setFilter("isDiabetic", e.target.value)} className={inputCls}>
                      <option value="all">All</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </FilterField>

                  <FilterField label="Diet">
                    <select value={advancedFilters.dietaryPreference} onChange={(e) => setFilter("dietaryPreference", e.target.value)} className={inputCls}>
                      <option value="all">All</option>
                      <option value="vegetarian">Vegetarian</option>
                      <option value="non-vegetarian">Non-veg</option>
                      <option value="vegan">Vegan</option>
                      <option value="eggetarian">Eggetarian</option>
                    </select>
                  </FilterField>

                  <FilterField label="Role">
                    <select value={advancedFilters.role} onChange={(e) => setFilter("role", e.target.value)} className={inputCls}>
                      <option value="all">All</option>
                      <option value="user">User</option>
                      <option value="patient">Patient</option>
                      <option value="doctor">Doctor</option>
                      <option value="admin">Admin</option>
                      <option value="takeadmin">Take Admin</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                  </FilterField>

                  <FilterField label="Status">
                    <select value={advancedFilters.isActive} onChange={(e) => setFilter("isActive", e.target.value)} className={inputCls}>
                      <option value="all">All</option>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </FilterField>

                  <FilterField label="From">
                    <input type="date" value={advancedFilters.startDate} onChange={(e) => setFilter("startDate", e.target.value)} className={inputCls} />
                  </FilterField>

                  <FilterField label="To">
                    <input type="date" value={advancedFilters.endDate} onChange={(e) => setFilter("endDate", e.target.value)} className={inputCls} />
                  </FilterField>

                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setAdvancedFilters(EMPTY_FILTERS);
                        setPage(1);
                      }}
                      className="w-full h-10 rounded-xl bg-slate-100 hover:bg-tk-blue/10 hover:text-tk-blue text-slate-700 font-bold text-sm transition-colors"
                    >
                      Reset filters
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table */}
        <motion.div variants={riseIn} className="bg-white rounded-3xl border border-tk-line overflow-hidden">
          {loading ? (
            <div className="p-5 space-y-3" aria-busy="true">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-20">
              <EmptyState title="No users match" hint="Clear the search or reset the filters." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[860px]">
                <thead>
                  <tr className="bg-tk-bg border-b border-tk-line">
                    {["User", "Age", "Gender", "Diabetic", "Role", "Registered", "Actions"].map((h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={`px-6 py-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted ${i === 6 ? "text-right" : ""}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <motion.tr
                      key={u._id}
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(i, 10) * 0.025, ease: EASE }}
                      className="border-b border-tk-line last:border-0 hover:bg-tk-blue/[0.03] transition-colors"
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-tk-ink truncate">{u.name}</p>
                            <p className="text-xs text-tk-muted truncate">{showEmail(u.email)}</p>
                          </div>
                          {!u.isActive && (
                            <span className="ml-1 px-2 py-0.5 rounded-full bg-tk-error/10 text-tk-error text-[10px] font-bold">Suspended</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-sm font-semibold text-slate-700">{u.profile?.age || "–"}</td>
                      <td className="px-6 py-3.5 text-sm font-semibold text-slate-700 capitalize">{u.profile?.gender || "–"}</td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            u.profile?.isDiabetic === "yes" ? "bg-tk-error/10 text-tk-error" : "bg-tk-teal-soft text-tk-teal"
                          }`}
                        >
                          {u.profile?.isDiabetic === "yes" ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <RolePill role={u.role} />
                      </td>
                      <td className="px-6 py-3.5">
                        <p className="text-sm font-semibold text-slate-700">
                          {new Date(u.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                        <p className="text-xs text-tk-muted">
                          {new Date(u.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
                        </p>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => viewDetails(u)}
                            title="View details"
                            aria-label={`View details for ${u.name}`}
                            className={`${iconBtn} hover:text-tk-blue hover:bg-tk-blue/10`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {superAdmin && (
                            <>
                              <button
                                onClick={() => handleToggleStatus(u)}
                                title={u.isActive ? "Suspend" : "Restore"}
                                aria-label={u.isActive ? `Suspend ${u.name}` : `Restore ${u.name}`}
                                className={`${iconBtn} ${
                                  u.isActive ? "hover:text-tk-error hover:bg-tk-error/10" : "text-tk-teal hover:text-white hover:bg-tk-teal"
                                }`}
                              >
                                {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u._id, u.name)}
                                title="Delete permanently"
                                aria-label={`Delete ${u.name}`}
                                className={`${iconBtn} hover:text-tk-error hover:bg-tk-error/10`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-tk-line flex items-center justify-between">
            <p className="text-sm font-semibold text-tk-muted">
              Page {page} of {pages}
            </p>
            <div className="flex gap-2">
              {[
                { Icon: ChevronLeft, label: "Previous page", disabled: page === 1, go: () => setPage((p) => p - 1) },
                { Icon: ChevronRight, label: "Next page", disabled: page === pages, go: () => setPage((p) => p + 1) },
              ].map(({ Icon, label, disabled, go }) => (
                <button
                  key={label}
                  disabled={disabled}
                  onClick={go}
                  aria-label={label}
                  className="w-9 h-9 rounded-xl border border-tk-line grid place-items-center text-tk-muted disabled:opacity-30
                    hover:bg-tk-blue hover:border-tk-blue hover:text-white transition-colors active:scale-95"
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Details drawer */}
      <AnimatePresence>
        {d && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setUserDetail(null)}
              className="fixed inset-0 z-[90] bg-tk-ink/40 backdrop-blur-[2px]"
            />
            <motion.aside
              key="drawer"
              role="dialog"
              aria-modal="true"
              aria-label="User details"
              initial={reduce ? { opacity: 0 } : { x: "100%" }}
              animate={reduce ? { opacity: 1 } : { x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: "100%" }}
              transition={{ duration: 0.3, ease: EASE }}
              className="fixed inset-y-0 right-0 z-[100] w-full max-w-[640px] bg-white shadow-2xl flex flex-col"
            >
              <div className="shrink-0 px-6 py-5 border-b border-tk-line flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-tk-ink">Identity profile</h2>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted">
                    {detailLoading ? "Loading full details…" : "Management oversight"}
                  </p>
                </div>
                <button
                  onClick={() => setUserDetail(null)}
                  aria-label="Close"
                  className="w-10 h-10 grid place-items-center rounded-xl text-tk-muted hover:text-tk-ink hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-tk-blue/20"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-7">
                <div className="flex items-center gap-4">
                  <Avatar name={d.name} size="w-16 h-16" text="text-2xl" />
                  <div className="min-w-0">
                    <h3 className="text-xl font-extrabold text-tk-ink leading-tight truncate">{d.name}</h3>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      <RolePill role={d.role} />
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          d.isActive ? "bg-tk-teal-soft text-tk-teal" : "bg-tk-error/10 text-tk-error"
                        }`}
                      >
                        {d.isActive ? "Active" : "Suspended"}
                      </span>
                    </div>
                  </div>
                </div>

                <section>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted mb-3">Authority control</p>
                  {superAdmin ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {["user", "admin", "takeadmin", "superadmin"].map((r) => {
                        const current = d.role === r || (d.role === "patient" && r === "user");
                        return (
                          <button
                            key={r}
                            onClick={() => handleUpdateRole(d._id, r)}
                            disabled={current || updating}
                            aria-pressed={current}
                            className={`h-11 rounded-xl text-[13px] font-bold border transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-tk-blue/20 ${
                              current
                                ? "bg-tk-blue text-white border-tk-blue shadow-[0_8px_20px_-8px_rgba(32,90,226,0.6)]"
                                : "bg-white text-slate-600 border-tk-line hover:border-tk-action hover:text-tk-blue disabled:opacity-50"
                            }`}
                          >
                            {r === "takeadmin" ? "Take Admin" : r === "superadmin" ? "Super Admin" : r.charAt(0).toUpperCase() + r.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 bg-tk-bg rounded-2xl border border-tk-line flex items-start gap-3">
                      <ShieldAlert className="w-5 h-5 text-tk-blue shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-600 font-medium">
                        Only Super Admins can change roles. Current role: <b className="text-tk-ink">{displayRole(d.role)}</b>
                      </p>
                    </div>
                  )}
                </section>

                <section>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted mb-3">Contact</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3.5 bg-tk-bg rounded-xl border border-tk-line">
                      <Mail className="w-4 h-4 text-tk-blue shrink-0" />
                      <p className="text-sm font-semibold text-tk-ink truncate">{showEmail(d.email)}</p>
                    </div>
                    <div className="flex items-center gap-3 p-3.5 bg-tk-bg rounded-xl border border-tk-line">
                      <Smartphone className="w-4 h-4 text-tk-blue shrink-0" />
                      <p className="text-sm font-semibold text-tk-ink">{d.phone ? showPhone(d.phone) : "No mobile linked"}</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted">Health &amp; lifestyle</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <InfoTile label="Gender" value={d.profile?.gender || "–"} />
                    <InfoTile label="Age" value={d.profile?.age || "–"} />
                    <InfoTile label="Goal" value={d.nutritionGoal?.goal || "General"} />
                    <InfoTile label="Blood group" value={d.profile?.bloodGroup || "–"} />
                    <InfoTile label="Height" value={d.profile?.height ? `${d.profile.height} cm` : "–"} />
                    <InfoTile label="Weight" value={d.profile?.weight ? `${d.profile.weight} kg` : "–"} />
                    <InfoTile label="Since" value={new Date(d.createdAt).toLocaleDateString()} />
                    <InfoTile label="Status" value={d.isActive ? "Active" : "Suspended"} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <InfoCard
                      icon={Activity}
                      title="Medical context"
                      rows={[
                        ["Diabetic", d.profile?.isDiabetic?.toUpperCase() || "NO"],
                        ["Allergies", d.profile?.allergies?.length ? d.profile.allergies.join(", ") : "None"],
                        ["Conditions", d.profile?.chronicConditions?.length ? d.profile.chronicConditions.join(", ") : "None"],
                      ]}
                    />
                    <InfoCard
                      icon={Award}
                      title="System health"
                      rows={[
                        ["BMI", d.healthMetrics?.bmi || "–"],
                        [
                          "Plan",
                          d.subscription?.plan?.toUpperCase() || "FREE",
                          ["premium", "take_plus"].includes(d.subscription?.plan) ? "text-amber-600" : "",
                        ],
                        ["Verified", d.isEmailVerified ? "YES" : "PENDING", d.isEmailVerified ? "text-tk-teal" : "text-amber-600"],
                      ]}
                    />
                    <InfoCard
                      icon={Activity}
                      title="Habits & lifestyle"
                      rows={[
                        ["Sleep", d.profile?.lifestyle?.sleepHours ? `${d.profile.lifestyle.sleepHours} hrs` : "–"],
                        ["Stress", d.profile?.lifestyle?.stressLevel?.toUpperCase() || "–"],
                        ["Water", d.profile?.lifestyle?.waterIntake ? `${d.profile.lifestyle.waterIntake} glasses` : "–"],
                      ]}
                    />
                    <InfoCard
                      icon={Award}
                      title="Preferences"
                      rows={[
                        ["Activity", d.profile?.activityLevel?.replace("_", " ")?.toUpperCase() || "SEDENTARY"],
                        ["Cuisine", d.profile?.dietPreferences?.cuisinePreference || "General"],
                        ["Dietary", d.profile?.dietaryPreference?.toUpperCase() || "–"],
                      ]}
                    />
                  </div>
                </section>
              </div>

              <div className="shrink-0 p-5 border-t border-tk-line bg-white flex gap-3">
                {superAdmin ? (
                  <>
                    <button
                      onClick={() => handleImpersonate(d._id)}
                      className="flex-1 h-12 rounded-xl bg-tk-blue text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-tk-action transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-tk-blue/30"
                    >
                      <ExternalLink className="w-4 h-4" /> Login as this user
                    </button>
                    <button
                      onClick={() => handleToggleStatus(d)}
                      className={`flex-1 h-12 rounded-xl font-bold text-sm border transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-tk-blue/20 ${
                        d.isActive
                          ? "bg-white text-tk-error border-tk-error/30 hover:bg-tk-error/5"
                          : "bg-tk-teal text-white border-tk-teal hover:opacity-90"
                      }`}
                    >
                      {d.isActive ? "Suspend identity" : "Restore identity"}
                    </button>
                    <button
                      onClick={() => handleDeleteUser(d._id, d.name)}
                      title="Delete user permanently"
                      aria-label="Delete user permanently"
                      className="w-12 h-12 grid place-items-center rounded-xl bg-tk-error text-white hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-4 focus-visible:ring-tk-error/30"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-tk-muted font-semibold py-3">Super Admin access is required to act on this user.</p>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
