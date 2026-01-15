import { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { Video, VideoOff, Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function VideoTest() {
  const [client, setClient] = useState(null);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [isJoined, setIsJoined] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Your Agora credentials
  const APP_ID = 'e788e8f838484d4dafe4705d682df57c';
  const CHANNEL = 'healthai-test';
  const TOKEN = null; // For testing without token

  useEffect(() => {
    initializeAgora();
    return () => {
      cleanup();
    };
  }, []);

  const initializeAgora = () => {
    const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    
    agoraClient.on('user-published', async (user, mediaType) => {
      await agoraClient.subscribe(user, mediaType);
      
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

    agoraClient.on('user-unpublished', (user) => {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    });

    agoraClient.on('user-left', (user) => {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    });

    setClient(agoraClient);
  };

  const joinChannel = async () => {
    if (!client) return;

    try {
      // Generate a random UID
      const uid = Math.floor(Math.random() * 10000);
      
      // Get token from server
      let token = null;
      try {
        const response = await fetch('/api/doctors/generate-video-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            channelName: CHANNEL, 
            uid: uid 
          }),
        });
        
        const tokenData = await response.json();
        if (tokenData.success) {
          token = tokenData.token;
          console.log('Generated token:', token ? 'Token received' : 'No token (testing mode)');
        }
      } catch (error) {
        console.log('Failed to get token from server, using null token:', error);
      }
      
      // Join the channel
      await client.join(APP_ID, CHANNEL, token, uid);
      
      // Create local tracks
      const videoTrack = await AgoraRTC.createCameraVideoTrack();
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      
      setLocalVideoTrack(videoTrack);
      setLocalAudioTrack(audioTrack);
      
      // Play local video
      if (localVideoRef.current) {
        videoTrack.play(localVideoRef.current);
      }
      
      // Publish tracks
      await client.publish([videoTrack, audioTrack]);
      
      setIsJoined(true);
      toast.success('Joined video call successfully!');
    } catch (error) {
      console.error('Error joining channel:', error);
      toast.error('Failed to join video call: ' + error.message);
    }
  };

  const leaveChannel = async () => {
    if (!client) return;

    try {
      await cleanup();
      setIsJoined(false);
      setRemoteUsers([]);
      toast.success('Left video call');
    } catch (error) {
      console.error('Error leaving channel:', error);
      toast.error('Failed to leave video call');
    }
  };

  const cleanup = async () => {
    if (localVideoTrack) {
      localVideoTrack.stop();
      localVideoTrack.close();
      setLocalVideoTrack(null);
    }
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
      setLocalAudioTrack(null);
    }
    if (client && isJoined) {
      await client.leave();
    }
  };

  const toggleVideo = async () => {
    if (localVideoTrack) {
      const enabled = !isVideoEnabled;
      await localVideoTrack.setEnabled(enabled);
      setIsVideoEnabled(enabled);
    }
  };

  const toggleAudio = async () => {
    if (localAudioTrack) {
      const enabled = !isAudioEnabled;
      await localAudioTrack.setEnabled(enabled);
      setIsAudioEnabled(enabled);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Video Call Test</h1>
          <p className="text-slate-400">Test your Agora.io video calling setup</p>
          <div className="mt-4 p-4 bg-slate-800 rounded-lg">
            <p className="text-sm text-slate-300">
              <strong>Channel:</strong> {CHANNEL} | <strong>App ID:</strong> {APP_ID.substring(0, 8)}...
            </p>
          </div>
        </div>

        {/* Video Area */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Local Video */}
          <div className="bg-slate-900 rounded-2xl overflow-hidden aspect-video relative">
            <div 
              ref={localVideoRef}
              className="w-full h-full bg-slate-800"
            />
            <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
              You {isJoined ? '(Live)' : '(Preview)'}
            </div>
            {!isVideoEnabled && (
              <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                <VideoOff className="w-16 h-16 text-slate-400" />
              </div>
            )}
          </div>

          {/* Remote Video */}
          <div className="bg-slate-900 rounded-2xl overflow-hidden aspect-video relative">
            {remoteUsers.length > 0 ? (
              <div 
                ref={remoteVideoRef}
                className="w-full h-full bg-slate-800"
              />
            ) : (
              <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                <div className="text-center">
                  <Video className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-400">
                    {isJoined ? 'Waiting for others to join...' : 'Remote participant will appear here'}
                  </p>
                </div>
              </div>
            )}
            {remoteUsers.length > 0 && (
              <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                Remote User
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full transition-colors ${
              isAudioEnabled ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-500 text-white hover:bg-red-600'
            }`}
            disabled={!isJoined}
          >
            {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>

          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-colors ${
              isVideoEnabled ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-500 text-white hover:bg-red-600'
            }`}
            disabled={!isJoined}
          >
            {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>

          {!isJoined ? (
            <button
              onClick={joinChannel}
              className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-full font-medium transition-colors flex items-center gap-2"
            >
              <Phone className="w-5 h-5" />
              Join Call
            </button>
          ) : (
            <button
              onClick={leaveChannel}
              className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-full font-medium transition-colors flex items-center gap-2"
            >
              <PhoneOff className="w-5 h-5" />
              Leave Call
            </button>
          )}
        </div>

        {/* Status */}
        <div className="text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
            isJoined ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isJoined ? 'bg-green-400 animate-pulse' : 'bg-slate-400'
            }`}></div>
            {isJoined ? `Connected (${remoteUsers.length + 1} participants)` : 'Not connected'}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Testing Instructions:</h3>
          <ol className="text-slate-300 space-y-2 list-decimal list-inside">
            <li>Click "Join Call" to start the video call</li>
            <li>Allow camera and microphone permissions when prompted</li>
            <li>Open this page in another browser tab/window to test with multiple participants</li>
            <li>Test the mute/unmute and video on/off controls</li>
            <li>Check that you can see and hear other participants</li>
          </ol>
          
          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-blue-400 text-sm">
              <strong>Note:</strong> This is using your Agora.io free tier (10,000 minutes/month). 
              Perfect for testing and development!
            </p>
          </div>

          <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <h4 className="text-yellow-400 font-medium mb-2">🔧 Troubleshooting</h4>
            <div className="text-yellow-300 text-sm space-y-1">
              <p><strong>If video call fails:</strong></p>
              <p>• Check browser console for error messages</p>
              <p>• Ensure camera/microphone permissions are granted</p>
              <p>• Try disabling token authentication in Agora Console</p>
              <p>• Check server logs for token generation issues</p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <h4 className="text-green-400 font-medium mb-2">✅ Quick Fix</h4>
            <div className="text-green-300 text-sm">
              <p><strong>Easiest solution:</strong> Go to Agora Console → Project Settings → Change Authentication from "App ID + Token" to "App ID only"</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}