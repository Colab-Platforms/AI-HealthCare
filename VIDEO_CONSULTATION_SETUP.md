# Video Consultation & Email Setup Guide

## 🎥 Video Consultation Features

### What's Implemented:
- **Real-time video calls** using Agora.io SDK
- **Audio/Video controls** (mute, camera on/off, speaker control)
- **Screen sharing** capability
- **Chat messaging** during consultation
- **Connection status** indicators
- **Participant management**
- **Automatic room creation** for each appointment

### Video Call Flow:
1. **Booking**: Patient books video consultation → Video room created
2. **Email**: Both patient and doctor receive appointment emails with join links
3. **Reminders**: Automated email reminders (day before + 30 minutes before)
4. **Join**: Both parties click join link → Enter video consultation
5. **Consultation**: Real-time video/audio with chat
6. **End**: Consultation ends → Summary page with prescription/notes

## 📧 Email Notification System

### Email Types:
1. **Appointment Confirmation** - Sent immediately after booking
2. **Day-Before Reminder** - Sent 24 hours before appointment
3. **30-Minute Reminder** - Sent 30 minutes before appointment
4. **Manual Reminders** - Can be triggered by doctors/admins

### Email Features:
- **Professional HTML templates** with branding
- **Appointment details** (date, time, doctor info)
- **Direct join links** for video consultations
- **Mobile-responsive** design
- **Personalized content** for patients and doctors

## 🔧 Setup Instructions

### 1. Email Configuration (SMTP)

Update your `.env` file with email settings:

```env
# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=HealthAI <noreply@healthai.com>
```

**For Gmail:**
1. Enable 2-factor authentication
2. Generate an "App Password" in Google Account settings
3. Use the app password (not your regular password)

**For Other Providers:**
- **Outlook**: `smtp-mail.outlook.com`, port 587
- **Yahoo**: `smtp.mail.yahoo.com`, port 587
- **Custom SMTP**: Use your provider's settings

### 2. Video Conference Setup (Agora.io)

#### Option A: Agora.io (Recommended for Production)

1. **Sign up** at [Agora.io](https://www.agora.io/)
2. **Create a project** in Agora Console
3. **Get credentials**:
   - App ID
   - App Certificate (enable certificate in project settings)

Update your `.env` file:
```env
# Video Conference Configuration
AGORA_APP_ID=your-agora-app-id
AGORA_APP_CERTIFICATE=your-agora-app-certificate
```

#### Option B: Simple WebRTC (Fallback)

If Agora credentials are not provided, the system automatically falls back to simple WebRTC using Google's STUN servers.

### 3. Environment Variables

Complete `.env` file example:
```env
PORT=5000
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=your-jwt-secret
OPENROUTER_API_KEY=your-openrouter-key
APP_URL=http://localhost:3000
NODE_ENV=development

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=HealthAI <noreply@healthai.com>

# Video Conference Configuration
AGORA_APP_ID=your-agora-app-id
AGORA_APP_CERTIFICATE=your-agora-app-certificate
```

## 🚀 Usage

### For Patients:
1. **Book Appointment**: Select "Video Consultation" when booking
2. **Receive Email**: Get confirmation email with join link
3. **Get Reminders**: Receive automated reminder emails
4. **Join Call**: Click join link in email or go to appointment page
5. **Consultation**: Video call with doctor, chat, screen share
6. **Summary**: View consultation summary, prescription, ratings

### For Doctors:
1. **Get Notification**: Receive email when patient books appointment
2. **Prepare**: Review patient profile and health reports
3. **Get Reminders**: Receive reminder emails before consultation
4. **Join Call**: Click join link or access from doctor dashboard
5. **Consultation**: Conduct video consultation with full controls
6. **Complete**: Add notes, prescription, recommendations
7. **Follow-up**: Schedule follow-up appointments

### For Admins:
- **Monitor**: View all appointments and consultation status
- **Send Reminders**: Manually trigger reminder emails
- **Manage**: Handle appointment scheduling conflicts
- **Reports**: Track consultation completion rates

## 🔧 Technical Details

### Video Call Architecture:
```
Patient Browser ←→ Agora.io Servers ←→ Doctor Browser
                ↓
        HealthAI Backend
        (Token generation, room management)
```

### Email Scheduler:
- **Cron Jobs**: Run every 15 minutes for upcoming reminders
- **Database Tracking**: Prevents duplicate reminder emails
- **Error Handling**: Continues operation even if some emails fail
- **Logging**: Comprehensive logs for debugging

### Security Features:
- **JWT Authentication**: Secure API access
- **Agora Tokens**: Time-limited video call access
- **Email Validation**: Prevent spam and unauthorized access
- **HTTPS Ready**: SSL/TLS support for production

## 🐛 Troubleshooting

### Video Call Issues:
1. **Camera/Microphone not working**: Check browser permissions
2. **Can't join call**: Verify Agora credentials in .env
3. **Poor video quality**: Check internet connection
4. **Audio echo**: Use headphones or adjust speaker settings

### Email Issues:
1. **Emails not sending**: Check SMTP credentials
2. **Emails in spam**: Configure SPF/DKIM records
3. **Gmail authentication**: Use app password, not regular password
4. **Rate limiting**: Some providers limit emails per hour

### Common Fixes:
```bash
# Restart server after .env changes
npm restart

# Check server logs
npm start

# Test email configuration
curl -X POST http://localhost:5000/api/doctors/appointments/[ID]/reminder

# Verify video room creation
curl -X GET http://localhost:5000/api/doctors/appointments/[ID]
```

## 📱 Mobile Support

### Video Calls:
- **iOS Safari**: Full support for video/audio
- **Android Chrome**: Full support for video/audio
- **Mobile Controls**: Touch-friendly interface
- **Responsive Design**: Adapts to screen size

### Email Templates:
- **Mobile-responsive**: Optimized for all screen sizes
- **Touch-friendly**: Large buttons and links
- **Fast loading**: Optimized images and CSS

## 🔮 Future Enhancements

### Planned Features:
- **Recording**: Save consultation recordings (with consent)
- **File Sharing**: Share documents during consultation
- **Whiteboard**: Digital whiteboard for explanations
- **AI Transcription**: Automatic consultation notes
- **Multi-language**: Support for multiple languages
- **Calendar Integration**: Sync with Google/Outlook calendars

### Advanced Video Features:
- **Virtual Backgrounds**: Professional backgrounds
- **Noise Cancellation**: AI-powered audio enhancement
- **Bandwidth Optimization**: Adaptive video quality
- **Breakout Rooms**: For group consultations

## 📞 Support

For technical support or questions:
- **Email**: support@healthai.com
- **Documentation**: Check this file and code comments
- **Logs**: Check server console for detailed error messages

---

**Note**: This implementation provides a complete video consultation and email notification system. All features are production-ready but may require additional configuration for your specific deployment environment.