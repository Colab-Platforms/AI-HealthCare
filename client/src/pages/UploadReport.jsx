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

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const usedStorage = (totalSize / (1024 * 1024)).toFixed(1);
  const maxStorage = 100; // MB

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Upload Medical Reports</h1>
        <p className="text-slate-500 mt-1">Upload your medical documents for AI-powered analysis</p>
      </div>

      {/* How It Works Banner */}
      <div className="relative rounded-2xl overflow-hidden shadow-lg bg-gradient-to-r from-cyan-500 to-blue-500 p-6 sm:p-8">
        <div className="text-white max-w-2xl">
          <h2 className="text-xl sm:text-2xl font-bold mb-2">How It Works</h2>
          <p className="text-white/90 text-sm">Upload your medical reports and get instant AI-powered analysis with personalized health insights</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Upload Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Drop Zone */}
          <div
            {...getRootProps()}
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              isDragActive 
                ? 'border-cyan-500 bg-cyan-50' 
                : 'border-slate-300 hover:border-cyan-400 bg-white'
            }`}
          >
            <input {...getInputProps()} />
            <div className="w-16 h-16 rounded-2xl bg-cyan-100 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-cyan-600" />
            </div>
            <p className="text-lg font-semibold text-slate-800 mb-2">
              {isDragActive ? 'Drop your files here' : 'Drag & drop files here'}
            </p>
            <p className="text-slate-500 mb-4">or click to browse from your device</p>
            <div className="flex items-center justify-center gap-4 text-sm text-slate-600">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-emerald-500" /> PDF
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-emerald-500" /> PNG
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-emerald-500" /> JPG
              </span>
              <span>Max 10MB per file</span>
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800">Uploaded Files ({files.length})</h3>
              </div>
              <div className="divide-y divide-slate-200">
                {files.map((file) => (
                  <div key={file.id} className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{file.name}</p>
                      <p className="text-sm text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <div className="relative">
                      <select
                        value={file.reportType}
                        onChange={(e) => updateFileType(file.id, e.target.value)}
                        className="appearance-none bg-white text-slate-800 text-sm px-4 py-2 pr-8 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none cursor-pointer"
                      >
                        {reportTypes.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {loading && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                  <Loader className="w-5 h-5 text-cyan-600 animate-spin" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Analyzing your report...</p>
                  <p className="text-sm text-slate-500">AI is extracting health insights</p>
                </div>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-slate-500 mt-2 text-right">{uploadProgress}%</p>
            </div>
          )}

          {/* Report Analysis Preview */}
          <div className="relative rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-purple-500 to-pink-500 p-6">
            <div className="text-white">
              <h3 className="text-lg font-bold mb-1">AI-Powered Analysis</h3>
              <p className="text-white/90 text-sm">Get detailed insights, health scores, and personalized recommendations</p>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={loading || files.length === 0}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Upload & Analyze
              </>
            )}
          </button>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Storage Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Cloud className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Storage</p>
                <p className="text-sm text-slate-500">{usedStorage} MB of {maxStorage} MB</p>
              </div>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                style={{ width: `${(parseFloat(usedStorage) / maxStorage) * 100}%` }}
              />
            </div>
          </div>

          {/* Recent Uploads */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4">Recent Uploads</h3>
            <div className="space-y-3">
              {files.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No files uploaded yet</p>
              ) : (
                files.slice(0, 3).map((file) => (
                  <div key={file.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <FileText className="w-5 h-5 text-cyan-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">{file.reportType}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Security Info */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <Shield className="w-5 h-5 text-emerald-500" />
              <span className="font-semibold text-slate-800">Secure Upload</span>
            </div>
            <p className="text-sm text-slate-600">
              Your files are encrypted end-to-end and stored securely. We comply with HIPAA regulations.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 text-sm text-slate-500 pt-4">
        <Shield className="w-4 h-4" />
        <span>End-to-end Encrypted & HIPAA Compliant</span>
      </div>
    </div>
  );
}
