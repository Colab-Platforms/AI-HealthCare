import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { healthService } from '../services/api';
import { Upload, FileText, X, Loader, CheckCircle, Shield, Cloud, ChevronDown, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const reportTypes = [
  { value: 'Blood Test', label: 'Blood Test' },
  { value: 'X-Ray', label: 'X-Ray' },
  { value: 'MRI', label: 'MRI' },
  { value: 'CT Scan', label: 'CT Scan' },
  { value: 'ECG', label: 'ECG' },
  { value: 'Ultrasound', label: 'Ultrasound' },
  { value: 'General Checkup', label: 'General Checkup' },
  { value: 'Other', label: 'Other' }
];

export default function UploadReport() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const navigate = useNavigate();

  // Scroll to top on mount
  useState(() => {
    window.scrollTo(0, 0);
  }, []);

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
        return prev + 10;
      });
    }, 500);

    try {
      // Upload first file (can be extended for multiple)
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
    <div className="space-y-3 sm:space-y-6 animate-fade-in p-4 max-w-4xl mx-auto">
      {/* Header - Compact on mobile */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Upload Medical Reports</h1>
        <p className="text-slate-500 mt-1 text-xs sm:text-sm">Upload your medical documents for AI-powered analysis</p>
      </div>

      {/* Drop Zone - Compact on mobile */}
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-12 text-center cursor-pointer transition-all ${
          isDragActive 
            ? 'border-cyan-500 bg-cyan-50' 
            : 'border-slate-300 hover:border-cyan-400 bg-white'
        }`}
      >
        <input {...getInputProps()} />
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-cyan-100 flex items-center justify-center mx-auto mb-3 sm:mb-4">
          <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-600" />
        </div>
        <p className="text-base sm:text-lg font-semibold text-slate-800 mb-1 sm:mb-2">
          {isDragActive ? 'Drop files here' : 'Tap to upload'}
        </p>
        <p className="text-slate-500 mb-3 sm:mb-4 text-xs sm:text-sm">PDF, PNG, JPG • Max 10MB</p>
        <div className="flex items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-600">
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500" /> PDF
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500" /> PNG
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500" /> JPG
          </span>
        </div>
      </div>

      {/* File List - Compact on mobile */}
      {files.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-3 sm:p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800 text-sm sm:text-base">Files ({files.length})</h3>
          </div>
          <div className="divide-y divide-slate-200 max-h-[200px] overflow-y-auto">
            {files.map((file) => (
              <div key={file.id} className="p-3 sm:p-4 flex items-center gap-2 sm:gap-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-cyan-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate text-xs sm:text-sm">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <div className="relative flex-shrink-0">
                  <select
                    value={file.reportType}
                    onChange={(e) => updateFileType(file.id, e.target.value)}
                    className="appearance-none bg-white text-slate-800 text-xs sm:text-sm px-2 py-1 sm:px-4 sm:py-2 pr-6 sm:pr-8 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none cursor-pointer"
                  >
                    {reportTypes.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-slate-400 pointer-events-none" />
                </div>
                <button
                  onClick={() => removeFile(file.id)}
                  className="p-1.5 sm:p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress Bar - Compact on mobile */}
      {loading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
              <Loader className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600 animate-spin" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm sm:text-base">Analyzing...</p>
              <p className="text-xs sm:text-sm text-slate-500">AI is extracting insights</p>
            </div>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 text-right">{uploadProgress}%</p>
        </div>
      )}

      {/* Submit Button - Compact on mobile */}
      <button
        onClick={handleSubmit}
        disabled={loading || files.length === 0}
        className="w-full py-3 sm:py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
      >
        {loading ? (
          <>
            <Loader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
            Upload & Analyze
          </>
        )}
      </button>

      {/* Security Info - Compact on mobile */}
      <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-slate-500 pt-2">
        <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
        <span>Encrypted & HIPAA Compliant</span>
      </div>
    </div>
  );
}
