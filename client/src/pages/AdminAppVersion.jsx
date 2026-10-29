import React, { useState, useEffect } from "react";
import { Smartphone, Apple, Send, RefreshCw } from "lucide-react";
import { adminService } from "../services/api";
import toast from "react-hot-toast";
import SEO from "../hooks/useSEO";

const emptyForm = { version: "", latestBuild: "", message: "", storeUrl: "" };

function PlatformCard({ label, Icon, form, setForm, onPush, pushing }) {
  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-slate-700" />
        <h3 className="font-semibold text-slate-900">{label}</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500">Version (display)</label>
          <input
            type="text"
            value={form.version}
            onChange={(e) => update("version", e.target.value)}
            placeholder="2.5.2"
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Latest Build (number)</label>
          <input
            type="number"
            value={form.latestBuild}
            onChange={(e) => update("latestBuild", e.target.value)}
            placeholder="21"
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500">Message (optional)</label>
        <textarea
          value={form.message}
          onChange={(e) => update("message", e.target.value)}
          placeholder="A new version of Take Health is available. Please update the app."
          rows={2}
          className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500">Store URL (optional)</label>
        <input
          type="text"
          value={form.storeUrl}
          onChange={(e) => update("storeUrl", e.target.value)}
          placeholder="https://..."
          className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        onClick={onPush}
        disabled={pushing || !form.version || !form.latestBuild}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg py-2.5 transition-colors"
      >
        <Send className="w-4 h-4" />
        {pushing ? "Pushing..." : `Push ${label} Update`}
      </button>
    </div>
  );
}

export default function AdminAppVersion() {
  const [loading, setLoading] = useState(true);
  const [androidForm, setAndroidForm] = useState(emptyForm);
  const [iosForm, setIosForm] = useState(emptyForm);
  const [pushingAndroid, setPushingAndroid] = useState(false);
  const [pushingIos, setPushingIos] = useState(false);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data } = await adminService.getAppVersionConfig();
      if (data.android) {
        setAndroidForm({
          version: data.android.version || "",
          latestBuild: data.android.latestBuild ?? "",
          message: data.android.message || "",
          storeUrl: data.android.storeUrl || "",
        });
      }
      if (data.ios) {
        setIosForm({
          version: data.ios.version || "",
          latestBuild: data.ios.latestBuild ?? "",
          message: data.ios.message || "",
          storeUrl: data.ios.storeUrl || "",
        });
      }
    } catch (err) {
      toast.error("Failed to load current version config");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const push = async (platform, form, setPushing) => {
    setPushing(true);
    try {
      await adminService.pushAppVersion({
        [platform]: {
          version: form.version,
          latestBuild: Number(form.latestBuild),
          message: form.message || undefined,
          storeUrl: form.storeUrl || undefined,
        },
      });
      toast.success(`${platform === "android" ? "Android" : "iOS"} update pushed`);
      loadConfig();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to push update");
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <SEO title="App Version | Admin" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">App Version Push</h1>
          <p className="text-sm text-slate-500 mt-1">
            Sets the latest build each platform's app compares against on launch.
            No notification is sent — the app shows its own update dialog.
          </p>
        </div>
        <button
          onClick={loadConfig}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          <PlatformCard
            label="Android"
            Icon={Smartphone}
            form={androidForm}
            setForm={setAndroidForm}
            pushing={pushingAndroid}
            onPush={() => push("android", androidForm, setPushingAndroid)}
          />
          <PlatformCard
            label="iOS"
            Icon={Apple}
            form={iosForm}
            setForm={setIosForm}
            pushing={pushingIos}
            onPush={() => push("ios", iosForm, setPushingIos)}
          />
        </div>
      )}
    </div>
  );
}
