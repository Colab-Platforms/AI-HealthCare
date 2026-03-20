const cron = require('node-cron');
const Appointment = require('../models/Appointment');
const emailService = require('./emailService');

class ReminderService {
  constructor() {
    this.startReminderScheduler();
  }

  startReminderScheduler() {
    // Run every 15 minutes to check for upcoming appointments
    cron.schedule('*/15 * * * *', async () => {
      await this.sendUpcomingReminders();
    });

    // Run every hour to send day-before reminders
    cron.schedule('0 * * * *', async () => {
      await this.sendDayBeforeReminders();
    });

    console.log('Appointment reminder scheduler started');
  }

  async sendUpcomingReminders() {
    try {
      const now = new Date();
      const in30Minutes = new Date(now.getTime() + 30 * 60 * 1000);
      const in15Minutes = new Date(now.getTime() + 15 * 60 * 1000);

      // Find appointments starting in 15-30 minutes that haven't been reminded
      const upcomingAppointments = await Appointment.find({
        date: { $gte: in15Minutes, $lte: in30Minutes },
        status: { $in: ['scheduled', 'confirmed'] },
        reminderSent: { $ne: true }
      })
      .populate('patient', 'name email age')
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email' } });

      for (const appointment of upcomingAppointments) {
        try {
          const emailData = {
            patient: appointment.patient,
            doctor: {
              name: appointment.doctor.user?.name || appointment.doctor.name,
              email: appointment.doctor.user?.email || appointment.doctor.email,
              specialization: appointment.doctor.specialization
            },
            appointment
          };

          await emailService.sendConsultationReminder(emailData);
          
          // Mark as reminded
          appointment.reminderSent = true;
          await appointment.save();

          console.log(`Reminder sent for appointment ${appointment._id}`);
        } catch (error) {
          console.error(`Failed to send reminder for appointment ${appointment._id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in sendUpcomingReminders:', error);
    }
  }

  async sendDayBeforeReminders() {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      // Find appointments for tomorrow that haven't been reminded
      const tomorrowAppointments = await Appointment.find({
        date: { $gte: tomorrow, $lt: dayAfterTomorrow },
        status: { $in: ['scheduled', 'confirmed'] },
        dayBeforeReminderSent: { $ne: true }
      })
      .populate('patient', 'name email age')
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email' } });

      for (const appointment of tomorrowAppointments) {
        try {
          const emailData = {
            patient: appointment.patient,
            doctor: {
              name: appointment.doctor.user?.name || appointment.doctor.name,
              email: appointment.doctor.user?.email || appointment.doctor.email,
              specialization: appointment.doctor.specialization
            },
            appointment
          };

          await emailService.sendConsultationReminder(emailData);
          
          // Mark as reminded
          appointment.dayBeforeReminderSent = true;
          await appointment.save();

          console.log(`Day-before reminder sent for appointment ${appointment._id}`);
        } catch (error) {
          console.error(`Failed to send day-before reminder for appointment ${appointment._id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in sendDayBeforeReminders:', error);
    }
  }

  // Manual reminder sending
  async sendManualReminder(appointmentId) {
    try {
      const appointment = await Appointment.findById(appointmentId)
        .populate('patient', 'name email age')
        .populate({ path: 'doctor', populate: { path: 'user', select: 'name email' } });

      if (!appointment) {
        throw new Error('Appointment not found');
      }

      const emailData = {
        patient: appointment.patient,
        doctor: {
          name: appointment.doctor.user?.name || appointment.doctor.name,
          email: appointment.doctor.user?.email || appointment.doctor.email,
          specialization: appointment.doctor.specialization
        },
        appointment
      };

      await emailService.sendConsultationReminder(emailData);
      
      return { success: true, message: 'Manual reminder sent successfully' };
    } catch (error) {
      console.error('Error sending manual reminder:', error);
      throw error;
    }
  }
}

module.exports = new ReminderService();