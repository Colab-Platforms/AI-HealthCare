// Gateway-agnostic subscription lifecycle sweep — downgrades lapsed paid users to Free
// and escalates unresolved past_due accounts past their grace period.
// Runs independently of any webhook, so it self-heals if a webhook was ever missed.

const User = require('../models/User');
const emailService = require('./emailService');

const PAST_DUE_GRACE_DAYS = 5;
const RENEWAL_REMINDER_DAYS_BEFORE = 3;

// One-time-payment flow has no auto-renewal, so remind users a few days before
// currentPeriodEnd to come back and pay manually. Skips anyone already reminded
// for this period (renewalReminderSentAt is cleared on every successful payment).
const runRenewalReminderCron = async () => {
  try {
    const now = new Date();
    const reminderWindowEnd = new Date(now.getTime() + RENEWAL_REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000);

    const dueSoon = await User.find({
      'subscription.plan': { $ne: 'free' },
      'subscription.status': 'active',
      'subscription.autoRenew': false,
      'subscription.currentPeriodEnd': { $gte: now, $lte: reminderWindowEnd },
      'subscription.renewalReminderSentAt': null,
    }).select('name email subscription');

    for (const user of dueSoon) {
      try {
        await emailService.sendEmail({
          to: user.email,
          subject: `Your take.health ${user.subscription.plan} plan is renewing soon`,
          html: `<p>Hi ${user.name || 'there'},</p>
                 <p>Your ${user.subscription.plan} plan expires on ${new Date(user.subscription.currentPeriodEnd).toLocaleDateString('en-IN')}.
                 Renew from your Subscription page to keep uninterrupted access.</p>`,
        });
        user.subscription.renewalReminderSentAt = now;
        await user.save();
      } catch (emailErr) {
        console.error('[Subscription Lifecycle] Reminder email failed for', user.email, emailErr.message);
      }
    }

    console.log(`[Subscription Lifecycle] Renewal reminders sent: ${dueSoon.length}`);
  } catch (error) {
    console.error('[Subscription Lifecycle] Renewal reminder cron error:', error);
  }
};

const runSubscriptionLifecycleCron = async () => {
  try {
    const now = new Date();

    // Paid plan, period end has passed, and the gateway never marked it renewed/cancelled.
    const expiredResult = await User.updateMany(
      {
        'subscription.plan': { $ne: 'free' },
        'subscription.status': { $in: ['active', 'past_due'] },
        'subscription.currentPeriodEnd': { $lt: now },
      },
      {
        $set: {
          'subscription.plan': 'free',
          'subscription.status': 'expired',
          'subscription.autoRenew': false,
        },
      }
    );

    // past_due accounts whose grace period has run out without a currentPeriodEnd update
    // (e.g. gateway retries exhausted silently) — same downgrade, separate for clearer logging.
    const graceDeadline = new Date(now.getTime() - PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000);
    const graceExpiredResult = await User.updateMany(
      {
        'subscription.plan': { $ne: 'free' },
        'subscription.status': 'past_due',
        'subscription.statusUpdatedAt': { $lt: graceDeadline },
      },
      {
        $set: {
          'subscription.plan': 'free',
          'subscription.status': 'expired',
          'subscription.autoRenew': false,
        },
      }
    );

    console.log(
      `[Subscription Lifecycle] Expired by period end: ${expiredResult.modifiedCount}, ` +
      `Expired by grace period: ${graceExpiredResult.modifiedCount}`
    );
  } catch (error) {
    console.error('[Subscription Lifecycle] Cron error:', error);
  }
};

module.exports = { runSubscriptionLifecycleCron, runRenewalReminderCron };
