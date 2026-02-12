import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { doctorService } from '../services/api';
import { User, Heart, FileText, Calendar, Activity, Watch, AlertCircle, Clock, Phone, Mail, ArrowLeft } from 'lucide-react';
import GenericSkeleton from '../components/skeletons/GenericSkeleton';

export default function PatientProfile() {
  const { patientId } = useParams();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get('appointmentId');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetchProfile = async () => {
      try { const { data } = await doctorService.getPatientProfile(patientId, appointmentId); setData(data); } catch (error) { console.error('Failed to fetch patient profile:', error); } finally { setLoading(false); }
    };
    fetchProfile();
  }, [patientId, appointmentId]);

  if (loading) return <GenericSkeleton />;
  if (!data) return <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6 text-center py-16"><p className="text-slate-400">Patient not found or access denied.</p><Link to="/doctors" className="mt-4 inline-block px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-xl">Go Back</Link></div>;

  const { patient, healthSummary, healthReports, wearableSummary, appointmentHistory } = data;
  const tabs = [{ id: 'overview', label: 'Overview', icon: User }, { id: 'reports', label: 'Health Reports', icon: FileText }, { id: 'wearables', label: 'Wearable Data', icon: Watch }, { id: 'history', label: 'Appointment History', icon: Calendar }];

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/doctor/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors"><ArrowLeft className="w-4 h-4" />Back to Dashboard</Link>

      {/* Patient Header */}
      <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white text-3xl font-bold">{patient.name?.charAt(0)?.toUpperCase()}</div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{patient.name}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-400">
              {patient.email && <span className="flex items-center gap-1"><Mail className="w-4 h-4" /> {patient.email}</span>}
              {patient.phone && <span className="flex items-center gap-1"><Phone className="w-4 h-4" /> {patient.phone}</span>}
              {patient.profile?.age && <span>{patient.profile.age} years old</span>}
              {patient.profile?.gender && <span className="capitalize">{patient.profile.gender}</span>}
            </div>
          </div>
          {healthSummary?.healthScore && (
            <div className="text-center">
              <div className={`text-4xl font-bold ${healthSummary.healthScore >= 80 ? 'text-emerald-400' : healthSummary.healthScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{healthSummary.healthScore}</div>
              <p className="text-sm text-slate-400">Health Score</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><User className="w-5 h-5 text-cyan-400" /> Basic Information</h2>
            <div className="grid grid-cols-2 gap-4">
              {patient.profile?.height && <div className="p-3 bg-slate-800 rounded-xl"><p className="text-sm text-slate-400">Height</p><p className="font-semibold text-white">{patient.profile.height} cm</p></div>}
              {patient.profile?.weight && <div className="p-3 bg-slate-800 rounded-xl"><p className="text-sm text-slate-400">Weight</p><p className="font-semibold text-white">{patient.profile.weight} kg</p></div>}
              {patient.profile?.bloodGroup && <div className="p-3 bg-slate-800 rounded-xl"><p className="text-sm text-slate-400">Blood Group</p><p className="font-semibold text-white">{patient.profile.bloodGroup}</p></div>}
              {patient.healthMetrics?.bmi && <div className="p-3 bg-slate-800 rounded-xl"><p className="text-sm text-slate-400">BMI</p><p className="font-semibold text-white">{patient.healthMetrics.bmi.toFixed(1)}</p></div>}
            </div>
            {patient.profile?.allergies?.length > 0 && <div className="mt-4"><p className="text-sm text-slate-400 mb-2">Allergies</p><div className="flex flex-wrap gap-2">{patient.profile.allergies.map((allergy, i) => <span key={i} className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">{allergy}</span>)}</div></div>}
            {patient.profile?.chronicConditions?.length > 0 && <div className="mt-4"><p className="text-sm text-slate-400 mb-2">Chronic Conditions</p><div className="flex flex-wrap gap-2">{patient.profile.chronicConditions.map((condition, i) => <span key={i} className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm">{condition}</span>)}</div></div>}
          </div>

          {healthSummary && (
            <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Heart className="w-5 h-5 text-red-400" /> Health Summary</h2>
              {healthSummary.deficiencies?.length > 0 && (
                <div className="mb-4"><p className="text-sm text-slate-400 mb-2">Deficiencies ({healthSummary.deficiencies.length})</p>
                  <div className="space-y-2">{healthSummary.deficiencies.slice(0, 3).map((def, i) => {
                    const currentVal = typeof def.currentValue === 'object' ? def.currentValue?.value || JSON.stringify(def.currentValue) : def.currentValue;
                    const normalRange = typeof def.normalRange === 'object' ? def.normalRange?.value || JSON.stringify(def.normalRange) : def.normalRange;
                    return (
                    <div key={i} className={`p-3 rounded-xl ${def.severity === 'severe' ? 'bg-red-500/10 border border-red-500/30' : def.severity === 'moderate' ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
                      <div className="flex justify-between items-center"><span className="font-medium text-white">{typeof def.name === 'object' ? def.name?.value || 'Unknown' : def.name}</span><span className={`text-xs px-2 py-1 rounded-full ${def.severity === 'severe' ? 'bg-red-500/20 text-red-400' : def.severity === 'moderate' ? 'bg-amber-500/20 text-amber-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{def.severity}</span></div>
                      <p className="text-sm text-slate-400 mt-1">Current: {currentVal} | Normal: {normalRange}</p>
                    </div>
                  )})}</div>
                </div>
              )}
              {healthSummary.riskFactors?.length > 0 && <div className="mb-4"><p className="text-sm text-slate-400 mb-2">Risk Factors</p><div className="flex flex-wrap gap-2">{healthSummary.riskFactors.map((risk, i) => <span key={i} className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm">{typeof risk === 'object' ? risk?.name || risk?.value || JSON.stringify(risk) : risk}</span>)}</div></div>}
              {healthSummary.keyFindings?.length > 0 && <div><p className="text-sm text-slate-400 mb-2">Key Findings</p><ul className="space-y-1">{healthSummary.keyFindings.slice(0, 4).map((finding, i) => {
                const findingText = typeof finding === 'object' ? finding?.title || finding?.finding || finding?.value || JSON.stringify(finding) : finding;
                return <li key={i} className="text-sm text-slate-300 flex items-start gap-2"><span className="text-cyan-400 mt-1">•</span>{findingText}</li>;
              })}</ul></div>}
            </div>
          )}

          {wearableSummary && (
            <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6 lg:col-span-2">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Watch className="w-5 h-5 text-blue-400" /> Wearable Data Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-500/10 rounded-xl text-center border border-blue-500/20"><Activity className="w-6 h-6 text-blue-400 mx-auto mb-2" /><p className="text-2xl font-bold text-white">{wearableSummary.avgSteps?.toLocaleString() || 'N/A'}</p><p className="text-sm text-slate-400">Avg Steps/Day</p></div>
                <div className="p-4 bg-red-500/10 rounded-xl text-center border border-red-500/20"><Heart className="w-6 h-6 text-red-400 mx-auto mb-2" /><p className="text-2xl font-bold text-white">{wearableSummary.avgHeartRate || 'N/A'}</p><p className="text-sm text-slate-400">Avg Heart Rate</p></div>
                <div className="p-4 bg-indigo-500/10 rounded-xl text-center border border-indigo-500/20"><Clock className="w-6 h-6 text-indigo-400 mx-auto mb-2" /><p className="text-2xl font-bold text-white">{wearableSummary.avgSleepHours || 'N/A'}</p><p className="text-sm text-slate-400">Avg Sleep (hrs)</p></div>
                <div className="p-4 bg-emerald-500/10 rounded-xl text-center border border-emerald-500/20"><Watch className="w-6 h-6 text-emerald-400 mx-auto mb-2" /><p className="text-2xl font-bold text-white">{wearableSummary.devices?.length || 0}</p><p className="text-sm text-slate-400">Connected Devices</p></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
          <h2 className="text-lg font-bold text-white mb-4">Health Reports</h2>
          {healthReports?.length > 0 ? (
            <div className="space-y-3">{healthReports.map((report) => (
              <div key={report._id} className="p-4 bg-slate-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center"><FileText className="w-6 h-6 text-slate-400" /></div><div><p className="font-semibold text-white">{report.reportType}</p><p className="text-sm text-slate-400">{new Date(report.createdAt).toLocaleDateString()}</p></div></div>
                <div className="flex items-center gap-4">{report.healthScore && <span className={`font-bold ${report.healthScore >= 80 ? 'text-emerald-400' : report.healthScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>Score: {report.healthScore}</span>}<span className={`px-2 py-1 rounded-lg text-xs font-medium ${report.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{report.status}</span></div>
              </div>
            ))}</div>
          ) : <p className="text-slate-400 text-center py-8">No health reports available</p>}
        </div>
      )}

      {/* Wearables Tab */}
      {activeTab === 'wearables' && (
        <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
          <h2 className="text-lg font-bold text-white mb-4">Wearable Device Data</h2>
          {wearableSummary ? (
            <div className="space-y-6">
              <div><p className="text-sm text-slate-400 mb-3">Connected Devices</p><div className="flex flex-wrap gap-3">{wearableSummary.devices?.map((device, i) => <div key={i} className="px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center gap-2"><Watch className="w-4 h-4 text-cyan-400" /><span className="font-medium text-cyan-300">{device.name || device.type}</span></div>)}</div></div>
              {wearableSummary.recentMetrics?.length > 0 && (
                <div><p className="text-sm text-slate-400 mb-3">Recent Activity (Last 7 Days)</p>
                  <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-700"><th className="text-left py-2 text-slate-400 font-medium">Date</th><th className="text-right py-2 text-slate-400 font-medium">Steps</th><th className="text-right py-2 text-slate-400 font-medium">Calories</th><th className="text-right py-2 text-slate-400 font-medium">Active Min</th><th className="text-right py-2 text-slate-400 font-medium">Distance</th></tr></thead>
                    <tbody>{wearableSummary.recentMetrics.map((metric, i) => <tr key={i} className="border-b border-slate-700/50"><td className="py-2 text-white">{new Date(metric.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td><td className="py-2 text-right text-slate-300">{metric.steps?.toLocaleString()}</td><td className="py-2 text-right text-slate-300">{metric.caloriesBurned}</td><td className="py-2 text-right text-slate-300">{metric.activeMinutes}</td><td className="py-2 text-right text-slate-300">{metric.distance?.toFixed(1)} km</td></tr>)}</tbody>
                  </table></div>
                </div>
              )}
            </div>
          ) : <p className="text-slate-400 text-center py-8">No wearable data available</p>}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
          <h2 className="text-lg font-bold text-white mb-4">Appointment History</h2>
          {appointmentHistory?.length > 0 ? (
            <div className="space-y-3">{appointmentHistory.map((apt) => (
              <div key={apt._id} className="p-4 bg-slate-800 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3"><Calendar className="w-5 h-5 text-slate-400" /><span className="font-semibold text-white">{new Date(apt.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium ${apt.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : apt.status === 'scheduled' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>{apt.status}</span>
                </div>
                {apt.doctor && <p className="text-sm text-slate-400">Dr. {apt.doctor.name} - {apt.doctor.specialization}</p>}
                {apt.symptoms && <p className="text-sm text-slate-500 mt-2"><span className="font-medium text-slate-400">Symptoms:</span> {apt.symptoms}</p>}
                {apt.notes && <p className="text-sm text-slate-500 mt-1"><span className="font-medium text-slate-400">Notes:</span> {apt.notes}</p>}
              </div>
            ))}</div>
          ) : <p className="text-slate-400 text-center py-8">No appointment history</p>}
        </div>
      )}
    </div>
  );
}
