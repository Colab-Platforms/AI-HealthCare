import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doctorService } from '../services/api';
import { 
  ArrowLeft, FileText, Pill, Calendar, Star, MessageSquare, 
  Download, Share2, CheckCircle, Clock, User, Heart, Activity,
  AlertTriangle, Info, Bookmark, Send, ThumbsUp, ThumbsDown
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ConsultationSummary() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [consultation, setConsultation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    fetchConsultationSummary();
  }, [appointmentId]);

  const fetchConsultationSummary = async () => {
    try {
      const { data } = await doctorService.getConsultationSummary(appointmentId);
      setConsultation(data);
    } catch (error) {
      toast.error('Failed to load consultation summary');
      navigate('/doctors');
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async () => {
    if (rating === 0) {
      toast.error('Please provide a rating');
      return;
    }
    
    setSubmittingReview(true);
    try {
      await doctorService.submitReview(appointmentId, { rating, review });
      toast.success('Review submitted successfully');
      setConsultation(prev => ({ ...prev, reviewSubmitted: true }));
    } catch (error) {
      toast.error('Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const downloadPrescription = async () => {
    try {
      const response = await doctorService.downloadPrescription(appointmentId);
      // Handle PDF download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prescription-${appointmentId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download prescription');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  // Mock data for demonstration
  const mockConsultation = {
    id: appointmentId,
    doctor: {
      name: 'Dr. Sarah Johnson',
      specialization: 'General Physician',
      image: null
    },
    date: new Date().toISOString(),
    duration: '30 minutes',
    diagnosis: 'Vitamin D deficiency with mild fatigue symptoms',
    prescription: [
      {
        medication: 'Vitamin D3 Supplement',
        dosage: '1000 IU daily',
        duration: '3 months',
        instructions: 'Take with food, preferably in the morning'
      },
      {
        medication: 'Multivitamin',
        dosage: '1 tablet daily',
        duration: '1 month',
        instructions: 'Take after breakfast'
      }
    ],
    recommendations: [
      'Get 15-20 minutes of sunlight exposure daily',
      'Include vitamin D rich foods like fatty fish, eggs, and fortified milk',
      'Regular exercise to improve energy levels',
      'Follow-up blood test in 3 months'
    ],
    followUp: {
      date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'Blood test review'
    },
    notes: 'Patient reported fatigue and low energy levels. Blood work shows vitamin D deficiency at 18 ng/mL (normal: 30-100). Recommended supplementation and lifestyle changes.',
    reviewSubmitted: false
  };

  const consultationData = consultation || mockConsultation;

  return (
    <div className="min-h-screen bg-[#0a0f1a] pb-8">
      {/* Header */}
      <div className="bg-[#111827] border-b border-slate-700 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/doctors')}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">Consultation Summary</h1>
              <p className="text-sm text-slate-400">
                {new Date(consultationData.date).toLocaleDateString()} • {consultationData.duration}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={downloadPrescription}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors">
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* Doctor Info */}
        <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-purple-500 to-orange-500 flex items-center justify-center text-xl font-bold text-white">
              {consultationData.doctor.name[0]}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">{consultationData.doctor.name}</h2>
              <p className="text-slate-400">{consultationData.doctor.specialization}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 mb-1">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm text-slate-400">4.8 rating</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-slate-800 rounded-xl w-fit mb-6">
          <button 
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'summary' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Summary
          </button>
          <button 
            onClick={() => setActiveTab('prescription')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'prescription' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Prescription
          </button>
          <button 
            onClick={() => setActiveTab('followup')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'followup' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Follow-up
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <>
                {/* Diagnosis */}
                <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Diagnosis</h3>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{consultationData.diagnosis}</p>
                </div>

                {/* Doctor's Notes */}
                <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-green-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Doctor's Notes</h3>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{consultationData.notes}</p>
                </div>

                {/* Recommendations */}
                <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Recommendations</h3>
                  </div>
                  <ul className="space-y-3">
                    {consultationData.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
                        <span className="text-slate-300">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {/* Prescription Tab */}
            {activeTab === 'prescription' && (
              <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Pill className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Prescription</h3>
                </div>
                
                <div className="space-y-4">
                  {consultationData.prescription.map((med, index) => (
                    <div key={index} className="p-4 bg-slate-800 rounded-xl">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-bold text-white">{med.medication}</h4>
                        <span className="text-sm text-slate-400">{med.duration}</span>
                      </div>
                      <p className="text-cyan-400 font-medium mb-2">{med.dosage}</p>
                      <p className="text-slate-300 text-sm">{med.instructions}</p>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                    <div>
                      <p className="text-yellow-400 font-medium mb-1">Important</p>
                      <p className="text-slate-300 text-sm">
                        Take medications as prescribed. Do not stop or change dosage without consulting your doctor.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Follow-up Tab */}
            {activeTab === 'followup' && (
              <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-orange-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Follow-up Care</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 bg-slate-800 rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                      <Clock className="w-5 h-5 text-cyan-400" />
                      <h4 className="font-bold text-white">Next Appointment</h4>
                    </div>
                    <p className="text-slate-300">
                      {new Date(consultationData.followUp.date).toLocaleDateString()} - {consultationData.followUp.type}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-slate-800 rounded-xl">
                    <h4 className="font-bold text-white mb-2">Health Tracking</h4>
                    <p className="text-slate-300 text-sm mb-3">
                      Monitor your progress and upload follow-up reports to track improvements.
                    </p>
                    <button className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                      Upload Report
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  <span className="text-white">Book Follow-up</span>
                </button>
                <button className="w-full flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
                  <MessageSquare className="w-5 h-5 text-cyan-400" />
                  <span className="text-white">Message Doctor</span>
                </button>
                <button className="w-full flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
                  <Bookmark className="w-5 h-5 text-cyan-400" />
                  <span className="text-white">Save to Health Records</span>
                </button>
              </div>
            </div>

            {/* Rate Consultation */}
            {!consultationData.reviewSubmitted && (
              <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
                <h3 className="text-lg font-bold text-white mb-4">Rate this Consultation</h3>
                
                <div className="mb-4">
                  <p className="text-slate-400 text-sm mb-2">How was your experience?</p>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(i => (
                      <button
                        key={i}
                        onClick={() => setRating(i)}
                        className={`p-1 transition-colors ${
                          i <= rating ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-400'
                        }`}
                      >
                        <Star className="w-6 h-6 fill-current" />
                      </button>
                    ))}
                  </div>
                </div>
                
                <textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="Share your feedback (optional)"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-400 resize-none h-20 focus:outline-none focus:border-cyan-500"
                />
                
                <button
                  onClick={submitReview}
                  disabled={submittingReview || rating === 0}
                  className="w-full mt-4 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 text-white py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {submittingReview ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Review
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Health Improvement Tracking */}
            <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Health Tracking</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Vitamin D Level</span>
                  <span className="text-yellow-400">Improving</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Energy Level</span>
                  <span className="text-green-400">Stable</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Sleep Quality</span>
                  <span className="text-cyan-400">Good</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}