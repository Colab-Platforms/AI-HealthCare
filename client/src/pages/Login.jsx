import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const attemptLogin = async (retryCount = 0) => {
      try {
        const user = await login(email, password);
        toast.success('Welcome back!');
        navigate(user.role === 'admin' || user.role === 'superadmin' ? '/admin' : user.role === 'doctor' ? '/doctor/dashboard' : '/dashboard');
      } catch (error) {
        const status = error.response?.status;
        const errorMsg = error.response?.data?.message || error.message || 'Login failed';

        // Handle 503 (database connection) errors with retry
        if (status === 503 && retryCount < 2) {
          console.log(`Database connection failed, retrying... (attempt ${retryCount + 1}/2)`);
          toast.loading('Connecting to database, please wait...');

          // Wait 2 seconds before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
          return attemptLogin(retryCount + 1);
        }

        // Check for network errors
        if (!error.response) {
          toast.error('Network error - Check if server is running and accessible');
          console.error('Connection details:', {
            apiUrl: error.config?.baseURL,
            host: window.location.hostname,
            port: window.location.port
          });
        } else if (status === 503) {
          toast.error('Database temporarily unavailable. Please try again in a moment.');
        } else {
          toast.error(errorMsg);
        }
      } finally {
        setLoading(false);
      }
    };

    await attemptLogin();
  };

  return (
    <div className="min-h-screen flex bg-white font-sans">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#064e3b]">
        {/* Decorative Glow Elements matching Dashboard */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-cyan-400/10 rounded-full blur-[100px] translate-y-1/4 -translate-x-1/4 pointer-events-none" />
        
        <div className="absolute inset-0 bg-gradient-to-br from-[#064e3b] via-[#065f46] to-[#042f24] opacity-90" />

        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <div className="flex justify-center mb-10 group">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-400/20 blur-2xl rounded-full group-hover:bg-emerald-400/40 transition-all duration-700" />
              <img 
                src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/logo_with_text-1.png?v=1774261099" 
                alt="take.health" 
                className="h-32 w-auto object-contain brightness-0 invert relative z-10 transition-transform duration-700 group-hover:scale-105"
              />
            </div>
          </div>
          <h1 className="text-4xl font-light tracking-tight mb-4 text-center">
            Welcome to <span className="font-medium">take.health</span>
          </h1>
          <p className="text-xl text-emerald-50/70 text-center max-w-md leading-relaxed">
            Your AI-powered health companion for smarter, faster, and more personal healthcare.
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-0 sm:p-8 bg-slate-50/30">
        <div className="w-full max-w-md bg-white p-6 sm:p-10 rounded-none sm:rounded-[2.5rem] shadow-[0_20px_60px_rgba(6,78,59,0.05)] border-0 sm:border border-emerald-50/50">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-12">
            <img 
              src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/logo_with_text-1.png?v=1774261099" 
              alt="take.health" 
              className="h-24 w-auto object-contain"
            />
          </div>

          <div className="text-center mb-10">
            <h2 className="text-3xl font-black mb-2 text-[#064e3b] tracking-tight uppercase">Sign In</h2>
            <p className="text-emerald-800/40 font-bold uppercase text-[10px] tracking-[0.2em]">Access your health portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-2 ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-800/20 group-focus-within:text-[#064e3b] transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-emerald-50/30 border border-emerald-100/50 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] text-[#064e3b] font-bold transition-all placeholder:text-emerald-800/20"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-2 ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-800/20 group-focus-within:text-[#064e3b] transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-emerald-50/30 border border-emerald-100/50 rounded-2xl py-4 pl-12 pr-12 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] text-[#064e3b] font-bold transition-all placeholder:text-emerald-800/20"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-800/20 hover:text-[#064e3b] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1 gap-2">
              <label className="flex items-center gap-2 cursor-pointer group whitespace-nowrap">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" className="peer sr-only" />
                  <div className="w-5 h-5 bg-emerald-50 border-2 border-emerald-100 rounded-lg peer-checked:bg-[#064e3b] peer-checked:border-[#064e3b] transition-all" />
                  <div className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity">
                    <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z"/></svg>
                  </div>
                </div>
                <span className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest group-hover:text-[#064e3b] transition-colors">Remember me</span>
              </label>
              <Link to="/forgot-password" line title="Go to find password page" className="text-[10px] font-black text-emerald-800/40 hover:text-[#064e3b] transition-colors uppercase tracking-widest whitespace-nowrap">Forgot password?</Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#064e3b] text-emerald-50 font-black uppercase text-xs tracking-[0.2em] rounded-2xl hover:bg-[#042f24] hover:shadow-[0_20px_40px_rgba(6,78,59,0.2)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98] border-b-4 border-[#042f24] hover:border-b-2 hover:translate-y-px active:border-b-0 active:translate-y-1"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span className="text-sm">Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center mt-12">
            <span className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest">New to take.health?</span>{' '}
            <Link to="/register" className="ml-2 font-black text-[#064e3b] hover:text-[#042f24] transition-all uppercase text-[10px] tracking-widest border-b-2 border-emerald-100 hover:border-[#064e3b] pb-0.5">Create Final Profile</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
