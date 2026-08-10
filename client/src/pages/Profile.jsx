import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import {
  User,
  Save,
  Heart,
  AlertCircle,
  Camera,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Target,
  Activity,
  Droplet,
  Cigarette,
  Wine,
  Moon,
  Apple,
  Dumbbell,
  Pill,
  Upload,
  Bell,
  ShieldCheck,
  ChevronRight,
  LogOut,
  FileText,
  Settings,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Clock,
  Sparkles,
  Zap,
  X,
  ScrollText,
  Shield,
  Headphones,
  ExternalLink
} from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import ProfileSkeleton from "../components/skeletons/ProfileSkeleton";
import SEO from "../hooks/useSEO";

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [healthGoal, setHealthGoal] = useState(null);
  const [goalLoading, setGoalLoading] = useState(false);
  const [editingCalories, setEditingCalories] = useState(false);
  const [calorieOverrideInput, setCalorieOverrideInput] = useState("");
  const [savingCalorieOverride, setSavingCalorieOverride] = useState(false);
  const [extraData, setExtraData] = useState({
    reportsCount: 0,
    metrics: {},
    latestAnalysis: null,
    loading: true,
  });
  const [expandedSection, setExpandedSection] = useState(null); // 'profile' or 'goals'
  const [viewingPdf, setViewingPdf] = useState(null); // URL of PDF to view
  const [pdfLoading, setPdfLoading] = useState(true);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswordFields, setShowPasswordFields] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }

    setChangingPassword(true);
    try {
      const { data } = await api.post(
        "auth/change-password",
        { currentPassword, newPassword },
        { skipAutoLogout: true },
      );
      toast.success(data.message || "Password changed successfully");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setExpandedSection(null);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to change password. Please try again.",
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const [goalFormData, setGoalFormData] = useState({
    goalType: "maintenance",
    currentWeight: user?.profile?.weight || "",
    targetWeight: "",
    height: user?.profile?.height || "",
    age: user?.profile?.age || "",
    gender: user?.profile?.gender || "male",
    activityLevel: user?.profile?.activityLevel || "sedentary",
    dietaryPreference: user?.profile?.dietaryPreference || "non-vegetarian",
    targetWeeks: "12",
  });

  const [formData, setFormData] = useState({
    name: user?.name || "",
    profile: {
      age: user?.profile?.age || "",
      gender: user?.profile?.gender || "",
      dietaryPreference: user?.profile?.dietaryPreference || "non-vegetarian",
      height: user?.profile?.height || "",
      weight: user?.profile?.weight || "",
      bloodGroup: user?.profile?.bloodGroup || "",
      phone: user?.phone || user?.profile?.phone || "",
      activityLevel: user?.profile?.activityLevel || "sedentary",
      isDiabetic: user?.profile?.isDiabetic || "no",
      allergies: user?.profile?.allergies || "",
      medicalHistory: {
        conditions: user?.profile?.medicalHistory?.conditions || [],
      },
      lifestyle: {
        smoker: user?.profile?.lifestyle?.smoker || false,
        alcohol: user?.profile?.lifestyle?.alcohol || false,
        sleepHours: user?.profile?.lifestyle?.sleepHours || "7",
        stressLevel: user?.profile?.lifestyle?.stressLevel || "moderate",
        waterIntake: user?.profile?.lifestyle?.waterIntake || "8",
      },
      diabetesProfile: user?.profile?.diabetesProfile || {
        type: "Type 2",
        hba1c: "",
      },
    },
    foodPreferences: {
      region: user?.foodPreferences?.region || "other",
      country: user?.foodPreferences?.country || "India",
      preferredFoods: user?.foodPreferences?.preferredFoods || [],
      foodsToAvoid: user?.foodPreferences?.foodsToAvoid || [],
      dietaryRestrictions: user?.foodPreferences?.dietaryRestrictions || [],
      mealPreferences: user?.foodPreferences?.mealPreferences || {
        breakfast: [],
        lunch: [],
        snacks: [],
        dinner: []
      },
    },
  });

  const fetchHealthGoal = async () => {
    try {
      const { data } = await api.get("nutrition/goals");
      setHealthGoal(data.healthGoal);
      if (data.healthGoal) {
        setGoalFormData((prev) => ({
          ...prev,
          goalType: data.healthGoal.goalType,
          currentWeight: user?.profile?.weight || data.healthGoal.currentWeight,
          targetWeight: data.healthGoal.targetWeight,
          height: user?.profile?.height || data.healthGoal.height,
          age: user?.profile?.age || data.healthGoal.age,
          gender: user?.profile?.gender || data.healthGoal.gender,
          activityLevel: data.healthGoal.activityLevel,
          dietaryPreference: data.healthGoal.dietaryPreference,
        }));
      }
    } catch (e) {
      console.error("Failed to fetch health goal", e);
    }
  };

  const fetchExtraData = async () => {
    try {
      const [reportsRes, summaryRes, dashRes] = await Promise.all([
        api.get("health/reports"),
        api.get("metrics/summary/latest?types=heart_rate,blood_pressure"),
        api.get("health/dashboard"),
      ]);

      const reportsArray = Array.isArray(reportsRes.data)
        ? reportsRes.data
        : reportsRes.data?.reports || [];
      const reportsCount =
        dashRes.data && typeof dashRes.data.totalReports === "number"
          ? dashRes.data.totalReports
          : reportsArray.length;

      setExtraData({
        reportsCount,
        metrics: summaryRes.data,
        latestAnalysis: dashRes.data.latestAnalysis,
        recentReports: reportsArray.slice(0, 3),
        loading: false,
      });
    } catch (e) {
      console.error("Failed to fetch extra profile data", e);
      setExtraData((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchHealthGoal();
    fetchExtraData();
    if (searchParams.get("tab") === "goals") setExpandedSection("goals");
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      setGoalFormData((prev) => ({
        ...prev,
        currentWeight: user?.profile?.weight || prev.currentWeight,
        height: user?.profile?.height || prev.height,
        age: user?.profile?.age || prev.age,
        gender: user?.profile?.gender || prev.gender,
        dietaryPreference:
          user?.profile?.dietaryPreference || prev.dietaryPreference,
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => {
      const keys = name.split(".");
      if (keys.length === 1) {
        return { ...prev, [name]: type === "checkbox" ? checked : value };
      }

      const newFormData = { ...prev };
      let current = newFormData;

      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = type === "checkbox" ? checked : value;
      return newFormData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        phone: formData.profile.phone,
        profile: {
          ...formData.profile,
          age: Number(formData.profile.age),
          height: Number(formData.profile.height),
          weight: Number(formData.profile.weight),
          diabetesProfile:
            formData.profile.isDiabetic === "yes"
              ? formData.profile.diabetesProfile
              : undefined,
        },
        foodPreferences: {
          region: formData.foodPreferences.region,
          country: formData.foodPreferences.country,
          preferredFoods: formData.foodPreferences.preferredFoods || [],
          foodsToAvoid: formData.foodPreferences.foodsToAvoid || [],
          dietaryRestrictions: formData.foodPreferences.dietaryRestrictions || [],
          mealPreferences: formData.foodPreferences.mealPreferences || {
            breakfast: [],
            lunch: [],
            snacks: [],
            dinner: []
          },
        },
      };
      const { data } = await api.put("auth/profile", payload);
      updateUser(data);
      toast.success("Profile updated successfully!");
      // Don't wait for diet plan generation - it can timeout
      if (data.bmiChanged) {
        fetchHealthGoal().catch(() => {
          // Silently fail if diet plan generation times out
        });
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || "Failed to update profile";
      // If it's a diet plan timeout, still show success since profile was updated
      if (errorMsg.includes("Diet plan") || errorMsg.includes("timed out")) {
        toast.success("Profile updated successfully!");
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoalSubmit = async (e) => {
    e.preventDefault();

    const currentWeight = parseFloat(formData.profile.weight);
    const height = parseFloat(formData.profile.height);
    const age = parseInt(formData.profile.age);
    const gender = formData.profile.gender;

    if (!currentWeight || !height || !age || !gender) {
      console.log( `Missing required personal info: weight=${currentWeight}, height=${height}, age=${age}, gender=${gender}`)
      toast.error(
        "Please fill your weight, height, age and gender in Personal Info before setting a goal.",
      );
      return;
    }

    setGoalLoading(true);
    try {
      const targetDate = new Date();
      targetDate.setDate(
        targetDate.getDate() + parseInt(goalFormData.targetWeeks) * 7,
      );

      const payload = {
        ...goalFormData,
        targetDate,
        currentWeight,
        targetWeight: parseFloat(goalFormData.targetWeight),
        height,
        age,
        gender,
        isDiabetic: formData.profile.isDiabetic === "yes",
      };
      const { data } = await api.put("nutrition/goals", payload);
      setHealthGoal(data.healthGoal);
      toast.success("Fitness goal updated!");
      const { data: userData } = await api.get("auth/profile");
      updateUser(userData);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update goal");
    } finally {
      setGoalLoading(false);
    }
  };

  const handleGoalChange = (e) => {
    const { name, value } = e.target;
    setGoalFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveCalorieOverride = async () => {
    const value = parseInt(calorieOverrideInput, 10);
    if (!value || value < 800 || value > 6000) {
      toast.error("Enter a calorie target between 800 and 6000 kcal");
      return;
    }
    setSavingCalorieOverride(true);
    try {
      const { data } = await api.patch("nutrition/goals/calorie-override", {
        dailyCalorieTarget: value,
      });
      setHealthGoal(data.healthGoal);
      const { data: userData } = await api.get("auth/profile");
      updateUser(userData);
      toast.success("Calorie goal updated");
      setEditingCalories(false);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to update calorie goal",
      );
    } finally {
      setSavingCalorieOverride(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("profilePicture", file);
      const { data } = await api.post("auth/upload-profile-picture", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      updateUser({ ...user, profilePicture: data.profilePicture });
      toast.success("Profile picture updated!");
    } catch (error) {
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const bmi =
    formData.profile.height && formData.profile.weight
      ? (
          formData.profile.weight / Math.pow(formData.profile.height / 100, 2)
        ).toFixed(1)
      : null;

  const getBmiStatus = (bmi) => {
    if (!bmi) return { label: "N/A", color: "slate" };
    if (bmi < 18.5) return { label: "Underweight", color: "blue" };
    if (bmi < 25) return { label: "Normal", color: "emerald" };
    if (bmi < 30) return { label: "Overweight", color: "amber" };
    return { label: "Obese", color: "red" };
  };

  const bmiStatus = getBmiStatus(parseFloat(bmi));

  // Smart weight / goal mismatch warning
  const goalMismatchWarning = (() => {
    const cw =
      parseFloat(formData.profile.weight) ||
      parseFloat(user?.profile?.weight) ||
      0;
    const tw = parseFloat(goalFormData.targetWeight) || 0;
    const goal = goalFormData.goalType;

    if (!cw || !tw) return null;

    if (goal === "weight_loss" && tw > cw) {
      return {
        msg: `Weight mismatch: Target (${tw}kg) is higher than current (${cw}kg).`,
        icon: "⚠️",
      };
    } else if ((goal === "weight_gain" || goal === "muscle_gain") && tw < cw) {
      return {
        msg: `Weight mismatch: Target (${tw}kg) is lower than current (${cw}kg).`,
        icon: "⚠️",
      };
    }
    return null;
  })();

  // Toast alert for mismatch
  useEffect(() => {
    if (goalMismatchWarning && goalMismatchWarning.icon === "⚠️") {
      toast.error(goalMismatchWarning.msg, { id: "weight-mismatch" });
    }
  }, [goalMismatchWarning]);

  // Live Macro Preview (Client-side calculation to match backend)
  const liveMacroPreview = (() => {
    const cw =
      parseFloat(formData.profile.weight) ||
      parseFloat(user?.profile?.weight) ||
      0;
    const ht =
      parseFloat(formData.profile.height) ||
      parseFloat(user?.profile?.height) ||
      0;
    const age =
      parseInt(formData.profile.age) || parseInt(user?.profile?.age) || 0;
    const gender = formData.profile.gender || user?.profile?.gender || "male";
    const goal = goalFormData.goalType;
    const activity = goalFormData.activityLevel || "sedentary";
    const isDiabetic = formData.profile.isDiabetic === "yes";

    if (!cw || !ht || !age) return null;

    // 1. Calculate BMR (Mifflin-St Jeor)
    let bmr = 10 * cw + 6.25 * ht - 5 * age;
    bmr = gender === "male" ? bmr + 5 : bmr - 161;

    // 2. Calculate TDEE
    const multipliers = {
      sedentary: 1.2,
      lightly_active: 1.375,
      moderately_active: 1.55,
      very_active: 1.725,
      extremely_active: 1.9,
    };
    const tdee = bmr * (multipliers[activity] || 1.2);

    // 3. Calorie Target — mirrors HealthGoal.js's calculateCalorieTarget() so the live preview
    // matches what actually gets persisted on submit. Derives the surplus/deficit from
    // targetWeight + targetWeeks instead of a flat constant, capped to a physiologically
    // realistic weekly rate (ACSM safe-loss guideline / natural muscle-gain ceiling).
    const MAX_WEEKLY_RATE_FRACTION = {
      weight_loss: 0.01,
      weight_gain: 0.005,
      muscle_gain: 0.0025,
    };
    const KCAL_PER_KG_FAT = 7700;

    const targetWeight = parseFloat(goalFormData.targetWeight) || 0;
    const weeks = parseInt(goalFormData.targetWeeks) || 12;

    let adjust = 0;
    let weeklyRateKg = 0;
    let realisticWeeks = null;

    if (["weight_loss", "weight_gain", "muscle_gain"].includes(goal) && targetWeight) {
      const requestedWeeklyRate = (targetWeight - cw) / weeks;

      // Cap direction follows the actual target-vs-current sign, not the goalType label —
      // mirrors HealthGoal.js so a mismatched goal/target combo (e.g. "Weight loss" with a
      // higher target) still recalculates live instead of freezing at 0.
      const maxRateFraction =
        requestedWeeklyRate < 0
          ? MAX_WEEKLY_RATE_FRACTION.weight_loss
          : goal === "muscle_gain"
            ? MAX_WEEKLY_RATE_FRACTION.muscle_gain
            : MAX_WEEKLY_RATE_FRACTION.weight_gain;
      const maxRate = maxRateFraction * cw;

      weeklyRateKg =
        requestedWeeklyRate < 0
          ? Math.max(requestedWeeklyRate, -maxRate)
          : Math.min(requestedWeeklyRate, maxRate);

      adjust = (weeklyRateKg * KCAL_PER_KG_FAT) / 7;
      if (isDiabetic) adjust *= 0.8;

      if (weeklyRateKg !== 0) {
        realisticWeeks = Math.ceil(Math.abs(targetWeight - cw) / Math.abs(weeklyRateKg));
      }
    } else if (goal === "weight_loss") adjust = isDiabetic ? -400 : -500;
    else if (goal === "weight_gain") adjust = isDiabetic ? 250 : 500;
    else if (goal === "muscle_gain") adjust = isDiabetic ? 200 : 300;

    const safeMinimum = Math.max(gender === "male" ? 1500 : 1200, Math.round(bmr * 1.1));
    const calorieTarget = Math.max(Math.round(tdee + adjust), safeMinimum);

    // 4. Macros
    let pro, carb, fat;
    if (isDiabetic) {
      const proPct =
        goal === "weight_loss" || goal === "muscle_gain" ? 0.35 : 0.3;
      const carbPct = 0.25;
      const fatPct = 1 - proPct - carbPct;
      pro = Math.round((calorieTarget * proPct) / 4);
      carb = Math.round((calorieTarget * carbPct) / 4);
      fat = Math.round((calorieTarget * fatPct) / 9);
    } else {
      const proPerKg =
        goal === "weight_loss" ? 1.6 : goal === "muscle_gain" ? 1.8 : 1.2;
      const fatPerKg = goal === "weight_loss" ? 0.6 : 1.0;
      pro = Math.round(cw * proPerKg);
      fat = Math.round(cw * fatPerKg);
      carb = Math.round(Math.max((calorieTarget - pro * 4 - fat * 9) / 4, 0));
    }

    return {
      calories: calorieTarget,
      protein: pro,
      carbs: carb,
      fats: fat,
      weeklyRateKg,
      realisticWeeks,
      requestedWeeks: weeks,
    };
  })();

  if (!user) return <ProfileSkeleton />;

  return (
    <div className="w-full relative min-h-screen bg-[#F2F7F2] overflow-x-hidden animate-fade-in pb-32">
      <SEO pageName="profile" />
      <div className="relative z-10 px-[21.96px] pt-12 max-w-lg mx-auto">
        {/* Profile Header Section - Horizontal Layout */}
        <div className="flex items-center gap-[18px] mb-10">
          <div className="relative flex-shrink-0">
            <div
              className="relative group cursor-pointer"
              onClick={() =>
                setExpandedSection(
                  expandedSection === "img_options" ? null : "img_options",
                )
              }
            >
              {user?.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt={user.name}
                  className="w-[84.18px] h-[84.18px] rounded-full object-cover border-[3.66px] border-white shadow-lg transition-transform active:scale-95"
                />
              ) : (
                <div className="w-[84.18px] h-[84.18px] rounded-full bg-slate-100 flex items-center justify-center text-2xl font-black text-slate-400 border-[3.66px] border-white shadow-lg transition-transform active:scale-95">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
              )}

              <div className="absolute -bottom-1 -right-1">
                <div className="w-[31.1px] h-[31.1px] rounded-xl bg-[#1a2138] flex items-center justify-center border-[2.75px] border-white shadow-md">
                  <Camera
                    className="w-[14px] h-[14px] text-white"
                    strokeWidth={3}
                  />
                </div>
              </div>

              <AnimatePresence>
                {expandedSection === "img_options" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="absolute top-full left-0 mt-3 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 w-44"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        fileInputRef.current?.click();
                        setExpandedSection(null);
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#69A38D] flex items-center justify-center">
                        <Upload size={14} />
                      </div>
                      <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">
                        Upload Photo
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        cameraInputRef.current?.click();
                        setExpandedSection(null);
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Camera size={14} />
                      </div>
                      <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">
                        Open Camera
                      </span>
                    </button>
                    <div className="absolute -top-1.5 left-6 w-3 h-3 bg-white border-t border-l border-slate-100 rotate-45" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              capture="environment"
              className="hidden"
            />
          </div>

          <div className="flex-1 flex flex-col items-start gap-1">
            <h2 className="text-[28px] font-black text-[#1a1a1a] leading-none mb-1">
              {user?.name}
            </h2>
            <div className="flex flex-col gap-1 mb-2">
              <p className="text-[16px] font-bold text-[#7B8B9A] flex items-center gap-2">
                <span>
                  {user?.profile?.age
                    ? `${user.profile.age} yrs`
                    : "Age not set"}
                </span>
                <span className="w-1 h-1 bg-[#D9D9D9] rounded-full" />
                <span className="capitalize">
                  {user?.profile?.gender || "Other"}
                </span>
                <span className="w-1 h-1 bg-[#D9D9D9] rounded-full" />
                <span>
                  {user?.profile?.height
                    ? `${user.profile.height}cm`
                    : "Height not set"}
                </span>
              </p>
              <p className="text-[12px] font-bold text-slate-400 flex items-center gap-1.5 lowercase">
                <Mail size={12} className="text-slate-300" />
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Settings Card — liquid glass */}
        <div
          className="w-full flex flex-col mx-auto mb-10"
          style={{
            borderRadius: "25.6px",
            maxWidth: "349.25px",
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.85)",
            boxShadow: "0 4px 24px rgba(16,185,129,0.06), 0 1px 0 rgba(255,255,255,0.9) inset",
          }}
        >
          <div className="flex flex-col">
            {/* Account Details */}
            <button
              onClick={() =>
                setExpandedSection(
                  expandedSection === "account" ? null : "account",
                )
              }
              className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors border-b border-slate-50 group"
            >
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                  <User size={18} className="text-slate-600" />
                </div>
                <span className="text-[15px] font-black text-[#1a1a1a] tracking-tight">
                  Account Details
                </span>
              </div>
              <ChevronRight
                size={18}
                className={`text-slate-300 transition-transform ${expandedSection === "account" ? "rotate-90" : ""}`}
              />
            </button>

            <AnimatePresence>
              {expandedSection === "account" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-slate-50/30 px-6 border-b border-slate-100 overflow-hidden"
                >
                  <div className="py-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                          Full Name
                        </label>
                        <input
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold shadow-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                          Email
                        </label>
                        <input
                          value={user?.email}
                          disabled
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                          Phone
                        </label>
                        <input
                          name="profile.phone"
                          value={formData.profile.phone}
                          onChange={handleChange}
                          className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                          Age
                        </label>
                        <input
                          name="profile.age"
                          value={formData.profile.age}
                          onChange={handleChange}
                          className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                          Gender
                        </label>
                        <select
                          name="profile.gender"
                          value={formData.profile.gender}
                          onChange={handleChange}
                          className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold shadow-sm"
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                          Blood Group
                        </label>
                        <select
                          name="profile.bloodGroup"
                          value={formData.profile.bloodGroup}
                          onChange={handleChange}
                          className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold shadow-sm"
                        >
                          <option value="">Select</option>
                          {[
                            "A+",
                            "A-",
                            "B+",
                            "B-",
                            "AB+",
                            "AB-",
                            "O+",
                            "O-",
                          ].map((bg) => (
                            <option key={bg} value={bg}>
                              {bg}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                          Height (cm)
                        </label>
                        <input
                          name="profile.height"
                          value={formData.profile.height}
                          onChange={handleChange}
                          className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                          Weight (kg)
                        </label>
                        <input
                          name="profile.weight"
                          value={formData.profile.weight}
                          onChange={handleChange}
                          className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold shadow-sm"
                        />
                      </div>

                      <div className="col-span-2 border-t border-slate-200 pt-5 mt-2">
                        <label className="text-[11px] font-black text-[#69A38D] uppercase tracking-widest mb-4 block">
                          Comprehensive Health History
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">
                              Are you Diabetic?
                            </label>
                            <select
                              name="profile.isDiabetic"
                              value={formData.profile.isDiabetic}
                              onChange={handleChange}
                              className="w-full bg-white border border-slate-100 rounded-xl py-2.5 px-3 text-[11px] font-bold"
                            >
                              <option value="no">No</option>
                              <option value="yes">Yes</option>
                            </select>
                          </div>
                          {formData.profile.isDiabetic === "yes" && (
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">
                                HbA1c (%)
                              </label>
                              <input
                                name="profile.diabetesProfile.hba1c"
                                value={formData.profile.diabetesProfile.hba1c}
                                onChange={handleChange}
                                className="w-full bg-white border border-slate-100 rounded-xl py-2.5 px-3 text-[11px] font-bold"
                              />
                            </div>
                          )}
                          <div className="col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">
                              Medical Conditions
                            </label>
                            <input
                              value={formData.profile.medicalHistory.conditions.join(
                                ", ",
                              )}
                              onChange={(e) => {
                                const conds = e.target.value
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean);
                                setFormData((prev) => ({
                                  ...prev,
                                  profile: {
                                    ...prev.profile,
                                    medicalHistory: { conditions: conds },
                                  },
                                }));
                              }}
                              className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold"
                              placeholder="e.g. Hypertension, Asthma"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">
                              Allergies
                            </label>
                            <input
                              name="profile.allergies"
                              value={formData.profile.allergies}
                              onChange={handleChange}
                              className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold"
                              placeholder="e.g. Peanuts, Penicillin"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2 border-t border-slate-200 pt-5 mt-2">
                        <label className="text-[11px] font-black text-[#69A38D] uppercase tracking-widest mb-4 block">
                          Food Preferences
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">
                              Region
                            </label>
                            <select
                              name="foodPreferences.region"
                              value={formData.foodPreferences.region}
                              onChange={handleChange}
                              className="w-full bg-white border border-slate-100 rounded-xl py-2.5 px-3 text-[11px] font-bold"
                            >
                              <option value="north">North</option>
                              <option value="south">South</option>
                              <option value="east">East</option>
                              <option value="west">West</option>
                              <option value="northeast">Northeast</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">
                              Country
                            </label>
                            <input
                              name="foodPreferences.country"
                              value={formData.foodPreferences.country}
                              onChange={handleChange}
                              className="w-full bg-white border border-slate-100 rounded-xl py-2.5 px-3 text-[11px] font-bold"
                              placeholder="e.g. India, USA, UK"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleSubmit}
                      className="w-full py-4 bg-[#1a2138] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] shadow-lg active:scale-98 transition-transform"
                    >
                      Save Changes
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Change Password */}
            <button
              onClick={() =>
                setExpandedSection(
                  expandedSection === "password" ? null : "password",
                )
              }
              className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors border-b border-slate-50 group"
            >
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                  <Lock size={18} className="text-slate-600" />
                </div>
                <span className="text-[15px] font-black text-[#1a1a1a] tracking-tight">
                  Change Password
                </span>
              </div>
              <ChevronRight
                size={18}
                className={`text-slate-300 transition-transform ${expandedSection === "password" ? "rotate-90" : ""}`}
              />
            </button>

            <AnimatePresence>
              {expandedSection === "password" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-slate-50/30 px-6 border-b border-slate-100 overflow-hidden"
                >
                  {user?.authProvider === "google" ? (
                    <div className="py-6">
                      <p className="text-xs font-bold text-slate-400 text-center">
                        This account uses Google Sign-In and doesn't have a
                        password to change.
                      </p>
                    </div>
                  ) : (
                    <div className="py-6 space-y-4">
                      {[
                        {
                          key: "currentPassword",
                          label: "Current Password",
                          show: "current",
                        },
                        {
                          key: "newPassword",
                          label: "New Password",
                          show: "new",
                        },
                        {
                          key: "confirmPassword",
                          label: "Confirm New Password",
                          show: "confirm",
                        },
                      ].map(({ key, label, show }) => (
                        <div key={key}>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                            {label}
                          </label>
                          <div className="relative">
                            <input
                              type={showPasswordFields[show] ? "text" : "password"}
                              value={passwordForm[key]}
                              onChange={(e) =>
                                setPasswordForm((prev) => ({
                                  ...prev,
                                  [key]: e.target.value,
                                }))
                              }
                              className="w-full bg-white border border-slate-100 rounded-xl py-3 pl-4 pr-11 text-sm font-bold shadow-sm"
                              placeholder="••••••••"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowPasswordFields((prev) => ({
                                  ...prev,
                                  [show]: !prev[show],
                                }))
                              }
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              {showPasswordFields[show] ? (
                                <EyeOff size={16} />
                              ) : (
                                <Eye size={16} />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={handleChangePassword}
                        disabled={changingPassword}
                        className="w-full py-4 bg-[#1a2138] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] shadow-lg active:scale-98 transition-transform disabled:opacity-60"
                      >
                        {changingPassword ? "Updating..." : "Update Password"}
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Goal Settings */}
            <button
              onClick={() =>
                setExpandedSection(expandedSection === "goals" ? null : "goals")
              }
              className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors border-b border-slate-50 group"
            >
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                  <Target size={18} className="text-slate-600" />
                </div>
                <span className="text-[15px] font-black text-[#1a1a1a] tracking-tight">
                  Goal Settings
                </span>
              </div>
              <ChevronRight
                size={18}
                className={`text-slate-300 transition-transform ${expandedSection === "goals" ? "rotate-90" : ""}`}
              />
            </button>

            <AnimatePresence>
              {expandedSection === "goals" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-slate-50/30 px-6 border-b border-slate-100 overflow-hidden"
                >
                  <div className="py-6 space-y-6">
                    <form onSubmit={handleGoalSubmit} className="space-y-6">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                          Health Objective
                        </label>
                        <select
                          name="goalType"
                          value={goalFormData.goalType}
                          onChange={handleGoalChange}
                          className="w-full bg-white border-2 border-[#69A38D]/20 rounded-xl py-3 px-4 text-[13px] font-black shadow-sm"
                        >
                          <option value="weight_loss">Weight loss</option>
                          <option value="weight_gain">Weight gain</option>
                          <option value="maintenance">Maintain weight</option>
                          <option value="muscle_gain">
                            Muscle gain / strength building
                          </option>
                          <option value="health_improvement">
                            Improve fitness / stamina
                          </option>
                          <option value="general_health">
                            General health / wellness
                          </option>
                          <option value="disease_management">
                            Disease management
                          </option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100/30">
                          <p className="text-[9px] font-black text-[#69A38D] uppercase mb-1">
                            Current Weight
                          </p>
                          <p className="text-lg font-black text-[#1a1a1a]">
                            {formData.profile.weight ||
                              user?.profile?.weight ||
                              "—"}{" "}
                            <span className="text-[10px] text-slate-400">
                              kg
                            </span>
                          </p>
                        </div>
                        <div className="p-4 bg-white rounded-xl border border-slate-100">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                            Target Weight
                          </p>
                          <input
                            type="number"
                            name="targetWeight"
                            value={goalFormData.targetWeight}
                            onChange={handleGoalChange}
                            className="w-full text-lg font-black text-[#1a1a1a] bg-transparent focus:outline-none"
                            placeholder="Set target"
                          />
                        </div>
                      </div>

                      {/* Smart Weight / Goal Mismatch Warning */}
                      {goalMismatchWarning && (
                        <div className="flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl animate-bounce-subtle">
                          <span className="text-sm">
                            {goalMismatchWarning.icon}
                          </span>
                          <p className="text-[10px] font-bold text-red-700">
                            {goalMismatchWarning.msg}
                          </p>
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                          Target Timeframe
                        </label>
                        <select
                          name="targetWeeks"
                          value={goalFormData.targetWeeks}
                          onChange={handleGoalChange}
                          className="w-full bg-white border-2 border-slate-100 rounded-xl py-3 px-4 text-sm font-bold shadow-sm"
                        >
                          <option value="4">4 Weeks (Aggressive)</option>
                          <option value="8">8 Weeks (Steady)</option>
                          <option value="12">12 Weeks (Sustainable)</option>
                          <option value="16">16 Weeks (Lifestyle)</option>
                          <option value="24">24 Weeks (Long-term)</option>
                        </select>
                        <p className="text-[9px] text-slate-400 mt-2 italic px-1">
                          Tip: 12 weeks is recommended for sustainable fat loss
                          or muscle gain.
                        </p>
                      </div>

                      {/* Macros Card - Uses Live Preview or Last Synced Data */}
                      {(liveMacroPreview || healthGoal?.macroTargets) && (
                        <div className="p-5 bg-[#1a2138] rounded-2xl text-white shadow-xl relative overflow-hidden">
                          {/* Preview Glow Effect */}
                          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[40px] rounded-full -mr-10 -mt-10" />

                          <div className="flex items-center justify-between mb-4 relative z-10">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                  Daily Calorie Budget
                                </span>
                                {formData.profile.isDiabetic === "yes" && (
                                  <span className="text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">
                                    Diabetic
                                  </span>
                                )}
                              </div>
                              {!healthGoal && (
                                <span className="text-[8px] font-bold text-[#69A38D] uppercase tracking-tight">
                                  Live Prediction
                                </span>
                              )}
                              {healthGoal?.calorieSource === "manual" && (
                                <span className="text-[8px] font-bold text-amber-400 uppercase tracking-tight">
                                  Custom target
                                </span>
                              )}
                            </div>
                            {editingCalories ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  autoFocus
                                  value={calorieOverrideInput}
                                  onChange={(e) =>
                                    setCalorieOverrideInput(e.target.value)
                                  }
                                  className="w-20 bg-white/10 border border-white/20 rounded-lg py-1 px-2 text-sm font-black text-white text-right focus:outline-none focus:border-[#69A38D]"
                                  placeholder="kcal"
                                />
                                <button
                                  type="button"
                                  onClick={handleSaveCalorieOverride}
                                  disabled={savingCalorieOverride}
                                  className="text-[10px] font-black uppercase text-emerald-400 disabled:opacity-50"
                                >
                                  {savingCalorieOverride ? "..." : "Save"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCalories(false)}
                                  className="text-[10px] font-black uppercase text-slate-400"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setCalorieOverrideInput(
                                    String(
                                      liveMacroPreview?.calories ||
                                        healthGoal?.dailyCalorieTarget ||
                                        "",
                                    ),
                                  );
                                  setEditingCalories(true);
                                }}
                                disabled={!healthGoal}
                                className="text-xl font-black disabled:cursor-not-allowed"
                                title={
                                  healthGoal
                                    ? "Tap to set a custom calorie target"
                                    : "Sync your fitness plan first to customize"
                                }
                              >
                                {liveMacroPreview?.calories ||
                                  healthGoal?.dailyCalorieTarget}
                                <span className="text-[11px] text-[#69A38D] ml-1">
                                  KCAL
                                </span>
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-3 relative z-10">
                            {[
                              {
                                label: "PRO",
                                val:
                                  liveMacroPreview?.protein ||
                                  healthGoal?.macroTargets.protein,
                                unit: "g",
                                color: "bg-emerald-500",
                              },
                              {
                                label: "CARB",
                                val:
                                  liveMacroPreview?.carbs ||
                                  healthGoal?.macroTargets.carbs,
                                unit: "g",
                                color: "bg-amber-500",
                              },
                              {
                                label: "FAT",
                                val:
                                  liveMacroPreview?.fats ||
                                  healthGoal?.macroTargets.fats,
                                unit: "g",
                                color: "bg-rose-500",
                              },
                            ].map((m) => (
                              <div
                                key={m.label}
                                className="bg-white/5 rounded-xl p-3 border border-white/5"
                              >
                                <div
                                  className={`w-1 h-4 ${m.color} rounded-full mb-2 shadow-[0_0_10px_rgba(0,0,0,0.2)]`}
                                />
                                <p className="text-[10px] font-black text-slate-400 mb-0.5">
                                  {m.label}
                                </p>
                                <p className="text-sm font-black text-white">
                                  {m.val}
                                  {m.unit}
                                </p>
                              </div>
                            ))}
                          </div>

                          {formData.profile.isDiabetic === "yes" && (
                            <div className="mt-4 flex flex-col gap-1 px-1 relative z-10">
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                                <p className="text-[9px] text-amber-400/80 italic font-medium">
                                  🩺 Glucose Optimization: Controlled carbs for
                                  stable insulin levels
                                </p>
                              </div>
                              <p className="text-[8px] text-slate-500 opacity-60 ml-3 italic">
                                *Macros are based on current weight to ensure
                                safety during your journey
                              </p>
                            </div>
                          )}

                          {/* Realistic timeframe note — the calorie budget above is capped to a safe
                              weekly rate, so surface the actual ETA when it differs from what was picked */}
                          {liveMacroPreview?.realisticWeeks &&
                            liveMacroPreview.realisticWeeks > liveMacroPreview.requestedWeeks && (
                              <div className="mt-4 flex items-start gap-2 px-1 relative z-10">
                                <span className="text-sm shrink-0">⏱️</span>
                                <p className="text-[9px] text-slate-400 leading-relaxed">
                                  <span className="text-amber-400 font-bold">
                                    {Math.abs(liveMacroPreview.weeklyRateKg)} kg/week
                                  </span>{" "}
                                  is the safe rate for this goal — reaching your target this way
                                  will realistically take{" "}
                                  <span className="text-white font-bold">
                                    ~{liveMacroPreview.realisticWeeks} weeks
                                  </span>
                                  , not {liveMacroPreview.requestedWeeks}. The calorie budget above
                                  reflects the safe rate, not the shorter timeframe.
                                </p>
                              </div>
                            )}
                        </div>
                      )}

                      <button
                        type="submit"
                        className="w-full py-4 bg-[#69A38D] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg hover:bg-[#5a8b78] transition-all"
                      >
                        Sync Fitness Plan
                      </button>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Medical Records */}
            <button
              onClick={() =>
                setExpandedSection(
                  expandedSection === "reports" ? null : "reports",
                )
              }
              className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors border-b border-slate-50 group"
            >
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                  <FileText size={18} className="text-slate-600" />
                </div>
                <span className="text-[15px] font-black text-[#1a1a1a] tracking-tight">
                  Medical Records
                </span>
              </div>
              <ChevronRight
                size={18}
                className={`text-slate-300 transition-transform ${expandedSection === "reports" ? "rotate-90" : ""}`}
              />
            </button>

            <AnimatePresence>
              {expandedSection === "reports" && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  className="bg-slate-50/30 px-6 border-b border-slate-100"
                >
                  <div className="py-4 max-h-[200px] overflow-y-auto no-scrollbar space-y-2">
                    {extraData.recentReports?.map((r) => (
                      <div
                        key={r._id}
                        onClick={() => navigate(`/reports/${r._id}`)}
                        className="p-3 bg-white rounded-xl border border-slate-100 flex items-center justify-between"
                      >
                        <span className="text-[11px] font-bold text-slate-700 truncate">
                          {r.reportType}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {new Date(r.date).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                    <button
                      onClick={() => navigate("/medical-vault")}
                      className="w-full py-2 text-[9px] font-black text-[#69A38D] uppercase tracking-widest text-center"
                    >
                      Open Vault →
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => navigate("/complete-analysis")}
              className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors border-b border-slate-50 group"
            >
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                  <TrendingUp size={18} className="text-slate-600" />
                </div>
                <span className="text-[15px] font-black text-[#1a1a1a] tracking-tight">
                  Progress Reports
                </span>
              </div>
              <ChevronRight size={18} className="text-slate-300" />
            </button>

            {/* Data & Consent */}
            <button
              onClick={() => navigate("/privacy-settings")}
              className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors border-b border-slate-50 group"
            >
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                  <ShieldCheck size={18} className="text-slate-600" />
                </div>
                <span className="text-[15px] font-black text-[#1a1a1a] tracking-tight">
                  Data & Consent
                </span>
              </div>
              <ChevronRight size={18} className="text-slate-300" />
            </button>

            {/* Terms & Conditions */}
            <button
              onClick={() => {
                setViewingPdf(
                  "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Terrms_and_Conditions_take.health_revised.pdf?v=1776407779",
                );
                setPdfLoading(true);
              }}
              className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors border-b border-slate-50 group"
            >
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                  <ScrollText size={18} className="text-slate-600" />
                </div>
                <span className="text-[15px] font-black text-[#1a1a1a] tracking-tight">
                  Terms & Conditions
                </span>
              </div>
              <ChevronRight size={18} className="text-slate-300" />
            </button>

            {/* Privacy Policy */}
            <button
              onClick={() => {
                setViewingPdf(
                  "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/take_health_privacy_policy.pdf?v=1776407816",
                );
                setPdfLoading(true);
              }}
              className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors border-b border-slate-50 group"
            >
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                  <Shield size={18} className="text-slate-600" />
                </div>
                <span className="text-[15px] font-black text-[#1a1a1a] tracking-tight">
                  Privacy Policy
                </span>
              </div>
              <ChevronRight size={18} className="text-slate-300" />
            </button>

            {/* Customer Support */}
            {/* <button 
                   onClick={() => toast('Customer Support coming soon', { icon: '🎧' })}
                   className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors border-b border-slate-50 group"
                 >
                    <div className="flex items-center gap-5">
                       <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                          <Headphones size={18} className="text-slate-600" />
                       </div>
                       <span className="text-[15px] font-black text-[#1a1a1a] tracking-tight">Customer Support</span>
                    </div>
                    <ChevronRight size={18} className="text-slate-300" />
                 </button> */}
          </div>

          {/* Logout Section - Fixed at the bottom of the card */}
          <div className="p-6 border-t border-white/40">
            <button
              onClick={logout}
              className="w-full py-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center gap-3 hover:bg-rose-50 hover:border-rose-100 transition-all group"
            >
              <LogOut size={16} className="text-rose-500" />
              <span className="text-[14px] font-black text-rose-500 tracking-tight">
                Logout Account
              </span>
            </button>
          </div>
        </div>

        {/* PDF Viewer Modal */}
        <AnimatePresence>
          {viewingPdf && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black flex flex-col h-[100dvh]"
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              <div className="p-4 flex items-center justify-between text-white border-b border-white/10 bg-[#1a2138]">
                <div className="flex flex-col">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                    Compliance
                  </h3>
                  <h3 className="text-xs font-black uppercase tracking-tight text-white/90">
                    {viewingPdf?.includes("privacy")
                      ? "Privacy Policy"
                      : "Terms & Conditions"}
                  </h3>
                </div>
                <button
                  onClick={() => setViewingPdf(null)}
                  className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center hover:bg-rose-500/20 hover:text-rose-500 transition-all border border-white/5 active:scale-90"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 w-full bg-slate-100 relative overflow-hidden">
                {pdfLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
                    <div className="w-12 h-12 border-4 border-slate-100 border-t-[#69A38D] rounded-full animate-spin mb-4" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Optimizing View...
                    </p>
                  </div>
                )}

                <iframe
                  src={`${viewingPdf}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                  className="w-full h-full border-none bg-white"
                  style={{ WebkitOverflowScrolling: "touch" }}
                  title="Legal Document"
                  onLoad={() => setPdfLoading(false)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
