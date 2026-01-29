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
        </div>
      </div>

      {/* Comparison Section */}
      {showComparison && comparison && (
        <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6"><h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><GitCompare className="w-5 h-5 text-blue-500" /> Health Comparison</h2><span className={`px-3 py-1 rounded-lg text-sm font-medium ${comparison.comparison.overallTrend === 'improved' ? 'bg-emerald-100 text-emerald-700' : comparison.comparison.overallTrend === 'declined' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{comparison.comparison.overallTrend === 'improved' ? '↑ Improved' : comparison.comparison.overallTrend === 'declined' ? '↓ Declined' : '→ Stable'}</span></div>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-200"><p className="text-sm text-slate-600 mb-1">Previous Report</p><p className="font-medium text-slate-800">{new Date(comparison.previousReport.createdAt).toLocaleDateString()}</p><p className="text-2xl font-bold text-slate-600">{comparison.previousReport.healthScore}/100</p></div>
            <div className="bg-cyan-50 p-4 rounded-xl border-2 border-cyan-200"><p className="text-sm text-cyan-700 mb-1">Current Report</p><p className="font-medium text-slate-800">{new Date(comparison.currentReport.createdAt).toLocaleDateString()}</p><p className="text-2xl font-bold text-cyan-600">{comparison.currentReport.healthScore}/100</p></div>
          </div>
          <p className="text-slate-700">{comparison.comparison.summary}</p>
        </div>
      )}

      {/* Chat Section */}
      {chatOpen && (
        <div className="bg-white rounded-2xl border-2 border-violet-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Sparkles className="w-5 h-5 text-violet-500" /> Ask About Your Report</h2><button onClick={() => setChatOpen(false)} className="p-2 text-slate-400 hover:text-slate-800 rounded-lg"><X className="w-5 h-5" /></button></div>
          <div className="h-64 overflow-y-auto mb-4 space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            {chatHistory.length === 0 && <p className="text-slate-500 text-center py-8">Ask any questions about your health report.<br />"What does my hemoglobin level mean?"</p>}
            {chatHistory.map((msg, i) => (<div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] p-3 rounded-xl ${msg.role === 'user' ? 'bg-violet-500 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>{msg.content}</div></div>))}
            {sending && <div className="flex justify-start"><div className="bg-white border border-slate-200 p-3 rounded-xl"><span className="animate-pulse text-slate-600">Thinking...</span></div></div>}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask a question..." className="flex-1 bg-white border-2 border-slate-200 rounded-xl py-3 px-4 text-slate-800 placeholder-slate-400 focus:border-violet-400 focus:outline-none" disabled={sending} />
            <button type="submit" disabled={sending || !message.trim()} className="px-4 py-3 bg-violet-500 text-white rounded-xl hover:bg-violet-600 transition-all disabled:opacity-50"><Send className="w-5 h-5" /></button>
          </form>
        </div>
      )}

      {/* Summary */}
      {aiAnalysis?.summary && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2"><Activity className="w-5 h-5 text-cyan-500" /> Summary</h2>
          <p className="text-slate-700 leading-relaxed">{aiAnalysis.summary}</p>
        </div>
      )}

      {/* Key Findings & Risk Factors */}
      <div className="grid md:grid-cols-2 gap-6">
        {aiAnalysis?.keyFindings?.length > 0 && (
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Heart className="w-5 h-5 text-blue-500" /> Key Findings</h2>
            <ul className="space-y-2">{aiAnalysis.keyFindings.map((finding, i) => (<li key={i} className="flex items-start gap-3 text-sm text-slate-700"><span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />{finding}</li>))}</ul>
          </div>
        )}
        {aiAnalysis?.riskFactors?.length > 0 && (
          <div className="bg-white rounded-2xl border-l-4 border-amber-500 border-t-2 border-r-2 border-b-2 border-t-slate-200 border-r-slate-200 border-b-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" /> Risk Factors</h2>
            <ul className="space-y-2">{aiAnalysis.riskFactors.map((risk, i) => (<li key={i} className="flex items-start gap-3 text-sm text-slate-700"><span className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0" />{risk}</li>))}</ul>
          </div>
        )}
      </div>

      {/* Health Metrics */}
      {aiAnalysis?.metrics && Object.keys(aiAnalysis.metrics).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Health Metrics</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {Object.entries(aiAnalysis.metrics).map(([key, metric]) => (
              <div key={key} className={`p-4 rounded-xl border-2 ${metric.status === 'normal' ? 'bg-emerald-50 border-emerald-200' : metric.status === 'borderline' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                <p className="text-sm text-slate-600 capitalize mb-1 font-medium">{key.replace(/([A-Z])/g, ' $1')}</p>
                <p className="text-2xl font-bold text-slate-800">{metric.value} <span className="text-sm font-normal text-slate-500">{metric.unit}</span></p>
                <div className="flex items-center justify-between mt-2"><span className="text-xs text-slate-600">Normal: {metric.normalRange}</span><span className={`px-2 py-0.5 rounded text-xs font-medium ${metric.status === 'normal' ? 'bg-emerald-100 text-emerald-700' : metric.status === 'borderline' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{metric.status}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deficiencies */}
      {aiAnalysis?.deficiencies?.length > 0 && (
        <div className="bg-white rounded-2xl border-l-4 border-amber-500 border-t-2 border-r-2 border-b-2 border-t-slate-200 border-r-slate-200 border-b-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><Droplets className="w-5 h-5 text-amber-500" /> Detected Deficiencies</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {aiAnalysis.deficiencies.map((def, i) => (
              <div key={i} className={`p-4 rounded-xl border-2 ${def.severity === 'severe' ? 'bg-red-50 border-red-200' : def.severity === 'moderate' ? 'bg-amber-50 border-amber-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className="flex items-center justify-between mb-2"><span className="font-bold text-slate-800">{def.name}</span><span className={`px-2 py-0.5 rounded text-xs font-medium ${def.severity === 'severe' ? 'bg-red-100 text-red-700' : def.severity === 'moderate' ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700'}`}>{def.severity}</span></div>
                <p className="text-sm text-slate-700 font-medium">Current: {def.currentValue}</p><p className="text-sm text-slate-600">Normal: {def.normalRange}</p>
                {def.symptoms?.length > 0 && <p className="text-xs text-slate-600 mt-2">Symptoms: {def.symptoms.join(', ')}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Natural Supplements - Indian Foods */}
      {aiAnalysis?.supplements?.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
            <Apple className="w-5 h-5 text-green-600" /> Natural Supplement Recommendations
          </h2>
          <p className="text-sm text-slate-600 mb-6">Natural Indian foods and remedies to address your deficiencies</p>
          <div className="grid md:grid-cols-2 gap-4">
            {aiAnalysis.supplements.map((supp, i) => (
              <div key={i} className="p-4 bg-green-50 rounded-xl border-2 border-green-200">
                <p className="font-bold text-green-700">{supp.category}</p>
                <p className="text-sm text-green-600 mt-1">{supp.reason}</p>
                <p className="text-xs text-green-700 mt-2 font-medium">{supp.naturalSources || supp.generalDosage}</p>
                {supp.note && <p className="text-xs text-green-600 mt-1 italic">{supp.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diet Plan */}
      {aiAnalysis?.dietPlan && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><Apple className="w-5 h-5 text-emerald-500" /> Personalized Diet Plan</h2>
          {aiAnalysis.dietPlan.overview && <p className="text-slate-700 mb-6">{aiAnalysis.dietPlan.overview}</p>}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[{ key: 'breakfast', label: 'Breakfast', icon: '🌅', color: 'emerald', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' }, { key: 'lunch', label: 'Lunch', icon: '☀️', color: 'blue', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' }, { key: 'dinner', label: 'Dinner', icon: '🌙', color: 'violet', bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' }, { key: 'snacks', label: 'Snacks', icon: '🍎', color: 'amber', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' }].map(({ key, label, icon, bg, border, text }) => (
              aiAnalysis.dietPlan[key]?.length > 0 && (
                <div key={key} className={`p-4 rounded-xl ${bg} border-2 ${border}`}>
                  <div className="flex items-center gap-2 mb-3"><span className="text-xl">{icon}</span><span className={`font-bold ${text}`}>{label}</span></div>
                  {aiAnalysis.dietPlan[key].map((meal, i) => (<div key={i} className="mb-2"><p className={`text-sm ${text} font-medium`}>{meal.meal}</p>{meal.tip && <p className={`text-xs text-slate-600 italic`}>{meal.tip}</p>}</div>))}
                </div>
              )
            ))}
          </div>
          {(aiAnalysis.dietPlan.foodsToIncrease?.length > 0 || aiAnalysis.dietPlan.foodsToLimit?.length > 0) && (
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {aiAnalysis.dietPlan.foodsToIncrease?.length > 0 && (<div className="p-4 bg-emerald-50 rounded-xl border-2 border-emerald-200"><h3 className="font-bold text-emerald-700 mb-3">✅ Foods to Increase</h3><div className="flex flex-wrap gap-2">{aiAnalysis.dietPlan.foodsToIncrease.map((food, i) => (<span key={i} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">{food}</span>))}</div></div>)}
              {aiAnalysis.dietPlan.foodsToLimit?.length > 0 && (<div className="p-4 bg-red-50 rounded-xl border-2 border-red-200"><h3 className="font-bold text-red-700 mb-3">⚠️ Foods to Limit</h3><div className="flex flex-wrap gap-2">{aiAnalysis.dietPlan.foodsToLimit.map((food, i) => (<span key={i} className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium">{food}</span>))}</div></div>)}
            </div>
          )}
          {aiAnalysis.dietPlan.tips?.length > 0 && (<div className="p-4 bg-slate-50 border border-slate-200 rounded-xl"><h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" /> Diet Tips</h3><ul className="space-y-2">{aiAnalysis.dietPlan.tips.map((tip, i) => (<li key={i} className="text-sm text-slate-700 flex items-start gap-2"><span className="w-1.5 h-1.5 bg-cyan-500 rounded-full mt-2" />{tip}</li>))}</ul></div>)}
        </div>
      )}

      {/* Disclaimer */}
      <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
        <p className="text-sm text-blue-700"><strong>Disclaimer:</strong> This AI analysis is for informational wellness support only and should not replace professional medical advice. Always consult with a healthcare provider for medical decisions.</p>
      </div>
    </div>
  );
}
