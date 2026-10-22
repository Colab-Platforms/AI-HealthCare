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

  // Claim first, send second. The flag is flipped with a conditional update
  // ({flag: {$ne: true}}) BEFORE the email goes out, so when two instances (or
  // two overlapping ticks) pick up the same appointment, exactly one wins the
  // claim and the other skips it. The old find -> email -> save() order let both
  // send. If the send fails, the claim is released so the next tick retries.
  // Returns true only if this call sent the reminder.
  async claimAndSend(appointment, flag) {
    const claimed = await Appointment.updateOne(
      { _id: appointment._id, [flag]: { $ne: true } },
      { $set: { [flag]: true } }
    );
    if (claimed.modifiedCount !== 1) return false; // someone else already has it

    try {
      await emailService.sendConsultationReminder({
        patient: appointment.patient,
        doctor: {
          name: appointment.doctor.user?.name || appointment.doctor.name,
          email: appointment.doctor.user?.email || appointment.doctor.email,
          specialization: appointment.doctor.specialization
        },
        appointment
      });
      return true;
    } catch (error) {
      console.error(`Failed to send ${flag} reminder for appointment ${appointment._id}:`, error);
      try {
        await Appointment.updateOne({ _id: appointment._id }, { $set: { [flag]: false } });
      } catch (releaseError) {
        console.error(`Could not release ${flag} claim for appointment ${appointment._id}:`, releaseError.message);
      }
      return false;
    }
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
        if (await this.claimAndSend(appointment, 'reminderSent')) {
          console.log(`Reminder sent for appointment ${appointment._id}`);
        }
      }
    } catch (error) {
      console.error('Error in sendUpcomingReminders:', error);
    }
  }

  async sendDayBeforeReminders() {
    try {
      // "About a day before" as an instant, not a calendar day. The old query took
      // "tomorrow" from the server's (UTC) midnight, so for IST patients the
      // reminder timing depended on where UTC midnight fell in their day. A rolling
      // 23h–25h window is timezone-free; this runs hourly, so every appointment
      // enters it on ~2 ticks. The overlap is also the safety net for one missed
      // tick, and claimAndSend's atomic flag stops it sending twice.
      const HOUR_MS = 60 * 60 * 1000;
      const windowStart = new Date(Date.now() + 23 * HOUR_MS);
      const windowEnd = new Date(Date.now() + 25 * HOUR_MS);

      const tomorrowAppointments = await Appointment.find({
        date: { $gte: windowStart, $lt: windowEnd },
        status: { $in: ['scheduled', 'confirmed'] },
        dayBeforeReminderSent: { $ne: true }
      })
      .populate('patient', 'name email age')
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email' } });

      for (const appointment of tomorrowAppointments) {
        if (await this.claimAndSend(appointment, 'dayBeforeReminderSent')) {
          console.log(`Day-before reminder sent for appointment ${appointment._id}`);
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