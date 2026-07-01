import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SEO from "../hooks/useSEO";
import { useAuth } from "../context/AuthContext";
import { Activity, Mail, Lock, Eye, EyeOff, ArrowRight, Smartphone, ChevronDown, Download, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

const APK_URL = "https://github.com/patilabhiraj/take-health-download/releases/download/v1.0.0/Take.Health.apk";

function ApkBanner() {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full mb-5 rounded-2xl overflow-hidden border border-emerald-100"
      style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)" }}>

      {/* Header row — always visible */}
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 gap-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(5,150,105,0.12)" }}>
            <Smartphone className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-[12px] font-black text-emerald-800 tracking-tight leading-tight">Android App Available</p>
            <p className="text-[10px] text-emerald-600 font-semibold leading-tight">Beta APK • Play Store coming soon</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
            {open ? "Hide" : "How to Install"}
          </span>
          <ChevronDown className={`w-4 h-4 text-emerald-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Expandable instructions */}
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Warning note */}
          <div className="flex items-start gap-2.5 rounded-xl p-3"
            style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)" }}>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-black text-amber-700 leading-tight">Android may show a security warning</p>
              <p className="text-[10px] text-amber-600 leading-relaxed mt-0.5">
                This is normal for apps not yet on the Play Store. We are waiting for our DUNS number to publish on Google Play. The app is 100% official and safe.
              </p>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            {[
              "Tap the Download button below",
              'Open the downloaded APK file from your notifications or Downloads folder',
              'If prompted, tap "Install anyway" — or go to Settings → Security → enable "Install unknown apps"',
              "App installs in seconds. Login with your account.",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(5,150,105,0.12)" }}>
                  <span className="text-[10px] font-black text-emerald-700">{i + 1}</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">{step}</p>
              </div>
            ))}
          </div>

          {/* Download button */}
          <a
            href={APK_URL}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-black tracking-wide transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #059669, #10b981)", boxShadow: "0 4px 16px rgba(5,150,105,0.3)" }}
          >
            <Download className="w-4 h-4" />
            Download take.health APK
          </a>
          <p className="text-center text-[9px] text-slate-400 font-medium">v1.0.0 Beta • Android 8.0+</p>
        </div>
      )}
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const attemptLogin = async (retryCount = 0) => {
      let loadingToastId = null;
      try {
        const user = await login(email, password);
        toast.success("Welcome back!");
        navigate(
          user.role === "admin" || user.role === "superadmin"
            ? "/admin"
            : user.role === "doctor"
              ? "/doctor/dashboard"
              : "/dashboard",
        );
      } catch (error) {
        const status = error.response?.status;
        const errorMsg =
          error.response?.data?.message ||
          error.message ||
          "Unable to sign in. Please check your credentials and try again.";

        // Handle 503 (database connection) errors with retry
        if (status === 503 && retryCount < 2) {
          console.log(
            `Database connection failed, retrying... (attempt ${retryCount + 1}/2)`,
          );
          loadingToastId = toast.loading(
            "Connecting to database, please wait...",
          );

          // Wait 2 seconds before retrying
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return attemptLogin(retryCount + 1);
        }

        // Check for network errors
        if (!error.response) {
          toast.error(
            "Network error - Check if server is running and accessible",
          );
          console.error("Connection details:", {
            apiUrl: error.config?.baseURL,
            host: window.location.hostname,
            port: window.location.port,
          });
        } else if (status === 503) {
          toast.error(
            "Database temporarily unavailable. Please try again in a moment.",
          );
        } else if (status === 400 || status === 401) {
          toast.error(
            error.response?.data?.message ||
              "Invalid email/phone or password. Please try again.",
          );
        } else {
          toast.error(errorMsg);
        }
      } finally {
        if (loadingToastId) {
          toast.dismiss(loadingToastId);
        }
        setLoading(false);
      }
    };

    await attemptLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center font-sans p-4" style={{ background: "#F2F7F2" }}>

      <SEO pageName="login" />
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Centered Logo */}
        <Link to="/" className="mb-6 hover:scale-105 transition-transform">
          <img
            src="/assets/logos/logo-full.png"
            alt="take.health"
            className="h-20 w-auto object-contain"
          />
        </Link>

        <ApkBanner />

        <div className="w-full rounded-3xl p-5 sm:p-6"
          style={{
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.85)",
            boxShadow: "0 4px 24px rgba(16,185,129,0.06), 0 1px 0 rgba(255,255,255,0.9) inset",
          }}>
          <div className="text-left mb-4 shrink-0">
            <h2 className="text-2xl font-black mb-0 text-[#064e3b] tracking-tight">
              Welcome Back
            </h2>
            <p className="text-gray-400 font-bold uppercase text-[8px] tracking-[0.2em] ml-0.5">
              Login to your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div>
              <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5 ml-1">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 group-focus-within:text-[#064e3b] transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border-2 border-gray-400 rounded-xl py-2.5 pl-11 pr-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-semibold transition-all placeholder:text-gray-300 text-sm shadow-sm"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5 ml-1">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 group-focus-within:text-[#064e3b] transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border-2 border-gray-400 rounded-xl py-2.5 pl-11 pr-11 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-semibold transition-all placeholder:text-gray-300 text-sm shadow-sm"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#064e3b] transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1 gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" className="peer sr-only" />
                  <div className="w-4 h-4 bg-white border-2 border-gray-300 rounded peer-checked:bg-[#064e3b] peer-checked:border-[#064e3b] transition-all" />
                  <div className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity">
                    <svg
                      className="w-2.5 h-2.5 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                    </svg>
                  </div>
                </div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-[#064e3b]">
                  Remember me
                </span>
              </label>
              <Link
                to="/forgot-password"
                core="true"
                className="text-[10px] font-black text-gray-400 hover:text-[#064e3b] transition-colors uppercase tracking-widest whitespace-nowrap"
              >
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#064e3b] text-white font-black uppercase text-xs tracking-[0.2em] rounded-xl hover:bg-[#042f24] hover:shadow-[0_20px_40px_rgba(6,78,59,0.3)] shadow-[0_10px_20px_rgba(6,78,59,0.15)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98] border-b-4 border-[#042f24]"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span className="text-sm">Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center mt-6 shrink-0">
            <Link
              to="/register"
              className="font-black text-[#064e3b] hover:text-[#042f24] transition-all uppercase text-xs tracking-widest border-b-2 border-gray-200 hover:border-[#064e3b] pb-0.5"
            >
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
