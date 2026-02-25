import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, Stethoscope, ArrowLeft, Upload, FileText, X, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const specializations = [
  'General Physician', 'Cardiologist', 'Dermatologist', 'Endocrinologist',
  'Gastroenterologist', 'Neurologist', 'Nutritionist', 'Oncologist',
  'Orthopedic', 'Pediatrician', 'Psychiatrist', 'Pulmonologist'
];

const requiredDocuments = [
  { id: 'license', name: 'Medical License', description: 'Valid medical license certificate' },
  { id: 'degree', name: 'Medical Degree', description: 'MBBS/MD or equivalent degree certificate' },
  { id: 'id_proof', name: 'ID Proof', description: 'Government issued ID (Aadhar/Passport)' }
];

export default function DoctorRegister() {
  const { registerDoctor } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '',
    specialization: '', qualifications: '', experience: '', hospital: '',
    licenseNumber: '', consultationFee: '', bio: ''
  });
  const [documents, setDocuments] = useState({});

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (docId, file) => {
    if (file) {
      // In production, you'd upload to server/cloud storage
      // For now, we'll store the file name and create a preview
      setDocuments(prev => ({
        ...prev,
        [docId]: {
          file,
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB'
        }
      }));
    }
  };

  const removeDocument = (docId) => {
    setDocuments(prev => {
      const newDocs = { ...prev };
      delete newDocs[docId];
      return newDocs;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    // Check if all required documents are uploaded
    const missingDocs = requiredDocuments.filter(doc => !documents[doc.id]);
    if (missingDocs.length > 0) {
      toast.error(`Please upload: ${missingDocs.map(d => d.name).join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      // In production, upload documents first and get URLs
      const documentsList = Object.entries(documents).map(([type, doc]) => ({
        name: doc.name,
        type,
        url: `pending_upload_${type}` // Placeholder - would be actual URL after upload
      }));

      await registerDoctor({
        ...formData,
        qualifications: formData.qualifications.split(',').map(q => q.trim()).filter(Boolean),
        experience: parseInt(formData.experience),
        consultationFee: parseInt(formData.consultationFee) || 500,
        documents: documentsList
      });
      toast.success('Registration successful! Your profile is pending approval.');
      navigate('/doctor/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-orange-500 flex items-center justify-center">
              <Activity className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-800">HealthAI</span>
          </Link>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Doctor Registration</h1>
          <p className="text-slate-500">Join our platform and connect with patients</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-4 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                  step >= s ? 'bg-cyan-500 text-white' : 'bg-slate-200 text-slate-400'
                }`}>{s}</div>
                <span className={`text-sm hidden sm:block ${step >= s ? 'text-cyan-600 font-medium' : 'text-slate-400'}`}>
                  {s === 1 ? 'Account' : s === 2 ? 'Professional' : 'Documents'}
                </span>
                {s < 3 && <div className={`w-8 h-1 rounded ${step > s ? 'bg-cyan-500' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {/* Step 1: Account Details */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none" placeholder="Dr. John Smith" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none" placeholder="doctor@example.com" required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none" placeholder="+91 98765 43210" />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                    <input type="password" name="password" value={formData.password} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none" placeholder="••••••••" required minLength={6} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Confirm Password</label>
                    <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none" placeholder="••••••••" required />
                  </div>
                </div>
                <button type="button" onClick={() => setStep(2)} className="w-full py-3 bg-gradient-to-r from-purple-500 to-orange-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all mt-4">
                  Continue →
                </button>
              </div>
            )}

            {/* Step 2: Professional Details */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Specialization</label>
                    <select name="specialization" value={formData.specialization} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-slate-800 focus:border-cyan-500 focus:outline-none" required>
                      <option value="">Select specialization</option>
                      {specializations.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Experience (years)</label>
                    <input type="number" name="experience" value={formData.experience} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none" placeholder="5" required min={0} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Medical License Number</label>
                  <input type="text" name="licenseNumber" value={formData.licenseNumber} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none" placeholder="MCI-12345" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Qualifications (comma separated)</label>
                  <input type="text" name="qualifications" value={formData.qualifications} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none" placeholder="MBBS, MD, FRCP" />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Hospital/Clinic</label>
                    <input type="text" name="hospital" value={formData.hospital} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none" placeholder="City Hospital" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Consultation Fee (₹)</label>
                    <input type="number" name="consultationFee" value={formData.consultationFee} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none" placeholder="500" min={0} />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button type="button" onClick={() => setStep(3)} className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-orange-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all">
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Document Upload */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-amber-800">
                    <strong>Important:</strong> Please upload clear copies of the following documents. These will be reviewed by our admin team before your profile is approved.
                  </p>
                </div>

                {requiredDocuments.map((doc) => (
                  <div key={doc.id} className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-slate-800">{doc.name} <span className="text-red-500">*</span></h4>
                        <p className="text-sm text-slate-500">{doc.description}</p>
                      </div>
                      {documents[doc.id] ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : null}
                    </div>
                    
                    {documents[doc.id] ? (
                      <div className="mt-3 flex items-center justify-between bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-cyan-500" />
                          <div>
                            <p className="text-sm font-medium text-slate-700">{documents[doc.id].name}</p>
                            <p className="text-xs text-slate-500">{documents[doc.id].size}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => removeDocument(doc.id)} className="p-1 text-slate-400 hover:text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="mt-3 flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-cyan-500 hover:bg-cyan-50 transition-all">
                        <Upload className="w-5 h-5 text-slate-400" />
                        <span className="text-sm text-slate-500">Click to upload</span>
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange(doc.id, e.target.files[0])}
                        />
                      </label>
                    )}
                  </div>
                ))}

                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setStep(2)} className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button type="submit" disabled={loading} className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-orange-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50">
                    {loading ? 'Submitting...' : 'Submit Application'}
                  </button>
                </div>
              </div>
            )}
          </form>

          <p className="text-center text-slate-500 mt-6">
            Already have an account? <Link to="/login" className="text-cyan-600 hover:text-cyan-700 font-medium">Sign in</Link>
          </p>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6 flex items-center justify-center gap-2">
          <Stethoscope className="w-4 h-4" />
          Your profile will be reviewed by our admin team before being listed.
        </p>
      </div>
    </div>
  );
}
