import { useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../hooks/useSEO";
import { Trash2, Mail, Phone, MessageSquare, ArrowLeft, ShieldCheck, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";

// Public, unauthenticated page — Google Play requires account deletion to
// work without the app installed. Same generic response whether or not the
// email has an account, so this page can never be used to probe who's
// registered (only the request-flow behavior matters here; the backend
// enforces the actual anti-enumeration guarantee).
export default function DeleteAccount() {
  const [step, setStep] = useState(1); // 1: form, 2: enter code, 3: done
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your registered email address");
      return;
    }
    setLoading(true);
    try {
      await api.post("/privacy/public-delete/request", { email: email.trim(), phone: phone.trim() });
      toast.success("If an account exists, a confirmation code has been sent to that email.");
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code from your email");
      return;
    }
    setLoading(true);
    try {
      await api.post("/privacy/public-delete/confirm", {
        email: email.trim(),
        otp: code,
        reason: reason.trim() || undefined,
      });
      setStep(3);
    } catch (error) {
      toast.error(error.response?.data?.message || "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center font-sans p-4" style={{ background: "#F2F7F2" }}>
      <SEO pageName="deleteAccount" />
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 hover:text-[#064e3b] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          take.health
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-100 p-6 sm:p-8">
          {step === 1 && (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <h1 className="text-xl font-black text-gray-900">Delete Your Take Health Account</h1>
              </div>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                If you would like to permanently delete your Take Health account and associated personal data, submit a request below — even if you no longer have the app installed.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">
                    Registered Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white border-2 border-gray-300 rounded-xl py-2.5 pl-11 pr-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-medium transition-all text-sm"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="w-full bg-white border-2 border-gray-300 rounded-xl py-2.5 pl-11 pr-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-medium transition-all text-sm"
                      placeholder="10-digit mobile number"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">
                    Reason for Deletion (Optional)
                  </label>
                  <div className="relative">
                    <MessageSquare className="absolute left-4 top-3.5 w-4 h-4 text-gray-400" />
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value.slice(0, 1000))}
                      rows={3}
                      className="w-full bg-white border-2 border-gray-300 rounded-xl py-2.5 pl-11 pr-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-medium transition-all text-sm resize-none"
                      placeholder="Let us know why you're leaving — helps us improve"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all text-sm disabled:opacity-60"
                >
                  {loading ? "Sending..." : "Request Account Deletion"}
                </button>

                <p className="flex items-start gap-1.5 text-[11px] text-gray-400 leading-relaxed">
                  <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  We'll email a confirmation code to verify this request is really from you before anything is deleted.
                </p>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5 text-amber-600" />
                </div>
                <h1 className="text-xl font-black text-gray-900">Confirm Deletion</h1>
              </div>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                If an account exists for <span className="font-semibold text-gray-700">{email}</span>, we've sent a 6-digit code there. Enter it below to permanently schedule deletion.
              </p>

              <form onSubmit={handleConfirm} className="space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-white border-2 border-gray-300 rounded-xl py-3 px-4 text-center focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-bold tracking-[0.5em] transition-all text-lg"
                  placeholder="000000"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all text-sm disabled:opacity-60"
                >
                  {loading ? "Confirming..." : "Confirm & Delete Account"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-[#064e3b] transition-colors"
                >
                  Back
                </button>
              </form>
            </>
          )}

          {step === 3 && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h1 className="text-xl font-black text-gray-900 mb-2">Request Received</h1>
              <p className="text-sm text-gray-500 leading-relaxed">
                Your account and associated data are scheduled for permanent deletion in 30 days. You'll receive reminder emails before this happens. If you have the app and change your mind, you can cancel anytime from Privacy Settings before then.
              </p>
              <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                Some data (such as payment transaction records) may be retained longer where required by law — see our{" "}
                <Link to="/privacy-policy" className="underline hover:text-[#064e3b]">Privacy Policy</Link> for details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
