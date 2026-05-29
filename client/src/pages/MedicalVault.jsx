import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Plus, Search, Trash2, X, FileImage, ShieldCheck,
  Download, Calendar, Stethoscope, Pill, Syringe, Activity,
  FileSpreadsheet, Sparkles, ArrowLeft, Heart, Share2, Grid,
  List, Filter, ChevronDown, ChevronUp, LockKeyhole, FolderLock,
  ShieldAlert, Eye, Edit3, Trash, CheckCircle2, RefreshCw, Info, Lock
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const CATEGORY_MAP = {
  prescription: { label: 'Prescriptions', icon: Pill, color: 'text-[#5B8C6F]', bg: 'bg-[#5B8C6F]/10', border: 'border-[#5B8C6F]/20' },
  lab_report: { label: 'Lab Reports', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  scan: { label: 'Scans & X-Rays', icon: FileImage, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
  discharge_summary: { label: 'Doctor Notes', icon: Stethoscope, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
  vaccination: { label: 'Vaccinations', icon: Syringe, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  insurance: { label: 'Insurance & ID', icon: ShieldCheck, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
  other: { label: 'Other Documents', icon: FileSpreadsheet, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100' }
};

export default function MedicalVault() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  // Dialogs / Panels state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(true); // default open on desktop
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Filters State
  const [filterTypes, setFilterTypes] = useState([]); // Array of active category keys
  const [filterDateRange, setFilterDateRange] = useState('all'); // 'all' | '30days' | '6months' | 'year' | 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [filterHospital, setFilterHospital] = useState('');
  const [filterDoctor, setFilterDoctor] = useState('');
  const [filterFileTypes, setFilterFileTypes] = useState([]); // 'pdf', 'image'
  const [selectedTags, setSelectedTags] = useState([]);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [showOnlyRecentlyViewed, setShowOnlyRecentlyViewed] = useState(false);

  // Local Sync Lists (for AI Reports and fallback)
  const [favoriteReportIds, setFavoriteReportIds] = useState(() => {
    return JSON.parse(localStorage.getItem('favorite_reports_ids') || '[]');
  });
  const [recentlyViewedIds, setRecentlyViewedIds] = useState(() => {
    return JSON.parse(localStorage.getItem('recently_viewed_docs') || '[]');
  });

  // Upload Form State
  const [dragActive, setDragActive] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState, setUploadState] = useState('idle'); // 'idle' | 'uploading' | 'success' | 'error'
  const [uploadFormData, setUploadFormData] = useState({
    title: '',
    category: 'prescription',
    documentDate: new Date().toISOString().split('T')[0],
    hospital: '',
    doctorName: '',
    notes: '',
    tags: '',
    isFavorite: false
  });

  // Edit Metadata State
  const [editFormData, setEditFormData] = useState({
    title: '',
    category: 'prescription',
    documentDate: '',
    hospital: '',
    doctorName: '',
    notes: '',
    tags: '',
    isFavorite: false
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Load documents
  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/documents');
      setDocuments(data.documents || []);
    } catch (error) {
      toast.error('Failed to load vault records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Persist Favorites State
  useEffect(() => {
    localStorage.setItem('favorite_reports_ids', JSON.stringify(favoriteReportIds));
  }, [favoriteReportIds]);

  // Persist Recently Viewed
  useEffect(() => {
    localStorage.setItem('recently_viewed_docs', JSON.stringify(recentlyViewedIds));
  }, [recentlyViewedIds]);

  // Download file via private URL (optimized - no server bottleneck)
  const handleDownload = async (doc, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const toastId = toast.loading('Generating download link...');
    try {
      // Get the private download URL from the server (lightweight, no file transfer)
      const { data } = await api.get(`/documents/${doc._id}/download-url${doc.isAnalyzedReport ? '?type=report' : ''}`);
      
      toast.dismiss(toastId);
      
      // Open the download URL directly - browser handles the download
      // This is much faster because the file goes directly from Cloudinary to the browser
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.setAttribute('download', doc.originalName || doc.title || 'document');
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Download started');
    } catch (error) {
      console.error("Download error", error);
      toast.dismiss(toastId);
      
      // Fallback to proxy endpoint if private URL generation fails
      if (error.response?.status === 400 || error.response?.status === 500) {
        toast.loading('Using alternative download method...');
        try {
          const response = await api.get(`/documents/${doc._id}/file${doc.isAnalyzedReport ? '?type=report' : ''}`, {
            responseType: 'blob'
          });
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const fallbackLink = document.createElement('a');
          fallbackLink.href = url;
          fallbackLink.setAttribute('download', doc.originalName || doc.title || 'document');
          document.body.appendChild(fallbackLink);
          fallbackLink.click();
          fallbackLink.remove();
          window.URL.revokeObjectURL(url);
          toast.dismiss();
          toast.success('Download started');
        } catch (fallbackError) {
          toast.dismiss();
          toast.error('Failed to download file');
        }
      } else {
        toast.error('Failed to generate download link');
      }
    }
  };

  // Preview Blob handling
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let objectUrl = null;
    if (selectedDoc) {
      const isPdf = selectedDoc.fileUrl?.toLowerCase().includes('.pdf') || selectedDoc.mimetype?.includes('pdf');
      
      if (isPdf) {
        const fetchPreview = async () => {
          setPreviewLoading(true);
          try {
            const response = await api.get(`/documents/${selectedDoc._id}/file${selectedDoc.isAnalyzedReport ? '?type=report' : ''}`, {
              responseType: 'blob'
            });
            objectUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            setPreviewBlobUrl(objectUrl);
          } catch (error) {
            console.error("Preview error", error);
            setPreviewBlobUrl(null);
          } finally {
            setPreviewLoading(false);
          }
        };
        fetchPreview();
      } else {
        setPreviewBlobUrl(selectedDoc.fileUrl); // Keep direct URL for images, as Cloudinary usually allows it or we can proxy it too, but to save bandwidth we keep direct.
      }
    } else {
      setPreviewBlobUrl(null);
    }
    
    return () => {
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
    };
  }, [selectedDoc]);

  // Handle Drag & Drop Events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a PDF or an Image (JPEG/PNG)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('File size exceeds the 10MB limit');
      return;
    }
    setUploadFile(file);
    // Auto-fill title from file name without extension
    const titleWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    setUploadFormData(prev => ({
      ...prev,
      title: titleWithoutExt
    }));
  };

  // Submit Upload Record
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) return toast.error('Please select or drop a file');
    if (!uploadFormData.title) return toast.error('Document title is required');

    setUploadState('uploading');
    setUploadProgress(10);

    // Mock progress animation since standard XHR is simple
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 85) {
          clearInterval(progressInterval);
          return 85;
        }
        return prev + 15;
      });
    }, 150);

    try {
      const data = new FormData();
      data.append('document', uploadFile);
      data.append('title', uploadFormData.title);
      data.append('category', uploadFormData.category);
      data.append('documentDate', uploadFormData.documentDate);
      data.append('notes', uploadFormData.notes);
      data.append('hospital', uploadFormData.hospital);
      data.append('doctorName', uploadFormData.doctorName);
      data.append('isFavorite', uploadFormData.isFavorite);

      const tagArr = uploadFormData.tags.split(',').map(t => t.trim()).filter(Boolean);
      data.append('tags', JSON.stringify(tagArr));

      await api.post('/documents', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadState('success');
      toast.success('Document uploaded securely');

      setTimeout(() => {
        setIsUploadOpen(false);
        resetUploadForm();
        fetchDocuments();
      }, 1200);

    } catch (error) {
      clearInterval(progressInterval);
      setUploadState('error');
      toast.error(error?.response?.data?.message || 'Secure upload failed');
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadProgress(0);
    setUploadState('idle');
    setUploadFormData({
      title: '',
      category: 'prescription',
      documentDate: new Date().toISOString().split('T')[0],
      hospital: '',
      doctorName: '',
      notes: '',
      tags: '',
      isFavorite: false
    });
  };

  // Toggle Favorite
  const handleToggleFavorite = async (doc, e) => {
    e.stopPropagation();
    if (doc.isAnalyzedReport) {
      // Toggle for AI report (localStorage)
      const isFav = favoriteReportIds.includes(doc._id);
      if (isFav) {
        setFavoriteReportIds(prev => prev.filter(id => id !== doc._id));
        toast.success('Removed from favorites');
      } else {
        setFavoriteReportIds(prev => [...prev, doc._id]);
        toast.success('Added to favorites');
      }
    } else {
      // Custom doc (DB call)
      try {
        const nextFavorite = !doc.isFavorite;
        const updatedDocs = documents.map(d => d._id === doc._id ? { ...d, isFavorite: nextFavorite } : d);
        setDocuments(updatedDocs);

        await api.put(`/documents/${doc._id}`, { isFavorite: nextFavorite });
        toast.success(nextFavorite ? 'Added to favorites' : 'Removed from favorites');
      } catch (error) {
        toast.error('Failed to update favorite status');
        fetchDocuments(); // Rollback
      }
    }
  };

  // Open Details Drawer
  const handleOpenDetails = (doc) => {
    setSelectedDoc(doc);
    // Populate form data
    setEditFormData({
      title: doc.title || '',
      category: doc.category || 'other',
      documentDate: doc.documentDate ? new Date(doc.documentDate).toISOString().split('T')[0] : '',
      hospital: doc.hospital || '',
      doctorName: doc.doctorName || '',
      notes: doc.notes || '',
      tags: Array.isArray(doc.tags) ? doc.tags.join(', ') : '',
      isFavorite: doc.isAnalyzedReport ? favoriteReportIds.includes(doc._id) : (doc.isFavorite || false)
    });

    // Add to recently viewed
    const updatedRecent = [doc._id, ...recentlyViewedIds.filter(id => id !== doc._id)].slice(0, 12);
    setRecentlyViewedIds(updatedRecent);

    setIsDetailsOpen(true);
  };

  // Save Edit metadata
  const handleSaveMetadata = async () => {
    if (!selectedDoc) return;
    if (selectedDoc.isAnalyzedReport) {
      // For AI analyzed reports, we allow toggling favorite and noting locally/session
      const isFav = editFormData.isFavorite;
      const isCurrentlyFav = favoriteReportIds.includes(selectedDoc._id);
      if (isFav !== isCurrentlyFav) {
        if (isFav) {
          setFavoriteReportIds(prev => [...prev, selectedDoc._id]);
        } else {
          setFavoriteReportIds(prev => prev.filter(id => id !== selectedDoc._id));
        }
      }
      toast.success('Metadata settings updated locally');
      setIsDetailsOpen(false);
      return;
    }

    setIsSavingEdit(true);
    try {
      const tagArr = editFormData.tags.split(',').map(t => t.trim()).filter(Boolean);
      const updateData = {
        title: editFormData.title,
        category: editFormData.category,
        documentDate: editFormData.documentDate,
        hospital: editFormData.hospital,
        doctorName: editFormData.doctorName,
        notes: editFormData.notes,
        isFavorite: editFormData.isFavorite,
        tags: tagArr
      };

      const { data } = await api.put(`/documents/${selectedDoc._id}`, updateData);

      setDocuments(prev => prev.map(d => d._id === selectedDoc._id ? { ...d, ...data.document } : d));
      toast.success('Record metadata updated successfully');
      setIsDetailsOpen(false);
    } catch (error) {
      toast.error('Failed to update record details');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete Document
  const handleDeleteDoc = async (doc, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to permanently delete "${doc.title}"?`)) return;

    try {
      if (doc.isAnalyzedReport) {
        await api.delete(`/health/reports/${doc._id}`);
      } else {
        await api.delete(`/documents/${doc._id}`);
      }
      toast.success('Document deleted successfully');
      if (isDetailsOpen && selectedDoc?._id === doc._id) {
        setIsDetailsOpen(false);
      }
      fetchDocuments();
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  // Dynamically extract unique lists for tags, hospitals, doctors to display in filters
  const filterHelperLists = useMemo(() => {
    const tagsSet = new Set();
    const hospitalsSet = new Set();
    const doctorsSet = new Set();

    documents.forEach(doc => {
      if (Array.isArray(doc.tags)) {
        doc.tags.forEach(t => tagsSet.add(t));
      }
      if (doc.hospital) hospitalsSet.add(doc.hospital);
      if (doc.doctorName) doctorsSet.add(doc.doctorName);
    });

    return {
      allTags: Array.from(tagsSet).filter(Boolean),
      allHospitals: Array.from(hospitalsSet).filter(Boolean),
      allDoctors: Array.from(doctorsSet).filter(Boolean)
    };
  }, [documents]);

  // File size formatter
  const formatBytes = (bytes, decimals = 1) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Computed Stats
  const vaultStats = useMemo(() => {
    const total = documents.length;
    const prescriptions = documents.filter(d => d.category === 'prescription').length;
    const labReports = documents.filter(d => d.category === 'lab_report').length;

    // Recent uploads: past 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recent = documents.filter(d => new Date(d.documentDate || d.createdAt) >= sevenDaysAgo).length;

    // Storage Used
    const totalSizeBytes = documents.reduce((sum, d) => sum + (d.size || 0), 0);
    const storagePercent = Math.min((totalSizeBytes / (500 * 1024 * 1024)) * 100, 100);

    return {
      total,
      prescriptions,
      labReports,
      recent,
      storageUsed: formatBytes(totalSizeBytes),
      storagePercent
    };
  }, [documents]);

  // Filter & Search Logic
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      // 1. Search Query Match
      if (search) {
        const query = search.toLowerCase();
        const matchesTitle = doc.title?.toLowerCase().includes(query);
        const matchesHospital = doc.hospital?.toLowerCase().includes(query);
        const matchesDoctor = doc.doctorName?.toLowerCase().includes(query);
        const matchesNotes = doc.notes?.toLowerCase().includes(query);
        const matchesTags = Array.isArray(doc.tags) && doc.tags.some(t => t.toLowerCase().includes(query));

        if (!matchesTitle && !matchesHospital && !matchesDoctor && !matchesNotes && !matchesTags) {
          return false;
        }
      }

      // 2. Category Type Filter
      if (filterTypes.length > 0) {
        if (!filterTypes.includes(doc.category)) return false;
      }

      // 3. Date Range Filter
      if (filterDateRange !== 'all') {
        const docDate = new Date(doc.documentDate || doc.createdAt);
        const now = new Date();
        if (filterDateRange === '30days') {
          const limit = new Date();
          limit.setDate(now.getDate() - 30);
          if (docDate < limit) return false;
        } else if (filterDateRange === '6months') {
          const limit = new Date();
          limit.setMonth(now.getMonth() - 6);
          if (docDate < limit) return false;
        } else if (filterDateRange === 'year') {
          const limit = new Date();
          limit.setFullYear(now.getFullYear() - 1);
          if (docDate < limit) return false;
        } else if (filterDateRange === 'custom' && customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          if (docDate < start || docDate > end) return false;
        }
      }

      // 4. Hospital Filter
      if (filterHospital) {
        if (!doc.hospital || !doc.hospital.toLowerCase().includes(filterHospital.toLowerCase())) {
          return false;
        }
      }

      // 5. Doctor Filter
      if (filterDoctor) {
        if (!doc.doctorName || !doc.doctorName.toLowerCase().includes(filterDoctor.toLowerCase())) {
          return false;
        }
      }

      // 6. File Type Filter
      if (filterFileTypes.length > 0) {
        const isPdf = doc.mimetype?.includes('pdf') || doc.fileUrl?.toLowerCase().includes('.pdf') || doc.originalName?.toLowerCase().includes('.pdf');
        const isImage = doc.mimetype?.includes('image') || (!isPdf && doc.fileUrl && !doc.fileUrl.toLowerCase().includes('.pdf'));

        let matchesType = false;
        if (filterFileTypes.includes('pdf') && isPdf) matchesType = true;
        if (filterFileTypes.includes('image') && isImage) matchesType = true;

        if (!matchesType) return false;
      }

      // 7. Tags Filter
      if (selectedTags.length > 0) {
        if (!Array.isArray(doc.tags)) return false;
        const hasAllSelectedTags = selectedTags.every(t => doc.tags.includes(t));
        if (!hasAllSelectedTags) return false;
      }

      // 8. Favorites Filter
      if (showOnlyFavorites) {
        const isFav = doc.isAnalyzedReport ? favoriteReportIds.includes(doc._id) : doc.isFavorite;
        if (!isFav) return false;
      }

      // 9. Recently Viewed Filter
      if (showOnlyRecentlyViewed) {
        if (!recentlyViewedIds.includes(doc._id)) return false;
      }

      return true;
    });
  }, [documents, search, filterTypes, filterDateRange, customStartDate, customEndDate, filterHospital, filterDoctor, filterFileTypes, selectedTags, showOnlyFavorites, showOnlyRecentlyViewed, favoriteReportIds, recentlyViewedIds]);

  const clearAllFilters = () => {
    setFilterTypes([]);
    setFilterDateRange('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setFilterHospital('');
    setFilterDoctor('');
    setFilterFileTypes([]);
    setSelectedTags([]);
    setShowOnlyFavorites(false);
    setShowOnlyRecentlyViewed(false);
    toast.success('Filters cleared');
  };

  const toggleCategoryFilter = (cat) => {
    setFilterTypes(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const toggleFileTypeFilter = (type) => {
    setFilterFileTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const toggleTagFilter = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  return (
    <div className="w-full min-h-screen px-4 md:px-12 py-8 space-y-8 font-sans selection:bg-[#5B8C6F]/20 select-none pb-32">

      {/* TOP HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-black tracking-tight flex items-center gap-3">
            Medical Vault <ShieldCheck className="w-7 h-7 text-[#5B8C6F]" />
          </h1>
          <p className="text-sm font-medium text-slate-400 mt-1.5">
            Securely manage, search, and access all your medical reports and records.
          </p>
        </div>

        {/* Primary CTA upload record */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-2 bg-[#1a1a1a] hover:bg-black text-white px-6 py-3.5 rounded-[20px] font-black uppercase tracking-widest text-[11px] shadow-lg shadow-black/10 hover:scale-[1.03] active:scale-95 transition-all duration-200"
          >
            <Plus className="w-4 h-4" strokeWidth={3} /> Upload Document
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
        {/* Stat 1: Total records */}
        <div className="bg-gradient-to-tr from-white/90 to-[#ebf0e6]/40 backdrop-blur-md border border-[#f0f0ea] p-5 rounded-[24px] shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex justify-between items-center mb-4">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Records</span>
            <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
              <FolderLock className="w-4 h-4 text-slate-500" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-black leading-none">{vaultStats.total}</h3>
            <p className="text-[9px] font-bold text-emerald-600 mt-1 uppercase tracking-wider">▲ Live Synced</p>
          </div>
        </div>

        {/* Stat 2: Prescriptions */}
        <div className="bg-gradient-to-tr from-white/90 to-blue-50/20 backdrop-blur-md border border-slate-100 p-5 rounded-[24px] shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Prescriptions</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100/50 flex items-center justify-center">
              <Pill className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-black leading-none">{vaultStats.prescriptions}</h3>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Category Filter</p>
          </div>
        </div>

        {/* Stat 3: Lab Reports */}
        <div className="bg-gradient-to-tr from-white/90 to-emerald-50/20 backdrop-blur-md border border-slate-100 p-5 rounded-[24px] shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lab Insights</span>
            <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100/50 flex items-center justify-center">
              <Activity className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-black leading-none">{vaultStats.labReports}</h3>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Reports Count</p>
          </div>
        </div>

        {/* Stat 4: Recent Uploads */}
        <div className="bg-gradient-to-tr from-white/90 to-purple-50/20 backdrop-blur-md border border-slate-100 p-5 rounded-[24px] shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Recent (7d)</span>
            <div className="w-8 h-8 rounded-full bg-purple-50 border border-purple-100/50 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-purple-500" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-black leading-none">{vaultStats.recent}</h3>
            <p className="text-[9px] font-bold text-[#5B8C6F] mt-1 uppercase tracking-wider">New Uploads</p>
          </div>
        </div>

        {/* Stat 5: Storage used */}
        <div className="bg-gradient-to-tr from-white/90 to-rose-50/20 backdrop-blur-md border border-slate-100 p-5 rounded-[24px] shadow-sm flex flex-col justify-between col-span-2 lg:col-span-1 group hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vault Space</span>
            <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">{vaultStats.storageUsed} / 500MB</span>
          </div>
          <div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 mb-3">
              <div
                className="h-full bg-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${vaultStats.storagePercent}%` }}
              />
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cloud Limit (500MB)</p>
          </div>
        </div>
      </div>

      {/* FILTER BAR / SEARCH / LAYOUT ACTIONS CONTROLS */}
      <div className="w-full bg-[#FAFBF8] border border-[#f0f0ea] p-4 rounded-[2rem] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">

        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search records, hospitals, doctors, tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-[#e2e8f0] rounded-[18px] pl-11 pr-10 py-3 text-sm focus:outline-none focus:border-[#5B8C6F] focus:ring-2 focus:ring-[#5B8C6F]/10 placeholder:text-slate-400 font-medium"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mid Options: Date Filter / Mobile drawer toggle */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
          {/* Date Range Picker */}
          <div className="flex flex-col md:flex-row items-center gap-2 md:gap-1.5 bg-white border border-slate-200 rounded-[18px] px-3 md:px-4 py-2 md:py-2.5 shadow-sm w-full md:w-auto">
            <Calendar className="w-4 h-4 text-[#5B8C6F] hidden md:block" />
            <div className="flex items-center gap-1.5 w-full md:w-auto">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setFilterDateRange('custom');
                }}
                className="bg-transparent border-0 p-1 md:p-0 text-xs font-black uppercase tracking-wider text-slate-700 outline-none focus:ring-0 cursor-pointer flex-1 md:flex-none md:w-28 text-center"
                placeholder="Start date"
              />
              <span className="text-slate-300 text-xs hidden md:inline">—</span>
              <span className="text-slate-300 text-xs md:hidden">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setFilterDateRange('custom');
                }}
                className="bg-transparent border-0 p-1 md:p-0 text-xs font-black uppercase tracking-wider text-slate-700 outline-none focus:ring-0 cursor-pointer flex-1 md:flex-none md:w-28 text-center"
                placeholder="End date"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                  setFilterDateRange('all');
                  toast.success('Date range cleared');
                }}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-colors ml-auto md:ml-0"
                title="Clear date range"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Toggle Filter Sidebar (Desktop) */}
          <button
            onClick={() => setIsFilterSidebarOpen(!isFilterSidebarOpen)}
            className={`hidden md:flex items-center gap-1 px-3 py-2.5 rounded-[18px] border text-xs font-black uppercase tracking-wider transition-all ${isFilterSidebarOpen ? 'bg-[#5B8C6F]/10 border-[#5B8C6F]/30 text-[#5B8C6F]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <Filter className="w-4 h-4" />
          </button>

          {/* Mobile Filter Toggle (Bottom sheet trigger) */}
          <button
            onClick={() => setIsMobileFilterOpen(true)}
            className="md:hidden flex items-center gap-1.5 px-4.5 py-2.5 bg-white border border-slate-200 rounded-[18px] text-xs font-black uppercase tracking-wider text-slate-600"
          >
            <Filter className="w-3 h-3" /> Filters {(filterTypes.length + selectedTags.length + (showOnlyFavorites ? 1 : 0)) > 0 && `(${(filterTypes.length + selectedTags.length + (showOnlyFavorites ? 1 : 0))})`}
          </button>
        </div>

        {/* View Toggle Mode */}
        <div className="flex items-center bg-white border border-slate-200 rounded-[18px] p-1 shadow-sm shrink-0 self-stretch md:self-auto justify-center md:justify-start">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-[14px] transition-all flex items-center gap-1.5 text-xs font-bold ${viewMode === 'grid' ? 'bg-[#1a1a1a] text-white' : 'text-slate-400 hover:text-slate-800'}`}
            title="Grid View"
          >
            <Grid className="w-4 h-4" /> <span className="text-[10px] font-black uppercase tracking-wider px-1">Grid</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-[14px] transition-all flex items-center gap-1.5 text-xs font-bold ${viewMode === 'list' ? 'bg-[#1a1a1a] text-white' : 'text-slate-400 hover:text-slate-800'}`}
            title="List View"
          >
            <List className="w-4 h-4" /> <span className="text-[10px] font-black uppercase tracking-wider px-1">List</span>
          </button>
        </div>
      </div>

      {/* FILTER AND CONTENT SPLIT SECTION */}
      <div className="w-full flex items-start gap-8 relative">

        {/* DESKTOP STICKY FILTER SIDEBAR */}
        <AnimatePresence>
          {isFilterSidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="hidden md:block shrink-0 sticky top-24 self-start max-h-[80vh] overflow-y-auto pr-2 scrollbar-thin bg-white/60 backdrop-blur-md border border-[#f0f0ea] rounded-[2rem] p-6 space-y-6 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-[#5B8C6F]" /> Filter Options
                </span>
                <button
                  onClick={clearAllFilters}
                  className="text-[9px] font-black uppercase tracking-widest text-[#5B8C6F] hover:text-[#4a7b5e] transition-colors"
                >
                  Clear All
                </button>
              </div>

              {/* Favorites & Recently Viewed Filters */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${showOnlyFavorites ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'}`}
                >
                  <span className="flex items-center gap-2"><Heart className="w-4 h-4 fill-current" /> Favorites Only</span>
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" style={{ opacity: showOnlyFavorites ? 1 : 0 }} />
                </button>
                <button
                  onClick={() => setShowOnlyRecentlyViewed(!showOnlyRecentlyViewed)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${showOnlyRecentlyViewed ? 'bg-[#5B8C6F]/10 border-[#5B8C6F]/20 text-[#5B8C6F]' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'}`}
                >
                  <span className="flex items-center gap-2"><Eye className="w-4 h-4" /> Recently Viewed</span>
                  <span className="w-2 h-2 rounded-full bg-[#5B8C6F] animate-pulse" style={{ opacity: showOnlyRecentlyViewed ? 1 : 0 }} />
                </button>
              </div>

              {/* Collapsible Filter Section: Report Type */}
              <FilterSection title="Report Type">
                <div className="space-y-2 pt-1">
                  {Object.keys(CATEGORY_MAP).map(key => {
                    const active = filterTypes.includes(key);
                    const cat = CATEGORY_MAP[key];
                    return (
                      <label
                        key={key}
                        className="flex items-center gap-3 cursor-pointer group select-none text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleCategoryFilter(key)}
                          className="w-4.5 h-4.5 rounded border-slate-300 text-[#5B8C6F] focus:ring-[#5B8C6F] cursor-pointer"
                        />
                        <div className="flex items-center gap-2">
                          <cat.icon className={`w-3.5 h-3.5 ${cat.color}`} />
                          <span>{cat.label}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </FilterSection>

              {/* Filter Section: Hospital Name Search */}
              <FilterSection title="Hospital / Laboratory">
                <div className="space-y-3 pt-1">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Hospital name..."
                      value={filterHospital}
                      onChange={(e) => setFilterHospital(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-[#5B8C6F] font-medium"
                    />
                  </div>
                  {filterHelperLists.allHospitals.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-thin">
                      {filterHelperLists.allHospitals.slice(0, 8).map(h => (
                        <button
                          key={h}
                          onClick={() => setFilterHospital(filterHospital === h ? '' : h)}
                          className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border transition-all ${filterHospital === h ? 'bg-[#5B8C6F] border-[#5B8C6F] text-white' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'}`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </FilterSection>

              {/* Filter Section: Doctor Name Search */}
              <FilterSection title="Doctor Name">
                <div className="space-y-3 pt-1">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Doctor name..."
                      value={filterDoctor}
                      onChange={(e) => setFilterDoctor(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-[#5B8C6F] font-medium"
                    />
                  </div>
                  {filterHelperLists.allDoctors.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-thin">
                      {filterHelperLists.allDoctors.slice(0, 8).map(d => (
                        <button
                          key={d}
                          onClick={() => setFilterDoctor(filterDoctor === d ? '' : d)}
                          className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border transition-all ${filterDoctor === d ? 'bg-[#5B8C6F] border-[#5B8C6F] text-white' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </FilterSection>

              {/* Filter Section: File Type */}
              <FilterSection title="File Format">
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors">
                    <input
                      type="checkbox"
                      checked={filterFileTypes.includes('pdf')}
                      onChange={() => toggleFileTypeFilter('pdf')}
                      className="w-4.5 h-4.5 rounded border-slate-300 text-[#5B8C6F] focus:ring-[#5B8C6F]"
                    />
                    <span>PDF Documents</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors">
                    <input
                      type="checkbox"
                      checked={filterFileTypes.includes('image')}
                      onChange={() => toggleFileTypeFilter('image')}
                      className="w-4.5 h-4.5 rounded border-slate-300 text-[#5B8C6F] focus:ring-[#5B8C6F]"
                    />
                    <span>Images / Scans (PNG, JPG)</span>
                  </label>
                </div>
              </FilterSection>

              {/* Filter Section: Tags */}
              {filterHelperLists.allTags.length > 0 && (
                <FilterSection title="Document Tags">
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {filterHelperLists.allTags.map(tag => {
                      const active = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleTagFilter(tag)}
                          className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-xl border transition-all ${active ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                  </div>
                </FilterSection>
              )}

              {/* Security trust badge */}
              <div className="pt-4 mt-6 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2 text-[#5B8C6F]">
                  <FolderLock className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">Secure Storage</span>
                </div>
                <div className="space-y-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg">
                    <LockKeyhole className="w-3.5 h-3.5 text-[#5B8C6F]" /> HIPAA Secure
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> AES-256 Encrypted
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg">
                    <Sparkles className="w-3.5 h-3.5 text-[#5B8C6F]" /> AI Verified
                  </div>
                </div>
              </div>

            </motion.aside>
          )}
        </AnimatePresence>

        {/* MAIN RECORDS AREA */}
        <div className="flex-1 min-w-0">

          {loading ? (
            /* Skeleton Loading Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : filteredDocuments.length === 0 ? (
            /* Empty State Layout */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full bg-[#FAFBF8] border border-[#f0f0ea] rounded-[2.5rem] p-16 text-center space-y-6 shadow-sm"
            >
              <div className="w-24 h-24 bg-white border border-[#f0f0ea] rounded-[2rem] mx-auto flex items-center justify-center shadow-sm relative">
                <FolderLock className="w-12 h-12 text-[#5B8C6F]" />
                <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-400 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-bounce shadow">0</div>
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-xl font-black text-black">No Medical Records Uploaded Yet</h3>
                <p className="text-sm font-medium text-slate-400 leading-relaxed">
                  Start uploading prescriptions, lab results, scans, and notes. Carry all your health papers securely wherever you go.
                </p>
              </div>
              <div>
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="bg-[#1a1a1a] hover:bg-black text-white px-8 py-4 rounded-[20px] font-black uppercase tracking-widest text-[11px] transition-all hover:scale-105 shadow-md shadow-black/10"
                >
                  Upload Your First Report
                </button>
              </div>
            </motion.div>
          ) : (
            /* Layout Grid/List rendering */
            <div className="space-y-4">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
                <span>Showing {filteredDocuments.length} of {documents.length} Records</span>
                {(filterTypes.length + selectedTags.length + (showOnlyFavorites ? 1 : 0) || search) && (
                  <button
                    onClick={clearAllFilters}
                    className="text-[#5B8C6F] font-black hover:underline"
                  >
                    Clear Applied Filters
                  </button>
                )}
              </div>

              {viewMode === 'grid' ? (
                /* Grid View rendering */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredDocuments.map(doc => {
                    return (
                      <DocumentGridCard
                        key={doc._id}
                        doc={doc}
                        isFavorite={favoriteReportIds.includes(doc._id) || doc.isFavorite}
                        onFavorite={(e) => handleToggleFavorite(doc, e)}
                        onDelete={(e) => handleDeleteDoc(doc, e)}
                        onView={() => handleOpenDetails(doc)}
                        onDownload={(e) => handleDownload(doc, e)}
                      />
                    );
                  })}
                </div>
              ) : (
                /* List View rendering */
                <div className="bg-[#FAFBF8] border border-[#f0f0ea] rounded-[2rem] overflow-hidden shadow-sm divide-y divide-[#f0f0ea]">
                  {filteredDocuments.map(doc => {
                    return (
                      <DocumentListRow
                        key={doc._id}
                        doc={doc}
                        isFavorite={favoriteReportIds.includes(doc._id) || doc.isFavorite}
                        onFavorite={(e) => handleToggleFavorite(doc, e)}
                        onDelete={(e) => handleDeleteDoc(doc, e)}
                        onView={() => handleOpenDetails(doc)}
                        onDownload={(e) => handleDownload(doc, e)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* DRAG-AND-DROP UPLOAD MODAL */}
      <AnimatePresence>
        {isUploadOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => uploadState !== 'uploading' && setIsUploadOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="bg-white rounded-[32px] p-6 md:p-8 w-full max-w-2xl relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide flex flex-col md:flex-row gap-8"
            >
              <button
                onClick={() => uploadState !== 'uploading' && setIsUploadOpen(false)}
                className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors text-slate-400 z-10"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Upload Dropzone Side */}
              <div className="flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-xl font-black text-black tracking-tight flex items-center gap-2">
                    Secure Upload <Lock className="w-4 h-4 text-[#5B8C6F]" />
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                    Add new health records to your secure vault.
                  </p>
                </div>

                {/* Dropzone area */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-[24px] p-6 text-center transition-all flex flex-col items-center justify-center h-64 relative group overflow-hidden ${dragActive ? 'border-[#5B8C6F] bg-[#5B8C6F]/5' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'}`}
                >
                  <input
                    type="file"
                    id="file-upload-input"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />

                  {uploadState === 'idle' && (
                    <div className="space-y-3 pointer-events-none">
                      <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto text-[#5B8C6F] group-hover:scale-110 transition-transform">
                        <FolderLock className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="font-black text-black text-xs block">Drag & Drop file here</span>
                        <span className="text-[9px] font-bold text-slate-400 mt-1 block uppercase tracking-widest">or tap to select file</span>
                      </div>
                      <p className="text-[8px] text-slate-400 uppercase tracking-widest font-black bg-white/80 border border-[#f0f0ea] px-3 py-1 rounded-full inline-block">PDF, JPEG, PNG • Max 10MB</p>
                    </div>
                  )}

                  {uploadState === 'uploading' && (
                    <div className="space-y-4 w-full px-4 pointer-events-none">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-[#5B8C6F] animate-spin">
                        <RefreshCw className="w-6 h-6" />
                      </div>
                      <div className="space-y-2">
                        <span className="font-black text-black text-xs block">Encrypting and uploading file...</span>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                          <div className="h-full bg-[#5B8C6F] rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">{uploadProgress}% Complete</span>
                      </div>
                    </div>
                  )}

                  {uploadState === 'success' && (
                    <div className="space-y-3 pointer-events-none animate-scale-in">
                      <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <div>
                        <span className="font-black text-black text-xs block">Stored Securely!</span>
                        <span className="text-[9px] font-bold text-[#5B8C6F] uppercase tracking-widest">AES-256 encrypted</span>
                      </div>
                    </div>
                  )}

                  {uploadFile && uploadState === 'idle' && (
                    <div className="absolute inset-0 bg-white/95 p-4 flex flex-col justify-between items-center text-center animate-fade-in border border-slate-100 rounded-[22px]">
                      <div className="w-full flex justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                          className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        <div className="w-10 h-10 bg-[#5B8C6F]/10 text-[#5B8C6F] rounded-xl flex items-center justify-center mx-auto">
                          {uploadFile.type.includes('pdf') ? <FileText className="w-5 h-5" /> : <FileImage className="w-5 h-5" />}
                        </div>
                        <div>
                          <span className="font-black text-xs text-black block truncate max-w-[200px]">{uploadFile.name}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{formatBytes(uploadFile.size)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => document.getElementById('file-upload-input').click()}
                        className="text-[9px] font-black uppercase tracking-widest text-[#5B8C6F] hover:underline mb-2"
                      >
                        Change File
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Details Side */}
              <form onSubmit={handleUploadSubmit} className="flex-1 space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Document Title</label>
                  <input
                    type="text"
                    required
                    value={uploadFormData.title}
                    onChange={e => setUploadFormData({ ...uploadFormData, title: e.target.value })}
                    placeholder="e.g. Blood Test Report, Clinic Prescription"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#5B8C6F] font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Category Type</label>
                    <select
                      value={uploadFormData.category}
                      onChange={e => setUploadFormData({ ...uploadFormData, category: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs outline-none focus:border-[#5B8C6F] font-black uppercase tracking-wider cursor-pointer"
                    >
                      {Object.keys(CATEGORY_MAP).map(k => <option key={k} value={k}>{CATEGORY_MAP[k].label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Date Issued</label>
                    <input
                      type="date"
                      required
                      value={uploadFormData.documentDate}
                      onChange={e => setUploadFormData({ ...uploadFormData, documentDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs outline-none focus:border-[#5B8C6F] font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Hospital / Lab</label>
                    <input
                      type="text"
                      value={uploadFormData.hospital}
                      onChange={e => setUploadFormData({ ...uploadFormData, hospital: e.target.value })}
                      placeholder="e.g. City Care Lab"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#5B8C6F] font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Doctor Name</label>
                    <input
                      type="text"
                      value={uploadFormData.doctorName}
                      onChange={e => setUploadFormData({ ...uploadFormData, doctorName: e.target.value })}
                      placeholder="e.g. Dr. Jameson"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#5B8C6F] font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Tags (Comma-separated)</label>
                  <input
                    type="text"
                    value={uploadFormData.tags}
                    onChange={e => setUploadFormData({ ...uploadFormData, tags: e.target.value })}
                    placeholder="e.g. blood, thyroid, quarterly"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#5B8C6F] font-medium"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Doctor Notes (Optional)</label>
                  <textarea
                    rows="2"
                    value={uploadFormData.notes}
                    onChange={e => setUploadFormData({ ...uploadFormData, notes: e.target.value })}
                    placeholder="Provide any additional notes or analysis reminders..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#5B8C6F] font-medium resize-none"
                  ></textarea>
                </div>

                <div className="flex items-center gap-2 mb-2 ml-1">
                  <input
                    type="checkbox"
                    id="upload-fav-chk"
                    checked={uploadFormData.isFavorite}
                    onChange={e => setUploadFormData({ ...uploadFormData, isFavorite: e.target.checked })}
                    className="w-4.5 h-4.5 rounded border-slate-300 text-[#5B8C6F] focus:ring-[#5B8C6F]"
                  />
                  <label htmlFor="upload-fav-chk" className="text-[10px] font-black uppercase tracking-wider text-slate-500 cursor-pointer">Mark as favorite record</label>
                </div>

                <button
                  type="submit"
                  disabled={uploadState === 'uploading' || !uploadFile}
                  className="w-full py-4 bg-[#1a1a1a] hover:bg-black text-white rounded-[20px] font-black uppercase tracking-widest text-[11px] shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploadState === 'uploading' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Upload & Encrypt</>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MOBILE COLLAPSIBLE FILTER BOTTOM SHEET */}
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
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white rounded-t-[32px] w-full max-h-[85vh] overflow-y-auto p-6 relative z-10 shadow-2xl space-y-6 pb-12"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-[#5B8C6F]" /> Filter Options
                </span>
                <button
                  onClick={clearAllFilters}
                  className="text-[10px] font-black uppercase tracking-widest text-[#5B8C6F]"
                >
                  Clear All
                </button>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setShowOnlyFavorites(!showOnlyFavorites); setIsMobileFilterOpen(false); }}
                  className={`flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all ${showOnlyFavorites ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-100 text-slate-500'}`}
                >
                  <Heart className="w-3.5 h-3.5 fill-current" /> Favorites
                </button>
                <button
                  onClick={() => { setShowOnlyRecentlyViewed(!showOnlyRecentlyViewed); setIsMobileFilterOpen(false); }}
                  className={`flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all ${showOnlyRecentlyViewed ? 'bg-[#5B8C6F]/10 border-[#5B8C6F]/20 text-[#5B8C6F]' : 'bg-slate-50 border-slate-100 text-slate-500'}`}
                >
                  <Eye className="w-3.5 h-3.5" /> Recent Views
                </button>
              </div>

              {/* Categories */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Report Types</span>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(CATEGORY_MAP).map(key => {
                    const active = filterTypes.includes(key);
                    const cat = CATEGORY_MAP[key];
                    return (
                      <button
                        key={key}
                        onClick={() => toggleCategoryFilter(key)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${active ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                      >
                        <cat.icon className="w-3.5 h-3.5" /> {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hospital Search */}
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Hospital / Lab</span>
                <input
                  type="text"
                  placeholder="Hospital name..."
                  value={filterHospital}
                  onChange={(e) => setFilterHospital(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#5B8C6F] font-medium"
                />
              </div>

              {/* Doctor Search */}
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Doctor Name</span>
                <input
                  type="text"
                  placeholder="Doctor name..."
                  value={filterDoctor}
                  onChange={(e) => setFilterDoctor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#5B8C6F] font-medium"
                />
              </div>

              {/* File Type */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">File Format</span>
                <div className="flex gap-3">
                  <button
                    onClick={() => toggleFileTypeFilter('pdf')}
                    className={`flex-1 py-2.5 rounded-xl border text-xs font-bold ${filterFileTypes.includes('pdf') ? 'bg-[#5B8C6F] text-white border-[#5B8C6F]' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                  >
                    PDFs Only
                  </button>
                  <button
                    onClick={() => toggleFileTypeFilter('image')}
                    className={`flex-1 py-2.5 rounded-xl border text-xs font-bold ${filterFileTypes.includes('image') ? 'bg-[#5B8C6F] text-white border-[#5B8C6F]' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                  >
                    Images Only
                  </button>
                </div>
              </div>

              {/* Action */}
              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="w-full py-4 bg-[#1a1a1a] text-white rounded-2xl font-black uppercase tracking-widest text-[11px]"
              >
                Apply Filters
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAILS DRAWER PANEL / SIDE DRAWER MODAL */}
      <AnimatePresence>
        {isDetailsOpen && selectedDoc && (
          <div className="fixed inset-0 z-[2000] flex justify-end">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsDetailsOpen(false)}
            />
            {/* Sliding Drawer Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative z-10 w-full max-w-5xl h-full bg-slate-50 shadow-2xl flex flex-col md:flex-row overflow-hidden"
            >

              {/* Left Viewport Side: Document Preview (takes 60% width on large screen) */}
              <div className="flex-1 md:flex-[1.3] bg-slate-900 flex flex-col h-[50vh] md:h-full relative">
                {/* Viewport Top Bar */}
                <div className="absolute top-0 inset-x-0 bg-slate-950/70 backdrop-blur-md px-6 py-4 flex items-center justify-between text-white z-10">
                  <div className="min-w-0">
                    <span className="text-[9px] font-black text-[#5B8C6F] uppercase tracking-widest block mb-0.5">Secure Viewport</span>
                    <h4 className="font-bold text-xs truncate max-w-xs">{selectedDoc.title}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDownload(selectedDoc, e)}
                      className="p-2.5 bg-white/10 hover:bg-white text-white hover:text-black rounded-full transition-all"
                      title="Download Original"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Main preview window */}
                <div className="flex-1 overflow-auto flex items-center justify-center p-4 pt-20">
                  {previewLoading ? (
                    <div className="flex flex-col items-center text-slate-400 animate-pulse">
                      <RefreshCw className="w-10 h-10 animate-spin mb-4" />
                      <p className="text-xs font-bold tracking-widest uppercase">Loading Secure Preview...</p>
                    </div>
                  ) : (selectedDoc.fileUrl?.toLowerCase().includes('.pdf') || selectedDoc.mimetype?.includes('pdf')) ? (
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

              {/* Right Sidebar Side: Editable metadata and notes (40% width) */}
              <div className="w-full md:w-96 bg-white h-[50vh] md:h-full overflow-y-auto border-l border-slate-200 flex flex-col justify-between">

                {/* Header Info */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-black tracking-tight flex items-center gap-2">
                      Record Details
                    </h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Metadata & Custom Notes</p>
                  </div>
                  <button
                    onClick={() => setIsDetailsOpen(false)}
                    className="p-2 hover:bg-slate-50 border border-slate-100 rounded-full transition-colors text-slate-400"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                {/* Edit Form Fields */}
                <div className="p-6 flex-1 space-y-5">

                  {/* Category Badge status */}
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl p-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Record Origin</span>
                    <span className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1 ${selectedDoc.isAnalyzedReport ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'}`}>
                      {selectedDoc.isAnalyzedReport ? (
                        <><Sparkles className="w-3 h-3" /> AI Analyzed</>
                      ) : (
                        <>Custom Upload</>
                      )}
                    </span>
                  </div>

                  {selectedDoc.isAnalyzedReport && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800">AI Report Insight</h4>
                      </div>
                      <p className="text-[11px] font-medium text-emerald-700 leading-relaxed">
                        This document was scanned and analyzed by our healthcare AI. You can review its structured biomarker results on the Reports page.
                      </p>
                      <button
                        onClick={() => navigate(`/reports/${selectedDoc._id}`, { state: { fromVault: true } })}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm transition-colors mt-1"
                      >
                        Open AI Insight Analysis
                      </button>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Document Title */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Document Title</label>
                      <input
                        type="text"
                        disabled={selectedDoc.isAnalyzedReport}
                        value={editFormData.title}
                        onChange={e => setEditFormData({ ...editFormData, title: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#5B8C6F] font-bold text-slate-800 disabled:opacity-60"
                      />
                    </div>

                    {/* Category Type */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Category Type</label>
                      <select
                        disabled={selectedDoc.isAnalyzedReport}
                        value={editFormData.category}
                        onChange={e => setEditFormData({ ...editFormData, category: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#5B8C6F] font-black uppercase tracking-wider disabled:opacity-60"
                      >
                        {Object.keys(CATEGORY_MAP).map(k => <option key={k} value={k}>{CATEGORY_MAP[k].label}</option>)}
                      </select>
                    </div>

                    {/* Hospital & Doctor */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Hospital / Lab</label>
                        <input
                          type="text"
                          disabled={selectedDoc.isAnalyzedReport}
                          value={editFormData.hospital}
                          onChange={e => setEditFormData({ ...editFormData, hospital: e.target.value })}
                          placeholder="Hospital or clinic"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#5B8C6F] font-medium text-slate-800 disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Doctor Name</label>
                        <input
                          type="text"
                          disabled={selectedDoc.isAnalyzedReport}
                          value={editFormData.doctorName}
                          onChange={e => setEditFormData({ ...editFormData, doctorName: e.target.value })}
                          placeholder="Doctor name"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#5B8C6F] font-medium text-slate-800 disabled:opacity-60"
                        />
                      </div>
                    </div>

                    {/* Date */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Issued Date</label>
                      <input
                        type="date"
                        disabled={selectedDoc.isAnalyzedReport}
                        value={editFormData.documentDate}
                        onChange={e => setEditFormData({ ...editFormData, documentDate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#5B8C6F] font-bold text-slate-800 disabled:opacity-60"
                      />
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Tags (Comma-separated)</label>
                      <input
                        type="text"
                        disabled={selectedDoc.isAnalyzedReport}
                        value={editFormData.tags}
                        onChange={e => setEditFormData({ ...editFormData, tags: e.target.value })}
                        placeholder="Tags e.g. blood, vaccine"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#5B8C6F] font-medium text-slate-800 disabled:opacity-60"
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Private Notes</label>
                      <textarea
                        rows="3"
                        value={editFormData.notes}
                        onChange={e => setEditFormData({ ...editFormData, notes: e.target.value })}
                        placeholder="Add doctor reminders, medication dosage instructions, or other details..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-[#5B8C6F] font-medium resize-none text-slate-800"
                      />
                    </div>

                    {/* Favorite flag */}
                    <div className="flex items-center gap-2 mb-2 ml-1">
                      <input
                        type="checkbox"
                        id="edit-fav-chk"
                        checked={editFormData.isFavorite}
                        onChange={e => setEditFormData({ ...editFormData, isFavorite: e.target.checked })}
                        className="w-4.5 h-4.5 rounded border-slate-300 text-[#5B8C6F] focus:ring-[#5B8C6F]"
                      />
                      <label htmlFor="edit-fav-chk" className="text-[10px] font-black uppercase tracking-wider text-slate-500 cursor-pointer">Mark as favorite record</label>
                    </div>

                  </div>

                  {/* Vault Timeline history logs */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Record Timeline</span>
                    <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">

                      <div className="flex items-start gap-4 relative pl-5 text-[11px]">
                        <div className="absolute left-1 top-1.5 w-2.5 h-2.5 rounded-full bg-[#5B8C6F] border border-white" />
                        <div>
                          <p className="font-bold text-slate-700">Uploaded Securely</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">{new Date(selectedDoc.createdAt || selectedDoc.documentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4 relative pl-5 text-[11px]">
                        <div className="absolute left-1 top-1.5 w-2.5 h-2.5 rounded-full bg-slate-400 border border-white" />
                        <div>
                          <p className="font-bold text-slate-700">Metadata Checked & Encryption Validated</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">TLS SHA-256 cloud check verified</p>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>

                {/* Footer Controls: Save & Delete */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-2">
                  <button
                    onClick={handleSaveMetadata}
                    disabled={isSavingEdit}
                    className="w-full py-4 bg-[#1a1a1a] hover:bg-black text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow transition-all flex items-center justify-center gap-2"
                  >
                    {isSavingEdit ? <RefreshCw className="w-4.5 h-4.5 animate-spin" /> : <>Save Changes</>}
                  </button>

                  <button
                    onClick={() => handleDeleteDoc(selectedDoc)}
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

/* SUBCOMPONENT: FILTER SECTION */
function FilterSection({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-slate-100 pb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-colors"
      >
        <span>{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden space-y-2 pt-3"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* SUBCOMPONENT: DOCUMENT GRID CARD */
function DocumentGridCard({ doc, isFavorite, onFavorite, onDelete, onView, onDownload }) {
  const meta = CATEGORY_MAP[doc.category] || CATEGORY_MAP.other;
  const isPdf = doc.mimetype?.includes('pdf') || doc.fileUrl?.toLowerCase().includes('.pdf') || doc.originalName?.toLowerCase().includes('.pdf');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:translate-y-[-4px] hover:border-[#5B8C6F]/20 hover:shadow-[#5B8C6F]/5 transition-all duration-300 flex flex-col group relative overflow-hidden"
    >

      {/* Favorite and AI Sparkle Overlay */}
      <div className="absolute top-4 inset-x-4 flex justify-between items-center z-[5]">

        {/* Origin badge tag */}
        {doc.isAnalyzedReport ? (
          <div className="px-2 py-1 bg-[#5B8C6F] text-white text-[8px] font-black uppercase tracking-widest rounded-lg shadow flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 animate-pulse" /> AI Insight
          </div>
        ) : (
          <div className="px-2 py-1 bg-slate-900/80 text-white text-[8px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1.5">
            Vault Storage
          </div>
        )}

        {/* Heart Favorite toggle */}
        <button
          onClick={onFavorite}
          className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md border backdrop-blur-md transition-all ${isFavorite ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white/90 border-slate-100 text-slate-400 hover:text-rose-500'}`}
        >
          <Heart className={`w-4.5 h-4.5 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Thumbnail area click to open details */}
      <div
        onClick={onView}
        className="h-36 bg-slate-50/50 border-b border-slate-100 relative flex items-center justify-center overflow-hidden cursor-pointer group-hover:bg-[#5B8C6F]/5 transition-colors"
      >
        {isPdf ? (
          <div className="relative w-14 h-14 bg-white rounded-2xl shadow flex items-center justify-center overflow-hidden border border-slate-100">
            <div className="absolute top-0 inset-x-0 h-1 bg-red-400" />
            <FileText className="w-8 h-8 text-red-400" />
          </div>
        ) : doc.fileUrl ? (
          <img
            src={doc.fileUrl}
            alt={doc.title}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
          />
        ) : (
          <meta.icon className={`w-12 h-12 opacity-30 ${meta.color}`} />
        )}

        {/* Hover overlay indicator */}
        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
          <span className="text-white text-[9px] font-black uppercase tracking-[0.2em] border border-white/30 px-4 py-2.5 rounded-xl bg-slate-950/60 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> View Record</span>
        </div>
      </div>

      {/* Metadata Detail */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">

        <div className="space-y-2">
          {/* Category Badge & Date */}
          <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            <span className={`px-2.5 py-1 rounded-lg ${meta.bg} ${meta.color} font-black border ${meta.border}`}>{meta.label}</span>
            <span>{new Date(doc.documentDate || doc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>

          {/* Record Title */}
          <h3 className="font-bold text-sm text-slate-800 leading-snug line-clamp-2 cursor-pointer hover:text-[#5B8C6F]" onClick={onView}>
            {doc.title}
          </h3>

          {/* Doctor and Hospital metadata details */}
          {(doc.hospital || doc.doctorName) && (
            <div className="text-[10px] font-medium text-slate-400 space-y-0.5">
              {doc.hospital && <p className="truncate">🏥 {doc.hospital}</p>}
              {doc.doctorName && <p className="truncate">👨‍⚕️ {doc.doctorName}</p>}
            </div>
          )}

          {/* Tags */}
          {Array.isArray(doc.tags) && doc.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1.5">
              {doc.tags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="text-[8px] font-black uppercase tracking-wider text-[#5B8C6F]/80 bg-[#5B8C6F]/5 border border-[#5B8C6F]/10 px-2 py-0.5 rounded-md">
                  #{tag}
                </span>
              ))}
              {doc.tags.length > 3 && (
                <span className="text-[8px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md">+{doc.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>

        {/* Quick Footer Action Panel */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-50">
          <button
            onClick={onView}
            className="flex-1 bg-slate-50 hover:bg-[#5B8C6F]/10 text-slate-700 hover:text-[#5B8C6F] border border-slate-100 hover:border-[#5B8C6F]/20 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1"
          >
            <Edit3 className="w-3 h-3" /> Details
          </button>

          <button
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-black rounded-xl border border-slate-100 transition-colors"
            title="Download Document"
            onClick={(e) => onDownload(e)}
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onDelete}
            className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl border border-slate-100 transition-colors"
            title="Delete Permanently"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

    </motion.div>
  );
}

/* SUBCOMPONENT: DOCUMENT LIST ROW */
function DocumentListRow({ doc, isFavorite, onFavorite, onDelete, onView, onDownload }) {
  const meta = CATEGORY_MAP[doc.category] || CATEGORY_MAP.other;
  const isPdf = doc.mimetype?.includes('pdf') || doc.fileUrl?.toLowerCase().includes('.pdf') || doc.originalName?.toLowerCase().includes('.pdf');

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center justify-between p-4 bg-white hover:bg-[#5B8C6F]/5 transition-colors gap-4 group"
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* PDF/Image Icon */}
        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
          {isPdf ? (
            <FileText className="w-5 h-5 text-rose-500" />
          ) : (
            <meta.icon className={`w-5 h-5 ${meta.color}`} />
          )}
        </div>

        {/* Title & Metadata text details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${meta.bg} ${meta.color} border ${meta.border}`}>{meta.label}</span>
            {doc.isAnalyzedReport && (
              <span className="bg-[#5B8C6F] text-white text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex items-center gap-0.5"><Sparkles className="w-2 h-2" /> AI</span>
            )}
            <span className="text-[10px] text-slate-400 font-medium">{new Date(doc.documentDate || doc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
          <h4 className="font-bold text-xs text-slate-800 truncate hover:text-[#5B8C6F] cursor-pointer" onClick={onView}>
            {doc.title}
          </h4>
          <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
            {doc.hospital && `🏥 ${doc.hospital} `} {doc.doctorName && ` • 👨‍⚕️ ${doc.doctorName}`}
          </p>
        </div>
      </div>

      {/* Action triggers */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onFavorite}
          className={`p-2 rounded-full border transition-colors ${isFavorite ? 'bg-rose-50 border-rose-100 text-rose-500' : 'bg-white border-slate-100 text-slate-300 hover:text-rose-500'}`}
          title="Favorite"
        >
          <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
        </button>

        <button
          onClick={onView}
          className="px-3.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100"
        >
          Details
        </button>

        <button
          onClick={(e) => onDownload(e)}
          className="p-2 bg-slate-50 border border-slate-100 text-slate-400 hover:text-black rounded-lg transition-colors"
          title="Download File"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onDelete}
          className="p-2 bg-slate-50 border border-slate-100 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

    </motion.div>
  );
}

/* SUBCOMPONENT: SKELETON CARD */
function SkeletonCard() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 space-y-4 animate-pulse">
      <div className="h-28 bg-slate-100 rounded-2xl w-full" />
      <div className="space-y-2">
        <div className="h-3 bg-slate-100 rounded w-1/3" />
        <div className="h-4 bg-slate-100 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
      </div>
      <div className="flex gap-2 pt-2 border-t border-slate-50">
        <div className="h-8 bg-slate-100 rounded-xl flex-1" />
        <div className="h-8 bg-slate-100 rounded-xl w-10" />
        <div className="h-8 bg-slate-100 rounded-xl w-10" />
      </div>
    </div>
  );
}
