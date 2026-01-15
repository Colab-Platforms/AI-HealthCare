# 🩺 Appointment Booking Test Guide

## ✅ **Issue Fixed**
- **Problem**: `online` was not a valid enum value for appointment type
- **Solution**: Updated frontend to only use `video` consultations
- **Status**: Ready for testing

## 🧪 **Test the Booking Flow**

### **Step 1: Access the Application**
- **URL**: `http://localhost:3000`
- **Network**: `http://192.168.1.197:3000` (for mobile testing)

### **Step 2: Register/Login as Patient**
1. Click "Register" 
2. Fill in patient details
3. Login with your credentials

### **Step 3: Book Video Consultation**
1. Go to **"Find Doctors"** page
2. Click **"Book Consultation"** on any doctor
3. Fill in the booking form:
   - **Date**: Select future date
   - **Time Slot**: Choose available time
   - **Consultation Type**: Video (only option)
   - **Symptoms**: Optional description
4. Click **"Confirm"**

### **Step 4: Verify Booking Success**
- ✅ Success message should appear
- ✅ Email confirmation sent (if SMTP configured)
- ✅ Appointment appears in "My Appointments" tab

### **Step 5: Test Video Consultation**
1. Click **"Join Consultation"** when appointment time arrives
2. Allow camera/microphone permissions
3. Test video call functionality

## 📧 **Email Testing**
- **Test Page**: `http://localhost:3000/email-test`
- **SMTP Configured**: ✅ tech@colabplatforms.com
- **Features**: Appointment confirmations, reminders

## 🎥 **Video Testing**
- **Test Page**: `http://localhost:3000/video-test`
- **Agora Configured**: ✅ App ID: e788e8f838484d4dafe4705d682df57c
- **Features**: Real-time video, audio controls, multi-participant

## 🔧 **Current Configuration**

### **Appointment Types (Fixed)**
- ✅ **Video**: Primary consultation method
- ❌ **Phone**: Removed from UI (still supported in backend)
- ❌ **In-Person**: Removed from UI (still supported in backend)

### **Valid Enum Values**
```javascript
type: { type: String, enum: ['video', 'phone', 'in-person'], default: 'video' }
```

### **Frontend Changes**
- Removed type selection radio buttons
- Fixed to "Video Consultation" only
- Updated appointment display to show "Video Call"
- Simplified booking form

## 🚀 **Expected Results**

### **Successful Booking Should:**
1. ✅ Create appointment with `type: 'video'`
2. ✅ Send confirmation email to patient and doctor
3. ✅ Create video room for consultation
4. ✅ Show appointment in dashboard
5. ✅ Allow joining video consultation

### **Email Notifications Should:**
1. ✅ Send immediately after booking
2. ✅ Include appointment details and join link
3. ✅ Be mobile-responsive and professional
4. ✅ Schedule automatic reminders

### **Video Consultation Should:**
1. ✅ Allow real-time video/audio communication
2. ✅ Provide media controls (mute, camera, speaker)
3. ✅ Support multiple participants
4. ✅ Work on desktop and mobile devices

## 🐛 **Troubleshooting**

### **If Booking Still Fails:**
1. Check server logs for detailed error
2. Verify appointment data being sent
3. Check database connection
4. Ensure all required fields are provided

### **If Video Doesn't Work:**
1. Check browser permissions for camera/microphone
2. Verify Agora credentials in server logs
3. Test with `/video-test` page first
4. Check network connectivity

### **If Emails Don't Send:**
1. Verify SMTP credentials in `.env`
2. Check spam folder
3. Test with `/email-test` page
4. Check server logs for email errors

## 📱 **Mobile Testing**
- Open on mobile browser: `http://192.168.1.197:3000`
- Test booking flow on mobile
- Test video consultation on mobile
- Verify responsive design

---

**Status**: ✅ Ready for testing - Appointment booking should now work with video consultations only!