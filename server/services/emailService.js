const { Resend } = require('resend');
const fs = require('fs');

class EmailService {
  constructor() {
    this.apiKey = process.env.RESEND_API_KEY;
    if (this.apiKey) {
      this.resend = new Resend(this.apiKey);
      console.log('✅ Email Service: Resend API initialized');
    } else {
      console.warn('⚠️ Email Service: RESEND_API_KEY is missing. Emails will fail to send on Production.');
    }
  }

  async sendEmail({ to, subject, html }) {
    if (!this.resend) {
      console.error('❌ Email Service: No Resend API key found');
      return { success: false, error: 'API key missing' };
    }

    try {
      console.log(`📧 Sending email to ${to}: ${subject}`);
      const data = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
        to,
        subject,
        html,
      });

      console.log('✅ Email sent successfully:', data.id);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Email Service: Failed to send email via Resend:', error.message);
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

  async sendReportAnalysisComplete(email, name, reportId) {
    const html = this.getReportAnalysisCompleteTemplate(name, reportId);
    return this.sendEmail({ to: email, subject: 'Report Analysis Completed - take.health AI', html });
  }

  async sendDietPlanComplete(email, name) {
    const html = this.getDietPlanCompleteTemplate(name);
    return this.sendEmail({ to: email, subject: 'Customized Diet Plan Ready - take.health AI', html });
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
            <div class="logo">FitCure AI</div>
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
            <p>&copy; ${new Date().getFullYear()} FitCure AI. All rights reserved.</p>
            <p>Empowering your health journey with AI.</p>
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