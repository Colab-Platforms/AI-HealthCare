const nodemailer = require('nodemailer');
const User = require('../models/User');

class EmailService {
  constructor() {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: 465, // Use 465 for SSL (more reliable than 587 on Render)
        secure: true, // true for port 465
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        pool: {
          maxConnections: 1,
          maxMessages: 3,
          rateDelta: 10000,
          rateLimit: 3
        },
        connectionTimeout: 10000,
        socketTimeout: 10000,
      });
      console.log('✅ Email Service: Gmail SMTP initialized (Port 465 SSL)');
    } else {
      console.warn('⚠️ Email Service: SMTP_USER or SMTP_PASS missing. Emails will not be sent.');
    }
  }

  async sendEmail({ to, subject, html }) {
    if (!this.transporter) {
      console.error('❌ Email Service: No SMTP credentials found');
      return { success: false, error: 'SMTP credentials missing' };
    }

    try {
      console.log(`📧 Sending email to ${to}: ${subject}`);
      const info = await this.transporter.sendMail({
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to,
        subject,
        html,
      });

      console.log('✅ Email sent successfully:', info.messageId);
      return { success: true, data: info };
    } catch (error) {
      console.error('❌ Email Service: Failed to send email via SMTP:', error.message);
      console.error('Error details:', error.code, error.syscall);
      
      // Log for debugging
      if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
        console.error('⚠️ Connection error - possibly blocked by Render firewall or Gmail security');
      }
      
      return { success: false, error: error.message };
    }
  }

  async sendAppointmentConfirmation(appointmentData) {
    const { patient, doctor, appointment } = appointmentData;
    const html = this.getPatientConfirmationTemplate(patient, doctor, appointment);
    const doctorHtml = this.getDoctorNotificationTemplate(patient, doctor, appointment);

    await Promise.all([
      this.sendEmail({ to: patient.email, subject: 'Appointment Confirmation - HealthAI', html }),
      this.sendEmail({ to: doctor.email, subject: 'New Appointment Booking - HealthAI', html: doctorHtml })
    ]);
  }

  async sendConsultationReminder(appointmentData) {
    const { patient, doctor, appointment } = appointmentData;
    const html = this.getPatientReminderTemplate(patient, doctor, appointment);
    const doctorHtml = this.getDoctorReminderTemplate(patient, doctor, appointment);

    await Promise.all([
      this.sendEmail({ to: patient.email, subject: 'Consultation Reminder - HealthAI', html }),
      this.sendEmail({ to: doctor.email, subject: 'Consultation Reminder - HealthAI', html: doctorHtml })
    ]);
  }

  async sendPasswordResetCode(email, name, code) {
    const html = this.getPasswordResetTemplate(name, code);
    return this.sendEmail({ to: email, subject: 'Password Reset Verification - HealthAI', html });
  }

  async sendVerificationCode(email, name, code) {
    const html = this.getVerificationTemplate(name, code);
    return this.sendEmail({ to: email, subject: 'Email Verification - take.health AI', html });
  }

  // Security alert — sent after a successful password change so the account
  // owner can act fast (contact support) if they didn't make the change.
  async sendPasswordChangedAlert(email, name) {
    const html = this.getPasswordChangedTemplate(name);
    return this.sendEmail({ to: email, subject: 'Your password was changed - take.health', html });
  }

  async sendReportAnalysisComplete(email, name, reportId) {
    const html = this.getReportAnalysisCompleteTemplate(name, reportId);
    return this.sendEmail({ to: email, subject: 'Report Analysis Completed - take.health AI', html });
  }

  async sendDietPlanComplete(email, name) {
    const html = this.getDietPlanCompleteTemplate(name);
    return this.sendEmail({ to: email, subject: 'Customized Diet Plan Ready - take.health AI', html });
  }

  async sendWaitlistConfirmation(email, name) {
    const html = this.getWaitlistConfirmationTemplate(name);
    return this.sendEmail({ to: email, subject: "You're on the Take waitlist", html });
  }

  // Marketing emails (tips, newsletters, promotions) — skipped if user opted out
  async sendMarketingEmail(userId, email, subject, html) {
    try {
      const user = await User.findById(userId).select('privacySettings').lean();
      if (user && user.privacySettings?.marketingEnabled === false) {
        console.log(`📭 Marketing email skipped (opted out): ${email}`);
        return { success: false, skipped: true };
      }
    } catch (e) {
      console.warn('Could not check marketing preference:', e.message);
    }
    return this.sendEmail({ to: email, subject, html });
  }

  getPasswordResetTemplate(name, code) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Verification</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 20px auto; padding: 0; background-color: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #2FC8B9, #22d3ee); color: white; padding: 40px 20px; text-align: center; }
          .logo { font-size: 28px; font-weight: 800; letter-spacing: -1px; margin-bottom: 10px; }
          .content { padding: 40px; text-align: center; }
          .welcome-text { font-size: 18px; color: #64748b; margin-bottom: 30px; }
          .otp-container { background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin: 30px 0; display: inline-block; }
          .otp-code { font-size: 42px; font-weight: 900; color: #2FC8B9; letter-spacing: 12px; font-family: 'Courier New', monospace; padding-left: 12px; }
          .expiry-note { font-size: 14px; color: #94a3b8; margin-top: 20px; }
          .footer { text-align: center; padding: 30px; color: #94a3b8; font-size: 12px; background-color: #f8fafc; }
          .highlight { color: #2FC8B9; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">TakeHealth AI</div>
            <h2 style="margin: 0;">Password Reset Request</h2>
          </div>
          <div class="content">
            <p class="welcome-text">Hi ${name},</p>
            <p>We received a request to reset your password. Use the verification code below to proceed:</p>
            
            <div class="otp-container">
              <div class="otp-code">${code}</div>
            </div>

            <p class="expiry-note">This code is valid for <span class="highlight">10 minutes</span>. If you didn't request this, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} TakeHealth AI. All rights reserved.</p>
            <p>Empowering your health journey with AI.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getPasswordChangedTemplate(name) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Changed</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 20px auto; padding: 0; background-color: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #2FC8B9, #22d3ee); color: white; padding: 40px 20px; text-align: center; }
          .logo { font-size: 28px; font-weight: 800; letter-spacing: -1px; margin-bottom: 10px; }
          .content { padding: 40px; text-align: center; }
          .welcome-text { font-size: 18px; color: #64748b; margin-bottom: 10px; }
          .warning-box { background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px 20px; margin: 24px 0; text-align: left; }
          .warning-box p { margin: 0; font-size: 13px; color: #991b1b; }
          .footer { text-align: center; padding: 30px; color: #94a3b8; font-size: 12px; background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">take.health</div>
            <h2 style="margin: 0;">Password Changed</h2>
          </div>
          <div class="content">
            <p class="welcome-text">Hi ${name},</p>
            <p>Your account password was just changed successfully. You've been logged out on all other devices as a security precaution.</p>
            <div class="warning-box">
              <p><strong>Wasn't you?</strong> If you didn't make this change, your account may be compromised — please contact our support team immediately at support@take.health.</p>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} take.health. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getPatientConfirmationTemplate(patient, doctor, appointment) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Appointment Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
          .appointment-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #06b6d4; }
          .button { display: inline-block; background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏥 HealthAI</h1>
            <h2>Appointment Confirmed!</h2>
          </div>
          <div class="content">
            <p>Dear ${patient.name},</p>
            <p>Your appointment has been successfully booked. Here are the details:</p>
            
            <div class="appointment-card">
              <h3>📅 Appointment Details</h3>
              <p><strong>Doctor:</strong> Dr. ${doctor.name}</p>
              <p><strong>Specialization:</strong> ${doctor.specialization}</p>
              <p><strong>Date:</strong> ${new Date(appointment.date).toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${appointment.timeSlot}</p>
              <p><strong>Type:</strong> ${appointment.type === 'video' ? 'Video Consultation' : 'Phone Consultation'}</p>
              <p><strong>Appointment ID:</strong> ${appointment._id}</p>
            </div>

            ${appointment.type === 'video' ? `
            <div class="appointment-card">
              <h3>🎥 Video Consultation Link</h3>
              <p>Join your consultation using the link below:</p>
              <a href="${process.env.APP_URL}/consultation/${appointment._id}" class="button">
                Join Video Consultation
              </a>
              <p><small>This link will be active 15 minutes before your appointment time.</small></p>
            </div>
            ` : ''}

            <div class="appointment-card">
              <h3>📋 Before Your Appointment</h3>
              <ul>
                <li>Prepare a list of your current symptoms</li>
                <li>Have your medical reports ready</li>
                <li>Ensure stable internet connection for video calls</li>
                <li>Find a quiet, private space for the consultation</li>
              </ul>
            </div>

            <p>If you need to reschedule or cancel, please contact us at least 2 hours before your appointment.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL}/doctors" class="button">View My Appointments</a>
            </div>
          </div>
          <div class="footer">
            <p>Thank you for choosing HealthAI for your healthcare needs.</p>
            <p>For support, contact us at support@healthai.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getDoctorNotificationTemplate(patient, doctor, appointment) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Appointment Booking</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #059669, #0d9488); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f0fdf4; padding: 30px; border-radius: 0 0 10px 10px; }
          .appointment-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669; }
          .button { display: inline-block; background: linear-gradient(135deg, #059669, #0d9488); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🩺 HealthAI</h1>
            <h2>New Appointment Booking</h2>
          </div>
          <div class="content">
            <p>Dear Dr. ${doctor.name},</p>
            <p>You have a new appointment booking from a patient:</p>
            
            <div class="appointment-card">
              <h3>👤 Patient Information</h3>
              <p><strong>Name:</strong> ${patient.name}</p>
              <p><strong>Email:</strong> ${patient.email}</p>
              <p><strong>Age:</strong> ${patient.age || 'Not specified'}</p>
            </div>

            <div class="appointment-card">
              <h3>📅 Appointment Details</h3>
              <p><strong>Date:</strong> ${new Date(appointment.date).toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${appointment.timeSlot}</p>
              <p><strong>Type:</strong> ${appointment.type === 'video' ? 'Video Consultation' : 'Phone Consultation'}</p>
              <p><strong>Appointment ID:</strong> ${appointment._id}</p>
              ${appointment.symptoms ? `<p><strong>Symptoms:</strong> ${appointment.symptoms}</p>` : ''}
            </div>

            ${appointment.type === 'video' ? `
            <div class="appointment-card">
              <h3>🎥 Video Consultation</h3>
              <p>Join the consultation using the link below:</p>
              <a href="${process.env.APP_URL}/consultation/${appointment._id}" class="button">
                Join Video Consultation
              </a>
            </div>
            ` : ''}

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL}/doctor/dashboard" class="button">View Dashboard</a>
            </div>
          </div>
          <div class="footer">
            <p>HealthAI - Connecting patients with healthcare professionals</p>
            <p>For support, contact us at support@healthai.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getPatientReminderTemplate(patient, doctor, appointment) {
    const appointmentTime = new Date(appointment.date);
    const timeUntil = Math.ceil((appointmentTime - new Date()) / (1000 * 60)); // minutes

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Consultation Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b, #f97316); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #fffbeb; padding: 30px; border-radius: 0 0 10px 10px; }
          .reminder-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
          .button { display: inline-block; background: linear-gradient(135deg, #f59e0b, #f97316); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .urgent { background: #fef2f2; border-left-color: #ef4444; }
          .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ HealthAI</h1>
            <h2>Consultation Reminder</h2>
          </div>
          <div class="content">
            <p>Dear ${patient.name},</p>
            <p>Your consultation with Dr. ${doctor.name} is starting ${timeUntil <= 15 ? 'soon' : `in ${Math.ceil(timeUntil / 60)} hours`}!</p>
            
            <div class="reminder-card ${timeUntil <= 15 ? 'urgent' : ''}">
              <h3>📅 Appointment Details</h3>
              <p><strong>Doctor:</strong> Dr. ${doctor.name}</p>
              <p><strong>Time:</strong> ${appointment.timeSlot}</p>
              <p><strong>Type:</strong> ${appointment.type === 'video' ? 'Video Consultation' : 'Phone Consultation'}</p>
            </div>

            ${appointment.type === 'video' ? `
            <div class="reminder-card">
              <h3>🎥 Ready to Join?</h3>
              <p>Click the button below to join your video consultation:</p>
              <a href="${process.env.APP_URL}/consultation/${appointment._id}" class="button">
                Join Now
              </a>
            </div>
            ` : ''}

            <div class="reminder-card">
              <h3>✅ Quick Checklist</h3>
              <ul>
                <li>Stable internet connection</li>
                <li>Quiet, private space</li>
                <li>Medical reports ready</li>
                <li>List of symptoms/questions</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p>Thank you for choosing HealthAI</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getDoctorReminderTemplate(patient, doctor, appointment) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Consultation Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #8b5cf6, #a855f7); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #faf5ff; padding: 30px; border-radius: 0 0 10px 10px; }
          .reminder-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6; }
          .button { display: inline-block; background: linear-gradient(135deg, #8b5cf6, #a855f7); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🩺 HealthAI</h1>
            <h2>Consultation Reminder</h2>
          </div>
          <div class="content">
            <p>Dear Dr. ${doctor.name},</p>
            <p>You have an upcoming consultation with ${patient.name}.</p>
            
            <div class="reminder-card">
              <h3>👤 Patient: ${patient.name}</h3>
              <p><strong>Time:</strong> ${appointment.timeSlot}</p>
              <p><strong>Type:</strong> ${appointment.type === 'video' ? 'Video Consultation' : 'Phone Consultation'}</p>
              ${appointment.symptoms ? `<p><strong>Symptoms:</strong> ${appointment.symptoms}</p>` : ''}
            </div>

            ${appointment.type === 'video' ? `
            <div class="reminder-card">
              <h3>🎥 Join Consultation</h3>
              <a href="${process.env.APP_URL}/consultation/${appointment._id}" class="button">
                Join Video Call
              </a>
            </div>
            ` : ''}

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL}/patient/${patient._id}" class="button">View Patient Profile</a>
            </div>
          </div>
          <div class="footer">
            <p>HealthAI - Professional Healthcare Platform</p>
            <p>Thank you for choosing HealthAI - Professional Healthcare Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getVerificationTemplate(name, code) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 20px auto; padding: 0; background-color: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 40px 20px; text-align: center; }
          .logo { font-size: 28px; font-weight: 800; letter-spacing: -1px; margin-bottom: 10px; }
          .content { padding: 40px; text-align: center; }
          .welcome-text { font-size: 18px; color: #64748b; margin-bottom: 30px; }
          .otp-container { background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin: 30px 0; display: inline-block; }
          .otp-code { font-size: 42px; font-weight: 900; color: #059669; letter-spacing: 12px; font-family: 'Courier New', monospace; padding-left: 12px; }
          .expiry-note { font-size: 14px; color: #94a3b8; margin-top: 20px; }
          .footer { text-align: center; padding: 30px; color: #94a3b8; font-size: 12px; background-color: #f8fafc; }
          .highlight { color: #059669; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">take.health AI</div>
            <h2 style="margin: 0;">Verify Your Email</h2>
          </div>
          <div class="content">
            <p class="welcome-text">Hi ${name},</p>
            <p>Welcome to take.health AI! To complete your registration and start your health journey, please verify your email using the 6-digit code below:</p>
            
            <div class="otp-container">
              <div class="otp-code">${code}</div>
            </div>
 
            <p class="expiry-note">This code is valid for <span class="highlight">15 minutes</span>. If you didn't create an account, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} take.health AI. All rights reserved.</p>
            <p>Empowering your health journey with AI.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getReportAnalysisCompleteTemplate(name, reportId) {
    const reportUrl = `${process.env.APP_URL}/reports/${reportId}`;
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Report Analysis Completed</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 20px auto; padding: 0; background-color: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 40px 20px; text-align: center; }
          .logo { font-size: 28px; font-weight: 800; letter-spacing: -1px; margin-bottom: 10px; }
          .content { padding: 40px; text-align: center; }
          .welcome-text { font-size: 18px; color: #64748b; margin-bottom: 30px; }
          .button { display: inline-block; background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 600; margin: 30px 0; }
          .footer { text-align: center; padding: 30px; color: #94a3b8; font-size: 12px; background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">take.health AI</div>
            <h2 style="margin: 0;">Analysis Completed</h2>
          </div>
          <div class="content">
            <p class="welcome-text">Hi ${name},</p>
            <p>Great news! Your health report analysis has been completed. Our AI has extracted key insights and generated a personalized health score for you.</p>
            
            <a href="${reportUrl}" class="button">View My Detailed Report</a>

            <p>You can also view your updated diet plan and health dashboard for more information.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} take.health AI. All rights reserved.</p>
            <p>Empowering your health journey with AI.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getWaitlistConfirmationTemplate(name) {
    const appUrl = process.env.APP_URL && process.env.APP_URL.startsWith('http') && !process.env.APP_URL.includes('localhost') && !process.env.APP_URL.includes('192.168')
      ? process.env.APP_URL
      : 'https://take.health';
    const heroImageUrl = `${appUrl}/waitlist/waitlisted_user_mail_content_img.jpg`;
    const greetName = name ? name.split(' ')[0] : 'Human';

    const socialIcon = (href, path) => `
      <a href="${href}" style="display:inline-block; margin: 0 8px; text-decoration:none;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:36px;height:36px;background:rgba(255,255,255,0.12);border-radius:50%;">
          <tr><td align="center" valign="middle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#ffffff"><path d="${path}"/></svg>
          </td></tr>
        </table>
      </a>`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You're on the Take waitlist</title>
      </head>
      <body style="margin:0; padding:0; background-color:#0a0a1f;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a1f;">
          <tr>
            <td align="center" style="padding: 24px 12px;">
              <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#2b0f8f; border-radius: 16px; overflow:hidden; font-family: 'Segoe UI', Arial, sans-serif;">
                <tr>
                  <td>
                    <img src="${heroImageUrl}" alt="Take" width="480" style="display:block; width:100%; height:auto;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding: 28px 28px 8px 28px; color:#ffffff; font-size:15px; line-height:1.6;">
                    <p style="margin:0 0 4px 0;">Dear <strong>${greetName}</strong>,</p>
                    <p style="margin:0 0 20px 0;">You're officially on the <strong>Take waitlist</strong>.</p>
                    <p style="margin:0 0 16px 0;">
                      We're getting ready for something built to help you <strong>understand your health</strong>,
                      <strong>optimise what matters</strong>, and take control of what's next.<br/>
                      Your journey starts here.
                    </p>
                    <p style="margin:0 0 16px 0;">We'll let you know as soon as Take is ready for you to take off.</p>
                    <p style="margin:0 0 4px 0;">Until then, stay curious. Stay ahead.</p>
                    <p style="margin:0 0 20px 0;"><strong>The Take Team</strong></p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 28px;">
                    <hr style="border:none; border-top:1px solid rgba(255,255,255,0.2); margin:0;" />
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 20px 28px;">
                    ${socialIcon('https://www.facebook.com', 'M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z')}
                    ${socialIcon('https://www.instagram.com/takehealth_', 'M12 2c2.7 0 3 0 4.1.06 1.1.05 1.8.22 2.4.46a5 5 0 0 1 1.8 1.2 5 5 0 0 1 1.2 1.8c.24.6.4 1.3.46 2.4.06 1.1.06 1.4.06 4.1s0 3-.06 4.1c-.05 1.1-.22 1.8-.46 2.4a5 5 0 0 1-1.2 1.8 5 5 0 0 1-1.8 1.2c-.6.24-1.3.4-2.4.46-1.1.06-1.4.06-4.1.06s-3 0-4.1-.06c-1.1-.05-1.8-.22-2.4-.46a5 5 0 0 1-1.8-1.2 5 5 0 0 1-1.2-1.8c-.24-.6-.4-1.3-.46-2.4C2 15 2 14.7 2 12s0-3 .06-4.1c.05-1.1.22-1.8.46-2.4a5 5 0 0 1 1.2-1.8 5 5 0 0 1 1.8-1.2c.6-.24 1.3-.4 2.4-.46C9 2 9.3 2 12 2Zm0 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm5.5-1a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z')}
                    ${socialIcon('https://x.com/Take_Limited', 'M17.5 3h3.2l-7 8 8.2 10h-6.4l-5-6.5L4.4 21H1.2l7.5-8.6L1 3h6.5l4.5 5.9L17.5 3Zm-1.1 16.2h1.8L7.7 4.7H5.8l10.6 14.5Z')}
                    ${socialIcon('https://www.youtube.com', 'M23.5 7.2s-.2-1.6-.9-2.3c-.9-.9-1.9-.9-2.4-1C16.9 3.6 12 3.6 12 3.6h0s-4.9 0-8.2.3c-.5.1-1.5.1-2.4 1-.7.7-.9 2.3-.9 2.3S.2 9.1.2 11v1.9c0 1.9.3 3.8.3 3.8s.2 1.6.9 2.3c.9.9 2.1.9 2.6 1 1.9.2 8 .3 8 .3s4.9 0 8.2-.3c.5-.1 1.5-.1 2.4-1 .7-.7.9-2.3.9-2.3s.3-1.9.3-3.8V11c0-1.9-.3-3.8-.3-3.8ZM9.7 15.1V8.4l6.4 3.4-6.4 3.3Z')}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 0 28px 24px 28px; color:rgba(255,255,255,0.6); font-size:11px; line-height:1.6;">
                    &copy; ${new Date().getFullYear()} NSE &amp; BSE Listed<br/>India
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  getDietPlanCompleteTemplate(name) {
    const dietUrl = `${process.env.APP_URL}/diet-plan`;
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Diet Plan Ready</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 20px auto; padding: 0; background-color: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 40px 20px; text-align: center; }
          .logo { font-size: 28px; font-weight: 800; letter-spacing: -1px; margin-bottom: 10px; }
          .content { padding: 40px; text-align: center; }
          .welcome-text { font-size: 18px; color: #64748b; margin-bottom: 30px; }
          .button { display: inline-block; background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 600; margin: 30px 0; }
          .footer { text-align: center; padding: 30px; color: #94a3b8; font-size: 12px; background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">take.health AI</div>
            <h2 style="margin: 0;">Your Diet Plan is Ready</h2>
          </div>
          <div class="content">
            <p class="welcome-text">Hi ${name},</p>
            <p>Your personalized AI diet plan has been generated based on your latest health data, goals, and preferences.</p>
            
            <a href="${dietUrl}" class="button">View My Diet Plan</a>

            <p>Following this plan consistently will help you reach your health goals faster.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} take.health AI. All rights reserved.</p>
            <p>Empowering your health journey with AI.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();