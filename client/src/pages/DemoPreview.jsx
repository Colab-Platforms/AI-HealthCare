import { useState, useRef, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  Activity, TrendingUp, FileText, Calendar, Apple, Dumbbell, Pill, AlertCircle,
  Upload, Home, Users, User, Send, MessageCircle, Heart, AlertTriangle, Star, Clock,
  ArrowLeft, GitCompare, TrendingDown, Minus, X, Video, CreditCard, Check, Plus,
  Search, MapPin, Phone, Mail, Shield, Settings, LogOut, ChevronRight, Bell
} from 'lucide-react';

// Demo data
const demoUser = { name: 'John Doe', email: 'john@example.com', role: 'patient', profile: { age: 32, gender: 'male', height: 175, weight: 72, bloodGroup: 'O+', allergies: ['Penicillin'], chronicConditions: ['None'] }, healthMetrics: { healthScore: 78, bmi: 23.5, lastCheckup: new Date() } };
const healthScores = [
  { date: 'Jul', score: 65 }, { date: 'Aug', score: 68 }, { date: 'Sep', score: 72 },
  { date: 'Oct', score: 70 }, { date: 'Nov', score: 75 }, { date: 'Dec', score: 78 }
];
const demoAnalysis = {
  healthScore: 78,
  summary: 'Overall health is good with some areas needing attention. Blood sugar levels are slightly elevated.',
  keyFindings: ['Hemoglobin levels are normal at 14.2 g/dL', 'Cholesterol is borderline high at 210 mg/dL', 'Vitamin D deficiency detected'],
  riskFactors: ['Pre-diabetic blood sugar levels', 'Sedentary lifestyle indicators'],
  metrics: { hemoglobin: { value: 14.2, unit: 'g/dL', status: 'normal', normalRange: '12-16' }, bloodSugar: { value: 115, unit: 'mg/dL', status: 'borderline', normalRange: '70-100' }, cholesterol: { value: 210, unit: 'mg/dL', status: 'borderline', normalRange: '<200' } },
  recommendations: {
    diet: [{ item: 'Leafy Greens', reason: 'Rich in iron and vitamins', priority: 'high' }, { item: 'Fatty Fish', reason: 'Omega-3 helps reduce cholesterol', priority: 'high' }, { item: 'Nuts & Seeds', reason: 'Good fats for heart health', priority: 'medium' }],
    exercise: [{ activity: 'Brisk Walking', duration: '30 mins', frequency: 'daily', reason: 'Improves cardiovascular health' }, { activity: 'Strength Training', duration: '20 mins', frequency: '3x/week', reason: 'Builds muscle' }],
    medicines: [{ name: 'Vitamin D3', dosage: '2000 IU', timing: 'Morning', note: 'Take for 3 months' }]
  },
  doctorConsultation: { recommended: true, urgency: 'medium', specializations: ['Endocrinologist', 'Cardiologist'], reason: 'Blood sugar and cholesterol need monitoring' }
};

