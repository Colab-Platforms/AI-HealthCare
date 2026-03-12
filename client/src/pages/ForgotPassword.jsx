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
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-black">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-[120px]" />
                    <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-[120px]" />
                </div>

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
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
                        <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border border-white/10 shadow-lg shadow-black/10">
                            <Activity className="w-7 h-7 text-white" />
                        </div>
                        <h2 className="text-3xl font-black mb-2 text-black uppercase tracking-tighter">FitCure</h2>
                    </div>

                    <button onClick={() => step === 1 ? navigate('/login') : setStep(step - 1)} className="flex items-center gap-2 mb-6 text-black font-black uppercase tracking-tighter text-xs hover:text-slate-600 transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Back to {step === 1 ? 'Login' : 'Previous Step'}
                    </button>

                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-black mb-2 text-black uppercase tracking-tighter">
                            {step === 1 ? 'Reset Access' : step === 2 ? 'Verify Identity' : 'Secure Account'}
                        </h2>
                        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                            Step {step} of 3 • {step === 1 ? 'Email' : step === 2 ? 'Code' : 'New Password'}
                        </p>
                    </div>

                    {step === 1 && (
                        <form onSubmit={handleSendCode} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-2 text-slate-700">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black text-black font-bold placeholder:text-slate-400 shadow-sm"
                                        placeholder="you@example.com"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 text-white font-black uppercase tracking-widest rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50 bg-black"
                            >
                                {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Send Code <ArrowRight className="w-5 h-5" /></>}
                            </button>
                        </form>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleVerifyCode} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-2 text-slate-700">Verification Code</label>
                                <div className="flex justify-center gap-4">
                                    {[...Array(4)].map((_, i) => (
                                        <input
                                            key={i}
                                            type="text"
                                            maxLength="1"
                                            value={code[i] || ''}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                if (val) {
                                                    const newCode = code.split('');
                                                    newCode[i] = val;
                                                    const combined = newCode.join('');
                                                    setCode(combined);
                                                    if (i < 3 && e.target.nextSibling) e.target.nextSibling.focus();
                                                } else {
                                                    const newCode = code.split('');
                                                    newCode[i] = '';
                                                    setCode(newCode.join(''));
                                                    if (i > 0 && e.target.previousSibling) e.target.previousSibling.focus();
                                                }
                                            }}
                                            className="w-16 h-20 text-center text-4xl font-black bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black text-black"
                                        />
                                    ))}
                                </div>
                                <p className="text-center mt-6 text-slate-500 text-sm">Didn't receive code? <button type="button" onClick={handleSendCode} className="text-black font-bold hover:underline">Resend</button></p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 text-white font-black uppercase tracking-widest rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50 bg-black"
                            >
                                {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Verify Code <ArrowRight className="w-5 h-5" /></>}
                            </button>
                        </form>
                    )}

                    {step === 3 && (
                        <form onSubmit={handleResetPassword} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium mb-2 text-slate-700">New Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black text-black font-bold"
                                        placeholder="••••••••"
                                        required
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                                {password && (
                                    <div className="mt-2 space-y-1">
                                        <p className={`text-[10px] font-bold flex items-center gap-1 ${/[A-Z]/.test(password) ? 'text-green-500' : 'text-slate-400'}`}>
                                            {/[A-Z]/.test(password) ? '✓' : '○'} One uppercase letter
                                        </p>
                                        <p className={`text-[10px] font-bold flex items-center gap-1 ${/[0-9]/.test(password) ? 'text-green-500' : 'text-slate-400'}`}>
                                            {/[0-9]/.test(password) ? '✓' : '○'} One number
                                        </p>
                                        <p className={`text-[10px] font-bold flex items-center gap-1 ${/[!@#$%^&*]/.test(password) ? 'text-green-500' : 'text-slate-400'}`}>
                                            {/[!@#$%^&*]/.test(password) ? '✓' : '○'} One special character
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2 text-slate-700">Confirm New Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black text-black font-bold"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                                {confirmPassword && (
                                    <p className={`text-[10px] mt-1 font-bold ${password === confirmPassword ? 'text-green-500' : 'text-red-500'}`}>
                                        {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 text-white font-black uppercase tracking-widest rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50 bg-black"
                            >
                                {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Reset Password <ArrowRight className="w-5 h-5" /></>}
                            </button>
                        </form>
                    )}

                    <div className="mt-10 p-6 bg-slate-50 rounded-3xl border border-slate-100 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                            <ShieldCheck className="w-16 h-16 text-black" />
                        </div>
                        <p className="text-xs text-slate-500 font-bold leading-relaxed relative z-10">
                            <span className="text-black uppercase tracking-tighter mr-1">Security Note:</span>
                            FitCure AI never asks for your password over email. All password resets are handled through our secure verification system.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
