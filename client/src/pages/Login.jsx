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
    try {
      const user = await login(email, password);
      toast.success('Welcome back!');
      navigate(user.role === 'admin' ? '/admin' : user.role === 'doctor' ? '/doctor/dashboard' : '/dashboard');
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || 'Login failed';

      // Check for network errors
      if (!error.response) {
        toast.error('Network error - Check if server is running and accessible');
        console.error('Connection details:', {
          apiUrl: error.config?.baseURL,
          host: window.location.hostname,
          port: window.location.port
        });
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-black">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-[#2FC8B9] rounded-full blur-[120px]" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#2FC8B9] rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-3xl flex items-center justify-center mb-8">
            <Activity className="w-10 h-10 text-[#2FC8B9]" />
          </div>
          <h1 className="text-4xl font-black mb-4 text-center tracking-tighter uppercase">Patient Portal</h1>
          <p className="text-xl text-white/80 text-center max-w-md">
            Your AI-powered health companion for smarter healthcare decisions.
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border border-[#2FC8B9]/30 shadow-lg shadow-[#2FC8B9]/10">
              <Activity className="w-7 h-7 text-[#2FC8B9]" />
            </div>
            <h2 className="text-3xl font-black mb-2 text-black uppercase tracking-tighter">Your Health Profile</h2>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2 text-gray-900">Sign In</h2>
            <p className="text-gray-600">Access your health dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-[#2FC8B9]/30 focus:border-[#2FC8B9] text-black font-bold"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-[#2FC8B9]/30 focus:border-[#2FC8B9] text-black font-bold"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500" />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <a href="#" className="text-sm font-medium text-cyan-600 hover:text-cyan-700">Forgot password?</a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 text-white font-black uppercase tracking-widest rounded-xl hover:shadow-[0_10px_25px_rgba(47,200,185,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 bg-[#2FC8B9] hover:bg-[#28b5a6]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Enter Portal <ArrowRight className="w-5 h-5" /></>
              )}
            </button>
          </form>

          <p className="text-center mt-8 text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="font-bold text-[#2FC8B9] hover:text-black transition-colors uppercase text-xs tracking-widest">Create Profile</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
