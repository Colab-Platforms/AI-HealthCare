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
      this.sendEmail({ to: patient.email, subject: 'Appointment Confirmation - Take Health', html }),
      this.sendEmail({ to: doctor.email, subject: 'New Appointment Booking - Take Health', html: doctorHtml })
    ]);
  }

  async sendConsultationReminder(appointmentData) {
    const { patient, doctor, appointment } = appointmentData;
    const html = this.getPatientReminderTemplate(patient, doctor, appointment);
    const doctorHtml = this.getDoctorReminderTemplate(patient, doctor, appointment);

    await Promise.all([
      this.sendEmail({ to: patient.email, subject: 'Consultation Reminder - Take Health', html }),
      this.sendEmail({ to: doctor.email, subject: 'Consultation Reminder - Take Health', html: doctorHtml })
    ]);
  }

  async sendPasswordResetCode(email, name, code) {
    const html = this.getPasswordResetTemplate(name, code);
    return this.sendEmail({ to: email, subject: 'Password Reset Verification - Take Health', html });
  }

  async sendVerificationCode(email, name, code) {
    const html = this.getVerificationTemplate(name, code);
    return this.sendEmail({ to: email, subject: 'Email Verification - Take Health', html });
  }

  // DPDPA Section 9: sent to the guardian's own inbox (not the child's) so
  // consent is tied to a mailbox the guardian actually controls.
  async sendGuardianConsentCode(guardianEmail, childName, code) {
    const html = this.getGuardianConsentTemplate(guardianEmail, childName, code);
    return this.sendEmail({ to: guardianEmail, subject: `Guardian Verification Needed for ${childName}'s Take Health Account`, html });
  }

  // DPDP Rules 2025, Rule 8: advance notice before erasure. Sent at both the
  // 48h and 24h marks so the user has more than one chance to see it and
  // cancel if they didn't mean to request deletion.
  async sendDeletionReminder(email, name, scheduledDeletion, hoursBefore) {
    const html = this.getDeletionReminderTemplate(name, scheduledDeletion, hoursBefore);
    const subject = hoursBefore <= 24
      ? 'Final notice: your take.health data will be deleted in 24 hours'
      : 'Your take.health data will be deleted in 2 days';
    return this.sendEmail({ to: email, subject, html });
  }

  // Google Play "delete without the app" page — the code proves the person
  // submitting the public form actually controls this inbox, before we
  // schedule anything.
  async sendPublicDeletionConfirmCode(email, name, code) {
    const html = this.getPublicDeletionConfirmTemplate(name, code);
    return this.sendEmail({ to: email, subject: 'Confirm your take.health account deletion request', html });
  }

  // DPDPA Section 9: sent to a pre-existing account found to be under 18
  // without ever-verified guardian consent (e.g. created before the
  // guardian-otp gate existed). Goes to the child's own registered email,
  // since no guardian email is on file yet — that's the whole problem.
  async sendGuardianConsentGraceNotice(email, name, deadline) {
    const html = this.getGuardianConsentGraceNoticeTemplate(name, deadline);
    return this.sendEmail({ to: email, subject: 'Action needed: guardian verification required for your Take Health account', html });
  }

  // Security alert — sent after a successful password change so the account
  // owner can act fast (contact support) if they didn't make the change.
  async sendPasswordChangedAlert(email, name) {
    const html = this.getPasswordChangedTemplate(name);
    return this.sendEmail({ to: email, subject: 'Your password was changed - take.health', html });
  }

  // Confirms a pending deletion was cancelled — same reasoning as the
  // password-changed alert: any reversal of a scheduled data-erasure is a
  // security-relevant event the account owner should see happen, not just
  // a UI toast that vanishes.
  async sendDeletionCancelledConfirmation(email, name) {
    const html = this.getDeletionCancelledTemplate(name);
    return this.sendEmail({ to: email, subject: 'Your take.health account deletion was cancelled', html });
  }

  async sendReportAnalysisComplete(email, name, reportId) {
    const html = this.getReportAnalysisCompleteTemplate(name, reportId);
    return this.sendEmail({ to: email, subject: 'Report Analysis Completed - Take Health', html });
  }

  async sendDietPlanComplete(email, name) {
    const html = this.getDietPlanCompleteTemplate(name);
    return this.sendEmail({ to: email, subject: 'Customized Diet Plan Ready - Take Health', html });
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
            <div class="logo">Take Health</div>
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
            <p>&copy; ${new Date().getFullYear()} Take Health. All rights reserved.</p>
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

  getDeletionCancelledTemplate(name) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Deletion Cancelled</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 20px auto; padding: 0; background-color: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 40px 20px; text-align: center; }
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
            <h2 style="margin: 0;">Deletion Cancelled</h2>
          </div>
          <div class="content">
            <p class="welcome-text">Hi ${name || 'there'},</p>
            <p>Your pending account deletion request has been cancelled. Your account and data are safe — nothing further will happen.</p>
            <div class="warning-box">
              <p><strong>Didn't cancel this yourself?</strong> If you didn't request this cancellation, someone else may have access to your account — please contact our support team immediately at support@take.health.</p>
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
            <h1>🏥 Take Health</h1>
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
            <p>Thank you for choosing Take Health for your healthcare needs.</p>
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
            <h1>🩺 Take Health</h1>
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
            <p>Take Health - Connecting patients with healthcare professionals</p>
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
            <h1>⏰ Take Health</h1>
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
            <p>Thank you for choosing Take Health</p>
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
            <h1>🩺 Take Health</h1>
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
            <p>Take Health - Professional Healthcare Platform</p>
            <p>Thank you for choosing Take Health - Professional Healthcare Platform</p>
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
            <div class="logo">Take Health</div>
            <h2 style="margin: 0;">Verify Your Email</h2>
          </div>
          <div class="content">
            <p class="welcome-text">Hi ${name},</p>
            <p>Welcome to Take Health! To complete your registration and start your health journey, please verify your email using the 6-digit code below:</p>
            
            <div class="otp-container">
              <div class="otp-code">${code}</div>
            </div>
 
            <p class="expiry-note">This code is valid for <span class="highlight">15 minutes</span>. If you didn't create an account, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Take Health. All rights reserved.</p>
            <p>Empowering your health journey with AI.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getGuardianConsentTemplate(guardianEmail, childName, code) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Guardian Verification</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 20px auto; padding: 0; background-color: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 40px 20px; text-align: center; }
          .logo { font-size: 28px; font-weight: 800; letter-spacing: -1px; margin-bottom: 10px; }
          .content { padding: 40px; text-align: center; }
          .welcome-text { font-size: 18px; color: #64748b; margin-bottom: 10px; }
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
            <div class="logo">Take Health</div>
            <h2 style="margin: 0;">Guardian Verification</h2>
          </div>
          <div class="content">
            <p class="welcome-text"><strong>${childName}</strong> has listed you as their guardian while creating a Take Health account.</p>
            <p>Take Health processes health data for users under 18 only with a parent or guardian's consent, as required under India's Digital Personal Data Protection Act (DPDPA), 2023. Share this code with ${childName} to confirm you are their parent/guardian and consent to this account being created:</p>

            <div class="otp-container">
              <div class="otp-code">${code}</div>
            </div>

            <p class="expiry-note">This code is valid for <span class="highlight">10 minutes</span>. If you did not expect this email, you can safely ignore it — no account will be activated without this code.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Take Health. All rights reserved.</p>
            <p>Empowering your health journey with AI.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getGuardianConsentGraceNoticeTemplate(name, deadline) {
    const deadlineStr = new Date(deadline).toLocaleString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
    });
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Guardian Verification Required</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 20px auto; padding: 0; background-color: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #d97706, #f59e0b); color: white; padding: 40px 20px; text-align: center; }
          .logo { font-size: 28px; font-weight: 800; letter-spacing: -1px; margin-bottom: 10px; }
          .content { padding: 40px; text-align: center; }
          .body-text { font-size: 16px; color: #334155; text-align: left; }
          .date-box { background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin: 24px 0; }
          .date-box .label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
          .date-box .value { font-size: 20px; font-weight: 800; color: #1e293b; margin-top: 4px; }
          .cta { display: inline-block; margin-top: 24px; padding: 14px 32px; background: #059669; color: white; text-decoration: none; border-radius: 10px; font-weight: 700; }
          .footer { text-align: center; padding: 30px; color: #94a3b8; font-size: 12px; background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Take Health</div>
            <h2 style="margin: 0;">Guardian Verification Needed</h2>
          </div>
          <div class="content">
            <p class="body-text">Hi ${name || 'there'},</p>
            <p class="body-text">Our records show your profile indicates you're under 18, and we don't have verified consent from a parent or guardian on file for your account — required under India's DPDP Act, 2023.</p>
            <p class="body-text">Please open the app and complete guardian verification (your guardian will receive a short code by email to confirm) before the date below. Until then, AI features on your account remain unavailable.</p>
            <div class="date-box">
              <div class="label">Complete verification by</div>
              <div class="value">${deadlineStr}</div>
            </div>
            <p class="body-text">If we don't hear back by then, your account and data will be scheduled for deletion — you'll get advance notice before that happens too.</p>
            <a href="https://take.health/privacy-settings" class="cta">Verify Now</a>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Take Health. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getPublicDeletionConfirmTemplate(name, code) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirm Account Deletion</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 20px auto; padding: 0; background-color: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #dc2626, #ef4444); color: white; padding: 40px 20px; text-align: center; }
          .logo { font-size: 28px; font-weight: 800; letter-spacing: -1px; margin-bottom: 10px; }
          .content { padding: 40px; text-align: center; }
          .welcome-text { font-size: 18px; color: #64748b; margin-bottom: 10px; text-align: left; }
          .otp-container { background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin: 30px 0; display: inline-block; }
          .otp-code { font-size: 42px; font-weight: 900; color: #dc2626; letter-spacing: 12px; font-family: 'Courier New', monospace; padding-left: 12px; }
          .expiry-note { font-size: 14px; color: #94a3b8; margin-top: 20px; }
          .footer { text-align: center; padding: 30px; color: #94a3b8; font-size: 12px; background-color: #f8fafc; }
          .highlight { color: #dc2626; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Take Health</div>
            <h2 style="margin: 0;">Confirm Account Deletion</h2>
          </div>
          <div class="content">
            <p class="welcome-text">Hi ${name || 'there'},</p>
            <p class="welcome-text">Someone requested deletion of this account from take.health/delete-account. If this was you, enter this code to confirm:</p>

            <div class="otp-container">
              <div class="otp-code">${code}</div>
            </div>

            <p class="expiry-note">Valid for <span class="highlight">10 minutes</span>. If you didn't request this, ignore this email — your account stays exactly as it is, nothing happens without this code.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Take Health. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getDeletionReminderTemplate(name, scheduledDeletion, hoursBefore) {
    const deletionDate = new Date(scheduledDeletion).toLocaleString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
    });
    const urgent = hoursBefore <= 24;
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Deletion Notice</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 20px auto; padding: 0; background-color: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, ${urgent ? '#dc2626, #ef4444' : '#d97706, #f59e0b'}); color: white; padding: 40px 20px; text-align: center; }
          .logo { font-size: 28px; font-weight: 800; letter-spacing: -1px; margin-bottom: 10px; }
          .content { padding: 40px; text-align: center; }
          .body-text { font-size: 16px; color: #334155; text-align: left; }
          .date-box { background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin: 24px 0; }
          .date-box .label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
          .date-box .value { font-size: 20px; font-weight: 800; color: #1e293b; margin-top: 4px; }
          .cta { display: inline-block; margin-top: 24px; padding: 14px 32px; background: #059669; color: white; text-decoration: none; border-radius: 10px; font-weight: 700; }
          .footer { text-align: center; padding: 30px; color: #94a3b8; font-size: 12px; background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Take Health</div>
            <h2 style="margin: 0;">${urgent ? 'Final Notice' : 'Deletion Scheduled'}</h2>
          </div>
          <div class="content">
            <p class="body-text">Hi ${name || 'there'},</p>
            <p class="body-text">You requested deletion of your Take Health account. This is a reminder, as required under India's DPDP Rules, 2025, that your account and all associated data (health reports, chat history, food logs) will be <strong>permanently deleted</strong> in approximately <strong>${hoursBefore} hours</strong>.</p>
            <div class="date-box">
              <div class="label">Permanent deletion at</div>
              <div class="value">${deletionDate} IST</div>
            </div>
            <p class="body-text">If you didn't request this, or changed your mind, you can cancel anytime before this date from Privacy Settings — your data is untouched until then.</p>
            <a href="https://take.health/privacy-settings" class="cta">Cancel Deletion</a>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Take Health. All rights reserved.</p>
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
            <div class="logo">Take Health</div>
            <h2 style="margin: 0;">Analysis Completed</h2>
          </div>
          <div class="content">
            <p class="welcome-text">Hi ${name},</p>
            <p>Great news! Your health report analysis has been completed. Our AI has extracted key insights and generated a personalized health score for you.</p>
            
            <a href="${reportUrl}" class="button">View My Detailed Report</a>

            <p>You can also view your updated diet plan and health dashboard for more information.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Take Health. All rights reserved.</p>
            <p>Empowering your health journey with AI.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getWaitlistConfirmationTemplate(name) {
    const heroImageUrl = 'https://res.cloudinary.com/dvgg1i1ck/image/upload/v1787982029/k28szqgoxlclkazyxfua.jpg';
    const greetName = name ? name.split(' ')[0] : 'username';

    const socialIcon = (href, imgSrc) => `
      <a href="${href}" style="display:inline-block; margin: 0 12px; text-decoration:none;">
        <img src="${imgSrc}" width="20" height="20" alt="Social Icon" style="display:block; border:none;" />
      </a>`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You're on the Take waitlist</title>
      </head>
      <body style="margin:0; padding:0; background-color:#261386;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#261386;">
          <tr>
            <td align="center" style="padding: 0;">
              <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#261386; font-family: 'Segoe UI', Arial, sans-serif;">
                <tr>
                  <td>
                    <img src="${heroImageUrl}" alt="Take" width="480" style="display:block; width:100%; height:auto;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 32px 12px 32px; color:#ffffff; font-size:15px; line-height:1.6; text-align: left;">
                    <p style="margin:0 0 4px 0; font-weight: 500;">Dear ${greetName},</p>
                    <p style="margin:0 0 24px 0; font-weight: 500;">You're officially on the Take waitlist.</p>
                    
                    <p style="margin:0 0 4px 0; font-weight: 500;">We're getting ready for something built to help you understand your health, optimise what matters, and take control of what's next.</p>
                    <p style="margin:0 0 24px 0; font-weight: 500;">Your journey starts here.</p>
                    

                    
                    <p style="margin:0 0 24px 0; font-weight: 500;">We'll let you know as soon as Take is ready for you to take off.</p>
                    
                    <p style="margin:0 0 4px 0; font-weight: 500;">Until then, stay curious. Stay ahead.</p>
                    <p style="margin:0 0 24px 0; font-weight: 500;">The Take Team</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 32px;">
                    <hr style="border:none; border-top:1px solid #ffffff; margin:0;" />
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 24px 32px;">
                    ${socialIcon('https://www.facebook.com', 'https://img.icons8.com/ios-filled/50/ffffff/facebook-new.png')}
                    ${socialIcon('https://www.instagram.com/takehealth_', 'https://img.icons8.com/ios-filled/50/ffffff/instagram-new.png')}
                    ${socialIcon('https://x.com/Take_Limited', 'https://img.icons8.com/ios-filled/50/ffffff/twitterx.png')}
                    ${socialIcon('https://www.youtube.com', 'https://img.icons8.com/ios-filled/50/ffffff/youtube-play.png')}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 0 32px 32px 32px; color:#ffffff; font-size:12px; line-height:1.6;">
                    &copy; 2026 NSE &amp; BSE Listed<br/>India
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
            <div class="logo">Take Health</div>
            <h2 style="margin: 0;">Your Diet Plan is Ready</h2>
          </div>
          <div class="content">
            <p class="welcome-text">Hi ${name},</p>
            <p>Your personalized AI diet plan has been generated based on your latest health data, goals, and preferences.</p>
            
            <a href="${dietUrl}" class="button">View My Diet Plan</a>

            <p>Following this plan consistently will help you reach your health goals faster.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Take Health. All rights reserved.</p>
            <p>Empowering your health journey with AI.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();