import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { healthService } from '../services/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, Activity, Apple, Pill, Heart, AlertTriangle, ArrowLeft, Users, Send, MessageCircle, Star, Clock, GitCompare, Sparkles, X, Droplets } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReportDetails() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [recommendedDoctors, setRecommendedDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState(null);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const fetchReport = async () => {
      try { const { data } = await healthService.getReport(id); setReport(data.report); setRecommendedDoctors(data.recommendedDoctors || []); } catch (error) { toast.error('Failed to load report'); } finally { setLoading(false); }
    };
    fetchReport();
  }, [id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  const handleCompare = async () => {
    if (comparison) { setShowComparison(!showComparison); return; }
    setLoadingComparison(true);
    try { const { data } = await healthService.compareReport(id); setComparison(data); setShowComparison(true); } catch (error) { toast.error(error.response?.data?.message || 'No previous report found'); } finally { setLoadingComparison(false); }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || sending) return;
    const userMessage = message.trim();
    setMessage('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setSending(true);
    try { const { data } = await healthService.chatAboutReport(id, userMessage, chatHistory); setChatHistory(prev => [...prev, { role: 'assistant', content: data.response }]); } catch (error) { toast.error('Failed to get response'); setChatHistory(prev => prev.slice(0, -1)); } finally { setSending(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><div className="text-center"><div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" /><p className="text-slate-400">Loading report...</p></div></div>;
  if (!report) return <div className="text-center py-12 text-slate-400">Report not found</div>;

  const { aiAnalysis } = report;
  const healthScore = aiAnalysis?.healthScore || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 font-medium transition-colors"><ArrowLeft className="w-4 h-4" /> Back to Dashboard</Link>

      {/* Header Card */}
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"><div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" /></div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center"><FileText className="w-8 h-8" /></div>
            <div><h1 className="text-2xl font-bold">{report.reportType} Report</h1><p className="text-white/70">Analyzed on {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p></div>
          </div>
          <div className="text-center p-4 bg-white/10 backdrop-blur-sm rounded-xl"><p className="text-4xl font-bold">{healthScore}</p><p className="text-sm text-white/70">Health Score</p></div>
        </div>
        <div className="relative flex gap-3 mt-6 pt-6 border-t border-white/20">
          <button onClick={handleCompare} disabled={loadingComparison} className="flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 transition-all font-medium"><GitCompare className="w-4 h-4" />{loadingComparison ? 'Loading...' : showComparison ? 'Hide Comparison' : 'Compare with Previous'}</button>
          <button onClick={() => setChatOpen(!chatOpen)} className="flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 transition-all font-medium"><MessageCircle className="w-4 h-4" />Ask AI Questions</button>
        </div>
      </div>

      {/* Comparison Section */}
      {showComparison && comparison && (
        <div className="bg-[#111827] rounded-2xl border border-blue-500/30 p-6">
          <div className="flex items-center justify-between mb-6"><h2 className="text-lg font-bold text-white flex items-center gap-2"><GitCompare className="w-5 h-5 text-blue-400" /> Health Comparison</h2><span className={`px-3 py-1 rounded-lg text-sm font-medium ${comparison.comparison.overallTrend === 'improved' ? 'bg-emerald-500/20 text-emerald-400' : comparison.comparison.overallTrend === 'declined' ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'}`}>{comparison.comparison.overallTrend === 'improved' ? '↑ Improved' : comparison.comparison.overallTrend === 'declined' ? '↓ Declined' : '→ Stable'}</span></div>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700"><p className="text-sm text-slate-400 mb-1">Previous Report</p><p className="font-medium text-white">{new Date(comparison.previousReport.createdAt).toLocaleDateString()}</p><p className="text-2xl font-bold text-slate-400">{comparison.previousReport.healthScore}/100</p></div>
            <div className="bg-slate-800 p-4 rounded-xl border border-cyan-500/30"><p className="text-sm text-slate-400 mb-1">Current Report</p><p className="font-medium text-white">{new Date(comparison.currentReport.createdAt).toLocaleDateString()}</p><p className="text-2xl font-bold text-cyan-400">{comparison.currentReport.healthScore}/100</p></div>
          </div>
          <p className="text-slate-400">{comparison.comparison.summary}</p>
        </div>
      )}

      {/* Chat Section */}
      {chatOpen && (
        <div className="bg-[#111827] rounded-2xl border border-violet-500/30 p-6">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-violet-400" /> Ask About Your Report</h2><button onClick={() => setChatOpen(false)} className="p-2 text-slate-400 hover:text-white rounded-lg"><X className="w-5 h-5" /></button></div>
          <div className="h-64 overflow-y-auto mb-4 space-y-3 p-4 bg-slate-800 rounded-xl">
            {chatHistory.length === 0 && <p className="text-slate-500 text-center py-8">Ask any questions about your health report.<br />"What does my hemoglobin level mean?"</p>}
            {chatHistory.map((msg, i) => (<div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] p-3 rounded-xl ${msg.role === 'user' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-200'}`}>{msg.content}</div></div>))}
            {sending && <div className="flex justify-start"><div className="bg-slate-700 p-3 rounded-xl"><span className="animate-pulse text-slate-400">Thinking...</span></div></div>}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask a question..." className="flex-1 bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none" disabled={sending} />
            <button type="submit" disabled={sending || !message.trim()} className="px-4 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-all disabled:opacity-50"><Send className="w-5 h-5" /></button>
          </form>
        </div>
      )}

      {/* Summary */}
      {aiAnalysis?.summary && (
        <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
          <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2"><Activity className="w-5 h-5 text-cyan-400" /> Summary</h2>
          <p className="text-slate-400 leading-relaxed">{aiAnalysis.summary}</p>
        </div>
      )}

      {/* Key Findings & Risk Factors */}
      <div className="grid md:grid-cols-2 gap-6">
        {aiAnalysis?.keyFindings?.length > 0 && (
          <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Heart className="w-5 h-5 text-blue-400" /> Key Findings</h2>
            <ul className="space-y-2">{aiAnalysis.keyFindings.map((finding, i) => (<li key={i} className="flex items-start gap-3 text-sm text-slate-400"><span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />{finding}</li>))}</ul>
          </div>
        )}
        {aiAnalysis?.riskFactors?.length > 0 && (
          <div className="bg-[#111827] rounded-2xl border-l-4 border-amber-500 border-t border-r border-b border-slate-700 p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400" /> Risk Factors</h2>
            <ul className="space-y-2">{aiAnalysis.riskFactors.map((risk, i) => (<li key={i} className="flex items-start gap-3 text-sm text-slate-400"><span className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0" />{risk}</li>))}</ul>
          </div>
        )}
      </div>

      {/* Health Metrics */}
      {aiAnalysis?.metrics && Object.keys(aiAnalysis.metrics).length > 0 && (
        <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
          <h2 className="text-lg font-bold text-white mb-6">Health Metrics</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {Object.entries(aiAnalysis.metrics).map(([key, metric]) => (
              <div key={key} className={`p-4 rounded-xl border ${metric.status === 'normal' ? 'bg-emerald-500/10 border-emerald-500/30' : metric.status === 'borderline' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <p className="text-sm text-slate-400 capitalize mb-1">{key.replace(/([A-Z])/g, ' $1')}</p>
                <p className="text-2xl font-bold text-white">{metric.value} <span className="text-sm font-normal text-slate-500">{metric.unit}</span></p>
                <div className="flex items-center justify-between mt-2"><span className="text-xs text-slate-500">Normal: {metric.normalRange}</span><span className={`px-2 py-0.5 rounded text-xs font-medium ${metric.status === 'normal' ? 'bg-emerald-500/20 text-emerald-400' : metric.status === 'borderline' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>{metric.status}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deficiencies */}
      {aiAnalysis?.deficiencies?.length > 0 && (
        <div className="bg-[#111827] rounded-2xl border-l-4 border-amber-500 border-t border-r border-b border-slate-700 p-6">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Droplets className="w-5 h-5 text-amber-400" /> Detected Deficiencies</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {aiAnalysis.deficiencies.map((def, i) => (
              <div key={i} className={`p-4 rounded-xl ${def.severity === 'severe' ? 'bg-red-500/10 border border-red-500/30' : def.severity === 'moderate' ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
                <div className="flex items-center justify-between mb-2"><span className="font-bold text-white">{def.name}</span><span className={`px-2 py-0.5 rounded text-xs font-medium ${def.severity === 'severe' ? 'bg-red-500/20 text-red-400' : def.severity === 'moderate' ? 'bg-amber-500/20 text-amber-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{def.severity}</span></div>
                <p className="text-sm text-slate-400">Current: {def.currentValue}</p><p className="text-sm text-slate-500">Normal: {def.normalRange}</p>
                {def.symptoms?.length > 0 && <p className="text-xs text-slate-500 mt-2">Symptoms: {def.symptoms.join(', ')}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supplements */}
      {aiAnalysis?.supplements?.length > 0 && (
        <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Pill className="w-5 h-5 text-violet-400" /> Supplement Recommendations</h2>
          <p className="text-sm text-slate-500 mb-6">General supplement categories (not brand-specific)</p>
          <div className="grid md:grid-cols-2 gap-4">
            {aiAnalysis.supplements.map((supp, i) => (
              <div key={i} className="p-4 bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-xl border border-violet-500/20">
                <p className="font-bold text-violet-300">{supp.category}</p><p className="text-sm text-violet-400/80 mt-1">{supp.reason}</p><p className="text-xs text-violet-400 mt-2 font-medium">{supp.generalDosage}</p>
                {supp.note && <p className="text-xs text-violet-400/60 mt-1 italic">{supp.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diet Plan */}
      {aiAnalysis?.dietPlan && (
        <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Apple className="w-5 h-5 text-emerald-400" /> Personalized Diet Plan</h2>
          {aiAnalysis.dietPlan.overview && <p className="text-slate-400 mb-6">{aiAnalysis.dietPlan.overview}</p>}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[{ key: 'breakfast', label: 'Breakfast', icon: '🌅', color: 'emerald' }, { key: 'lunch', label: 'Lunch', icon: '☀️', color: 'blue' }, { key: 'dinner', label: 'Dinner', icon: '🌙', color: 'violet' }, { key: 'snacks', label: 'Snacks', icon: '🍎', color: 'amber' }].map(({ key, label, icon, color }) => (
              aiAnalysis.dietPlan[key]?.length > 0 && (
                <div key={key} className={`p-4 rounded-xl bg-${color}-500/10 border border-${color}-500/20`}>
                  <div className="flex items-center gap-2 mb-3"><span className="text-xl">{icon}</span><span className={`font-bold text-${color}-400`}>{label}</span></div>
                  {aiAnalysis.dietPlan[key].map((meal, i) => (<div key={i} className="mb-2"><p className={`text-sm text-${color}-300`}>{meal.meal}</p>{meal.tip && <p className={`text-xs text-${color}-400/60 italic`}>{meal.tip}</p>}</div>))}
                </div>
              )
            ))}
          </div>
          {(aiAnalysis.dietPlan.foodsToIncrease?.length > 0 || aiAnalysis.dietPlan.foodsToLimit?.length > 0) && (
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {aiAnalysis.dietPlan.foodsToIncrease?.length > 0 && (<div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20"><h3 className="font-bold text-emerald-400 mb-3">✅ Foods to Increase</h3><div className="flex flex-wrap gap-2">{aiAnalysis.dietPlan.foodsToIncrease.map((food, i) => (<span key={i} className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full">{food}</span>))}</div></div>)}
              {aiAnalysis.dietPlan.foodsToLimit?.length > 0 && (<div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20"><h3 className="font-bold text-red-400 mb-3">⚠️ Foods to Limit</h3><div className="flex flex-wrap gap-2">{aiAnalysis.dietPlan.foodsToLimit.map((food, i) => (<span key={i} className="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-full">{food}</span>))}</div></div>)}
            </div>
          )}
          {aiAnalysis.dietPlan.tips?.length > 0 && (<div className="p-4 bg-slate-800 rounded-xl"><h3 className="font-bold text-white mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-400" /> Diet Tips</h3><ul className="space-y-2">{aiAnalysis.dietPlan.tips.map((tip, i) => (<li key={i} className="text-sm text-slate-400 flex items-start gap-2"><span className="w-1.5 h-1.5 bg-cyan-500 rounded-full mt-2" />{tip}</li>))}</ul></div>)}
        </div>
      )}

      {/* Recommended Doctors */}
      {recommendedDoctors.length > 0 && (
        <div className="bg-[#111827] rounded-2xl border border-cyan-500/30 p-6">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Users className="w-5 h-5 text-cyan-400" /> Recommended Doctors</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {recommendedDoctors.map((doctor) => (
              <div key={doctor._id} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center text-lg font-bold text-white">{(doctor.name || doctor.user?.name)?.[0]?.toUpperCase()}</div>
                  <div><p className="font-bold text-white">Dr. {doctor.name || doctor.user?.name}</p><p className="text-sm text-cyan-400">{doctor.specialization}</p></div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400 mb-3"><Star className="w-4 h-4 text-amber-400 fill-amber-400" /><span>{doctor.rating?.toFixed(1)}</span><span>•</span><Clock className="w-4 h-4" /><span>{doctor.experience} yrs</span></div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-700"><span className="font-bold text-white">₹{doctor.consultationFee || 0}</span><Link to="/doctors" className="text-sm bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 transition-colors">Book Now</Link></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
        <p className="text-sm text-blue-400"><strong>Disclaimer:</strong> This AI analysis is for informational wellness support only and should not replace professional medical advice. Always consult with a healthcare provider for medical decisions.</p>
      </div>
    </div>
  );
}
