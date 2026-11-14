// Gateway-agnostic subscription lifecycle sweep — downgrades lapsed paid users to Free
// and escalates unresolved past_due accounts past their grace period.
// Runs independently of any webhook, so it self-heals if a webhook was ever missed.

const User = require('../models/User');
const emailService = require('./emailService');

const PAST_DUE_GRACE_DAYS = 3;
const RENEWAL_REMINDER_DAYS_BEFORE = 3;

// One-time-payment flow has no auto-renewal, so remind users a few days before
// currentPeriodEnd to come back and pay manually. Skips anyone already reminded
// for this period (renewalReminderSentAt is cleared on every successful payment).
// Excludes free_trial explicitly — a trial has no payment on file, so "renew your
// plan" is the wrong message; runTrialEndingReminderCron below handles that case.
const runRenewalReminderCron = async () => {
  try {
    const now = new Date();
    const reminderWindowEnd = new Date(now.getTime() + RENEWAL_REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000);

    const dueSoon = await User.find({
      'subscription.plan': { $nin: ['free', 'free_trial'] },
      'subscription.grantSource': null, // free Take+ from the Shopify offer gets the trial-ending email instead
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

// Same idea as the renewal reminder, but for free_trial accounts and with
// "upgrade now" copy instead of "renew" — there's no saved payment method to
// auto-charge, so nothing renews on its own.
const runTrialEndingReminderCron = async () => {
  try {
    const now = new Date();
    const reminderWindowEnd = new Date(now.getTime() + RENEWAL_REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000);

    // Free Take+ from the Shopify store offer (grantSource) ends the same way a
    // trial does, so it gets this email too.
    const endingSoon = await User.find({
      $or: [
        { 'subscription.plan': 'free_trial' },
        { 'subscription.grantSource': 'shopify_offer' },
      ],
      'subscription.status': 'active',
      'subscription.currentPeriodEnd': { $gte: now, $lte: reminderWindowEnd },
      'subscription.renewalReminderSentAt': null,
    }).select('name email subscription');

    for (const user of endingSoon) {
      const isOffer = user.subscription.grantSource === 'shopify_offer';
      const endsOn = new Date(user.subscription.currentPeriodEnd).toLocaleDateString('en-IN');
      try {
        await emailService.sendEmail({
          to: user.email,
          subject: isOffer ? 'Your free Take+ access is ending soon' : 'Your take.health free trial is ending soon',
          html: isOffer
            ? `<p>Hi ${user.name || 'there'},</p>
                 <p>Your free Take+ access ends on ${endsOn}.
                 Subscribe to Take+ from your Subscription page to keep uninterrupted access.</p>`
            : `<p>Hi ${user.name || 'there'},</p>
                 <p>Your free trial ends on ${endsOn}.
                 Upgrade to Pro or Pro Plus from your Subscription page to keep uninterrupted access to paid features.</p>`,
        });
        user.subscription.renewalReminderSentAt = now;
        await user.save();
      } catch (emailErr) {
        console.error('[Subscription Lifecycle] Trial-ending email failed for', user.email, emailErr.message);
      }
    }

    console.log(`[Subscription Lifecycle] Trial-ending reminders sent: ${endingSoon.length}`);
  } catch (error) {
    console.error('[Subscription Lifecycle] Trial-ending reminder cron error:', error);
  }
};

const runSubscriptionLifecycleCron = async () => {
  try {
    const now = new Date();

    // Shopify card offers waiting for a paid plan to end (shopifyOfferService,
    // rule D): give those users their trial BEFORE the downgrade below, so they
    // go from the paid plan straight to the trial instead of to 'free'.
    // Required here, not at the top: subscriptionAccess (which the offer service
    // uses) imports this file, and a top-level require would be circular.
    try {
      const { applyPendingCredits } = require('./shopifyOfferService');
      const applied = await applyPendingCredits(now);
      if (applied) console.log(`[Subscription Lifecycle] Shopify offer trials started after paid plan: ${applied}`);
    } catch (offerErr) {
      console.error('[Subscription Lifecycle] Shopify pending offers failed:', offerErr.message);
    }

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
        $unset: { 'subscription.grantSource': '' },
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

module.exports = { runSubscriptionLifecycleCron, runRenewalReminderCron, runTrialEndingReminderCron, PAST_DUE_GRACE_DAYS };
