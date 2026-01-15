const { RtcTokenBuilder, RtcRole } = require('agora-token');
const { v4: uuidv4 } = require('uuid');

class VideoService {
  constructor() {
    this.appId = process.env.AGORA_APP_ID;
    this.appCertificate = process.env.AGORA_APP_CERTIFICATE;
  }

  // Generate Agora RTC token for video call
  generateAgoraToken(channelName, uid, role = 'publisher') {
    if (!this.appId || !this.appCertificate) {
      console.log('Agora credentials not configured, using null token');
      return {
        token: null,
        appId: this.appId,
        channelName,
        uid,
        expiry: null
      };
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + 3600; // Token valid for 1 hour

    const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    
    try {
      const token = RtcTokenBuilder.buildTokenWithUid(
        this.appId,
        this.appCertificate,
        channelName,
        uid,
        agoraRole,
        privilegeExpiredTs
      );

      return {
        token,
        appId: this.appId,
        channelName,
        uid,
        expiry: privilegeExpiredTs
      };
    } catch (error) {
      console.error('Error generating Agora token:', error);
      return {
        token: null,
        appId: this.appId,
        channelName,
        uid,
        expiry: null
      };
    }
  }

  // Create a video room for consultation
  createConsultationRoom(appointmentId, doctorId, patientId) {
    const channelName = `consultation_${appointmentId}`;
    
    // Generate tokens for both doctor and patient
    const doctorToken = this.generateAgoraToken(channelName, doctorId, 'publisher');
    const patientToken = this.generateAgoraToken(channelName, patientId, 'publisher');

    return {
      roomId: channelName,
      doctor: {
        ...doctorToken,
        role: 'doctor'
      },
      patient: {
        ...patientToken,
        role: 'patient'
      },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
    };
  }

  // Generate token for test channel
  generateTestToken(channelName = 'healthai-test', uid = null) {
    if (!uid) {
      uid = Math.floor(Math.random() * 10000);
    }
    
    return this.generateAgoraToken(channelName, uid, 'publisher');
  }

  // Alternative: Simple WebRTC room (no external service needed)
  createSimpleWebRTCRoom(appointmentId) {
    const roomId = `room_${appointmentId}_${uuidv4().substring(0, 8)}`;
    
    return {
      roomId,
      type: 'webrtc',
      signalServer: `${process.env.APP_URL}/api/video/signal`,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000)
    };
  }

  // Get room details
  getRoomDetails(appointmentId, useAgora = true) {
    if (useAgora && this.appId && this.appCertificate) {
      // Use Agora for production-quality video
      return this.createConsultationRoom(
        appointmentId,
        `doctor_${Date.now()}`,
        `patient_${Date.now()}`
      );
    } else {
      // Use simple WebRTC for basic video calls
      return this.createSimpleWebRTCRoom(appointmentId);
    }
  }

  // Validate if room is still active
  isRoomActive(roomData) {
    return new Date() < new Date(roomData.expiresAt);
  }

  // End consultation room
  endConsultationRoom(roomId) {
    // In a real implementation, you might want to:
    // 1. Notify all participants
    // 2. Save call duration/quality metrics
    // 3. Clean up resources
    
    return {
      roomId,
      endedAt: new Date(),
      status: 'ended'
    };
  }
}

module.exports = new VideoService();