import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { healthService } from '../services/api';
import {
  Upload, FileText, X, Loader2, CheckCircle, Shield,
  Cloud, ChevronDown, Trash2, ArrowLeft, Info, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';

const reportTypes = [
  { value: 'Blood Test', label: 'Blood Test', icon: '🩸' },
  { value: 'X-Ray', label: 'X-Ray', icon: '🦴' },
  { value: 'MRI', label: 'MRI', icon: '🧠' },
  { value: 'CT Scan', label: 'CT Scan', icon: '💿' },
  { value: 'ECG', label: 'ECG', icon: '❤️' },
  { value: 'Ultrasound', label: 'Ultrasound', icon: '🌊' },
  { value: 'General Checkup', label: 'General Checkup', icon: '📋' },
  { value: 'Other', label: 'Other', icon: '📁' }
];

export default function UploadReport() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const navigate = useNavigate();

  const onDrop = useCallback((acceptedFiles) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      reportType: 'Blood Test',
      name: file.name,
      size: file.size
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg'] },
    maxSize: 10 * 1024 * 1024
  });

  const updateFileType = (id, reportType) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, reportType } : f));
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 5;
      });
    }, 300);

    try {
      const formData = new FormData();
      formData.append('report', files[0].file);
      formData.append('reportType', files[0].reportType);

      const { data } = await healthService.uploadReport(formData);
      clearInterval(progressInterval);
      setUploadProgress(100);
      toast.success('Report analyzed successfully!');
      setTimeout(() => navigate(`/reports/${data.report._id}`), 500);
    } catch (error) {
      clearInterval(progressInterval);
      toast.error(error.response?.data?.message || 'Failed to analyze report');
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 sm:px-6">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-400/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-2xl relative">
        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-10 space-y-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-100/50 rounded-full border border-blue-200">
            <Lock className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[10px] font-black tracking-widest text-blue-700 uppercase">HIPAA Secure Portal</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">
            Analyze Medical <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">Reports</span>
          </h1>
          <p className="text-slate-500 max-w-md font-medium">
            Upload your documents for instant AI-powered health insights and personalized recommendations.
          </p>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden transition-all">
          <div className="p-8 sm:p-12">
            {/* Drop Zone */}
            {!loading && files.length === 0 ? (
              <div
                {...getRootProps()}
                className={`relative group border-4 border-dashed rounded-[2rem] p-10 text-center cursor-pointer transition-all duration-500 ${isDragActive
                  ? 'border-blue-500 bg-blue-50/50 scale-[1.02]'
                  : 'border-slate-100 hover:border-blue-300 bg-slate-50/50'
                  }`}
              >
                <input {...getInputProps()} />
                <div className="w-20 h-20 rounded-3xl bg-white shadow-xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
                  <Upload className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  {isDragActive ? 'Drop your report here' : 'Drop report or click to browse'}
                </h3>
                <p className="text-slate-500 font-medium mb-6 text-sm">PDF, PNG, or JPG (Max 10MB)</p>
                <div className="flex items-center justify-center gap-4">
                  {['PDF', 'PNG', 'JPG'].map((ext) => (
                    <span key={ext} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-400">
                      {ext}
                    </span>
                  ))}
                </div>
              </div>
            ) : files.length > 0 && !loading ? (
              <div className="space-y-6">
                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                  {files.map((file) => (
                    <div key={file.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center flex-shrink-0">
                          <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 truncate text-base">{file.name}</p>
                          <p className="text-xs font-bold text-slate-400 uppercase">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>

                      <div className="w-full sm:w-auto flex items-center gap-2">
                        <div className="relative flex-1 sm:w-48">
                          <select
                            value={file.reportType}
                            onChange={(e) => updateFileType(file.id, e.target.value)}
                            className="w-full appearance-none bg-white text-slate-800 text-sm font-bold pl-4 pr-10 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-none cursor-pointer"
                          >
                            {reportTypes.map((type) => (
                              <option key={type.value} value={type.value}>{type.icon} {type.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                        <button
                          onClick={() => removeFile(file.id)}
                          className="p-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition-all flex-shrink-0"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setFiles([])}
                    className="px-6 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    className="flex-1 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                  >
                    <CheckCircle className="w-5 h-5 text-blue-400" />
                    Analyze Report
                  </button>
                </div>
              </div>
            ) : (
              /* Analysis State */
              <div className="space-y-10 py-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-slate-100 border-t-blue-500 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-blue-500 animate-pulse" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">Analyzing Report</h3>
                    <p className="text-slate-500 font-medium">Extracting health markers and findings...</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-500"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs font-black text-slate-400 uppercase tracking-widest">
                    <span>Processing Data</span>
                    <span>{uploadProgress}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                    <Shield className="w-5 h-5 text-blue-500" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Secure Scan</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                    <Lock className="w-5 h-5 text-blue-500" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">HIPAA Compliant</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 rounded-3xl p-6 border border-blue-100 flex gap-4">
          <Info className="w-6 h-6 text-blue-500 flex-shrink-0" />
          <p className="text-sm text-blue-700 leading-relaxed font-medium">
            Our AI analysis provides deep insights but is for educational purposes only. Always consult with a healthcare professional before making medical decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
