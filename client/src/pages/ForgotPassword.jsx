import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function ForgotPassword() {
    const [step, setStep] = useState(1); // 1: Email, 2: Code, 3: Reset
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSendCode = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/auth/forgot-password', { email });
            toast.success('Verification code sent to your email');
            setStep(2);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to send code');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e) => {
        e.preventDefault();
        if (code.length !== 4) {
            toast.error('Please enter the 4-digit code');
            return;
        }
        setLoading(true);
        try {
            await api.post('/auth/verify-reset-code', { email, code });
            toast.success('Code verified successfully');
            setStep(3);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Invalid or expired code');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.*[0-9]).{6,}$/;
        if (!passwordRegex.test(password)) {
            toast.error('Password must contain 1 uppercase, 1 special char, and 1 number');
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/reset-password', { email, code, password });
            toast.success('Password reset successful! You can now login.');
            navigate('/login');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
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
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-3xl flex items-center justify-center mb-8 border border-white/30">
                        {step === 1 && <Mail className="w-10 h-10 text-white" />}
                        {step === 2 && <ShieldCheck className="w-10 h-10 text-white" />}
                        {step === 3 && <KeyRound className="w-10 h-10 text-white" />}
                    </div>
                    <h1 className="text-4xl font-black mb-4 text-center tracking-tighter uppercase">
                        {step === 1 ? 'Forgot Password?' : step === 2 ? 'Check Your Email' : 'Reset Password'}
                    </h1>
                    <p className="text-xl text-white/80 text-center max-w-md">
                        {step === 1 ? "Don't worry, it happens. We'll help you get back to your health journey." :
                            step === 2 ? "We've sent a 4-digit verification code to your registered email address." :
                                "Create a strong, unique password to keep your health data secure."}
                    </p>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="flex-1 flex bg-white sm:bg-slate-50/30 sm:p-8">
                <div className="w-full max-w-md bg-white p-5 sm:p-10 min-h-screen sm:min-h-0 flex flex-col justify-center rounded-none sm:rounded-[2.5rem] shadow-none sm:shadow-[0_20px_60px_rgba(6,78,59,0.05)] border-0 sm:border border-emerald-50/50">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex justify-center mb-6">
                        <img 
                            src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/logo_with_text-1.png?v=1774261099" 
                            alt="take.health" 
                            className="h-16 w-auto object-contain"
                        />
                    </div>

                    <button onClick={() => step === 1 ? navigate('/login') : setStep(step - 1)} className="flex items-center gap-2 mb-4 text-[#064e3b] font-black uppercase tracking-tighter text-[10px] hover:text-[#042f24] transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Back to {step === 1 ? 'Login' : 'Previous Step'}
                    </button>

                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-black mb-1 text-[#064e3b] uppercase tracking-tighter">
                            {step === 1 ? 'Reset Access' : step === 2 ? 'Verify Identity' : 'Secure Account'}
                        </h2>
                        <p className="text-emerald-800/40 font-bold uppercase text-[9px] tracking-widest">
                            Step {step} of 3 • {step === 1 ? 'Email' : step === 2 ? 'Code' : 'New Password'}
                        </p>
                    </div>

                    {step === 1 && (
                        <form onSubmit={handleSendCode} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1 ml-1">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-800/20 group-focus-within:text-[#064e3b] transition-colors" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-emerald-50/30 border border-emerald-100/50 rounded-xl py-3 flex items-center pl-10 pr-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] text-[#064e3b] font-bold transition-all placeholder:text-emerald-800/20 text-sm"
                                        placeholder="you@email.com"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 bg-[#064e3b] text-emerald-50 font-black uppercase text-xs tracking-[0.2em] rounded-xl hover:bg-[#042f24] hover:shadow-[0_20px_40px_rgba(6,78,59,0.2)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98] border-b-4 border-[#042f24] hover:border-b-2 hover:translate-y-px active:border-b-0 active:translate-y-1"
                            >
                                {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span className="text-sm">Send Code</span> <ArrowRight className="w-4 h-4" /></>}
                            </button>
                        </form>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleVerifyCode} className="space-y-6 text-center">
                            <div className="space-y-4">
                                <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1">Verification Code</label>
                                <div className="flex justify-center gap-3">
                                    {[...Array(4)].map((_, i) => (
                                        <input
                                            key={i}
                                            id={`otp-${i}`}
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            autoComplete={i === 0 ? 'one-time-code' : 'off'}
                                            maxLength="1"
                                            value={code[i] || ''}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                const newCode = code.split('');
                                                if (val) {
                                                    newCode[i] = val;
                                                    const combined = newCode.join('');
                                                    setCode(combined.slice(0, 4));
                                                    if (i < 3) document.getElementById(`otp-${i+1}`).focus();
                                                } else {
                                                    newCode[i] = '';
                                                    setCode(newCode.join(''));
                                                    if (i > 0) document.getElementById(`otp-${i-1}`).focus();
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Backspace' && !code[i] && i > 0) {
                                                    document.getElementById(`otp-${i - 1}`).focus();
                                                }
                                            }}
                                            className="w-12 h-16 text-center text-3xl font-black bg-emerald-50/30 border-2 border-emerald-100 rounded-2xl focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] focus:outline-none text-[#064e3b] shadow-sm transition-all"
                                        />
                                    ))}
                                </div>
                                <p className="text-center mt-4 text-emerald-800/40 font-bold uppercase text-[9px] tracking-widest">Didn't receive code? <button type="button" onClick={handleSendCode} className="text-[#064e3b] hover:text-[#042f24] transition-all border-b border-emerald-100 hover:border-[#064e3b]">Resend Code</button></p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 bg-[#064e3b] text-emerald-50 font-black uppercase text-xs tracking-[0.2em] rounded-xl hover:bg-[#042f24] hover:shadow-[0_20px_40px_rgba(6,78,59,0.2)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98] border-b-4 border-[#042f24] hover:border-b-2 hover:translate-y-px active:border-b-0 active:translate-y-1"
                            >
                                {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span className="text-sm">Verify Code</span> <ArrowRight className="w-4 h-4" /></>}
                            </button>
                        </form>
                    )}

                    {step === 3 && (
                        <form onSubmit={handleResetPassword} className="space-y-2.5">
                            <div>
                                <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1 ml-1">New Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-800/20 group-focus-within:text-[#064e3b] transition-colors" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-emerald-50/30 border border-emerald-100/50 rounded-xl py-2.5 pl-10 pr-10 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] text-[#064e3b] font-bold transition-all placeholder:text-emerald-800/20 text-sm"
                                        placeholder="••••••••"
                                        required
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-800/20 hover:text-[#064e3b] transition-colors">
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {password && (
                                    <div className="mt-2 space-y-1 ml-1">
                                        <p className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${/[A-Z]/.test(password) ? 'text-emerald-600' : 'text-emerald-800/20'}`}>
                                            <div className={`w-1 h-1 rounded-full ${/[A-Z]/.test(password) ? 'bg-emerald-600' : 'bg-emerald-800/20'}`} /> One uppercase letter
                                        </p>
                                        <p className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${/[0-9]/.test(password) ? 'text-emerald-600' : 'text-emerald-800/20'}`}>
                                            <div className={`w-1 h-1 rounded-full ${/[0-9]/.test(password) ? 'bg-emerald-600' : 'bg-emerald-800/20'}`} /> One number
                                        </p>
                                        <p className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${/[!@#$%^&*]/.test(password) ? 'text-emerald-600' : 'text-emerald-800/20'}`}>
                                            <div className={`w-1 h-1 rounded-full ${/[!@#$%^&*]/.test(password) ? 'bg-emerald-600' : 'bg-emerald-800/20'}`} /> One special character
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1 ml-1">Confirm Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-800/20 group-focus-within:text-[#064e3b] transition-colors" />
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-emerald-50/30 border border-emerald-100/50 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] text-[#064e3b] font-bold transition-all placeholder:text-emerald-800/20 text-sm"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                                {confirmPassword && (
                                    <p className={`text-[8.5px] mt-1 ml-1 font-black uppercase tracking-widest ${password === confirmPassword ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {password === confirmPassword ? '✓ Match' : '✗ No Match'}
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 mt-4 bg-[#064e3b] text-emerald-50 font-black uppercase text-xs tracking-[0.2em] rounded-xl hover:bg-[#042f24] hover:shadow-[0_20px_40px_rgba(6,78,59,0.2)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98] border-b-4 border-[#042f24] hover:border-b-2 hover:translate-y-px active:border-b-0 active:translate-y-1"
                            >
                                {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span className="text-sm">Reset Password</span> <ArrowRight className="w-4 h-4" /></>}
                            </button>
                        </form>
                    )}

                    <div className="mt-10 p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                            <ShieldCheck className="w-16 h-16 text-[#064e3b]" />
                        </div>
                        <p className="text-[10px] text-emerald-800/40 font-black uppercase tracking-widest leading-relaxed relative z-10">
                            <span className="text-[#064e3b] uppercase tracking-tighter mr-1.5">Security Note:</span>
                            take.health AI Platform never asks for your password over email. All password resets are handled through our secure verification system.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