const demoDoctors = [
  { _id: '1', name: 'Dr. Sarah Johnson', specialization: 'Cardiologist', experience: 12, fee: 800, rating: 4.8, reviews: 124, hospital: 'City Heart Hospital', available: true, slots: ['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '03:00 PM'] },
  { _id: '2', name: 'Dr. Raj Patel', specialization: 'Endocrinologist', experience: 15, fee: 900, rating: 4.9, reviews: 89, hospital: 'Diabetes Care Center', available: true, slots: ['10:00 AM', '11:00 AM', '04:00 PM', '05:00 PM'] },
  { _id: '3', name: 'Dr. Emily Chen', specialization: 'General Physician', experience: 8, fee: 500, rating: 4.7, reviews: 156, hospital: 'Family Health Clinic', available: true, slots: ['09:00 AM', '10:00 AM', '02:00 PM', '03:00 PM', '04:00 PM'] },
  { _id: '4', name: 'Dr. Michael Brown', specialization: 'Neurologist', experience: 18, fee: 1200, rating: 4.9, reviews: 67, hospital: 'Neuro Care Institute', available: true, slots: ['11:00 AM', '02:00 PM', '03:00 PM'] },
  { _id: '5', name: 'Dr. Priya Sharma', specialization: 'Dermatologist', experience: 10, fee: 600, rating: 4.6, reviews: 203, hospital: 'Skin & Care Clinic', available: false, slots: [] }
];

const demoAppointments = [
  { _id: 'apt1', doctor: demoDoctors[1], date: '2024-12-15', timeSlot: '10:00 AM', status: 'confirmed', type: 'online', meetLink: 'https://meet.healthai.com/apt-xyz123', amountPaid: 450 }
];

const demoComparison = {
  overallTrend: 'improved', summary: 'Your health has improved since your last checkup.',
  metricChanges: [{ metric: 'Health Score', previous: '72', current: '78', change: 'improved' }, { metric: 'Blood Sugar', previous: '125 mg/dL', current: '115 mg/dL', change: 'improved' }],
  improvements: ['Blood sugar reduced by 10 mg/dL', 'Health score improved by 6 points'],
  concerns: ['Cholesterol still borderline high']
};

const demoChatResponses = {
  'cholesterol': 'Your cholesterol level of 210 mg/dL is borderline high. Focus on reducing saturated fats and increasing fiber. Regular exercise helps too.',
  'worried': 'No immediate alarm, but attention needed. Blood sugar is pre-diabetic and cholesterol borderline. Lifestyle changes can help. Follow up with specialists.',
  'default': 'Your health score is 78/100. Key areas: managing blood sugar and cholesterol through diet and exercise. Ask me anything specific!'
};

const specializations = ['All', 'Cardiologist', 'Endocrinologist', 'General Physician', 'Neurologist', 'Dermatologist', 'Orthopedic', 'Pediatrician'];
const reportTypes = ['Blood Test', 'X-Ray', 'MRI', 'CT Scan', 'ECG', 'General Checkup'];

export default function DemoPreview() {
  const [view, setView] = useState('dashboard');
  const [isAdmin, setIsAdmin] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [showComparison, setShowComparison] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [bookingStep, setBookingStep] = useState(0);
  const [bookingData, setBookingData] = useState({ date: '', slot: '', type: 'online' });
  const [doctors, setDoctors] = useState(demoDoctors);
  const [appointments, setAppointments] = useState(demoAppointments);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [uploadStep, setUploadStep] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [newDoctor, setNewDoctor] = useState({ name: '', specialization: '', experience: '', fee: '', hospital: '' });
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [profileData, setProfileData] = useState(demoUser.profile);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    const userMsg = message.toLowerCase();
    setChatHistory(prev => [...prev, { role: 'user', content: message }]);
    setMessage('');
    setTimeout(() => {
      const key = Object.keys(demoChatResponses).find(k => userMsg.includes(k));
      setChatHistory(prev => [...prev, { role: 'assistant', content: demoChatResponses[key] || demoChatResponses.default }]);
    }, 800);
  };

  const handleBooking = () => {
    if (bookingStep === 0) { setBookingStep(1); }
    else if (bookingStep === 1 && bookingData.date && bookingData.slot) { setBookingStep(2); }
    else if (bookingStep === 2) {
      const newApt = { _id: `apt${Date.now()}`, doctor: selectedDoctor, date: bookingData.date, timeSlot: bookingData.slot, status: 'confirmed', type: bookingData.type, meetLink: `https://meet.healthai.com/apt-${Math.random().toString(36).substr(2, 9)}`, amountPaid: selectedDoctor.fee / 2 };
      setAppointments(prev => [newApt, ...prev]);
      setBookingStep(3);
    }
  };

  const closeBooking = () => { setSelectedDoctor(null); setBookingStep(0); setBookingData({ date: '', slot: '', type: 'online' }); };

  const handleUpload = () => {
    if (uploadStep === 0 && uploadedFile) { setUploadStep(1); setAnalyzing(true); setTimeout(() => { setAnalyzing(false); setUploadStep(2); }, 2500); }
  };

  const addDoctor = () => {
    if (newDoctor.name && newDoctor.specialization && newDoctor.fee) {
      setDoctors(prev => [...prev, { ...newDoctor, _id: `doc${Date.now()}`, rating: 4.5, reviews: 0, available: true, slots: ['10:00 AM', '02:00 PM', '04:00 PM'] }]);
      setNewDoctor({ name: '', specialization: '', experience: '', fee: '', hospital: '' });
      setShowAddDoctor(false);
    }
  };

  const filteredDoctors = doctors.filter(d => (filter === 'All' || d.specialization === filter) && d.name.toLowerCase().includes(search.toLowerCase()));
  const TrendIcon = ({ trend }) => trend === 'improved' ? <TrendingUp className="w-4 h-4 text-green-600" /> : trend === 'declined' ? <TrendingDown className="w-4 h-4 text-red-600" /> : <Minus className="w-4 h-4 text-gray-400" />;

  // Dashboard View
  const DashboardView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Welcome back, John!</h1><p className="text-gray-600">Here's your health overview</p></div>
        <button onClick={() => setView('upload')} className="btn-primary flex items-center gap-2"><Upload className="w-4 h-4" /> Upload Report</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[{ icon: Activity, color: 'primary', label: 'Health Score', value: '78/100' }, { icon: FileText, color: 'blue', label: 'Total Reports', value: '6' }, { icon: TrendingUp, color: 'green', label: 'BMI', value: '23.5' }, { icon: Calendar, color: 'purple', label: 'Last Checkup', value: 'Dec 5' }].map((stat, i) => (
          <div key={i} className="card"><div className="flex items-center gap-4">
            <div className={`w-12 h-12 bg-${stat.color}-100 rounded-xl flex items-center justify-center`}><stat.icon className={`w-6 h-6 text-${stat.color}-600`} /></div>
            <div><p className="text-sm text-gray-500">{stat.label}</p><p className="text-2xl font-bold text-gray-900">{stat.value}</p></div>
          </div></div>
        ))}
      </div>

      {/* Upcoming Appointments */}
      {appointments.length > 0 && (
        <div className="card border-2 border-green-200 bg-green-50/30">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-green-600" /> Upcoming Appointments</h2>
          {appointments.filter(a => a.status === 'confirmed').map(apt => (
            <div key={apt._id} className="bg-white p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-lg font-bold text-primary-600">{apt.doctor.name[4]}</div>
                <div>
                  <p className="font-medium">{apt.doctor.name}</p>
                  <p className="text-sm text-gray-500">{apt.doctor.specialization} • {apt.date} at {apt.timeSlot}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {apt.type === 'online' && apt.meetLink && (
                  <a href={apt.meetLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
                    <Video className="w-4 h-4" /> Join Call
                  </a>
                )}
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">Confirmed</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Health Score Trend</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={healthScores}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="date" /><YAxis domain={[0, 100]} /><Tooltip /><Line type="monotone" dataKey="score" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e' }} /></LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card"><div className="flex items-center gap-2 mb-4"><Apple className="w-5 h-5 text-green-600" /><h3 className="font-semibold">Diet Recommendations</h3></div>
          <ul className="space-y-2">{demoAnalysis.recommendations.diet.map((item, i) => <li key={i} className="flex items-start gap-2 text-sm"><span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2" /><span><strong>{item.item}</strong> - {item.reason}</span></li>)}</ul>
        </div>
        <div className="card"><div className="flex items-center gap-2 mb-4"><Dumbbell className="w-5 h-5 text-blue-600" /><h3 className="font-semibold">Exercise Plan</h3></div>
          <ul className="space-y-2">{demoAnalysis.recommendations.exercise.map((item, i) => <li key={i} className="flex items-start gap-2 text-sm"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2" /><span><strong>{item.activity}</strong> - {item.duration}, {item.frequency}</span></li>)}</ul>
        </div>
      </div>

      <div className="card border-l-4 border-yellow-500 bg-yellow-50">
        <div className="flex items-start gap-3"><AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
          <div><h3 className="font-semibold">Doctor Consultation Recommended</h3><p className="text-sm text-gray-600 mt-1">{demoAnalysis.doctorConsultation.reason}</p>
            <p className="text-sm mt-2"><strong>Specialists:</strong> {demoAnalysis.doctorConsultation.specializations.join(', ')}</p>
            <button onClick={() => setView('doctors')} className="btn-primary mt-3 text-sm">Find Doctors</button>
          </div>
        </div>
      </div>
    </div>
  );

  // Upload Report View
  const UploadView = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Upload Health Report</h1><p className="text-gray-600">Upload your medical report for AI-powered analysis</p></div>

      {uploadStep === 0 && (
        <>
          <div className="card">
            <label className="block text-sm font-medium text-gray-700 mb-3">Report Type</label>
            <select className="input">{reportTypes.map(t => <option key={t}>{t}</option>)}</select>
          </div>
          <div className="card">
            <label className="block text-sm font-medium text-gray-700 mb-3">Upload File</label>
            {!uploadedFile ? (
              <div onClick={() => setUploadedFile({ name: 'blood_test_report.pdf', size: 2.4 })} className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-primary-400 transition-colors">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Drag & drop or click to upload</p>
                <p className="text-sm text-gray-500">PDF, PNG, JPG - max 10MB</p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3"><FileText className="w-10 h-10 text-primary-600" /><div><p className="font-medium">{uploadedFile.name}</p><p className="text-sm text-gray-500">{uploadedFile.size} MB</p></div></div>
                <button onClick={() => setUploadedFile(null)} className="p-2 text-gray-400 hover:text-red-500"><X className="w-5 h-5" /></button>
              </div>
            )}
          </div>
          <button onClick={handleUpload} disabled={!uploadedFile} className="btn-primary w-full flex items-center justify-center gap-2"><Upload className="w-5 h-5" /> Analyze Report</button>
        </>
      )}

      {uploadStep === 1 && (
        <div className="card text-center py-12">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Analyzing Your Report...</h3>
          <p className="text-gray-600 mt-2">Our AI is extracting insights from your report</p>
          <div className="mt-6 space-y-2 text-left max-w-xs mx-auto">
            {['Extracting text from PDF...', 'Analyzing health metrics...', 'Generating recommendations...'].map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-600" /><span>{step}</span></div>
            ))}
          </div>
        </div>
      )}

      {uploadStep === 2 && (
        <div className="space-y-6">
          <div className="card bg-green-50 border-2 border-green-200">
            <div className="flex items-center gap-3"><Check className="w-8 h-8 text-green-600" /><div><h3 className="text-lg font-semibold text-green-800">Analysis Complete!</h3><p className="text-green-700">Your report has been analyzed successfully</p></div></div>
          </div>
          <button onClick={() => setView('report')} className="btn-primary w-full">View Full Analysis</button>
        </div>
      )}

      <div className="p-4 bg-blue-50 rounded-xl text-sm text-blue-800"><strong>Note:</strong> AI analysis is for informational purposes only. Always consult a healthcare provider.</div>
    </div>
  );

  // Doctors View
  const DoctorsView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">{isAdmin ? 'Manage Doctors' : 'Find Doctors'}</h1><p className="text-gray-600">{isAdmin ? 'Add and manage platform doctors' : 'Book consultations with specialists'}</p></div>
        {isAdmin && <button onClick={() => setShowAddDoctor(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Add Doctor</button>}
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Search doctors..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-12" /></div>
        <div className="flex gap-2 flex-wrap">{specializations.slice(0, 5).map(spec => <button key={spec} onClick={() => setFilter(spec)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === spec ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{spec}</button>)}</div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDoctors.map(doctor => (
          <div key={doctor._id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center text-2xl font-bold text-primary-600">{doctor.name.split(' ')[1]?.[0] || doctor.name[0]}</div>
              <div className="flex-1"><h3 className="font-semibold text-gray-900">{doctor.name}</h3><p className="text-sm text-primary-600">{doctor.specialization}</p>
                <div className="flex items-center gap-1 mt-1"><Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /><span className="text-sm font-medium">{doctor.rating}</span><span className="text-sm text-gray-500">({doctor.reviews})</span></div>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2"><Clock className="w-4 h-4" /><span>{doctor.experience} years experience</span></div>
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /><span>{doctor.hospital}</span></div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <div><span className="text-lg font-bold text-gray-900">₹{doctor.fee}</span><span className="text-sm text-gray-500"> / session</span></div>
              {doctor.available ? (
                <button onClick={() => { setSelectedDoctor(doctor); setBookingStep(0); }} className="btn-primary text-sm">Book Now</button>
              ) : (
                <span className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-xl text-sm">Unavailable</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Doctor Modal (Admin) */}
      {showAddDoctor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">Add New Doctor</h2><button onClick={() => setShowAddDoctor(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-2">Doctor Name</label><input type="text" value={newDoctor.name} onChange={(e) => setNewDoctor({ ...newDoctor, name: e.target.value })} className="input" placeholder="Dr. John Smith" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-2">Specialization</label><select value={newDoctor.specialization} onChange={(e) => setNewDoctor({ ...newDoctor, specialization: e.target.value })} className="input"><option value="">Select</option>{specializations.slice(1).map(s => <option key={s}>{s}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-2">Experience (yrs)</label><input type="number" value={newDoctor.experience} onChange={(e) => setNewDoctor({ ...newDoctor, experience: e.target.value })} className="input" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-2">Fee (₹)</label><input type="number" value={newDoctor.fee} onChange={(e) => setNewDoctor({ ...newDoctor, fee: e.target.value })} className="input" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-2">Hospital/Clinic</label><input type="text" value={newDoctor.hospital} onChange={(e) => setNewDoctor({ ...newDoctor, hospital: e.target.value })} className="input" /></div>
              <button onClick={addDoctor} className="btn-primary w-full">Add Doctor</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Booking Modal
  const BookingModal = () => selectedDoctor && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        {bookingStep < 3 && <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">{bookingStep === 0 ? 'Book Appointment' : bookingStep === 1 ? 'Select Slot' : 'Payment'}</h2><button onClick={closeBooking} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div>}
        
        {bookingStep === 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center text-xl font-bold text-primary-600">{selectedDoctor.name.split(' ')[1]?.[0]}</div>
              <div><p className="font-semibold">{selectedDoctor.name}</p><p className="text-sm text-primary-600">{selectedDoctor.specialization}</p><p className="text-sm text-gray-500">{selectedDoctor.hospital}</p></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Consultation Type</label>
              <div className="flex gap-4">{['online', 'in-person'].map(type => <label key={type} className="flex items-center gap-2 cursor-pointer"><input type="radio" name="type" checked={bookingData.type === type} onChange={() => setBookingData({ ...bookingData, type })} className="text-primary-600" />{type === 'online' ? <><Video className="w-4 h-4" /> Online</> : <><MapPin className="w-4 h-4" /> In-Person</>}</label>)}</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl"><p className="text-sm text-blue-800"><strong>Consultation Fee:</strong> ₹{selectedDoctor.fee}</p><p className="text-sm text-blue-700 mt-1">Pay ₹{selectedDoctor.fee / 2} now to confirm (50% advance)</p></div>
            <button onClick={handleBooking} className="btn-primary w-full">Select Date & Time</button>
          </div>
        )}

        {bookingStep === 1 && (
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label><input type="date" value={bookingData.date} onChange={(e) => setBookingData({ ...bookingData, date: e.target.value })} min={new Date().toISOString().split('T')[0]} className="input" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Available Slots</label>
              <div className="grid grid-cols-3 gap-2">{selectedDoctor.slots.map(slot => <button key={slot} onClick={() => setBookingData({ ...bookingData, slot })} className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${bookingData.slot === slot ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{slot}</button>)}</div>
            </div>
            <div className="flex gap-3"><button onClick={() => setBookingStep(0)} className="flex-1 py-2.5 border border-gray-300 rounded-xl font-medium">Back</button><button onClick={handleBooking} disabled={!bookingData.date || !bookingData.slot} className="flex-1 btn-primary">Continue to Payment</button></div>
          </div>
        )}

        {bookingStep === 2 && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-xl space-y-2">
              <div className="flex justify-between"><span className="text-gray-600">Doctor</span><span className="font-medium">{selectedDoctor.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Date</span><span className="font-medium">{bookingData.date}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Time</span><span className="font-medium">{bookingData.slot}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Type</span><span className="font-medium capitalize">{bookingData.type}</span></div>
              <div className="border-t pt-2 mt-2 flex justify-between"><span className="font-semibold">Amount to Pay</span><span className="font-bold text-primary-600">₹{selectedDoctor.fee / 2}</span></div>
            </div>
            <div className="p-4 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-2 mb-3"><CreditCard className="w-5 h-5 text-gray-600" /><span className="font-medium">Payment Method</span></div>
              <div className="space-y-2">{['UPI', 'Credit/Debit Card', 'Net Banking'].map(method => <label key={method} className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50"><input type="radio" name="payment" defaultChecked={method === 'UPI'} /><span>{method}</span></label>)}</div>
            </div>
            <button onClick={handleBooking} className="btn-primary w-full flex items-center justify-center gap-2"><Shield className="w-4 h-4" /> Pay ₹{selectedDoctor.fee / 2} Securely</button>
          </div>
        )}

        {bookingStep === 3 && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><Check className="w-8 h-8 text-green-600" /></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Booking Confirmed!</h3>
            <p className="text-gray-600 mb-4">Your appointment has been scheduled</p>
            <div className="p-4 bg-gray-50 rounded-xl text-left space-y-2 mb-4">
              <p><strong>Doctor:</strong> {selectedDoctor.name}</p>
              <p><strong>Date:</strong> {bookingData.date} at {bookingData.slot}</p>
              <p><strong>Type:</strong> {bookingData.type === 'online' ? 'Video Consultation' : 'In-Person'}</p>
              {bookingData.type === 'online' && <div className="mt-3 p-3 bg-blue-50 rounded-lg"><p className="text-sm text-blue-800 font-medium flex items-center gap-2"><Video className="w-4 h-4" /> Video Call Link</p><p className="text-sm text-blue-600 mt-1 break-all">https://meet.healthai.com/apt-{Math.random().toString(36).substr(2, 6)}</p><p className="text-xs text-blue-600 mt-2">Link will be available in your dashboard</p></div>}
            </div>
            <button onClick={() => { closeBooking(); setView('dashboard'); }} className="btn-primary w-full">Go to Dashboard</button>
          </div>
        )}
      </div>
    </div>
  );

  // Profile View
  const ProfileView = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1><p className="text-gray-600">Manage your personal and health information</p></div>

      <div className="card gradient-bg text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center"><Activity className="w-8 h-8" /></div>
          <div><h3 className="text-lg font-semibold">Health Score</h3><p className="text-3xl font-bold">78/100</p></div>
          <div className="ml-auto text-right"><p className="text-sm opacity-80">BMI</p><p className="text-2xl font-bold">23.5</p></div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><User className="w-5 h-5 text-primary-600" /> Basic Information</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label><input type="text" value={demoUser.name} className="input" readOnly /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-2">Email</label><input type="email" value={demoUser.email} className="input bg-gray-50" disabled /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-2">Age</label><input type="number" value={profileData.age} onChange={(e) => setProfileData({ ...profileData, age: e.target.value })} className="input" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-2">Gender</label><select value={profileData.gender} onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })} className="input"><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Health Information</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-2">Height (cm)</label><input type="number" value={profileData.height} onChange={(e) => setProfileData({ ...profileData, height: e.target.value })} className="input" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-2">Weight (kg)</label><input type="number" value={profileData.weight} onChange={(e) => setProfileData({ ...profileData, weight: e.target.value })} className="input" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-2">Blood Group</label><select value={profileData.bloodGroup} onChange={(e) => setProfileData({ ...profileData, bloodGroup: e.target.value })} className="input">{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg}>{bg}</option>)}</select></div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Medical History</h2>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-2">Allergies</label><input type="text" value={profileData.allergies?.join(', ')} className="input" placeholder="e.g., Penicillin, Peanuts" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-2">Chronic Conditions</label><input type="text" value={profileData.chronicConditions?.join(', ')} className="input" placeholder="e.g., Diabetes, Hypertension" /></div>
        </div>
      </div>

      <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={() => alert('Profile saved!')}><Check className="w-5 h-5" /> Save Changes</button>
    </div>
  );

  // Report View with Chat
  const ReportView = () => (
    <div className="space-y-6">
      <button onClick={() => setView('dashboard')} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back to Dashboard</button>

      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4"><div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center"><FileText className="w-7 h-7 text-primary-600" /></div><div><h1 className="text-2xl font-bold text-gray-900">Blood Test Report</h1><p className="text-gray-500">Analyzed on Dec 5, 2024</p></div></div>
          <div className="text-right"><div className="text-3xl font-bold text-primary-600">78</div><div className="text-sm text-gray-500">Health Score</div></div>
        </div>
        <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
          <button onClick={() => setShowComparison(!showComparison)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100"><GitCompare className="w-4 h-4" />{showComparison ? 'Hide' : 'Compare'}</button>
          <button onClick={() => setChatOpen(!chatOpen)} className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100"><MessageCircle className="w-4 h-4" />Ask AI</button>
        </div>
      </div>

      {showComparison && (
        <div className="card border-2 border-blue-200 bg-blue-50/50">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold flex items-center gap-2"><GitCompare className="w-5 h-5 text-blue-600" /> Health Comparison</h2><span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">↑ Improved</span></div>
          <div className="grid md:grid-cols-2 gap-4 mb-4"><div className="bg-white p-4 rounded-xl"><p className="text-sm text-gray-500">Previous (Oct)</p><p className="text-2xl font-bold text-gray-400">72/100</p></div><div className="bg-white p-4 rounded-xl"><p className="text-sm text-gray-500">Current (Dec)</p><p className="text-2xl font-bold text-primary-600">78/100</p></div></div>
          <p className="text-gray-700 mb-4">{demoComparison.summary}</p>
          <div className="space-y-2 mb-4">{demoComparison.metricChanges.map((m, i) => <div key={i} className="flex items-center justify-between bg-white p-3 rounded-lg"><div className="flex items-center gap-2"><TrendIcon trend={m.change} /><span className="font-medium">{m.metric}</span></div><div className="text-sm"><span className="text-gray-500">{m.previous}</span> → <span className="font-medium">{m.current}</span></div></div>)}</div>
        </div>
      )}

      {chatOpen && (
        <div className="card border-2 border-purple-200">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-purple-600" /> Ask About Your Report</h2>
          <div className="h-48 overflow-y-auto mb-4 space-y-3 p-3 bg-gray-50 rounded-xl">
            {chatHistory.length === 0 && <p className="text-gray-500 text-center py-6">Try: "What does my cholesterol mean?" or "Should I be worried?"</p>}
            {chatHistory.map((msg, i) => <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] p-3 rounded-xl ${msg.role === 'user' ? 'bg-purple-600 text-white' : 'bg-white border'}`}>{msg.content}</div></div>)}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="flex gap-2"><input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask a question..." className="input flex-1" /><button type="submit" className="btn-primary px-4"><Send className="w-5 h-5" /></button></form>
        </div>
      )}

      <div className="card"><h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Activity className="w-5 h-5 text-primary-600" /> Summary</h2><p className="text-gray-700">{demoAnalysis.summary}</p></div>

      {/* Metrics */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Health Metrics</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {Object.entries(demoAnalysis.metrics).map(([key, m]) => (
            <div key={key} className={`p-4 rounded-xl ${m.status === 'normal' ? 'bg-green-50' : 'bg-yellow-50'}`}>
              <p className="text-sm text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
              <p className="text-xl font-bold">{m.value} {m.unit}</p>
              <p className="text-xs text-gray-500">Normal: {m.normalRange}</p>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${m.status === 'normal' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>{m.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card"><h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Heart className="w-5 h-5 text-blue-600" /> Key Findings</h2><ul className="space-y-2">{demoAnalysis.keyFindings.map((f, i) => <li key={i} className="flex items-start gap-2 text-sm"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2" />{f}</li>)}</ul></div>
        <div className="card border-l-4 border-orange-400"><h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-600" /> Risk Factors</h2><ul className="space-y-2">{demoAnalysis.riskFactors.map((r, i) => <li key={i} className="flex items-start gap-2 text-sm"><span className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-2" />{r}</li>)}</ul></div>
      </div>

      <div className="card"><h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Apple className="w-5 h-5 text-green-600" /> Diet</h2><div className="grid md:grid-cols-2 gap-4">{demoAnalysis.recommendations.diet.map((d, i) => <div key={i} className="p-4 bg-green-50 rounded-xl"><div className="flex justify-between mb-2"><span className="font-medium text-green-800">{d.item}</span><span className={`px-2 py-0.5 rounded text-xs ${d.priority === 'high' ? 'bg-green-200 text-green-800' : 'bg-gray-200'}`}>{d.priority}</span></div><p className="text-sm text-green-700">{d.reason}</p></div>)}</div></div>

      <div className="card"><h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Dumbbell className="w-5 h-5 text-blue-600" /> Exercise</h2>{demoAnalysis.recommendations.exercise.map((e, i) => <div key={i} className="p-4 bg-blue-50 rounded-xl mb-3"><div className="flex justify-between mb-2"><span className="font-medium text-blue-800">{e.activity}</span><span className="text-sm text-blue-600">{e.duration} • {e.frequency}</span></div><p className="text-sm text-blue-700">{e.reason}</p></div>)}</div>

      <div className="card border-2 border-primary-200 bg-primary-50/30">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-primary-600" /> Recommended Doctors</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {demoDoctors.filter(d => demoAnalysis.doctorConsultation.specializations.includes(d.specialization)).map(doc => (
            <div key={doc._id} className="bg-white p-4 rounded-xl shadow-sm">
              <div className="flex items-center gap-3 mb-3"><div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-lg font-bold text-primary-600">{doc.name.split(' ')[1][0]}</div><div><p className="font-medium">{doc.name}</p><p className="text-sm text-primary-600">{doc.specialization}</p></div></div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2"><Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />{doc.rating} • <Clock className="w-4 h-4" />{doc.experience} yrs</div>
              <div className="flex justify-between mt-3 pt-3 border-t"><span className="font-semibold">₹{doc.fee}</span><button onClick={() => { setSelectedDoctor(doc); setView('doctors'); }} className="text-sm bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700">Book Now</button></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Sidebar
  const Sidebar = () => (
    <aside className="w-64 bg-white border-r border-gray-200 fixed h-full flex flex-col">
      <div className="p-6">
        <div className="flex items-center gap-2"><div className="w-10 h-10 gradient-bg rounded-xl flex items-center justify-center"><Activity className="w-6 h-6 text-white" /></div><span className="text-xl font-bold text-gray-900">HealthAI</span></div>
        <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Demo Mode</span>
      </div>
      <nav className="px-4 space-y-1 flex-1">
        {[{ id: 'dashboard', icon: Home, label: 'Dashboard' }, { id: 'upload', icon: Upload, label: 'Upload Report' }, { id: 'report', icon: FileText, label: 'Report & Chat' }, { id: 'doctors', icon: Users, label: 'Doctors' }, { id: 'profile', icon: User, label: 'Profile' }].map(item => (
          <button key={item.id} onClick={() => setView(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === item.id ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-50'}`}><item.icon className="w-5 h-5" /><span className="font-medium">{item.label}</span></button>
        ))}
      </nav>
      
      {/* Admin Toggle */}
      <div className="px-4 py-3 border-t border-gray-100">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
          <span className="text-sm font-medium text-gray-700">Admin Mode</span>
          <Settings className="w-4 h-4 text-gray-400" />
        </label>
      </div>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center"><span className="text-primary-600 font-semibold">J</span></div>
          <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{isAdmin ? 'Admin User' : 'John Doe'}</p><p className="text-xs text-gray-500 truncate">{isAdmin ? 'admin@healthai.com' : 'john@example.com'}</p></div>
          <LogOut className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        {view === 'dashboard' && <DashboardView />}
        {view === 'upload' && <UploadView />}
        {view === 'report' && <ReportView />}
        {view === 'doctors' && <DoctorsView />}
        {view === 'profile' && <ProfileView />}
      </main>
      <BookingModal />
    </div>
  );
}
