import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dumbbell,
  Flame,
  Clock,
  Footprints,
  Bike,
  Waves,
  PersonStanding,
  Trophy,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  HeartPulse,
  TrendingUp,
  X,
  Route as RouteIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import toast from "react-hot-toast";
import { exerciseService, wearableService } from "../services/api";
import SEO from "../hooks/useSEO";

const ACTIVITY_TYPES = [
  { id: "running", label: "Running", icon: Footprints, category: "cardio" },
  { id: "cycling", label: "Cycling", icon: Bike, category: "cardio" },
  { id: "walking", label: "Walking", icon: Footprints, category: "cardio" },
  { id: "swimming", label: "Swimming", icon: Waves, category: "cardio" },
  { id: "gym_strength", label: "Gym / Strength", icon: Dumbbell, category: "strength" },
  { id: "yoga", label: "Yoga", icon: PersonStanding, category: "flexibility" },
  { id: "hiit", label: "HIIT", icon: Flame, category: "cardio" },
  { id: "sports", label: "Sports", icon: Trophy, category: "cardio" },
  { id: "other", label: "Other", icon: Dumbbell, category: "other" },
];

const activityMeta = (id) => ACTIVITY_TYPES.find((a) => a.id === id) || ACTIVITY_TYPES[8];

function LogExerciseForm({ onClose, onLogged }) {
  const [activityType, setActivityType] = useState("running");
  const [duration, setDuration] = useState("");
  const [distance, setDistance] = useState("");
  const [avgHeartRate, setAvgHeartRate] = useState("");
  const [minHeartRate, setMinHeartRate] = useState("");
  const [maxHeartRate, setMaxHeartRate] = useState("");
  const [intensity, setIntensity] = useState("medium");
  const [exercises, setExercises] = useState([{ name: "", sets: [{ reps: "", weight: "" }] }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSessionTime, setShowSessionTime] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillZones, setAutoFillZones] = useState(null);

  const category = activityMeta(activityType).category;

  const handleAutoFill = async () => {
    if (!startTime || !endTime) {
      toast.error("Set a start and end time first");
      return;
    }
    setAutoFilling(true);
    try {
      const { data } = await exerciseService.previewHeartRate(
        new Date(startTime).toISOString(),
        new Date(endTime).toISOString()
      );
      if (!data.found) {
        toast.error("No wearable heart-rate data found for that window");
        setAutoFillZones(null);
        return;
      }
      setAvgHeartRate(String(data.avgHeartRate));
      setMinHeartRate(String(data.minHeartRate));
      setMaxHeartRate(String(data.maxHeartRate));
      setAutoFillZones(data.heartRateZones);
      toast.success(`Filled from ${data.sampleCount} device readings`);
    } catch (error) {
      toast.error("Failed to auto-fill heart rate");
    } finally {
      setAutoFilling(false);
    }
  };

  const addExercise = () => setExercises([...exercises, { name: "", sets: [{ reps: "", weight: "" }] }]);
  const removeExercise = (idx) => setExercises(exercises.filter((_, i) => i !== idx));
  const updateExerciseName = (idx, name) =>
    setExercises(exercises.map((e, i) => (i === idx ? { ...e, name } : e)));
  const addSet = (idx) =>
    setExercises(
      exercises.map((e, i) => (i === idx ? { ...e, sets: [...e.sets, { reps: "", weight: "" }] } : e))
    );
  const updateSet = (exIdx, setIdx, field, value) =>
    setExercises(
      exercises.map((e, i) =>
        i === exIdx
          ? { ...e, sets: e.sets.map((s, si) => (si === setIdx ? { ...s, [field]: value } : s)) }
          : e
      )
    );
  const removeSet = (exIdx, setIdx) =>
    setExercises(
      exercises.map((e, i) =>
        i === exIdx ? { ...e, sets: e.sets.filter((_, si) => si !== setIdx) } : e
      )
    );

  const canSubmit = Number(duration) > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const payload = {
        activityType,
        duration: Number(duration),
        intensity,
      };
      if (category === "cardio") {
        if (distance) payload.distance = Number(distance);
        if (avgHeartRate) payload.avgHeartRate = Number(avgHeartRate);
        if (minHeartRate) payload.minHeartRate = Number(minHeartRate);
        if (maxHeartRate) payload.maxHeartRate = Number(maxHeartRate);
        if (startTime) payload.startTime = new Date(startTime).toISOString();
        if (endTime) payload.endTime = new Date(endTime).toISOString();
      }
      if (category === "strength") {
        payload.exercises = exercises
          .filter((e) => e.name.trim())
          .map((e) => ({
            name: e.name.trim(),
            sets: e.sets
              .filter((s) => s.reps || s.weight)
              .map((s) => ({ reps: Number(s.reps) || 0, weight: Number(s.weight) || 0 })),
          }));
      }

      const { data } = await exerciseService.logExercise(payload);
      toast.success(`🔥 ${data.exerciseLog.caloriesBurned} kcal burned — logged!`);
      onLogged?.();
      onClose();
    } catch (error) {
      toast.error("Failed to log exercise");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1002] flex items-end md:items-center justify-center p-0 md:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, y: 80, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 80, scale: 0.97 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="relative w-full max-w-md bg-[#f7f8f4] rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-[0_-10px_60px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 pt-6 pb-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Log Exercise</h2>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
              Calories calculated automatically
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 bg-white hover:bg-slate-50 rounded-full flex items-center justify-center transition-all border border-slate-200 shadow-sm shrink-0 ml-3"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4 overflow-y-auto">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">
              Activity
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ACTIVITY_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setActivityType(type.id)}
                  className={`py-2.5 rounded-xl text-[10.5px] font-black uppercase tracking-wide transition-all ${
                    activityType === type.id
                      ? "bg-[#69A38D] text-white shadow-md"
                      : "bg-white text-slate-500 border border-slate-100"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">
              Duration (minutes)
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min="0"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 30"
                className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#69A38D]/30 focus:border-[#69A38D]"
              />
            </div>
          </div>

          {category === "cardio" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">
                    Distance (km)
                  </label>
                  <div className="relative">
                    <RouteIcon className="w-4 h-4 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                      placeholder="e.g. 5"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#69A38D]/30 focus:border-[#69A38D]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">
                    Avg Heart Rate
                  </label>
                  <div className="relative">
                    <HeartPulse className="w-4 h-4 text-rose-300 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min="0"
                      value={avgHeartRate}
                      onChange={(e) => setAvgHeartRate(e.target.value)}
                      placeholder="e.g. 140"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#69A38D]/30 focus:border-[#69A38D]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">
                    Min Heart Rate
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minHeartRate}
                    onChange={(e) => setMinHeartRate(e.target.value)}
                    placeholder="e.g. 95"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#69A38D]/30 focus:border-[#69A38D]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">
                    Max Heart Rate
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={maxHeartRate}
                    onChange={(e) => setMaxHeartRate(e.target.value)}
                    placeholder="e.g. 168"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#69A38D]/30 focus:border-[#69A38D]"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSessionTime((v) => !v)}
                className="text-[10px] font-black text-[#69A38D] uppercase tracking-wide pl-1"
              >
                {showSessionTime ? "Hide session time" : "+ Add session time (auto-fill HR from device)"}
              </button>

              {showSessionTime && (
                <div className="bg-white rounded-xl p-3 border border-slate-100 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">
                        Start
                      </label>
                      <input
                        type="datetime-local"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">
                        End
                      </label>
                      <input
                        type="datetime-local"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoFill}
                    disabled={autoFilling}
                    className="w-full py-2 rounded-lg border-2 border-dashed border-[#69A38D]/40 text-[10px] font-black text-[#69A38D] uppercase tracking-wide hover:bg-[#69A38D]/5 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {autoFilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HeartPulse className="w-3.5 h-3.5" />}
                    {autoFilling ? "Fetching..." : "Auto-fill from device"}
                  </button>
                  {autoFillZones && (
                    <div className="text-[10px] font-bold text-slate-500 pl-1">
                      Zones (min): Z1 {autoFillZones.zone1} · Z2 {autoFillZones.zone2} · Z3 {autoFillZones.zone3} · Z4 {autoFillZones.zone4} · Z5 {autoFillZones.zone5}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {(category === "flexibility" || category === "other") && (
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">
                Intensity
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["low", "medium", "high"].map((level) => (
                  <button
                    key={level}
                    onClick={() => setIntensity(level)}
                    className={`py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all capitalize ${
                      intensity === level
                        ? "bg-[#69A38D] text-white shadow-md"
                        : "bg-white text-slate-500 border border-slate-100"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          )}

          {category === "strength" && (
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">
                Exercises
              </label>
              {exercises.map((ex, exIdx) => (
                <div key={exIdx} className="bg-white rounded-xl p-3 border border-slate-100 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ex.name}
                      onChange={(e) => updateExerciseName(exIdx, e.target.value)}
                      placeholder="e.g. Bench Press"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#69A38D]/30"
                    />
                    {exercises.length > 1 && (
                      <button onClick={() => removeExercise(exIdx)} className="text-slate-300 hover:text-rose-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {ex.sets.map((set, setIdx) => (
                    <div key={setIdx} className="flex items-center gap-2 pl-2">
                      <span className="text-[10px] font-black text-slate-300 w-10">Set {setIdx + 1}</span>
                      <input
                        type="number"
                        min="0"
                        value={set.reps}
                        onChange={(e) => updateSet(exIdx, setIdx, "reps", e.target.value)}
                        placeholder="Reps"
                        className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        value={set.weight}
                        onChange={(e) => updateSet(exIdx, setIdx, "weight", e.target.value)}
                        placeholder="Weight (kg)"
                        className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
                      />
                      {ex.sets.length > 1 && (
                        <button onClick={() => removeSet(exIdx, setIdx)} className="text-slate-300 hover:text-rose-500">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => addSet(exIdx)}
                    className="text-[10px] font-black text-[#69A38D] uppercase tracking-wide pl-2"
                  >
                    + Add Set
                  </button>
                </div>
              ))}
              <button
                onClick={addExercise}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-[11px] font-black text-slate-400 uppercase tracking-wide hover:border-[#69A38D] hover:text-[#69A38D] transition-all"
              >
                + Add Exercise
              </button>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-4 bg-[#69A38D] hover:bg-[#5B9A80] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 mt-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isSubmitting ? "Saving..." : "Log Exercise"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, unit, color }) {
  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[24px] p-4 border border-white/50 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-lg font-black text-slate-900 leading-tight">
          {value}
          {unit && <span className="text-xs font-bold text-slate-400 ml-1">{unit}</span>}
        </div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}

const ZONE_LABELS = {
  zone1: "Zone 1 · Light",
  zone2: "Zone 2 · Easy",
  zone3: "Zone 3 · Moderate",
  zone4: "Zone 4 · Hard",
  zone5: "Zone 5 · Max",
};

function SessionInsightModal({ sessionId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    exerciseService
      .getSessionInsight(sessionId)
      .then(({ data: res }) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load session insight");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const session = data?.session;
  const meta = session ? activityMeta(session.activityType) : null;
  const zones = session?.heartRateZones;
  const hasZones = zones && Object.values(zones).some((v) => v > 0);

  return (
    <div className="fixed inset-0 z-[1002] flex items-end md:items-center justify-center p-0 md:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, y: 80, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 80, scale: 0.97 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="relative w-full max-w-md bg-[#f7f8f4] rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-[0_-10px_60px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 pt-6 pb-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              {meta ? meta.label : "Session"}
            </h2>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
              Session insight
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 bg-white hover:bg-slate-50 rounded-full flex items-center justify-center transition-all border border-slate-200 shadow-sm shrink-0 ml-3"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4 overflow-y-auto">
          {loading ? (
            <div className="text-center py-10 text-slate-400 text-sm font-bold">Loading...</div>
          ) : !session ? (
            <div className="text-center py-10 text-slate-400 text-sm font-bold">Not found</div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                  <div className="text-base font-black text-slate-900">{session.duration}</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Minutes</div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                  <div className="text-base font-black text-slate-900">{session.caloriesBurned}</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Kcal</div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                  <div className="text-base font-black text-slate-900">{session.avgHeartRate || "-"}</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Avg BPM</div>
                </div>
              </div>

              {(session.minHeartRate || session.maxHeartRate) && (
                <div className="bg-white rounded-xl p-3 border border-slate-100 flex items-center justify-around">
                  <div className="text-center">
                    <div className="text-sm font-black text-slate-900">{session.minHeartRate || "-"}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Min BPM</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-black text-rose-500">{session.maxHeartRate || "-"}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Max BPM</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-black text-slate-500 uppercase capitalize">{session.source?.replace('_', ' ')}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Source</div>
                  </div>
                </div>
              )}

              {hasZones && (
                <div className="bg-white rounded-xl p-3 border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Time in Heart-Rate Zones
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(ZONE_LABELS).map(([key, label]) => {
                      const pct = data.heartRateZonePercent?.[key] || 0;
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500 w-24 shrink-0">{label}</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-rose-400 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-black text-slate-400 w-10 text-right">
                            {zones[key] || 0}m
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {data.comparison && (
                <div className="bg-white rounded-xl p-3 border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Vs Your {data.comparison.sessionCount}-Session Average
                  </div>
                  <div className="text-[11px] font-bold text-slate-600 space-y-1">
                    <div>Duration: {session.duration}m vs {data.comparison.avgDuration}m avg</div>
                    <div>Calories: {session.caloriesBurned} vs {data.comparison.avgCalories} avg</div>
                    {data.comparison.avgHeartRate && (
                      <div>Avg HR: {session.avgHeartRate || "-"} vs {data.comparison.avgHeartRate} avg</div>
                    )}
                  </div>
                </div>
              )}

              {data.nutrition && (
                <div className="bg-white rounded-xl p-3 border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Same-Day Nutrition
                  </div>
                  <div className="text-[11px] font-bold text-slate-600 space-y-1">
                    <div>Consumed: {data.nutrition.caloriesConsumed ?? "-"} kcal</div>
                    <div>Burned that day: {data.nutrition.caloriesBurned ?? "-"} kcal</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function Fitness() {
  const [showLogForm, setShowLogForm] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [todayLogs, setTodayLogs] = useState([]);
  const [dailySummary, setDailySummary] = useState(null);
  const [weeklyStats, setWeeklyStats] = useState(null);
  const [trends, setTrends] = useState({ dailyTrend: [], byType: [] });
  const [personalRecords, setPersonalRecords] = useState(null);
  const [hrWeekCompare, setHrWeekCompare] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [todayRes, dailyRes, weeklyRes, trendsRes, prRes, hrTrendRes] = await Promise.all([
        exerciseService.getTodayLogs(),
        exerciseService.getDailySummary(),
        exerciseService.getWeeklySummary(),
        exerciseService.getTrends("4weeks"),
        exerciseService.getPersonalRecords(),
        wearableService.getHeartRateTrend(2).catch(() => ({ data: null })),
      ]);
      setTodayLogs(todayRes.data.exerciseLogs || []);
      setDailySummary(dailyRes.data.summary);
      setWeeklyStats(weeklyRes.data.weeklyStats);
      setTrends({ dailyTrend: trendsRes.data.dailyTrend || [], byType: trendsRes.data.byType || [] });
      setPersonalRecords(prRes.data.personalRecords);
      setHrWeekCompare(hrTrendRes.data);
    } catch (error) {
      toast.error("Failed to load fitness data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleDelete = async (id) => {
    try {
      await exerciseService.deleteExerciseLog(id);
      toast.success("Exercise log deleted");
      fetchAll();
    } catch (error) {
      toast.error("Failed to delete log");
    }
  };

  const chartData = trends.dailyTrend.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("en-US", { weekday: "short" }),
  }));

  const hrChartData = trends.dailyTrend
    .filter((d) => d.avgHeartRate)
    .map((d) => ({
      ...d,
      label: new Date(d.date).toLocaleDateString("en-US", { weekday: "short" }),
    }));

  return (
    <div className="min-h-screen pb-32" style={{ background: "#F2F7F2" }}>
      <SEO pageName="fitness" />
      <div className="container mx-auto px-4 pt-2 pb-8 max-w-[1000px]">
        <div className="flex items-center justify-between mb-5 mt-2">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Fitness</h1>
            <p className="text-xs font-bold text-slate-400">Log workouts, track progress</p>
          </div>
          <button
            onClick={() => setShowLogForm(true)}
            className="flex items-center gap-1.5 bg-[#69A38D] hover:bg-[#5B9A80] text-white px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-wide shadow-lg active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Log
          </button>
        </div>

        {/* Today's stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <StatCard
            icon={Flame}
            label="Calories"
            value={dailySummary?.totalCaloriesBurned || 0}
            unit="kcal"
            color="bg-orange-50 text-orange-500"
          />
          <StatCard
            icon={Clock}
            label="Duration"
            value={dailySummary?.totalDuration || 0}
            unit="min"
            color="bg-blue-50 text-blue-500"
          />
          <StatCard
            icon={Dumbbell}
            label="Sessions"
            value={dailySummary?.sessionsCount || 0}
            color="bg-[#69A38D]/10 text-[#69A38D]"
          />
        </div>

        {/* Weekly summary */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[32px] p-5 md:p-6 border border-white/50 shadow-[0_4px_24px_rgba(0,0,0,0.02)] mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">This Week</h2>
            <TrendingUp className="w-4 h-4 text-[#69A38D]" />
          </div>
          <div className="grid grid-cols-4 gap-3 mb-5">
            <div>
              <div className="text-lg font-black text-slate-900">{weeklyStats?.totalSessions || 0}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Sessions</div>
            </div>
            <div>
              <div className="text-lg font-black text-slate-900">{weeklyStats?.totalDuration || 0}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Minutes</div>
            </div>
            <div>
              <div className="text-lg font-black text-slate-900">{weeklyStats?.totalCaloriesBurned || 0}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Kcal</div>
            </div>
            <div>
              <div className="text-lg font-black text-slate-900">
                {weeklyStats?.totalDistance ? weeklyStats.totalDistance.toFixed(1) : 0}
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Km</div>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid vertical={false} stroke="#eee" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value, name) => [value, name === "totalCalories" ? "Calories" : "Minutes"]}
                    contentStyle={{ borderRadius: 12, fontSize: 12, fontWeight: 700 }}
                  />
                  <Bar dataKey="totalCalories" fill="#69A38D" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Heart rate trend */}
        {hrChartData.length > 0 && (
          <div className="bg-white/80 backdrop-blur-xl rounded-[32px] p-5 md:p-6 border border-white/50 shadow-[0_4px_24px_rgba(0,0,0,0.02)] mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Avg Heart Rate</h2>
              <HeartPulse className="w-4 h-4 text-rose-400" />
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hrChartData}>
                  <CartesianGrid vertical={false} stroke="#eee" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={["dataMin - 10", "dataMax + 10"]} />
                  <Tooltip
                    formatter={(value) => [`${value} bpm`, "Avg HR"]}
                    contentStyle={{ borderRadius: 12, fontSize: 12, fontWeight: 700 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgHeartRate"
                    stroke="#fb7185"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#fb7185" }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* All-day heart rate: this week vs last week */}
        {hrWeekCompare?.thisWeek && (
          <div className="bg-white/80 backdrop-blur-xl rounded-[32px] p-5 md:p-6 border border-white/50 shadow-[0_4px_24px_rgba(0,0,0,0.02)] mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Heart Rate · This Week vs Last Week
              </h2>
              <HeartPulse className="w-4 h-4 text-rose-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-2xl p-4">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">This Week</div>
                <div className="text-2xl font-black text-slate-900">{hrWeekCompare.thisWeek.avgBpm}</div>
                <div className="text-[10px] font-bold text-slate-400 mb-1">avg bpm</div>
                <div className="text-[10px] font-bold text-slate-500">
                  {hrWeekCompare.thisWeek.minBpm}–{hrWeekCompare.thisWeek.maxBpm} bpm range · {hrWeekCompare.thisWeek.daysWithData}d logged
                </div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Last Week</div>
                {hrWeekCompare.lastWeek ? (
                  <>
                    <div className="text-2xl font-black text-slate-900">{hrWeekCompare.lastWeek.avgBpm}</div>
                    <div className="text-[10px] font-bold text-slate-400 mb-1">avg bpm</div>
                    <div className="text-[10px] font-bold text-slate-500">
                      {hrWeekCompare.lastWeek.minBpm}–{hrWeekCompare.lastWeek.maxBpm} bpm range · {hrWeekCompare.lastWeek.daysWithData}d logged
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] font-bold text-slate-400 pt-1">No data</div>
                )}
              </div>
            </div>
            {hrWeekCompare.avgBpmDelta !== null && (
              <div className={`mt-3 text-[11px] font-black text-center ${hrWeekCompare.avgBpmDelta > 0 ? "text-rose-500" : "text-[#69A38D]"}`}>
                {hrWeekCompare.avgBpmDelta === 0
                  ? "Same average as last week"
                  : `${hrWeekCompare.avgBpmDelta > 0 ? "+" : ""}${hrWeekCompare.avgBpmDelta} bpm vs last week`}
              </div>
            )}
          </div>
        )}

        {/* Today's sessions */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[32px] p-5 md:p-6 border border-white/50 shadow-[0_4px_24px_rgba(0,0,0,0.02)] mb-5">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-4">Today's Sessions</h2>
          {loading ? (
            <div className="text-center py-6 text-slate-400 text-sm font-bold">Loading...</div>
          ) : todayLogs.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm font-bold">No exercise logged today</div>
          ) : (
            <div className="space-y-2">
              {todayLogs.map((log) => {
                const meta = activityMeta(log.activityType);
                const Icon = meta.icon;
                return (
                  <div
                    key={log._id}
                    onClick={() => setSelectedSessionId(log._id)}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#69A38D]/10 text-[#69A38D] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-black text-slate-900 capitalize">
                        {meta.label}
                      </div>
                      <div className="text-[11px] font-bold text-slate-400">
                        {log.duration} min · {log.caloriesBurned} kcal
                        {log.distance ? ` · ${log.distance} km` : ""}
                        {log.avgHeartRate ? ` · ${log.avgHeartRate} bpm` : ""}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(log._id);
                      }}
                      className="text-slate-300 hover:text-rose-500 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Personal records */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[32px] p-5 md:p-6 border border-white/50 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Personal Records</h2>
          </div>
          {(!personalRecords ||
            (personalRecords.cardio.length === 0 && personalRecords.strength.length === 0)) ? (
            <div className="text-center py-4 text-slate-400 text-sm font-bold">
              Log a few sessions to see your records
            </div>
          ) : (
            <div className="space-y-2">
              {personalRecords.cardio.map((pr) => (
                <div key={pr.activityType} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                  <span className="text-sm font-black text-slate-900 capitalize">{activityMeta(pr.activityType).label}</span>
                  <span className="text-[11px] font-bold text-slate-500">
                    {pr.longestDistance > 0 ? `${pr.longestDistance} km · ` : ""}
                    {pr.longestDuration} min · {pr.mostCalories} kcal best
                  </span>
                </div>
              ))}
              {personalRecords.strength.map((pr) => (
                <div key={pr.exerciseName} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                  <span className="text-sm font-black text-slate-900">{pr.exerciseName}</span>
                  <span className="text-[11px] font-bold text-slate-500">
                    {pr.heaviestWeight} kg × {pr.maxReps} reps
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showLogForm && (
          <LogExerciseForm onClose={() => setShowLogForm(false)} onLogged={fetchAll} />
        )}
        {selectedSessionId && (
          <SessionInsightModal
            sessionId={selectedSessionId}
            onClose={() => setSelectedSessionId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
