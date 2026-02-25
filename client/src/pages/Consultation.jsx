import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doctorService } from '../services/api';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { 
  Video, Phone, MessageSquare, Calendar, Clock, User, Star, 
  MapPin, Award, CheckCircle, X, ArrowLeft, FileText, Pill,
  Heart, Activity, AlertCircle, Send, Mic, MicOff, VideoOff,
  Camera, Settings, Volume2, VolumeX, Users, Monitor
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Consultation() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [consultationActive, setConsultationActive] = useState(false);
  const [consultationMode, setConsultationMode] = useState('video'); // video, audio, chat
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [mediaControls, setMediaControls] = useState({
    video: true,
    audio: true,
    speaker: true
  });

  // Agora video call state
  const [agoraClient, setAgoraClient] = useState(null);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [isJoined, setIsJoined] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    fetchAppointment();
    initializeAgoraClient();
    
    return () => {
      cleanupAgoraClient();
    };
  }, [appointmentId]);

  const initializeAgoraClient = () => {
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    
    client.on('user-published', async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      
      if (mediaType === 'video') {
        setRemoteUsers(prev => [...prev.filter(u => u.uid !== user.uid), user]);
        if (remoteVideoRef.current) {
          user.videoTrack.play(remoteVideoRef.current);
        }
      }
      
      if (mediaType === 'audio') {
        user.audioTrack.play();
      }
    });

    client.on('user-unpublished', (user) => {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    });

    client.on('user-left', (user) => {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    });

    setAgoraClient(client);
  };

  const cleanupAgoraClient = async () => {
    if (localVideoTrack) {
      localVideoTrack.stop();
      localVideoTrack.close();
    }
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
    }
    if (agoraClient && isJoined) {
      await agoraClient.leave();
    }
  };

  const fetchAppointment = async () => {
    try {
      const { data } = await doctorService.getAppointmentDetails(appointmentId);
      setAppointment(data);
    } catch (error) {
      toast.error('Failed to load appointment details');
      navigate('/doctors');
    } finally {
      setLoading(false);
    }
  };

  const joinVideoCall = async () => {
    if (!agoraClient || !appointment?.videoRoom) {
      toast.error('Video call not available');
      return;
    }

    try {
      const { config } = appointment.videoRoom;
      
      if (config.type === 'agora' && config.appId && config.token) {
        // Join Agora channel
        await agoraClient.join(
          config.appId,
          config.channelName,
          config.token,
          config.uid
        );

        // Create and publish local tracks
        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();

        setLocalVideoTrack(videoTrack);
        setLocalAudioTrack(audioTrack);

        // Play local video
        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }

        // Publish tracks
        await agoraClient.publish([videoTrack, audioTrack]);
        setIsJoined(true);
        
        toast.success('Joined video call successfully');
      } else {
        // Fallback to simple WebRTC or show error
        toast.error('Video call configuration not available');
      }
    } catch (error) {
      console.error('Error joining video call:', error);
      toast.error('Failed to join video call');
    }
  };

  const leaveVideoCall = async () => {
    try {
      await cleanupAgoraClient();
      setIsJoined(false);
      setRemoteUsers([]);
      toast.success('Left video call');
    } catch (error) {
      console.error('Error leaving video call:', error);
    }
  };

  const startConsultation = async () => {
    try {
      await doctorService.startConsultation(appointmentId);
      setConsultationActive(true);
      
      if (appointment?.type === 'video') {
        await joinVideoCall();
      }
      
      toast.success('Consultation started');
    } catch (error) {
      toast.error('Failed to start consultation');
    }
  };

  const endConsultation = async () => {
    try {
      if (isJoined) {
        await leaveVideoCall();
      }
      
      await doctorService.endConsultation(appointmentId);
      setConsultationActive(false);
      toast.success('Consultation ended');
      navigate('/consultation-summary/' + appointmentId);
    } catch (error) {
      toast.error('Failed to end consultation');
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    
    const message = {
      id: Date.now(),
      text: newMessage,
      sender: 'patient',
      timestamp: new Date()
    };
    
    setMessages([...messages, message]);
    setNewMessage('');
  };

  const toggleMedia = async (type) => {
    if (type === 'video' && localVideoTrack) {
      const enabled = !mediaControls.video;
      await localVideoTrack.setEnabled(enabled);
      setMediaControls(prev => ({ ...prev, video: enabled }));
    } else if (type === 'audio' && localAudioTrack) {
      const enabled = !mediaControls.audio;
      await localAudioTrack.setEnabled(enabled);
      setMediaControls(prev => ({ ...prev, audio: enabled }));
    } else if (type === 'speaker') {
      setMediaControls(prev => ({ ...prev, speaker: !prev.speaker }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Appointment Not Found</h2>
        <p className="text-slate-400">The appointment you're looking for doesn't exist.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Header */}
      <div className="bg-[#111827] border-b border-slate-700 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/doctors')}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-orange-500 flex items-center justify-center text-lg font-bold text-white">
                {appointment.doctor?.name?.[0]?.toUpperCase() || 'D'}
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">
                  Dr. {appointment.doctor?.name}
                </h1>
                <p className="text-sm text-slate-400">{appointment.doctor?.specialization}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              appointment.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
              appointment.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-slate-500/20 text-slate-400'
            }`}>
              {appointment.status}
            </span>
          </div>
        </div>
      </div>

      {!consultationActive ? (
        /* Pre-Consultation View */
        <div className="max-w-4xl mx-auto p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Appointment Details */}
            <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
              <h2 className="text-lg font-bold text-white mb-6">Appointment Details</h2>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  <div>
                    <p className="text-white font-medium">Date & Time</p>
                    <p className="text-slate-400 text-sm">
                      {new Date(appointment.date).toLocaleDateString()} at {appointment.timeSlot}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Video className="w-5 h-5 text-cyan-400" />
                  <div>
                    <p className="text-white font-medium">Consultation Type</p>
                    <p className="text-slate-400 text-sm capitalize">{appointment.type}</p>
                  </div>
                </div>
                
                {appointment.symptoms && (
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-cyan-400 mt-0.5" />
                    <div>
                      <p className="text-white font-medium">Symptoms</p>
                      <p className="text-slate-400 text-sm">{appointment.symptoms}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Doctor Information */}
            <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
              <h2 className="text-lg font-bold text-white mb-6">Doctor Information</h2>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Award className="w-5 h-5 text-cyan-400" />
                  <div>
                    <p className="text-white font-medium">Experience</p>
                    <p className="text-slate-400 text-sm">{appointment.doctor?.experience || '5+'} years</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-cyan-400" />
                  <div>
                    <p className="text-white font-medium">Location</p>
                    <p className="text-slate-400 text-sm">{appointment.doctor?.location || 'Online'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Star className="w-5 h-5 text-cyan-400" />
                  <div>
                    <p className="text-white font-medium">Rating</p>
                    <div className="flex items-center gap-1">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                      <span className="text-slate-400 text-sm ml-1">(4.8)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Start Consultation */}
          <div className="mt-8 text-center">
            <button
              onClick={startConsultation}
              className="bg-gradient-to-r from-purple-500 to-orange-500 hover:from-purple-600 hover:to-orange-600 text-white px-8 py-4 rounded-xl font-medium transition-all inline-flex items-center gap-2"
            >
              <Video className="w-5 h-5" />
              Start Consultation
            </button>
          </div>
        </div>
      ) : (
        /* Active Consultation View */
        <div className="h-[calc(100vh-80px)] flex">
          {/* Video/Audio Area */}
          <div className="flex-1 bg-slate-900 relative">
            {consultationMode === 'video' && (
              <div className="h-full relative">
                {/* Remote Video (Doctor) */}
                <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                  {remoteUsers.length > 0 ? (
                    <div 
                      ref={remoteVideoRef}
                      className="w-full h-full"
                      style={{ background: '#1e293b' }}
                    />
                  ) : (
                    <div className="text-center">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-r from-purple-500 to-orange-500 flex items-center justify-center text-4xl font-bold text-white mx-auto mb-4">
                        {appointment.doctor?.name?.[0]?.toUpperCase() || 'D'}
                      </div>
                      <p className="text-white text-lg">Dr. {appointment.doctor?.name}</p>
                      <p className="text-slate-400">
                        {isJoined ? 'Waiting for doctor to join...' : 'Video consultation ready'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Local Video (Patient) - Picture in Picture */}
                {isJoined && (
                  <div className="absolute top-4 right-4 w-48 h-36 bg-slate-800 rounded-lg overflow-hidden border-2 border-slate-600">
                    <div 
                      ref={localVideoRef}
                      className="w-full h-full"
                      style={{ background: '#1e293b' }}
                    />
                    <div className="absolute bottom-2 left-2 text-white text-xs bg-black/50 px-2 py-1 rounded">
                      You
                    </div>
                  </div>
                )}

                {/* Connection Status */}
                <div className="absolute top-4 left-4">
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                    isJoined ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      isJoined ? 'bg-green-400' : 'bg-yellow-400'
                    } animate-pulse`}></div>
                    {isJoined ? 'Connected' : 'Connecting...'}
                  </div>
                </div>

                {/* Participant Count */}
                {isJoined && (
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
                    <div className="flex items-center gap-2 bg-slate-800/90 backdrop-blur-sm rounded-full px-3 py-1 text-white text-sm">
                      <Users className="w-4 h-4" />
                      {remoteUsers.length + 1} participants
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Media Controls */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
              <div className="flex items-center gap-4 bg-slate-800/90 backdrop-blur-sm rounded-full px-6 py-3">
                <button
                  onClick={() => toggleMedia('audio')}
                  className={`p-3 rounded-full transition-colors ${
                    mediaControls.audio ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                  title={mediaControls.audio ? 'Mute microphone' : 'Unmute microphone'}
                >
                  {mediaControls.audio ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                
                <button
                  onClick={() => toggleMedia('video')}
                  className={`p-3 rounded-full transition-colors ${
                    mediaControls.video ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                  title={mediaControls.video ? 'Turn off camera' : 'Turn on camera'}
                >
                  {mediaControls.video ? <Camera className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
                
                <button
                  onClick={() => toggleMedia('speaker')}
                  className={`p-3 rounded-full transition-colors ${
                    mediaControls.speaker ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                  title={mediaControls.speaker ? 'Mute speaker' : 'Unmute speaker'}
                >
                  {mediaControls.speaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>

                {/* Screen Share Button */}
                <button
                  className="p-3 rounded-full bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                  title="Share screen"
                >
                  <Monitor className="w-5 h-5" />
                </button>
                
                <button
                  onClick={endConsultation}
                  className="p-3 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
                  title="End consultation"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Chat Sidebar */}
          <div className="w-80 bg-[#111827] border-l border-slate-700 flex flex-col">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-white font-medium">Chat</h3>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {messages.map(message => (
                <div key={message.id} className={`flex ${message.sender === 'patient' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                    message.sender === 'patient' 
                      ? 'bg-cyan-500 text-white' 
                      : 'bg-slate-700 text-white'
                  }`}>
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 border-t border-slate-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={sendMessage}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white p-2 rounded-lg transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}