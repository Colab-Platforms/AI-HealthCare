import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { healthService } from "../services/api";
import api from "../services/api";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, ResponsiveContainer } from 'recharts';
import { useData } from "../context/DataContext";
import {
  FileText, ArrowLeft, Calendar, Zap, Activity, Filter, Search,
  Clock, Sparkles, Plus, X, FileImage, ShieldCheck, Download,
  Stethoscope, Pill, Syringe, FileSpreadsheet, Heart, Grid, List,
  ChevronDown, ChevronUp, LockKeyhole, FolderLock, Trash,
  CheckCircle2, RefreshCw, Lock, Eye, Trash2, ChevronLeft, ChevronRight
} from "lucide-react";
import toast from "react-hot-toast";
import SEO from "../hooks/useSEO";
import HealthShareCard from "../components/HealthShareCard";

const AI_REPORT_TYPES = [
  { value: "auto", label: "Auto Detect", icon: "✨" },
  { value: "Blood Test", label: "Blood Test", icon: "🩸" },
  { value: "X-Ray", label: "X-Ray", icon: "🦴" },
  { value: "MRI", label: "MRI", icon: "🧠" },
  { value: "CT Scan", label: "CT Scan", icon: "💿" },
  { value: "ECG", label: "ECG", icon: "❤️" },
  { value: "Ultrasound", label: "Ultrasound", icon: "🌊" },
  { value: "General Checkup", label: "General Checkup", icon: "📋" },
  { value: "Prescription", label: "Prescription", icon: "💊" },
  { value: "Doctor Notes", label: "Doctor Notes", icon: "🩺" },
  { value: "Vaccination", label: "Vaccination", icon: "💉" },
  { value: "Other", label: "Other", icon: "📁" },
];

const CATEGORY_MAP = {
  ai_report: {
    label: "AI Report",
    icon: Sparkles,
    color: "text-[#69A38D]",
    bg: "bg-[#E2EED2]",
    border: "border-[#69A38D]/20",
  },
  prescription: {
    label: "Prescriptions",
    icon: Pill,
    color: "text-[#5B8C6F]",
    bg: "bg-[#5B8C6F]/10",
    border: "border-[#5B8C6F]/20",
  },
  lab_report: {
    label: "Lab Reports",
    icon: Activity,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
  },
  scan: {
    label: "Scans & X-Rays",
    icon: FileImage,
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-100",
  },
  discharge_summary: {
    label: "Doctor Notes",
    icon: Stethoscope,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
  },
  doctor_notes: {
    label: "Doctor Notes",
    icon: Stethoscope,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
  },
  vaccination: {
    label: "Vaccinations",
    icon: Syringe,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
  },
  insurance: {
    label: "Insurance & ID",
    icon: ShieldCheck,
    color: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-100",
  },
  other: {
    label: "Other Documents",
    icon: FileSpreadsheet,
    color: "text-slate-600",
    bg: "bg-slate-50",
    border: "border-slate-100",
  },
};

const formatBytes = (bytes, decimals = 1) => {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i];
};

