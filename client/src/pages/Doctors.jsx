import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doctorService } from '../services/api';
import { Search, Star, Calendar, Clock, Video, X, User, Award, MapPin, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const specializations = ['All', 'General Physician', 'Nutritionist', 'Cardiologist', 'Dermatologist', 'Endocrinologist', 'Neurologist'];

export default function Doctors() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [bookingData, setBookingData] = useState({ date: '', timeSlot: '', symptoms: '' });
  const [booking, setBooking] = useState(false);
  const [activeTab, setActiveTab] = useState('doctors');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    try {
      const params = {};
      if (filter !== 'All') params.specialization = filter;
      const [doctorsRes, appointmentsRes] = await Promise.all([
        doctorService.getAll(params),
        doctorService.getAppointments()
      ]);
      setDoctors(doctorsRes.data);
      setAppointments(appointmentsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch available slots when date changes
  useEffect(() => {
    if (selectedDoctor && bookingData.date) {
      fetchAvailableSlots();
    }
  }, [selectedDoctor, bookingData.date]);

  const fetchAvailableSlots = async () => {
    if (!selectedDoctor || !bookingData.date) return;
    setLoadingSlots(true);
    try {
      // Don't pass date filter - get all 7 days and filter on frontend
      const { data } = await doctorService.getDoctorAvailableSlots(selectedDoctor._id);
      console.log('Slots response:', data);
      const dateKey = new Date(bookingData.date).toDateString();
      console.log('Looking for dateKey:', dateKey);
      console.log('Available keys:', Object.keys(data.slotsByDate || {}));
      setAvailableSlots(data.slotsByDate?.[dateKey] || []);
    } catch (error) {
      console.error('Failed to fetch slots:', error);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const filteredDoctors = doctors.filter(doc =>
    (doc.name || doc.user?.name)?.toLowerCase().includes(search.toLowerCase()) ||
    doc.specialization?.toLowerCase().includes(search.toLowerCase())
  );

  const handleBook = async (e) => {
    e.preventDefault();
    if (!bookingData.date || !bookingData.timeSlot) {
      toast.error('Please select date and time');
      return;
    }
    setBooking(true);
    try {
      await doctorService.bookAppointment({ doctorId: selectedDoctor._id, ...bookingData, type: 'video' });
      toast.success('Appointment booked successfully!');
      setSelectedDoctor(null);
      setBookingData({ date: '', timeSlot: '', symptoms: '' });
      setAvailableSlots([]);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to book appointment');
    } finally {
      setBooking(false);
    }
  };

  // Get next 7 days for date selection
  const getNext7Days = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      days.push({
        value: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        isToday: i === 0
      });
    }
    return days;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Find Doctors</h1>
        <p className="text-slate-500 mt-1">Book video consultations with healthcare specialists</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('doctors')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${activeTab === 'doctors' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <User className="w-4 h-4" /> Find Doctors
        </button>
        <button
          onClick={() => setActiveTab('appointments')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${activeTab === 'appointments' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Calendar className="w-4 h-4" /> My Appointments
          {appointments.length > 0 && <span className="ml-1 px-2 py-0.5 bg-cyan-100 text-cyan-600 text-xs rounded-full">{appointments.length}</span>}
        </button>
      </div>

      {/* Doctors Tab */}
      {activeTab === 'doctors' && (
        <>
          {/* Search & Filter */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search doctors..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:border-cyan-500 focus:outline-none"
              >
                {specializations.map(spec => <option key={spec} value={spec}>{spec}</option>)}
              </select>
            </div>
          </div>

          {/* Doctors List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto"></div>
              <p className="text-slate-500 mt-4">Loading doctors...</p>
            </div>
          ) : filteredDoctors.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDoctors.map((doctor) => {
                const name = doctor.name || doctor.user?.name || 'Doctor';
                return (
                  <div key={doctor._id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center text-xl font-bold text-white">
                        {name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-800">Dr. {name}</h3>
                        <p className="text-sm text-cyan-600 font-medium">{doctor.specialization}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                          <span className="text-sm text-slate-600">{doctor.rating?.toFixed(1) || '4.5'}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-sm text-slate-500">{doctor.experience || 5}+ yrs</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <div>
                        <span className="text-xl font-bold text-slate-800">₹{doctor.consultationFee || 500}</span>
                        <span className="text-sm text-slate-500"> / session</span>
                      </div>
                      <button
                        onClick={() => setSelectedDoctor(doctor)}
                        className="px-4 py-2 bg-gradient-to-r from-purple-500 to-orange-500 text-white font-medium rounded-xl hover:shadow-lg transition-all"
                      >
                        Book Now
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
              <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No doctors found</p>
            </div>
          )}
        </>
      )}

      {/* Appointments Tab */}
      {activeTab === 'appointments' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Your Appointments</h2>
          {appointments.length > 0 ? (
            <div className="space-y-3">
              {appointments.map((apt) => (
                <div key={apt._id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center text-white font-bold">
                        {(apt.doctor?.name || apt.doctor?.user?.name)?.[0]?.toUpperCase() || 'D'}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">Dr. {apt.doctor?.name || apt.doctor?.user?.name}</p>
                        <p className="text-sm text-slate-500">
                          {new Date(apt.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {apt.timeSlot}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        apt.status === 'completed' ? 'bg-green-100 text-green-600' :
                        apt.status === 'scheduled' ? 'bg-amber-100 text-amber-600' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {apt.status}
                      </span>
                      {apt.status === 'scheduled' && (
                        <button
                          onClick={() => navigate(`/consultation/${apt._id}`)}
                          className="px-3 py-1 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600"
                        >
                          Join Call
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No appointments yet</p>
              <button onClick={() => setActiveTab('doctors')} className="mt-3 text-cyan-600 font-medium hover:text-cyan-700">
                Book your first appointment →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Booking Modal */}
      {selectedDoctor && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800">Book Appointment</h2>
              <button onClick={() => { setSelectedDoctor(null); setAvailableSlots([]); setBookingData({ date: '', timeSlot: '', symptoms: '' }); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Doctor Info */}
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center text-white font-bold">
                {(selectedDoctor.name || selectedDoctor.user?.name)?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-slate-800">Dr. {selectedDoctor.name || selectedDoctor.user?.name}</p>
                <p className="text-sm text-cyan-600">{selectedDoctor.specialization}</p>
              </div>
            </div>

            <form onSubmit={handleBook} className="space-y-5">
              {/* Date Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Date</label>
                <div className="grid grid-cols-4 gap-2">
                  {getNext7Days().map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => setBookingData({ ...bookingData, date: day.value, timeSlot: '' })}
                      className={`p-2 rounded-xl text-center transition-all ${
                        bookingData.date === day.value
                          ? 'bg-cyan-500 text-white'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      <div className="text-xs font-medium">{day.label.split(' ')[0]}</div>
                      <div className="text-sm font-bold">{day.label.split(' ')[2]}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Slots */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Time</label>
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-6 h-6 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
                    <span className="ml-2 text-slate-500 text-sm">Loading slots...</span>
                  </div>
                ) : availableSlots.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {availableSlots.map((slot) => {
                        const isSelected = bookingData.timeSlot === slot.timeSlot;
                        const isPassed = slot.status === 'passed';
                        const isBooked = slot.status === 'booked';
                        const isBlocked = slot.status === 'blocked';
                        const isAvailable = slot.status === 'available';
                        
                        return (
                          <button
                            key={slot.timeSlot}
                            type="button"
                            onClick={() => isAvailable && setBookingData({ ...bookingData, timeSlot: slot.timeSlot })}
                            disabled={!isAvailable}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                              isSelected
                                ? 'bg-cyan-500 text-white ring-2 ring-cyan-300'
                                : isPassed
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed line-through'
                                : isBooked
                                ? 'bg-red-50 text-red-400 cursor-not-allowed border border-red-200'
                                : isBlocked
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-emerald-100 text-emerald-600 border border-emerald-200 hover:bg-emerald-200 cursor-pointer'
                            }`}
                            title={isPassed ? 'Time passed' : isBooked ? 'Already booked' : isBlocked ? 'Not available' : 'Available'}
                          >
                            {slot.timeSlot}
                            {isBooked && <span className="ml-1 text-xs">(Booked)</span>}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-emerald-100 border border-emerald-300"></span> Available
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-red-50 border border-red-200"></span> Booked
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-slate-100 border border-slate-200"></span> Passed/Unavailable
                      </span>
                    </div>
                  </>
                ) : bookingData.date ? (
                  <div className="text-center py-6 bg-slate-50 rounded-xl">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">No slots available for this date</p>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-slate-50 rounded-xl">
                    <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">Select a date first</p>
                  </div>
                )}
              </div>

              {/* Symptoms */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Symptoms (Optional)</label>
                <textarea
                  value={bookingData.symptoms}
                  onChange={(e) => setBookingData({ ...bookingData, symptoms: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none resize-none"
                  rows={3}
                  placeholder="Describe your symptoms..."
                />
              </div>

              {/* Consultation Type */}
              <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-cyan-600" />
                  <span className="font-medium text-cyan-700">Video Consultation</span>
                </div>
                <p className="text-xs text-cyan-600 mt-1">You'll receive a video call link via email</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setSelectedDoctor(null); setAvailableSlots([]); }}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={booking || !bookingData.date || !bookingData.timeSlot}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-orange-500 text-white font-medium rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {booking ? 'Booking...' : `Confirm • ₹${selectedDoctor.consultationFee || 500}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
