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
    <div className="min-h-screen flex" style={{ backgroundColor: '#F5F1EA' }}>
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #8B7355, #A0826D, #8B7355)' }}>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-3xl flex items-center justify-center mb-8">
            <Activity className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold mb-4 text-center">Welcome to HealthAI</h1>
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
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#8B7355' }}>
              <Activity className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold" style={{ color: '#2C2416' }}>HealthAI</span>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2" style={{ color: '#2C2416' }}>Sign In</h2>
            <p style={{ color: '#5C4F3D' }}>Access your health dashboard</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#2C2416' }}>Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#5C4F3D' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white rounded-xl py-3 pl-12 pr-4 focus:outline-none"
                  style={{ border: '1px solid #E5DFD3', color: '#2C2416' }}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#2C2416' }}>Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#5C4F3D' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white rounded-xl py-3 pl-12 pr-12 focus:outline-none"
                  style={{ border: '1px solid #E5DFD3', color: '#2C2416' }}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: '#5C4F3D' }}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded" style={{ borderColor: '#E5DFD3' }} />
                <span className="text-sm" style={{ color: '#5C4F3D' }}>Remember me</span>
              </label>
              <a href="#" className="text-sm font-medium" style={{ color: '#8B7355' }}>Forgot password?</a>
            </div>
            
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full py-3 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: '#8B7355' }}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign In <ArrowRight className="w-5 h-5" /></>
              )}
            </button>
          </form>
          
          <p className="text-center mt-8" style={{ color: '#5C4F3D' }}>
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold" style={{ color: '#8B7355' }}>Create one</Link>
          </p>

          <div className="mt-6 text-center">
            <Link to="/register/doctor" className="text-sm" style={{ color: '#5C4F3D' }}>
              Register as a Doctor →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