export default function AllReports() {
  const navigate = useNavigate();
  const { addPendingAnalysis, invalidateCache, dataRefreshTrigger } = useData();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);
  const [globalStats, setGlobalStats] = useState({ total: 0, aiCount: 0, vaultCount: 0, recent: 0, categoryCounts: {} });
  const [healthScoreTrend, setHealthScoreTrend] = useState([]);
  const PAGE_SIZE = 10;
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(true);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Upload dialog
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState("analyze"); // "analyze" | "vault"
  const [dragActive, setDragActive] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState, setUploadState] = useState("idle");
  // AI analyze mode state
  const [selectedReportType, setSelectedReportType] = useState("auto");
  // Vault mode state
  const [uploadFormData, setUploadFormData] = useState({
    title: "",
    category: "prescription",
    documentDate: new Date().toISOString().split("T")[0],
    hospital: "",
    doctorName: "",
    notes: "",
    tags: "",
    isFavorite: false,
  });

  // Details drawer
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: "",
    category: "prescription",
    documentDate: "",
    hospital: "",
    doctorName: "",
    notes: "",
    tags: "",
    isFavorite: false,
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Filters
  const [filterTypes, setFilterTypes] = useState([]);
  const [filterDateRange, setFilterDateRange] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [filterHospital, setFilterHospital] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterFileTypes, setFilterFileTypes] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [showOnlyRecentlyViewed, setShowOnlyRecentlyViewed] = useState(false);

  const [favoriteReportIds, setFavoriteReportIds] = useState(() =>
    JSON.parse(localStorage.getItem("favorite_reports_ids") || "[]")
  );
  const [recentlyViewedIds, setRecentlyViewedIds] = useState(() =>
    JSON.parse(localStorage.getItem("recently_viewed_docs") || "[]")
  );

  const fetchTrend = () => {
    healthService.getTrends({}).then(({ data }) => {
      if (data?.healthScoreTrend?.length > 1) {
        setHealthScoreTrend(data.healthScoreTrend.map(d => ({
          date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          score: d.score,
          reportId: d.reportId,
          reportType: d.reportType
        })));
      } else {
        setHealthScoreTrend([]);
      }
    }).catch(() => {});
  };

  // fetchDocuments is a plain async fn — avoids stale-closure issues with useCallback
  const fetchDocuments = async (page = 1, opts = {}) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', PAGE_SIZE);

      const activeSearch = opts.search !== undefined ? opts.search : search;
      const activeTypes = opts.filterTypes !== undefined ? opts.filterTypes : filterTypes;
      const activeHospital = opts.filterHospital !== undefined ? opts.filterHospital : filterHospital;
      const activeDoctor = opts.filterDoctor !== undefined ? opts.filterDoctor : filterDoctor;
      const activeTags = opts.selectedTags !== undefined ? opts.selectedTags : selectedTags;
      const activeDateRange = opts.filterDateRange !== undefined ? opts.filterDateRange : filterDateRange;
      const activeStartDate = opts.customStartDate !== undefined ? opts.customStartDate : customStartDate;
      const activeEndDate = opts.customEndDate !== undefined ? opts.customEndDate : customEndDate;

      if (activeSearch.trim()) params.set('search', activeSearch.trim());
      if (activeTypes.length > 0) params.set('category', activeTypes.join(','));
      if (activeHospital.trim()) params.set('hospital', activeHospital.trim());
      if (activeDoctor.trim()) params.set('doctor', activeDoctor.trim());
      if (activeTags.length) params.set('tags', activeTags.join(','));
      if (activeDateRange === 'custom') {
        if (activeStartDate) params.set('dateFrom', activeStartDate);
        if (activeEndDate) params.set('dateTo', activeEndDate);
      } else if (activeDateRange !== 'all') {
        const from = new Date();
        if (activeDateRange === '30days') from.setDate(from.getDate() - 30);
        else if (activeDateRange === '6months') from.setMonth(from.getMonth() - 6);
        else if (activeDateRange === 'year') from.setFullYear(from.getFullYear() - 1);
        params.set('dateFrom', from.toISOString().split('T')[0]);
      }

      const { data } = await api.get(`/documents?${params.toString()}`);
      setDocuments(Array.isArray(data?.documents) ? data.documents : []);
      setTotalDocs(data?.total || 0);
      setTotalPages(data?.pages || 1);
      setCurrentPage(data?.page || page);
      if (data?.stats) setGlobalStats(data.stats);
    } catch (error) {
      toast.error("Failed to load reports");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial load only
  useEffect(() => {
    window.scrollTo(0, 0);
    fetchDocuments(1);
    fetchTrend();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch trend whenever DataContext signals a completed analysis
  const isFirstTrigger = useRef(true);
  useEffect(() => {
    if (isFirstTrigger.current) { isFirstTrigger.current = false; return; }
    fetchDocuments(1);
    fetchTrend();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataRefreshTrigger]);

  // Load preview when document details are opened
  useEffect(() => {
    if (!isDetailsOpen || !selectedDoc) {
      setPreviewBlobUrl(null);
      return;
    }

    const loadPreview = async () => {
      if (!selectedDoc.fileUrl) return;
      
      setPreviewLoading(true);
      try {
        const response = await api.get(`/documents/${selectedDoc._id}/file`, {
          responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        setPreviewBlobUrl(url);
      } catch (error) {
        console.error('Failed to load preview:', error);
        setPreviewBlobUrl(null);
      } finally {
        setPreviewLoading(false);
      }
    };

    loadPreview();

    return () => {
      if (previewBlobUrl) {
        window.URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [selectedDoc, isDetailsOpen]);

  // Re-fetch when filters change (pass current values explicitly to avoid stale closures)
  const isFirstFilterRender = useRef(true);
  useEffect(() => {
    if (isFirstFilterRender.current) { isFirstFilterRender.current = false; return; }
    fetchDocuments(1, { filterTypes, filterHospital, filterDoctor, selectedTags, filterDateRange, customStartDate, customEndDate });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTypes, filterHospital, filterDoctor, selectedTags, filterDateRange, customStartDate, customEndDate]);

  // Debounce search — skip initial mount
  const isFirstSearchRender = useRef(true);
  useEffect(() => {
    if (isFirstSearchRender.current) { isFirstSearchRender.current = false; return; }
    const timer = setTimeout(() => fetchDocuments(1, { search }), 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleDownload = async (doc, e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    const typeParam = doc.isAnalyzedReport ? '?type=report' : '';
    const filename = doc.originalName || doc.title || "document";
    const toastId = toast.loading("Generating download link...");

    const downloadBlob = async (url) => {
      const response = await api.get(url, { responseType: "blob" });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    };

    try {
      const { data } = await api.get(`/documents/${doc._id}/download-url${typeParam}`);
      toast.dismiss(toastId);

      // If backend returns a server-relative path (encrypted vault doc), stream via api with auth
      if (data.downloadUrl?.startsWith("/")) {
        await downloadBlob(data.downloadUrl.replace(/^\/api/, ""));
      } else {
        const link = document.createElement("a");
        link.href = data.downloadUrl;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      toast.success("Download started");
    } catch (error) {
      toast.dismiss(toastId);
      // Fallback: stream directly through proxy
      try {
        await downloadBlob(`/documents/${doc._id}/file${typeParam}`);
        toast.success("Download started");
      } catch {
        toast.error("Failed to download file");
      }
    }
  };

  const handleDelete = async (doc, e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try {
      if (doc.isAnalyzedReport) {
        await api.delete(`/health/reports/${doc._id}`);
      } else {
        await api.delete(`/documents/${doc._id}`);
      }
      toast.success("Record deleted");
      if (isDetailsOpen && selectedDoc?._id === doc._id) setIsDetailsOpen(false);
      fetchDocuments(currentPage);
      fetchTrend();
    } catch {
      toast.error("Failed to delete record");
    }
  };

  const handleToggleFavorite = async (doc, e) => {
    e.stopPropagation();
    if (doc.isAnalyzedReport) {
      const isFav = favoriteReportIds.includes(doc._id);
      setFavoriteReportIds((prev) =>
        isFav ? prev.filter((id) => id !== doc._id) : [...prev, doc._id]
      );
      toast.success(isFav ? "Removed from favorites" : "Added to favorites");
    } else {
      try {
        const nextFav = !doc.isFavorite;
        setDocuments((prev) =>
          prev.map((d) => (d._id === doc._id ? { ...d, isFavorite: nextFav } : d))
        );
        await api.put(`/documents/${doc._id}`, { isFavorite: nextFav });
        toast.success(nextFav ? "Added to favorites" : "Removed from favorites");
      } catch {
        toast.error("Failed to update favorite");
        fetchDocuments(currentPage);
      }
    }
  };

  const handleOpenDetails = (doc) => {
    setSelectedDoc(doc);
    setEditFormData({
      title: doc.title || "",
      category: doc.category === "ai_report" ? "other" : (doc.category || "other"),
      documentDate: doc.documentDate
        ? new Date(doc.documentDate).toISOString().split("T")[0]
        : "",
      hospital: doc.hospital || "",
      doctorName: doc.doctorName || "",
      notes: doc.notes || "",
      tags: Array.isArray(doc.tags) ? doc.tags.join(", ") : "",
      isFavorite: doc.isAnalyzedReport
        ? favoriteReportIds.includes(doc._id)
        : doc.isFavorite || false,
    });
    const updated = [doc._id, ...recentlyViewedIds.filter((id) => id !== doc._id)].slice(0, 12);
    setRecentlyViewedIds(updated);
    setIsDetailsOpen(true);
  };

  const handleSaveMetadata = async () => {
    if (!selectedDoc) return;
    if (selectedDoc.isAnalyzedReport) {
      const isFav = editFormData.isFavorite;
      const isCurrentlyFav = favoriteReportIds.includes(selectedDoc._id);
      if (isFav !== isCurrentlyFav) {
        setFavoriteReportIds((prev) =>
          isFav ? [...prev, selectedDoc._id] : prev.filter((id) => id !== selectedDoc._id)
        );
      }
      toast.success("Settings updated");
      setIsDetailsOpen(false);
      return;
    }
    setIsSavingEdit(true);
    try {
      const tagArr = editFormData.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const { data } = await api.put(`/documents/${selectedDoc._id}`, {
        title: editFormData.title,
        category: editFormData.category,
        documentDate: editFormData.documentDate,
        hospital: editFormData.hospital,
        doctorName: editFormData.doctorName,
        notes: editFormData.notes,
        isFavorite: editFormData.isFavorite,
        tags: tagArr,
      });
      setDocuments((prev) =>
        prev.map((d) => (d._id === selectedDoc._id ? { ...d, ...data.document } : d))
      );
      toast.success("Record updated");
      setIsDetailsOpen(false);
    } catch {
      toast.error("Failed to update record");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Upload handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]);
  };

  const validateAndSetFile = (file) => {
    if (!["application/pdf", "image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
      toast.error("Please upload a PDF or Image (JPEG/PNG)");
      return;
    }
    const maxSize = uploadMode === "analyze" ? 4 * 1024 * 1024 : 10 * 1024 * 1024;
    const maxLabel = uploadMode === "analyze" ? "4MB" : "10MB";
    if (file.size > maxSize) {
      toast.error(`File size exceeds ${maxLabel} limit`);
      return;
    }
    setUploadFile(file);
    const titleWithoutExt = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
    setUploadFormData((prev) => ({ ...prev, title: titleWithoutExt }));
  };

  const handleAnalyzeSubmit = async () => {
    if (!uploadFile) return toast.error("Please select a file");
    setUploadState("uploading");
    setUploadProgress(10);
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 85) { clearInterval(progressInterval); return 85; }
        return prev + 8;
      });
    }, 300);
    try {
      const formData = new FormData();
      formData.append("report", uploadFile);
      formData.append("reportType", selectedReportType === "auto" ? "general" : selectedReportType);
      const { data } = await healthService.uploadReport(formData);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadState("success");
      if (data.backgroundProcessing) {
        addPendingAnalysis(data.report._id);
        toast.success("Report uploaded! AI analysis starting...");
      } else {
        toast.success("Report analyzed successfully!");
      }
      invalidateCache(["diet_plan", "dashboard", "reports"]);
      setTimeout(() => {
        setIsUploadOpen(false);
        resetUploadForm();
        fetchDocuments(1);
        fetchTrend();
        navigate(`/reports/${data.report._id}`);
      }, 800);
    } catch (error) {
      clearInterval(progressInterval);
      setUploadState("error");
      setUploadProgress(0);
      toast.error(error?.response?.data?.message || "Failed to analyze report");
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) return toast.error("Please select a file");
    if (!uploadFormData.title) return toast.error("Document title is required");

    setUploadState("uploading");
    setUploadProgress(10);
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 85) { clearInterval(progressInterval); return 85; }
        return prev + 15;
      });
    }, 150);

    try {
      const data = new FormData();
      data.append("document", uploadFile);
      data.append("title", uploadFormData.title);
      data.append("category", uploadFormData.category);
      data.append("documentDate", uploadFormData.documentDate);
      data.append("notes", uploadFormData.notes);
      data.append("hospital", uploadFormData.hospital);
      data.append("doctorName", uploadFormData.doctorName);
      data.append("isFavorite", uploadFormData.isFavorite);
      const tagArr = uploadFormData.tags.split(",").map((t) => t.trim()).filter(Boolean);
      data.append("tags", JSON.stringify(tagArr));

      await api.post("/documents", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadState("success");
      toast.success("Document uploaded securely");

      setTimeout(() => {
        setIsUploadOpen(false);
        resetUploadForm();
        fetchDocuments(currentPage);
      }, 1200);
    } catch (error) {
      clearInterval(progressInterval);
      setUploadState("error");
      toast.error(error?.response?.data?.message || "Upload failed");
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadProgress(0);
    setUploadState("idle");
    setSelectedReportType("Blood Test");
    setUploadFormData({
      title: "",
      category: "prescription",
      documentDate: new Date().toISOString().split("T")[0],
      hospital: "",
      doctorName: "",
      notes: "",
      tags: "",
      isFavorite: false,
    });
  };

  // Filter helpers
  const toggleCategoryFilter = (cat) =>
    setFilterTypes((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );

  const toggleFileTypeFilter = (type) =>
    setFilterFileTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );

  const toggleTagFilter = (tag) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  const clearAllFilters = () => {
    setFilterTypes([]);
    setFilterDateRange("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setFilterHospital("");
    setFilterDoctor("");
    setFilterFileTypes([]);
    setSelectedTags([]);
    setShowOnlyFavorites(false);
    setShowOnlyRecentlyViewed(false);
    setCurrentPage(1);
    toast.success("Filters cleared");
  };

  const filterHelperLists = useMemo(() => {
    const tagsSet = new Set();
    const hospitalsSet = new Set();
    const doctorsSet = new Set();
    documents.forEach((doc) => {
      if (Array.isArray(doc.tags)) doc.tags.forEach((t) => tagsSet.add(t));
      if (doc.hospital) hospitalsSet.add(doc.hospital);
      if (doc.doctorName) doctorsSet.add(doc.doctorName);
    });
    return {
      allTags: Array.from(tagsSet).filter(Boolean),
      allHospitals: Array.from(hospitalsSet).filter(Boolean),
      allDoctors: Array.from(doctorsSet).filter(Boolean),
    };
  }, [documents]);

  // Stats come from server globalStats for accuracy across all pages
  const stats = globalStats;

  // Client-side filters only for localStorage-based preferences (favorites, recently viewed, file type)
  // Search, category, hospital, doctor, tags, dateRange are handled server-side
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (filterFileTypes.length > 0 && !doc.isAnalyzedReport) {
        const isPdf = doc.mimetype?.includes("pdf") || doc.fileUrl?.toLowerCase().includes(".pdf") || doc.originalName?.toLowerCase().includes(".pdf");
        const isImage = doc.mimetype?.includes("image") || (!isPdf && doc.fileUrl);
        if (filterFileTypes.includes("pdf") && !isPdf) return false;
        if (filterFileTypes.includes("image") && !isImage) return false;
      }
      if (showOnlyFavorites) {
        const isFav = doc.isAnalyzedReport ? favoriteReportIds.includes(doc._id) : doc.isFavorite;
        if (!isFav) return false;
      }
      if (showOnlyRecentlyViewed && !recentlyViewedIds.includes(doc._id)) return false;
      return true;
    });
  }, [documents, filterFileTypes, showOnlyFavorites, showOnlyRecentlyViewed, favoriteReportIds, recentlyViewedIds]);

  const activeFilterCount =
    filterTypes.length +
    selectedTags.length +
    filterFileTypes.length +
    (filterHospital ? 1 : 0) +
    (filterDoctor ? 1 : 0) +
    (filterDateRange !== "all" ? 1 : 0) +
    (showOnlyFavorites ? 1 : 0) +
    (showOnlyRecentlyViewed ? 1 : 0);

  const statsData = [
    { label: "Total Records", value: stats.total, icon: FileText, color: "text-[#69A38D]", bg: "bg-[#E2EED2]" },
    { label: "AI Analyzed", value: stats.aiCount, icon: Sparkles, color: "text-amber-500", bg: "bg-amber-50" },
    { label: "Vault Docs", value: stats.vaultCount, icon: FolderLock, color: "text-indigo-500", bg: "bg-indigo-50" },
    { label: "Added This Week", value: stats.recent, icon: Clock, color: "text-rose-500", bg: "bg-rose-50" },
  ];

  return (
    <div className="w-full min-h-screen pb-32 relative overflow-x-hidden" style={{ background: "linear-gradient(160deg, #eef6f0 0%, #f4f9f5 50%, #e8f3ec 100%)" }}>
      <SEO pageName="reports" />
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-300/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-200/10 rounded-full blur-[100px] translate-x-1/2 pointer-events-none" />

      <div className="px-4 md:px-6 lg:px-10 pt-6 relative z-10 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] md:text-[36px] font-black text-[#1a2138] tracking-tight leading-none uppercase">
              Medical Records
            </h1>
            <p className="text-[13px] text-[#64748b] font-bold mt-1">
              Your complete health documentation
            </p>
          </div>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="px-5 py-3 bg-[#5B8C6F] text-white rounded-[20px] font-black hover:bg-[#4a7b5e] transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest shadow-lg shadow-[#5B8C6F]/25 active:scale-95 shrink-0"
          >
            <Plus size={18} strokeWidth={3} />
            <span className="hidden sm:inline">Upload Doc</span>
            <span className="sm:hidden">Upload</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statsData.map((stat, i) => (
            <div key={i} className="liquid-glass-inner rounded-[24px] p-4 flex items-center gap-3 group transition-all">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${stat.bg} group-hover:scale-110 transition-transform`}>
                <stat.icon size={18} className={stat.color} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xl font-black text-[#1a1a1a] tracking-tight leading-none">{stat.value}</span>
                <span className="text-[9px] font-bold text-[#a0a0a0] uppercase tracking-widest leading-tight mt-0.5">{stat.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Health Score Trend Section */}
        {healthScoreTrend.length > 1 && (() => {
          const latest = healthScoreTrend[healthScoreTrend.length - 1];
          const first = healthScoreTrend[0];
          const prev = healthScoreTrend[healthScoreTrend.length - 2];
          const overallChange = latest.score - first.score;
          const recentChange = latest.score - prev.score;
          const overallPct = first.score > 0 ? Math.abs(((overallChange / first.score) * 100).toFixed(1)) : 0;
          const improved = healthScoreTrend.filter((d, i) => i > 0 && d.score > healthScoreTrend[i-1].score);
          const declined = healthScoreTrend.filter((d, i) => i > 0 && d.score < healthScoreTrend[i-1].score);
          const stable   = healthScoreTrend.filter((d, i) => i > 0 && d.score === healthScoreTrend[i-1].score);
          const bestScore = Math.max(...healthScoreTrend.map(d => d.score));
          const lowestScore = Math.min(...healthScoreTrend.map(d => d.score));

          return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Left — bar chart */}
              <div className="lg:col-span-2 liquid-glass-inner rounded-[24px] p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-[13px] font-black text-[#1a2138] uppercase tracking-widest">Health Score Trend</h2>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">Tap any bar to open that report</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-2xl font-black text-[#1a2138] leading-none">{latest.score}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Latest</span>
                    </div>
                    <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${recentChange >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {recentChange >= 0 ? '↑' : '↓'} {Math.abs(recentChange)} pts
                    </div>
                  </div>
                </div>

                <div className="flex items-end gap-1.5 sm:gap-2 w-full" style={{ height: 150 }}>
                  {healthScoreTrend.map((d, i) => {
                    const barH = Math.max(14, (d.score / 100) * 110);
                    const prevD = healthScoreTrend[i - 1];
                    const chg = prevD ? d.score - prevD.score : 0;
                    const isLast = i === healthScoreTrend.length - 1;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group cursor-pointer select-none"
                        onClick={() => d.reportId && navigate(`/reports/${d.reportId}`)}
                        title={`${d.reportType} · ${d.score}/100 · ${d.date}`}
                      >
                        <span className={`text-[9px] font-black leading-none ${isLast ? 'text-[#5B8C6F]' : 'text-slate-400 group-hover:text-[#5B8C6F]'}`}>{d.score}</span>
                        {i > 0 && chg !== 0 && (
                          <span className={`text-[8px] font-black leading-none ${chg > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                            {chg > 0 ? `+${chg}` : chg}
                          </span>
                        )}
                        <div className="w-full flex items-end" style={{ height: 110, marginTop: (i === 0 || chg === 0) ? 14 : 0 }}>
                          <div className={`w-full rounded-t-xl transition-all duration-300 group-hover:opacity-75 ${
                            isLast ? 'bg-[#5B8C6F] shadow-md shadow-[#5B8C6F]/20'
                            : chg > 0 ? 'bg-emerald-300'
                            : chg < 0 ? 'bg-red-300'
                            : 'bg-slate-200'
                          }`} style={{ height: barH }} />
                        </div>
                        <span className={`text-[8px] font-bold truncate w-full text-center mt-1 ${isLast ? 'text-[#5B8C6F]' : 'text-slate-400'}`}>{d.date}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100/80">
                  {[['bg-emerald-300','Improved'],['bg-red-300','Declined'],['bg-slate-200','No Change'],['bg-[#5B8C6F]','Latest']].map(([bg, lbl]) => (
                    <div key={lbl} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-sm ${bg}`} />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider hidden sm:block">{lbl}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — insight cards */}
              <div className="flex flex-col gap-3">

                {/* Overall progress */}
                <div className={`liquid-glass-inner rounded-[24px] p-5 ${overallChange >= 0 ? 'ring-1 ring-emerald-200/60' : 'ring-1 ring-red-200/60'}`}>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Overall Progress</p>
                  <div className="flex items-end gap-2 mb-2">
                    <span className={`text-4xl font-black leading-none ${overallChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {overallChange >= 0 ? '+' : ''}{overallChange}
                    </span>
                    <span className="text-[11px] font-black text-slate-400 mb-1">pts</span>
                  </div>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black ${overallChange >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                    {overallChange >= 0 ? '↑' : '↓'} {overallPct}% since first report
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold mt-3">
                    {first.score} → {latest.score} across {healthScoreTrend.length} reports
                  </p>
                </div>

                {/* Breakdown */}
                <div className="liquid-glass-inner rounded-[24px] p-5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Report Breakdown</p>
                  <div className="space-y-2.5">
                    {[
                      { color: 'bg-emerald-400', label: 'Improved', count: improved.length, textColor: 'text-emerald-600' },
                      { color: 'bg-red-400',     label: 'Declined', count: declined.length, textColor: 'text-red-500' },
                      { color: 'bg-slate-300',   label: 'No Change',count: stable.length,   textColor: 'text-slate-500' },
                    ].filter(r => r.count > 0).map(({ color, label, count, textColor }) => (
                      <div key={label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                          <span className="text-[11px] font-bold text-slate-600">{label}</span>
                        </div>
                        <span className={`text-[13px] font-black ${textColor}`}>{count} report{count > 1 ? 's' : ''}</span>
                      </div>
                    ))}
                    {/* Progress bar */}
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex mt-1">
                      {improved.length > 0 && <div className="bg-emerald-400 h-full transition-all" style={{ width: `${(improved.length / (healthScoreTrend.length - 1)) * 100}%` }} />}
                      {declined.length > 0 && <div className="bg-red-400 h-full transition-all"     style={{ width: `${(declined.length / (healthScoreTrend.length - 1)) * 100}%` }} />}
                      {stable.length > 0   && <div className="bg-slate-300 h-full transition-all"   style={{ width: `${(stable.length   / (healthScoreTrend.length - 1)) * 100}%` }} />}
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Best Score</p>
                      <p className="text-[20px] font-black text-emerald-600 leading-none">{bestScore}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Lowest Score</p>
                      <p className="text-[20px] font-black text-red-500 leading-none">{lowestScore}</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {/* Search + View + Filter bar */}
        <div className="w-full liquid-glass p-3 rounded-[24px] flex items-center gap-3 flex-wrap md:flex-nowrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, hospital, doctor, tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/50 border border-white/80 rounded-[16px] pl-11 pr-10 py-3 text-sm focus:outline-none focus:border-[#5B8C6F]/40 placeholder:text-[#a0a0a0] font-medium text-[#1a1a1a]"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full text-slate-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-white/60 border border-white rounded-[20px] p-1 shadow-sm shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-[14px] transition-all flex items-center gap-1.5 ${viewMode === "grid" ? "bg-[#1a2138] text-white" : "text-slate-400 hover:text-slate-800"}`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-wider px-1 hidden sm:block">Grid</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-[14px] transition-all flex items-center gap-1.5 ${viewMode === "list" ? "bg-[#1a2138] text-white" : "text-slate-400 hover:text-slate-800"}`}
              title="List View"
            >
              <List className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-wider px-1 hidden sm:block">List</span>
            </button>
          </div>

          {/* Desktop filter toggle */}
          <button
            onClick={() => setIsFilterSidebarOpen(!isFilterSidebarOpen)}
            className={`hidden md:flex items-center gap-2 px-4 py-2.5 rounded-[20px] border text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
              isFilterSidebarOpen
                ? "bg-[#69A38D]/10 border-[#69A38D]/30 text-[#69A38D]"
                : "bg-white/60 border-white text-slate-500 hover:border-[#69A38D]/20"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#69A38D] text-white text-[9px] flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Mobile filter toggle */}
          <button
            onClick={() => setIsMobileFilterOpen(true)}
            className="md:hidden flex items-center gap-1.5 px-4 py-2.5 bg-white/60 border border-white rounded-[20px] text-xs font-black uppercase tracking-wider text-slate-500 shrink-0"
          >
            <Filter className="w-3 h-3" />
            {activeFilterCount > 0 ? `(${activeFilterCount})` : "Filters"}
          </button>
        </div>

        {/* Split: Sidebar + Main */}
        <div className="flex items-start gap-6">

          {/* Desktop Filter Sidebar */}
          <AnimatePresence>
            {isFilterSidebarOpen && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 268, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="hidden md:block shrink-0 sticky top-6 self-start max-h-[85vh] liquid-glass rounded-[24px] p-5 space-y-5"
                style={{ overflowY: 'auto', overflowX: 'hidden' }}
              >
                <div className="flex items-center justify-between border-b border-white/70 pb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-[#1a2138] flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-[#69A38D]" /> Filters
                  </span>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearAllFilters}
                      className="text-[9px] font-black uppercase tracking-widest text-[#69A38D] hover:text-[#528270]"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Favorites / Recently Viewed */}
                <div className="space-y-2">
                  <button
                    onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                      showOnlyFavorites
                        ? "bg-rose-50 border-rose-200 text-rose-600"
                        : "bg-white/60 border-white text-slate-500 hover:border-[#69A38D]/20"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Heart className="w-4 h-4 fill-current" /> Favorites Only
                    </span>
                    {showOnlyFavorites && <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />}
                  </button>
                  <button
                    onClick={() => setShowOnlyRecentlyViewed(!showOnlyRecentlyViewed)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                      showOnlyRecentlyViewed
                        ? "bg-[#69A38D]/10 border-[#69A38D]/20 text-[#69A38D]"
                        : "bg-white/60 border-white text-slate-500 hover:border-[#69A38D]/20"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Eye className="w-4 h-4" /> Recently Viewed
                    </span>
                    {showOnlyRecentlyViewed && <span className="w-2 h-2 rounded-full bg-[#69A38D] animate-pulse" />}
                  </button>
                </div>

                {/* Document Type */}
                <FilterSection title="Document Type">
                  <div className="space-y-2 pt-1">
                    {Object.keys(CATEGORY_MAP).filter(k => k !== 'discharge_summary').map((key) => {
                      const active = filterTypes.includes(key);
                      const cat = CATEGORY_MAP[key];
                      const count = globalStats.categoryCounts?.[key] || 0;
                      return (
                        <label
                          key={key}
                          className="flex items-center gap-3 cursor-pointer text-xs font-bold text-slate-500 hover:text-[#1a2138] transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleCategoryFilter(key)}
                            className="rounded border-slate-300 text-[#69A38D] focus:ring-[#69A38D]"
                          />
                          <div className="flex items-center justify-between gap-2 flex-1">
                            <div className="flex items-center gap-2">
                              <cat.icon className={`w-3.5 h-3.5 ${cat.color}`} />
                              <span>{cat.label}</span>
                            </div>
                            {count > 0 && (
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${active ? 'bg-[#69A38D] text-white' : 'bg-slate-100 text-slate-400'}`}>
                                {count}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </FilterSection>

                {/* Date Range */}
                <FilterSection title="Date Range">
                  <div className="space-y-1.5 pt-1">
                    {[
                      { value: "all", label: "All Time" },
                      { value: "30days", label: "Last 30 Days" },
                      { value: "6months", label: "Last 6 Months" },
                      { value: "year", label: "Past Year" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setFilterDateRange(opt.value)}
                        className={`w-full text-left text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl border transition-all ${
                          filterDateRange === opt.value
                            ? "bg-[#69A38D]/10 border-[#69A38D]/20 text-[#69A38D]"
                            : "bg-white/60 border-white text-slate-500 hover:border-[#69A38D]/10"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => { setCustomStartDate(e.target.value); setFilterDateRange("custom"); }}
                        className="bg-white/60 border border-white rounded-xl p-2 text-[9px] font-black text-slate-600 outline-none focus:border-[#69A38D]/30"
                      />
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => { setCustomEndDate(e.target.value); setFilterDateRange("custom"); }}
                        className="bg-white/60 border border-white rounded-xl p-2 text-[9px] font-black text-slate-600 outline-none focus:border-[#69A38D]/30"
                      />
                    </div>
                  </div>
                </FilterSection>

                {/* Hospital */}
                <FilterSection title="Hospital / Lab">
                  <div className="space-y-2 pt-1">
                    <div className="relative">
                      <Search className="w-3 h-3 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Hospital name..."
                        value={filterHospital}
                        onChange={(e) => setFilterHospital(e.target.value)}
                        className="w-full bg-white/60 border border-white rounded-xl pl-7 pr-3 py-2 text-xs focus:outline-none focus:border-[#69A38D]/30 font-medium"
                      />
                    </div>
                    {filterHelperLists.allHospitals.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {filterHelperLists.allHospitals.slice(0, 6).map((h) => (
                          <button
                            key={h}
                            onClick={() => setFilterHospital(filterHospital === h ? "" : h)}
                            className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border transition-all ${
                              filterHospital === h
                                ? "bg-[#69A38D] border-[#69A38D] text-white"
                                : "bg-white/60 border-white text-slate-500 hover:border-[#69A38D]/20"
                            }`}
                          >
                            {h}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </FilterSection>

                {/* Doctor */}
                <FilterSection title="Doctor Name">
                  <div className="space-y-2 pt-1">
                    <div className="relative">
                      <Search className="w-3 h-3 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Doctor name..."
                        value={filterDoctor}
                        onChange={(e) => setFilterDoctor(e.target.value)}
                        className="w-full bg-white/60 border border-white rounded-xl pl-7 pr-3 py-2 text-xs focus:outline-none focus:border-[#69A38D]/30 font-medium"
                      />
                    </div>
                    {filterHelperLists.allDoctors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {filterHelperLists.allDoctors.slice(0, 6).map((d) => (
                          <button
                            key={d}
                            onClick={() => setFilterDoctor(filterDoctor === d ? "" : d)}
                            className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border transition-all ${
                              filterDoctor === d
                                ? "bg-[#69A38D] border-[#69A38D] text-white"
                                : "bg-white/60 border-white text-slate-500 hover:border-[#69A38D]/20"
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </FilterSection>

                {/* File Format */}
                <FilterSection title="File Format">
                  <div className="space-y-2 pt-1">
                    {[
                      { value: "pdf", label: "PDF Documents" },
                      { value: "image", label: "Images / Scans" },
                    ].map((opt) => (
                      <label key={opt.value} className="flex items-center gap-3 cursor-pointer text-xs font-bold text-slate-500 hover:text-[#1a2138] transition-colors">
                        <input
                          type="checkbox"
                          checked={filterFileTypes.includes(opt.value)}
                          onChange={() => toggleFileTypeFilter(opt.value)}
                          className="rounded border-slate-300 text-[#69A38D] focus:ring-[#69A38D]"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </FilterSection>

                {/* Tags */}
                {filterHelperLists.allTags.length > 0 && (
                  <FilterSection title="Tags">
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {filterHelperLists.allTags.map((tag) => {
                        const active = selectedTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => toggleTagFilter(tag)}
                            className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-xl border transition-all ${
                              active
                                ? "bg-[#1a2138] border-[#1a2138] text-white shadow-sm"
                                : "bg-white/60 border-white text-slate-500 hover:border-[#69A38D]/20"
                            }`}
                          >
                            #{tag}
                          </button>
                        );
                      })}
                    </div>
                  </FilterSection>
                )}

                {/* Quick Stats + Security */}
                <div className="pt-4 border-t border-white/70 space-y-3">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Storage</span>
                  <div className="space-y-1.5 text-[10px]">
                    {[
                      { label: "Total Records", value: stats.total, color: "text-[#1a2138]" },
                      { label: "AI Reports", value: stats.aiCount, color: "text-[#69A38D]" },
                      { label: "Vault Docs", value: stats.vaultCount, color: "text-indigo-600" },
                    ].map((s, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-slate-400 font-bold">{s.label}</span>
                        <span className={`font-black ${s.color}`}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5 pt-2">
                    {["HIPAA Secure", "AES-256 Encrypted", "AI Verified"].map((badge, i) => {
                      const icons = [LockKeyhole, ShieldCheck, Sparkles];
                      const Icon = icons[i];
                      return (
                        <div key={badge} className="flex items-center gap-2 px-2.5 py-1.5 bg-white/60 rounded-xl border border-white text-[9px] font-black uppercase tracking-wider text-slate-400">
                          <Icon className="w-3 h-3 text-[#69A38D]" />
                          {badge}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Main content area */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="liquid-glass rounded-[32px] p-16 flex flex-col items-center justify-center text-center gap-8">
                <div className="w-24 h-24 rounded-[32px] bg-slate-50 flex items-center justify-center shadow-inner relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[#69A38D]/5 blur group-hover:scale-150 transition-transform duration-700" />
                  <FileText size={48} className="text-slate-200 relative z-10" />
                </div>
                <div className="flex flex-col gap-2 max-w-sm">
                  <h3 className="text-[24px] font-black text-[#1a2138] uppercase tracking-tight leading-none">
                    {activeFilterCount > 0 || search ? "No Matches Found" : "Registry Empty"}
                  </h3>
                  <p className="text-[14px] text-slate-400 font-bold">
                    {activeFilterCount > 0 || search
                      ? "Try adjusting your filters or search query."
                      : "Upload your first medical document to get started."}
                  </p>
                </div>
                {activeFilterCount > 0 ? (
                  <button
                    onClick={clearAllFilters}
                    className="px-8 py-4 bg-white border border-[#69A38D]/20 text-[#1a2138] rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-[#69A38D] hover:text-white transition-all shadow-sm active:scale-95"
                  >
                    Clear Filters
                  </button>
                ) : (
                  <button
                    onClick={() => setIsUploadOpen(true)}
                    className="px-10 py-5 bg-[#1a2138] text-white rounded-[28px] font-black hover:bg-black transition-all flex items-center gap-4 text-xs uppercase tracking-widest shadow-xl active:scale-95"
                  >
                    <Plus size={18} strokeWidth={3} /> Upload First Record
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
                  <span>
                    Page {currentPage} of {totalPages} &nbsp;·&nbsp; {totalDocs} Total Records
                  </span>
                  {(activeFilterCount > 0 || search) && (
                    <button
                      onClick={clearAllFilters}
                      className="text-[#69A38D] font-black hover:underline"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                {viewMode === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredDocuments.map((doc) => (
                      <UnifiedGridCard
                        key={doc._id}
                        doc={doc}
                        isFavorite={
                          doc.isAnalyzedReport
                            ? favoriteReportIds.includes(doc._id)
                            : doc.isFavorite || favoriteReportIds.includes(doc._id)
                        }
                        onFavorite={(e) => handleToggleFavorite(doc, e)}
                        onDelete={(e) => handleDelete(doc, e)}
                        onView={() => handleOpenDetails(doc)}
                        onDownload={(e) => handleDownload(doc, e)}
                        onTrackView={(id) => {
                          const updated = [id, ...recentlyViewedIds.filter(x => x !== id)].slice(0, 12);
                          setRecentlyViewedIds(updated);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="liquid-glass rounded-[24px] overflow-hidden divide-y divide-white/40">
                    {filteredDocuments.map((doc) => (
                      <UnifiedListRow
                        key={doc._id}
                        doc={doc}
                        isFavorite={
                          doc.isAnalyzedReport
                            ? favoriteReportIds.includes(doc._id)
                            : doc.isFavorite || favoriteReportIds.includes(doc._id)
                        }
                        onFavorite={(e) => handleToggleFavorite(doc, e)}
                        onDelete={(e) => handleDelete(doc, e)}
                        onView={() => handleOpenDetails(doc)}
                        onDownload={(e) => handleDownload(doc, e)}
                        onTrackView={(id) => {
                          const updated = [id, ...recentlyViewedIds.filter(x => x !== id)].slice(0, 12);
                          setRecentlyViewedIds(updated);
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <button
                      onClick={() => { fetchDocuments(currentPage - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      disabled={currentPage === 1}
                      className="w-10 h-10 rounded-full bg-white border border-white shadow-sm flex items-center justify-center text-[#1a2138] disabled:opacity-30 hover:bg-[#69A38D] hover:text-white hover:border-[#69A38D] transition-all active:scale-95"
                    >
                      <ChevronLeft size={16} strokeWidth={2.5} />
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .reduce((acc, p, idx, arr) => {
                        if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === '...' ? (
                          <span key={`ellipsis-${i}`} className="text-slate-300 font-black text-sm px-1">···</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => { fetchDocuments(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            className={`w-10 h-10 rounded-full text-[12px] font-black transition-all active:scale-95 ${
                              p === currentPage
                                ? 'bg-[#1a2138] text-white shadow-md'
                                : 'bg-white border border-white shadow-sm text-slate-500 hover:border-[#69A38D]/30 hover:text-[#69A38D]'
                            }`}
                          >
                            {p}
                          </button>
                        )
                      )}

                    <button
                      onClick={() => { fetchDocuments(currentPage + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      disabled={currentPage === totalPages}
                      className="w-10 h-10 rounded-full bg-white border border-white shadow-sm flex items-center justify-center text-[#1a2138] disabled:opacity-30 hover:bg-[#69A38D] hover:text-white hover:border-[#69A38D] transition-all active:scale-95"
                    >
                      <ChevronRight size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-8 pb-12 max-w-lg mx-auto">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
            Medical records are HIPAA compliant and AES-256 encrypted. AI analysis powered by clinical biomarker synthesis.
          </p>
        </div>
      </div>

      {/* ─── UPLOAD MODAL ─── */}
      <AnimatePresence>
        {isUploadOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => uploadState !== "uploading" && setIsUploadOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="bg-white rounded-[32px] p-6 md:p-8 w-full max-w-2xl relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide"
            >
              <button
                onClick={() => uploadState !== "uploading" && setIsUploadOpen(false)}
                className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 z-10"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Mode toggle */}
              <div className="mb-6">
                <h3 className="text-xl font-black text-black tracking-tight mb-4">Upload Record</h3>
                <div className="flex bg-slate-50 border border-slate-100 rounded-2xl p-1 gap-1">
                  <button
                    onClick={() => { setUploadMode("analyze"); setUploadFile(null); setUploadState("idle"); setUploadProgress(0); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      uploadMode === "analyze"
                        ? "bg-[#69A38D] text-white shadow-md shadow-[#69A38D]/20"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    AI Analyze
                  </button>
                  <button
                    onClick={() => { setUploadMode("vault"); setUploadFile(null); setUploadState("idle"); setUploadProgress(0); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      uploadMode === "vault"
                        ? "bg-[#1a2138] text-white shadow-md"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    Save to Vault
                  </button>
                </div>
                <p className="text-[10px] font-bold text-slate-400 mt-2 ml-1 uppercase tracking-wider">
                  {uploadMode === "analyze"
                    ? "AI will extract biomarkers, generate health score & personalized plan · Max 4MB"
                    : "Store document securely without analysis · Max 10MB"}
                </p>
              </div>

              <div className="flex flex-col md:flex-row gap-6">
                {/* Dropzone — same for both modes */}
                <div className="flex-1">
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-[24px] p-6 text-center transition-all flex flex-col items-center justify-center h-56 relative group overflow-hidden ${
                      dragActive
                        ? "border-[#69A38D] bg-[#69A38D]/5"
                        : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="file"
                      id="file-upload-input"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    {uploadState === "idle" && !uploadFile && (
                      <div className="space-y-3 pointer-events-none">
                        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto text-[#69A38D] group-hover:scale-110 transition-transform">
                          <FolderLock className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="font-black text-black text-xs block">Drag & Drop here</span>
                          <span className="text-[9px] font-bold text-slate-400 mt-1 block uppercase tracking-widest">or tap to select</span>
                        </div>
                        <p className="text-[8px] text-slate-400 uppercase tracking-widest font-black bg-white/80 border border-slate-100 px-3 py-1 rounded-full inline-block">
                          PDF, JPEG, PNG · Max {uploadMode === "analyze" ? "4MB" : "10MB"}
                        </p>
                      </div>
                    )}
                    {uploadState === "uploading" && (
                      <div className="space-y-4 w-full px-4 pointer-events-none">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-[#69A38D] animate-spin">
                          <RefreshCw className="w-6 h-6" />
                        </div>
                        <div className="space-y-2">
                          <span className="font-black text-black text-xs block">
                            {uploadMode === "analyze" ? "Uploading & analyzing..." : "Encrypting and uploading..."}
                          </span>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#69A38D] rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">{uploadProgress}%</span>
                        </div>
                      </div>
                    )}
                    {uploadState === "success" && (
                      <div className="space-y-3 pointer-events-none">
                        <div className="w-14 h-14 bg-[#E2EED2] text-[#69A38D] rounded-full flex items-center justify-center mx-auto shadow-sm">
                          <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <div>
                          <span className="font-black text-black text-xs block">
                            {uploadMode === "analyze" ? "Analysis started!" : "Stored Securely!"}
                          </span>
                          <span className="text-[9px] font-bold text-[#69A38D] uppercase tracking-widest">
                            {uploadMode === "analyze" ? "Redirecting..." : "AES-256 encrypted"}
                          </span>
                        </div>
                      </div>
                    )}
                    {uploadFile && uploadState === "idle" && (
                      <div className="absolute inset-0 bg-white/95 p-4 flex flex-col justify-between items-center text-center border border-slate-100 rounded-[22px]">
                        <div className="w-full flex justify-end">
                          <button
                            onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                            className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          <div className="w-10 h-10 bg-[#E2EED2] text-[#69A38D] rounded-xl flex items-center justify-center mx-auto">
                            {uploadFile.type.includes("pdf") ? <FileText className="w-5 h-5" /> : <FileImage className="w-5 h-5" />}
                          </div>
                          <div>
                            <span className="font-black text-xs text-black block truncate max-w-[180px]">{uploadFile.name}</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{formatBytes(uploadFile.size)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => document.getElementById("file-upload-input").click()}
                          className="text-[9px] font-black uppercase tracking-widest text-[#69A38D] hover:underline mb-2"
                        >
                          Change File
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right form — changes based on mode */}
                <div className="flex-1 flex flex-col gap-4">
                  {uploadMode === "analyze" ? (
                    /* ── AI ANALYZE FORM ── */
                    <>
                      {/* Auto Detect Banner */}
                      <div className="bg-[#E2EED2]/60 border border-[#69A38D]/20 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#69A38D] shrink-0" />
                          <div>
                            <p className="text-[10px] font-black text-[#69A38D] uppercase tracking-wider">
                              {selectedReportType === "auto" ? "Auto Detect — On" : `Manual: ${AI_REPORT_TYPES.find(r => r.value === selectedReportType)?.icon} ${AI_REPORT_TYPES.find(r => r.value === selectedReportType)?.label}`}
                            </p>
                            <p className="text-[9px] font-bold text-slate-500 mt-0.5">
                              {selectedReportType === "auto" ? "AI will read your document and categorize it automatically" : "AI will use your selected type as a hint"}
                            </p>
                          </div>
                        </div>
                        {selectedReportType !== "auto" && (
                          <button type="button" onClick={() => setSelectedReportType("auto")}
                            className="text-[9px] font-black text-slate-400 hover:text-red-400 uppercase tracking-widest whitespace-nowrap">
                            Reset
                          </button>
                        )}
                      </div>

                      {/* Manual Override — collapsible */}
                      <details className="group">
                        <summary className="text-[9px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-[#69A38D] transition-colors list-none flex items-center gap-1.5">
                          <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                          Override report type manually
                        </summary>
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          {AI_REPORT_TYPES.filter(rt => rt.value !== "auto").map((rt) => (
                            <button
                              key={rt.value}
                              type="button"
                              onClick={() => setSelectedReportType(rt.value)}
                              className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl border text-xs font-black transition-all ${
                                selectedReportType === rt.value
                                  ? "bg-[#69A38D]/10 border-[#69A38D]/30 text-[#69A38D]"
                                  : "bg-slate-50 border-slate-200 text-slate-500 hover:border-[#69A38D]/20"
                              }`}
                            >
                              <span>{rt.icon}</span>
                              <span className="truncate">{rt.label}</span>
                            </button>
                          ))}
                        </div>
                      </details>

                      <div className="bg-[#E2EED2]/50 border border-[#69A38D]/20 rounded-2xl p-4 space-y-1.5">
                        <p className="text-[10px] font-black text-[#69A38D] uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" /> What AI will do
                        </p>
                        {["Extract biomarkers & lab values", "Calculate health score", "Detect deficiencies", "Generate personalized diet plan"].map((item) => (
                          <p key={item} className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#69A38D] shrink-0" />
                            {item}
                          </p>
                        ))}
                      </div>

                      <button
                        onClick={handleAnalyzeSubmit}
                        disabled={uploadState === "uploading" || !uploadFile}
                        className="w-full py-4 bg-[#69A38D] hover:bg-[#528270] text-white rounded-[20px] font-black uppercase tracking-widest text-[11px] shadow-lg shadow-[#69A38D]/20 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-auto"
                      >
                        {uploadState === "uploading" ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <><Zap className="w-4 h-4" fill="currentColor" /> Analyze Now</>
                        )}
                      </button>
                    </>
                  ) : (
                    /* ── VAULT FORM ── */
                    <form onSubmit={handleUploadSubmit} className="flex flex-col gap-3 flex-1">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Document Title</label>
                        <input
                          type="text"
                          required
                          value={uploadFormData.title}
                          onChange={(e) => setUploadFormData({ ...uploadFormData, title: e.target.value })}
                          placeholder="e.g. Blood Test Report"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#69A38D] font-medium"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Category</label>
                          <select
                            value={uploadFormData.category}
                            onChange={(e) => setUploadFormData({ ...uploadFormData, category: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs outline-none focus:border-[#69A38D] font-black uppercase cursor-pointer"
                          >
                            {Object.entries(CATEGORY_MAP).filter(([k]) => k !== "ai_report" && k !== "discharge_summary").map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Date Issued</label>
                          <input
                            type="date"
                            required
                            value={uploadFormData.documentDate}
                            onChange={(e) => setUploadFormData({ ...uploadFormData, documentDate: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs outline-none focus:border-[#69A38D] font-bold"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Hospital / Lab</label>
                          <input
                            type="text"
                            value={uploadFormData.hospital}
                            onChange={(e) => setUploadFormData({ ...uploadFormData, hospital: e.target.value })}
                            placeholder="City Care Lab"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#69A38D] font-medium"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Doctor Name</label>
                          <input
                            type="text"
                            value={uploadFormData.doctorName}
                            onChange={(e) => setUploadFormData({ ...uploadFormData, doctorName: e.target.value })}
                            placeholder="Dr. Smith"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#69A38D] font-medium"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Tags (comma-separated)</label>
                        <input
                          type="text"
                          value={uploadFormData.tags}
                          onChange={(e) => setUploadFormData({ ...uploadFormData, tags: e.target.value })}
                          placeholder="blood, thyroid, quarterly"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#69A38D] font-medium"
                        />
                      </div>
                      <div className="flex items-center gap-2 ml-1">
                        <input
                          type="checkbox"
                          id="upload-fav"
                          checked={uploadFormData.isFavorite}
                          onChange={(e) => setUploadFormData({ ...uploadFormData, isFavorite: e.target.checked })}
                          className="rounded border-slate-300 text-[#69A38D] focus:ring-[#69A38D]"
                        />
                        <label htmlFor="upload-fav" className="text-[10px] font-black uppercase tracking-wider text-slate-500 cursor-pointer">
                          Mark as favorite
                        </label>
                      </div>
                      <button
                        type="submit"
                        disabled={uploadState === "uploading" || !uploadFile}
                        className="w-full py-4 bg-[#1a2138] hover:bg-black text-white rounded-[20px] font-black uppercase tracking-widest text-[11px] shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-auto"
                      >
                        {uploadState === "uploading" ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          "Upload & Encrypt"
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MOBILE FILTER BOTTOM SHEET ─── */}
      <AnimatePresence>
        {isMobileFilterOpen && (
          <div className="fixed inset-0 z-[1000] flex items-end justify-center md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsMobileFilterOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-white rounded-t-[32px] w-full max-h-[85vh] overflow-y-auto p-6 relative z-10 shadow-2xl space-y-6 pb-12"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-[#69A38D]" /> Filter Options
                </span>
                <button onClick={clearAllFilters} className="text-[10px] font-black uppercase tracking-widest text-[#69A38D]">
                  Clear All
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setShowOnlyFavorites(!showOnlyFavorites); }}
                  className={`flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all ${showOnlyFavorites ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-slate-50 border-slate-100 text-slate-500"}`}
                >
                  <Heart className="w-3.5 h-3.5 fill-current" /> Favorites
                </button>
                <button
                  onClick={() => { setShowOnlyRecentlyViewed(!showOnlyRecentlyViewed); }}
                  className={`flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all ${showOnlyRecentlyViewed ? "bg-[#69A38D]/10 border-[#69A38D]/20 text-[#69A38D]" : "bg-slate-50 border-slate-100 text-slate-500"}`}
                >
                  <Eye className="w-3.5 h-3.5" /> Recent Views
                </button>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Document Types</span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(CATEGORY_MAP).filter(([k]) => k !== 'discharge_summary').map(([key, cat]) => {
                    const active = filterTypes.includes(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleCategoryFilter(key)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${active ? "bg-[#1a2138] border-[#1a2138] text-white shadow-sm" : "bg-slate-50 border-slate-100 text-slate-600"}`}
                      >
                        <cat.icon className="w-3.5 h-3.5" /> {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Hospital / Lab</span>
                <input
                  type="text"
                  placeholder="Hospital name..."
                  value={filterHospital}
                  onChange={(e) => setFilterHospital(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#69A38D] font-medium"
                />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Doctor Name</span>
                <input
                  type="text"
                  placeholder="Doctor name..."
                  value={filterDoctor}
                  onChange={(e) => setFilterDoctor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#69A38D] font-medium"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => toggleFileTypeFilter("pdf")}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-bold ${filterFileTypes.includes("pdf") ? "bg-[#69A38D] text-white border-[#69A38D]" : "bg-slate-50 border-slate-100 text-slate-600"}`}
                >PDFs Only</button>
                <button
                  onClick={() => toggleFileTypeFilter("image")}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-bold ${filterFileTypes.includes("image") ? "bg-[#69A38D] text-white border-[#69A38D]" : "bg-slate-50 border-slate-100 text-slate-600"}`}
                >Images Only</button>
              </div>
              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="w-full py-4 bg-[#1a2138] text-white rounded-2xl font-black uppercase tracking-widest text-[11px]"
              >
                Apply Filters
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── DETAILS DRAWER ─── */}
      <AnimatePresence>
        {isDetailsOpen && selectedDoc && (
          <div className="fixed inset-0 z-[2000] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsDetailsOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative z-10 w-full max-w-5xl h-full bg-slate-50 shadow-2xl flex flex-col md:flex-row overflow-hidden"
            >
              {/* Preview pane */}
              <div className="flex-1 md:flex-[1.3] bg-slate-900 flex flex-col h-[50vh] md:h-full relative">
                <div className="absolute top-0 inset-x-0 bg-slate-950/70 backdrop-blur-md px-6 py-4 flex items-center justify-between text-white z-10">
                  <div className="min-w-0">
                    <span className="text-[9px] font-black text-[#69A38D] uppercase tracking-widest block mb-0.5">
                      {selectedDoc.isAnalyzedReport ? "AI Analysis" : "Secure Viewport"}
                    </span>
                    <h4 className="font-bold text-xs truncate max-w-xs">{selectedDoc.title}</h4>
                  </div>
                  {(selectedDoc.fileUrl || selectedDoc.isAnalyzedReport) && (
                    <button
                      onClick={(e) => handleDownload(selectedDoc, e)}
                      className="p-2.5 bg-white/10 hover:bg-white text-white hover:text-black rounded-full transition-all"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-auto flex items-center justify-center p-4 pt-20">
                  {selectedDoc.isAnalyzedReport ? (
                    <div className="text-center space-y-6 p-8">
                      <div className="w-20 h-20 rounded-[24px] bg-[#E2EED2] flex items-center justify-center mx-auto">
                        <Sparkles className="w-10 h-10 text-[#69A38D]" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-white font-black text-lg uppercase tracking-tight">{selectedDoc.title}</h3>
                        {selectedDoc.aiAnalysis?.healthScore && (
                          <div className="inline-flex items-center gap-2 bg-[#69A38D]/20 border border-[#69A38D]/30 px-4 py-2 rounded-2xl">
                            <span className="text-[#69A38D] text-2xl font-black">{selectedDoc.aiAnalysis.healthScore}</span>
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Impact Score</span>
                          </div>
                        )}
                        <p className="text-slate-400 text-sm font-medium">
                          {selectedDoc.status === "completed"
                            ? "AI synthesis complete. Full report available."
                            : "Analysis in progress..."}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 justify-center flex-wrap">
                        <Link
                          to={`/reports/${selectedDoc._id}`}
                          onClick={() => setIsDetailsOpen(false)}
                          className="inline-flex items-center gap-3 px-8 py-4 bg-[#69A38D] hover:bg-[#528270] text-white rounded-[24px] font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-[#69A38D]/20"
                        >
                          <Zap size={18} fill="currentColor" /> Open Full Analysis
                        </Link>
                        {selectedDoc.aiAnalysis?.healthScore && (
                          <HealthShareCard
                            type="report"
                            data={{
                              healthScore: selectedDoc.aiAnalysis.healthScore,
                              reportType: selectedDoc.title || 'Health Report',
                              reportDate: selectedDoc.createdAt,
                              category: selectedDoc.category || 'lab_report',
                              keyFindings: selectedDoc.aiAnalysis?.keyFindings || selectedDoc.aiAnalysis?.findings || [],
                              deficiencies: selectedDoc.aiAnalysis?.deficiencies || [],
                              userName: '',
                            }}
                            trigger={
                              <button className="inline-flex items-center gap-2 px-6 py-4 bg-white/10 hover:bg-white/20 text-white rounded-[24px] font-black text-sm uppercase tracking-widest transition-all border border-white/20">
                                <Download size={16} /> Export Card
                              </button>
                            }
                          />
                        )}
                      </div>
                    </div>
                  ) : previewLoading ? (
                    <div className="flex flex-col items-center text-slate-400 animate-pulse">
                      <RefreshCw className="w-10 h-10 animate-spin mb-4" />
                      <p className="text-xs font-bold tracking-widest uppercase">Loading Preview...</p>
                    </div>
                  ) : (selectedDoc.fileUrl?.toLowerCase().includes(".pdf") || selectedDoc.mimetype?.includes("pdf")) ? (
                    previewBlobUrl ? (
                      <iframe
                        src={`${previewBlobUrl}#toolbar=0`}
                        className="w-full h-full bg-white border-0 rounded-2xl shadow-xl"
                        title={selectedDoc.title}
                      />
                    ) : (
                      <div className="text-center space-y-4">
                        <FolderLock className="w-16 h-16 text-slate-600 mx-auto" />
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Preview Unavailable</p>
                      </div>
                    )
                  ) : previewBlobUrl ? (
                    <img
                      src={previewBlobUrl}
                      alt={selectedDoc.title}
                      className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl"
                    />
                  ) : (
                    <div className="text-center space-y-4">
                      <FolderLock className="w-16 h-16 text-slate-600 mx-auto" />
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">No Preview Available</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata pane */}
              <div className="w-full md:w-96 bg-white h-[50vh] md:h-full overflow-y-auto border-l border-slate-200 flex flex-col justify-between">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-black tracking-tight">Record Details</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Metadata & Notes</p>
                  </div>
                  <button
                    onClick={() => setIsDetailsOpen(false)}
                    className="p-2 hover:bg-slate-50 border border-slate-100 rounded-full text-slate-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6 flex-1 space-y-5">
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl p-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Record Type</span>
                    <span className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1 ${selectedDoc.isAnalyzedReport ? "bg-[#E2EED2] text-[#69A38D]" : "bg-[#1a2138] text-white"}`}>
                      {selectedDoc.isAnalyzedReport ? (
                        <><Sparkles className="w-3 h-3" /> AI Analyzed</>
                      ) : (
                        <>Vault Document</>
                      )}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Document Title</label>
                      <input
                        type="text"
                        disabled={selectedDoc.isAnalyzedReport}
                        value={editFormData.title}
                        onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#69A38D] font-bold text-slate-800 disabled:opacity-60"
                      />
                    </div>
                    {!selectedDoc.isAnalyzedReport && (
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Category</label>
                        <select
                          value={editFormData.category}
                          onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#69A38D] font-black uppercase"
                        >
                          {Object.entries(CATEGORY_MAP).filter(([k]) => k !== "ai_report" && k !== "discharge_summary").map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Hospital / Lab</label>
                        <input
                          type="text"
                          disabled={selectedDoc.isAnalyzedReport}
                          value={editFormData.hospital}
                          onChange={(e) => setEditFormData({ ...editFormData, hospital: e.target.value })}
                          placeholder="Hospital or clinic"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#69A38D] font-medium text-slate-800 disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Doctor</label>
                        <input
                          type="text"
                          disabled={selectedDoc.isAnalyzedReport}
                          value={editFormData.doctorName}
                          onChange={(e) => setEditFormData({ ...editFormData, doctorName: e.target.value })}
                          placeholder="Doctor name"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#69A38D] font-medium text-slate-800 disabled:opacity-60"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Date Issued</label>
                      <input
                        type="date"
                        disabled={selectedDoc.isAnalyzedReport}
                        value={editFormData.documentDate}
                        onChange={(e) => setEditFormData({ ...editFormData, documentDate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#69A38D] font-bold text-slate-800 disabled:opacity-60"
                      />
                    </div>
                    {!selectedDoc.isAnalyzedReport && (
                      <>
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Tags (comma-separated)</label>
                          <input
                            type="text"
                            value={editFormData.tags}
                            onChange={(e) => setEditFormData({ ...editFormData, tags: e.target.value })}
                            placeholder="e.g. blood, vaccine"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#69A38D] font-medium text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Private Notes</label>
                          <textarea
                            rows="3"
                            value={editFormData.notes}
                            onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                            placeholder="Add reminders or instructions..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#69A38D] font-medium resize-none text-slate-800"
                          />
                        </div>
                      </>
                    )}
                    <div className="flex items-center gap-2 ml-1">
                      <input
                        type="checkbox"
                        id="edit-fav"
                        checked={editFormData.isFavorite}
                        onChange={(e) => setEditFormData({ ...editFormData, isFavorite: e.target.checked })}
                        className="rounded border-slate-300 text-[#69A38D] focus:ring-[#69A38D]"
                      />
                      <label htmlFor="edit-fav" className="text-[10px] font-black uppercase tracking-wider text-slate-500 cursor-pointer">
                        Mark as favorite
                      </label>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Timeline</span>
                    <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                      <div className="flex items-start gap-4 relative pl-5 text-[11px]">
                        <div className="absolute left-1 top-1.5 w-2.5 h-2.5 rounded-full bg-[#69A38D] border border-white" />
                        <div>
                          <p className="font-bold text-slate-700">Uploaded Securely</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">
                            {new Date(selectedDoc.createdAt || selectedDoc.documentDate).toLocaleDateString("en-GB", {
                              day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4 relative pl-5 text-[11px]">
                        <div className="absolute left-1 top-1.5 w-2.5 h-2.5 rounded-full bg-slate-300 border border-white" />
                        <div>
                          <p className="font-bold text-slate-700">Encryption Validated</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">TLS SHA-256 verified</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-2">
                  <button
                    onClick={handleSaveMetadata}
                    disabled={isSavingEdit}
                    className="w-full py-4 bg-[#1a2138] hover:bg-black text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow transition-all flex items-center justify-center gap-2"
                  >
                    {isSavingEdit ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Save Changes"}
                  </button>
                  <button
                    onClick={(e) => handleDelete(selectedDoc, e)}
                    className="w-full py-3.5 hover:bg-red-50 text-red-500 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-colors border border-transparent hover:border-red-100 flex items-center justify-center gap-1.5"
                  >
                    <Trash className="w-3.5 h-3.5" /> Delete Permanently
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── FILTER SECTION ── */
function FilterSection({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-white/70 pb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#1a2138] transition-colors"
      >
        <span>{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── UNIFIED GRID CARD ── */
function UnifiedGridCard({ doc, isFavorite, onFavorite, onDelete, onView, onDownload, onTrackView }) {
  const meta = CATEGORY_MAP[doc.category] || CATEGORY_MAP.other;
  const CatIcon = meta.icon;

  return (
    <div className="liquid-glass-inner rounded-[28px] p-5 group relative transition-all duration-300 overflow-hidden min-h-[220px] flex flex-col justify-between hover:shadow-lg">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#69A38D]/5 rounded-full blur-2xl -mr-16 -mt-16" />

      {/* Top row */}
      <div className="flex items-start justify-between relative z-10">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div className="w-14 h-14 rounded-[20px] bg-[#E2EED2] flex items-center justify-center shadow-inner group-hover:rotate-6 transition-transform shrink-0">
            <CatIcon size={28} className="text-[#69A38D]" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-black text-[#69A38D] uppercase tracking-widest">
              {doc.isAnalyzedReport
                ? (doc.status === "completed" ? meta.label.toUpperCase() : "PROCESSING")
                : meta.label.toUpperCase()}
            </span>
            <h3 className="text-[17px] font-black text-[#1a2138] leading-tight uppercase tracking-tight line-clamp-1">
              {doc.title}
            </h3>
            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">
              <Calendar size={11} className="text-[#69A38D] shrink-0" />
              <span className="truncate">{new Date(doc.documentDate || doc.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="w-9 h-9 rounded-xl bg-rose-50 text-rose-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white flex items-center justify-center shadow-sm shrink-0 ml-2"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* AI Health Score */}
      {doc.isAnalyzedReport && doc.aiAnalysis?.healthScore && (
        <div className="bg-white/70 rounded-[18px] p-3.5 flex items-center justify-between border border-white mt-3 relative z-10">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Impact Score</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-[#1a2138] tracking-tighter">{doc.aiAnalysis.healthScore}</span>
              <span className="text-slate-300 font-bold text-xs uppercase">Optimization</span>
            </div>
          </div>
          <div className="flex -space-x-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black text-[#69A38D] shadow-sm">{i}</div>
            ))}
          </div>
        </div>
      )}

      {/* Vault doc metadata */}
      {!doc.isAnalyzedReport && (doc.hospital || doc.doctorName || (Array.isArray(doc.tags) && doc.tags.length > 0)) && (
        <div className="mt-4 space-y-1.5 relative z-10">
          {doc.hospital && <p className="text-[10px] font-bold text-slate-400 truncate">🏥 {doc.hospital}</p>}
          {doc.doctorName && <p className="text-[10px] font-bold text-slate-400 truncate">👨‍⚕️ {doc.doctorName}</p>}
          {Array.isArray(doc.tags) && doc.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {doc.tags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="text-[8px] font-black uppercase tracking-wider text-[#69A38D]/80 bg-[#69A38D]/5 border border-[#69A38D]/10 px-2 py-0.5 rounded-md">
                  #{tag}
                </span>
              ))}
              {doc.tags.length > 3 && (
                <span className="text-[8px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md">+{doc.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-6 relative z-10">
        {doc.isAnalyzedReport ? (
          <Link
            to={`/reports/${doc._id}`}
            onClick={() => onTrackView(doc._id)}
            className="flex-1 py-3.5 bg-white/70 border border-white text-[#1a1a1a] rounded-[18px] font-black text-[10px] uppercase tracking-[0.15em] hover:bg-[#5B8C6F] hover:text-white transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Zap size={14} fill="currentColor" /> Explore
          </Link>
        ) : (
          <button
            onClick={onView}
            className="flex-1 py-3.5 bg-white/70 border border-white text-[#1a1a1a] rounded-[18px] font-black text-[10px] uppercase tracking-[0.15em] hover:bg-[#5B8C6F] hover:text-white transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Eye size={15} /> View
          </button>
        )}
        <button
          onClick={onFavorite}
          className={`w-12 h-12 rounded-[16px] border flex items-center justify-center transition-all shadow-sm ${
            isFavorite
              ? "bg-rose-500 border-rose-500 text-white"
              : "bg-white border-[#69A38D]/20 text-slate-400 hover:text-rose-500 hover:border-rose-200"
          }`}
        >
          <Heart size={15} className={isFavorite ? "fill-current" : ""} />
        </button>
        {!doc.isAnalyzedReport && (
          <button
            onClick={onDownload}
            className="w-12 h-12 rounded-[16px] bg-white border border-[#69A38D]/20 text-slate-400 hover:text-[#69A38D] hover:border-[#69A38D]/40 flex items-center justify-center transition-all shadow-sm"
            title="Download"
          >
            <Download size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── UNIFIED LIST ROW ── */
function UnifiedListRow({ doc, isFavorite, onFavorite, onDelete, onView, onDownload, onTrackView }) {
  const meta = CATEGORY_MAP[doc.category] || CATEGORY_MAP.other;
  const CatIcon = meta.icon;

  return (
    <div className="flex items-center justify-between p-4 hover:bg-white/40 transition-colors gap-4 group">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="w-12 h-12 rounded-[16px] bg-[#E2EED2] flex items-center justify-center shrink-0">
          <CatIcon size={20} className="text-[#69A38D]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[9px] font-black text-[#69A38D] uppercase tracking-widest">
              {doc.isAnalyzedReport
                ? (doc.status === "completed" ? meta.label.toUpperCase() : "PROCESSING")
                : meta.label.toUpperCase()}
            </span>
            <span className="text-[10px] text-slate-400 font-bold">
              {new Date(doc.documentDate || doc.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </div>
          <h4 className="font-black text-sm text-[#1a2138] truncate uppercase tracking-tight">{doc.title}</h4>
          {(doc.hospital || doc.doctorName) && (
            <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
              {doc.hospital && `🏥 ${doc.hospital}`}{doc.doctorName && ` · 👨‍⚕️ ${doc.doctorName}`}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onFavorite}
          className={`p-2 rounded-full border transition-colors ${isFavorite ? "bg-rose-50 border-rose-100 text-rose-500" : "bg-white/60 border-white text-slate-300 hover:text-rose-500"}`}
          title="Favorite"
        >
          <Heart className={`w-3.5 h-3.5 ${isFavorite ? "fill-current" : ""}`} />
        </button>
        {doc.isAnalyzedReport ? (
          <Link
            to={`/reports/${doc._id}`}
            onClick={() => onTrackView(doc._id)}
            className="px-4 py-2 bg-[#E2EED2] border border-[#69A38D]/20 text-[#69A38D] hover:bg-[#69A38D] hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5"
          >
            <Zap size={11} fill="currentColor" /> Explore
          </Link>
        ) : (
          <button
            onClick={onView}
            className="px-4 py-2 bg-white/60 border border-white text-slate-600 hover:bg-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors"
          >
            View
          </button>
        )}
        {!doc.isAnalyzedReport && (
          <button
            onClick={onDownload}
            className="p-2 bg-white/60 border border-white text-slate-400 hover:text-[#69A38D] rounded-xl transition-colors"
            title="Download"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-2 bg-white/60 border border-white text-slate-400 hover:text-red-500 rounded-xl transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ── SKELETON CARD ── */
function SkeletonCard() {
  return (
    <div className="bg-white/60 rounded-[40px] border border-white p-6 space-y-4 animate-pulse">
      <div className="flex gap-4">
        <div className="w-14 h-14 bg-slate-100 rounded-[20px]" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-2.5 bg-slate-100 rounded w-1/3" />
          <div className="h-4 bg-slate-100 rounded w-3/4" />
          <div className="h-2.5 bg-slate-100 rounded w-1/2" />
        </div>
      </div>
      <div className="h-20 bg-slate-100 rounded-[24px]" />
      <div className="h-12 bg-slate-100 rounded-[24px]" />
    </div>
  );
}
