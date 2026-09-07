import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import SEO from "../hooks/useSEO";
import { LifeBuoy, Mail, User as UserIcon, MessageSquare, Paperclip, ArrowLeft, CheckCircle2, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";

const CATEGORIES = [
  { value: "general_help", label: "General Help" },
  { value: "bug", label: "Report a Bug" },
  { value: "account_issue", label: "Account Issue" },
  { value: "feature_request", label: "Feature Request" },
  { value: "other", label: "Other" },
];

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB, matches server limit

export default function Support() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general_help");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > MAX_FILE_SIZE) {
      toast.error("Attachment must be under 4MB");
      e.target.value = "";
      return;
    }
    setFile(selected);
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill in your name, email, and message");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("email", email.trim());
      formData.append("subject", subject.trim());
      formData.append("category", category);
      formData.append("message", message.trim());
      if (file) formData.append("attachment", file);

      await api.post("/support/public", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSubmitted(true);
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center font-sans p-4" style={{ background: "#F2F7F2" }}>
      <SEO pageName="support" />
      <div className="w-full max-w-lg">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 hover:text-[#064e3b] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          take.health
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-100 p-6 sm:p-8">
          {!submitted ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <LifeBuoy className="w-5 h-5 text-[#064e3b]" />
                </div>
                <h1 className="text-xl font-black text-gray-900">Raise a Support Ticket</h1>
              </div>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                Tell us what's going on and our team will get back to you by email.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">
                    Your Name *
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white border-2 border-gray-300 rounded-xl py-2.5 pl-11 pr-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-medium transition-all text-sm"
                      placeholder="Jane Doe"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">
                    Email Address *
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full bg-white border-2 border-gray-300 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-medium transition-all text-sm"
                      placeholder="Short summary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-white border-2 border-gray-300 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-medium transition-all text-sm"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">
                    Message *
                  </label>
                  <div className="relative">
                    <MessageSquare className="absolute left-4 top-3.5 w-4 h-4 text-gray-400" />
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                      rows={5}
                      className="w-full bg-white border-2 border-gray-300 rounded-xl py-2.5 pl-11 pr-4 focus:outline-none focus:ring-4 focus:ring-[#064e3b]/10 focus:border-[#064e3b] text-gray-800 font-medium transition-all text-sm resize-none"
                      placeholder="Describe the issue you're facing..."
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">
                    Attachment (Optional)
                  </label>
                  {!file ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center gap-2 justify-center border-2 border-dashed border-gray-300 rounded-xl py-3 px-4 text-sm font-medium text-gray-500 hover:border-[#064e3b] hover:text-[#064e3b] transition-all"
                    >
                      <Paperclip className="w-4 h-4" />
                      Attach a screenshot or PDF (max 4MB)
                    </button>
                  ) : (
                    <div className="flex items-center justify-between border-2 border-gray-200 rounded-xl py-2.5 px-4 text-sm">
                      <span className="truncate text-gray-700 font-medium">{file.name}</span>
                      <button type="button" onClick={removeFile} className="text-gray-400 hover:text-red-500 flex-shrink-0 ml-2">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/jpg,image/webp,image/heic,image/heif"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#064e3b] hover:bg-[#053d2e] text-white font-bold py-3 rounded-xl transition-all text-sm disabled:opacity-60"
                >
                  {loading ? "Submitting..." : "Submit Ticket"}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h1 className="text-xl font-black text-gray-900 mb-2">Ticket Submitted</h1>
              <p className="text-sm text-gray-500 leading-relaxed">
                Thanks, {name.split(" ")[0] || "there"}. We've received your request and will get back to you at{" "}
                <span className="font-semibold text-gray-700">{email}</span> soon.
              </p>
              <Link
                to="/"
                className="inline-block mt-6 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-[#064e3b] transition-colors"
              >
                Back to Home
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
