import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Trash2, X, FileImage, ShieldCheck, Download, ExternalLink, Calendar, Stethoscope, Pill, Syringe, Activity, FileSpreadsheet, Sparkles, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const CATEGORY_MAP = {
  prescription: { label: 'Prescriptions', icon: Pill, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  lab_report: { label: 'Lab Insights', icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  scan: { label: 'Scans & Imaging', icon: FileImage, color: 'text-purple-500', bg: 'bg-purple-50' },
  discharge_summary: { label: 'Discharge Summaries', icon: Stethoscope, color: 'text-blue-500', bg: 'bg-blue-50' },
  vaccination: { label: 'Vaccinations', icon: Syringe, color: 'text-amber-500', bg: 'bg-amber-50' },
  insurance: { label: 'Insurance & ID', icon: ShieldCheck, color: 'text-rose-500', bg: 'bg-rose-50' },
  other: { label: 'Other Docs', icon: FileSpreadsheet, color: 'text-slate-500', bg: 'bg-slate-50' }
};

export default function MedicalRecords() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  
  // Preview State
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  // Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    category: 'prescription',
    documentDate: new Date().toISOString().split('T')[0],
    notes: '',
    file: null
  });

  useEffect(() => {
    fetchDocuments();
  }, [activeCategory]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/documents', {
        params: {
          category: activeCategory,
          search: search || undefined
        }
      });
      setDocuments(data.documents || []);
    } catch (error) {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDocuments();
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!formData.file) return toast.error('Please select a file');
    if (!formData.title) return toast.error('Title is required');

    setUploading(true);
    try {
      const data = new FormData();
      data.append('document', formData.file);
      data.append('title', formData.title);
      data.append('category', formData.category);
      data.append('documentDate', formData.documentDate);
      data.append('notes', formData.notes);

      await api.post('/documents', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Document saved to records');
      setIsUploadOpen(false);
      setFormData({ title: '', category: 'prescription', documentDate: new Date().toISOString().split('T')[0], notes: '', file: null });
      fetchDocuments();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm('Remove this document from your records?')) return;
    try {
      if (doc.isAnalyzedReport) {
        await api.delete(`/health/reports/${doc._id}`);
      } else {
        await api.delete(`/documents/${doc._id}`);
      }
      toast.success('Document deleted');
      fetchDocuments();
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  // Grouping documents if activeCategory is 'all'
  const groupedDocs = documents.reduce((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = [];
    acc[doc.category].push(doc);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Floating Add Button */}
      <button
        onClick={() => setIsUploadOpen(true)}
        className="fixed bottom-24 md:bottom-10 right-6 z-[200] w-14 h-14 bg-[#0F172A] text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(15,23,42,0.4)] hover:bg-slate-800 hover:scale-110 active:scale-95 transition-all border border-white/20"
        title="Add Document"
      >
        <Plus className="w-8 h-8" strokeWidth={2.5} />
      </button>

      <div className="max-w-[1200px] mx-auto px-4 md:px-6 pt-4 space-y-6">
        
        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto py-3 scrollbar-hide w-full border-b border-slate-100 bg-[#F8FAFC]/80 backdrop-blur-md sticky top-0 z-40">
          {['all', ...Object.keys(CATEGORY_MAP)].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${activeCategory === cat ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
            >
              {cat === 'all' ? 'All Records' : CATEGORY_MAP[cat].label}
            </button>
          ))}
        </div>

        {/* Documents Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Opening Records...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-white rounded-[32px] p-12 text-center border border-slate-100">
            <div className="w-20 h-20 bg-slate-50 rounded-3xl mx-auto flex items-center justify-center mb-6">
              <ShieldCheck className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">No Documents Found</h3>
            <p className="text-slate-500 max-w-sm mx-auto mb-8">Store your important physical papers digitally to carry them securely wherever you travel.</p>
            <button onClick={() => setIsUploadOpen(true)} className="px-6 py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-colors">
              Upload Your First Record
            </button>
          </div>
        ) : (
          <div className="space-y-12">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {documents.map(doc => (
                  <DocumentCard 
                    key={doc._id} 
                    doc={doc} 
                    onDelete={() => handleDelete(doc)} 
                    onPreview={(d) => { setSelectedDoc(d); setIsPreviewOpen(true); }}
                  />
                ))}
              </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4 md:px-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !uploading && setIsUploadOpen(false)} />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="bg-white rounded-[32px] p-6 md:p-8 w-full max-w-md relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide"
            >
              <button onClick={() => !uploading && setIsUploadOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                <X className="w-5 h-5" />
              </button>
              
              <div className="mb-6">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Upload Record</h3>
                <p className="text-xs font-medium text-slate-500 mt-1">Digitize your health records securely.</p>
              </div>

              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 ml-1">Title</label>
                  <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g., Blood Test Result" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 font-medium transition-all" />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 ml-1">Category</label>
                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100 font-medium transition-all">
                      {Object.keys(CATEGORY_MAP).map(k => <option key={k} value={k}>{CATEGORY_MAP[k].label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 ml-1">Date</label>
                    <input type="date" required value={formData.documentDate} onChange={e => setFormData({...formData, documentDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100 font-medium transition-all" />
                  </div>
                </div>

                <div>
                   <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 ml-1">File (PDF / Image)</label>
                   <div className="relative border-2 border-dashed border-slate-200 rounded-[24px] bg-slate-50 hover:bg-slate-100/50 transition-colors overflow-hidden group">
                      <input type="file" required accept="image/*,.pdf" onChange={e => setFormData({...formData, file: e.target.files[0]})} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <div className="py-5 px-4 text-center pointer-events-none">
                        <FileText className="w-6 h-6 text-indigo-300 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                        <span className="font-bold text-slate-600 text-[11px] block truncate px-2">{formData.file ? formData.file.name : 'Tap to select'}</span>
                        {!formData.file && <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-widest font-bold">JPEG, PNG, or PDF</p>}
                      </div>
                   </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 ml-1">Notes (Optional)</label>
                  <textarea rows="1" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Any details..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100 font-medium resize-none transition-all"></textarea>
                </div>

                <button type="submit" disabled={uploading} className="w-full py-3.5 mt-2 bg-[#0F172A] text-white rounded-2xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70 flex items-center justify-center gap-2 mb-2">
                  {uploading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Save Record"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {isPreviewOpen && selectedDoc && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-0 md:p-10">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setIsPreviewOpen(false)} />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative z-10 w-full h-full max-w-6xl md:max-h-[90vh] bg-transparent flex flex-col"
            >
              {/* Top Controls Bar */}
              <div className="bg-black/80 backdrop-blur-md px-6 py-4 text-white border-b border-white/10 rounded-t-[32px]">
                 <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <button 
                        onClick={() => setIsPreviewOpen(false)}
                        className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all shrink-0"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm truncate">{selectedDoc.title}</h4>
                        <p className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">
                          {CATEGORY_MAP[selectedDoc.category]?.label || 'Record'} • {new Date(selectedDoc.documentDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a 
                        href={selectedDoc.fileUrl} 
                        download 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="w-10 h-10 bg-white/10 hover:bg-white text-white hover:text-black rounded-full flex items-center justify-center transition-all"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                 </div>
              </div>

              <div className="flex-1 overflow-auto flex items-center justify-center p-4">
                {selectedDoc.fileUrl?.toLowerCase().includes('.pdf') || selectedDoc.mimetype?.includes('pdf') ? (
                  <iframe 
                    src={selectedDoc.fileUrl} 
                    className="w-full h-full rounded-b-2xl bg-white border-0 shadow-2xl"
                    title={selectedDoc.title}
                  />
                ) : (
                  <img 
                    src={selectedDoc.fileUrl} 
                    alt={selectedDoc.title} 
                    className="max-h-full max-w-full object-contain shadow-2xl" 
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

function DocumentCard({ doc, onDelete, onPreview }) {
  const navigate = useNavigate();
  const meta = CATEGORY_MAP[doc.category] || CATEGORY_MAP.other;
  const isPDF = doc.mimetype?.toLowerCase().includes('pdf') || 
                doc.originalName?.toLowerCase().includes('.pdf') || 
                doc.fileUrl?.toLowerCase().includes('.pdf');

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-[24px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden flex flex-col relative"
    >
      {/* Analyzed Badge */}
      {doc.isAnalyzedReport && (
        <div className="absolute top-3 left-3 z-[5] px-2 py-1 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest rounded-lg shadow-lg flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> AI Analyzed
        </div>
      )}

      {/* Thumbnail area - Link to preview */}
      <div 
        onClick={() => onPreview(doc)}
        className="h-32 bg-slate-50 relative border-b border-slate-100 flex items-center justify-center overflow-hidden cursor-pointer"
      >
        {isPDF ? (
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center overflow-hidden">
             <div className="absolute top-0 inset-x-0 h-1 bg-rose-400" />
             <FileText className="w-8 h-8 text-rose-400" />
          </div>
        ) : doc.fileUrl ? (
          <img src={doc.fileUrl} alt={doc.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
        ) : (
          <meta.icon className={`w-12 h-12 opacity-20 ${meta.color}`} />
        )}
        
        {/* Hover Hint */}
        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
           <p className="text-white text-[10px] font-black uppercase tracking-[0.2em] border border-white/30 px-4 py-2 rounded-full">Preview Record</p>
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-slate-800 leading-tight line-clamp-2">{doc.title}</h3>
        </div>
        
        <div className="flex items-center gap-2 mt-auto pt-4">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-md">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{new Date(doc.documentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
        
        {doc.isAnalyzedReport ? (
           <div className="mt-4 flex gap-2">
              <button 
                onClick={() => navigate(`/reports/${doc._id}`, { state: { fromVault: true } })}
                className="flex-1 bg-emerald-50 text-emerald-600 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors"
              >
                View Insight
              </button>
              <button 
                onClick={() => onDelete(doc._id)} 
                className="p-2 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-xl"
              >
                <Trash2 className="w-4 h-4" />
              </button>
           </div>
        ) : (
           <div className="mt-4 flex gap-2">
              <button 
                onClick={() => onPreview(doc)}
                className="flex-1 bg-indigo-50 text-indigo-600 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors"
              >
                View File
              </button>
              <button 
                onClick={() => onDelete(doc._id)} 
                className="p-2 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-xl"
              >
                <Trash2 className="w-4 h-4" />
              </button>
           </div>
        )}
      </div>
    </motion.div>
  );
}
