const { getFirebaseApp } = require('../config/firebase');
const { getMessaging } = require('firebase-admin/messaging');
const FCMToken = require('../models/FCMToken');

const getMsg = () => {
  const app = getFirebaseApp();
  if (!app) return null;
  return getMessaging(app);
};

// Mark invalid tokens inactive in bulk
const cleanupInvalidTokens = async (tokens, responses) => {
  const invalidTokens = [];
  responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        invalidTokens.push(tokens[i]);
      }
    }
  });

  if (invalidTokens.length > 0) {
    await FCMToken.updateMany(
      { token: { $in: invalidTokens } },
      { isActive: false }
    );
    console.warn(`🗑️ Marked ${invalidTokens.length} invalid FCM token(s) inactive`);
  }
};

// Send to a single user (all their active devices)
const sendToUser = async (userId, { title, body, data = {}, imageUrl } = {}) => {
  try {
    const messaging = getMsg();
    if (!messaging) return { success: false, reason: 'FCM not configured' };

    const tokenDocs = await FCMToken.find({ userId, isActive: true }).lean();
    if (tokenDocs.length === 0) return { success: false, reason: 'No active FCM tokens' };

    const tokens = tokenDocs.map(t => t.token);

    const message = {
      tokens,
      notification: { title, body, ...(imageUrl && { imageUrl }) },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      android: { priority: 'high', notification: { sound: 'default', channelId: 'health_reminders' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      webpush: { notification: { icon: '/logo192.png', badge: '/badge.png' } }
    };

    const response = await messaging.sendEachForMulticast(message);
    await cleanupInvalidTokens(tokens, response.responses);

    // Update lastUsedAt for successful tokens
    const successTokens = tokens.filter((_, i) => response.responses[i].success);
    if (successTokens.length > 0) {
      await FCMToken.updateMany({ token: { $in: successTokens } }, { lastUsedAt: new Date() });
    }

    console.log(`✅ FCM sendToUser: ${response.successCount}/${tokens.length} delivered (userId: ${userId})`);
    return { success: response.successCount > 0, successCount: response.successCount, total: tokens.length };
  } catch (error) {
    console.error(`❌ FCM sendToUser error (userId: ${userId}):`, error.message);
    return { success: false, error: error.message };
  }
};

// Send to multiple users — batched multicast (500 tokens per batch)
const sendToMultipleUsers = async (userIds, notification) => {
  try {
    const messaging = getMsg();
    if (!messaging) return { succeeded: 0, total: 0 };

    const tokenDocs = await FCMToken.find({ userId: { $in: userIds }, isActive: true }).lean();
    if (tokenDocs.length === 0) return { succeeded: 0, total: 0 };

    const tokens = tokenDocs.map(t => t.token);
    const BATCH = 500;
    let totalSuccess = 0;
    const allInvalidTokens = [];

    for (let i = 0; i < tokens.length; i += BATCH) {
      const batch = tokens.slice(i, i + BATCH);
      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title: notification.title, body: notification.body },
        data: notification.data || {},
        android: { priority: 'high' },
        webpush: { notification: { icon: '/logo192.png' } }
      });

      totalSuccess += response.successCount;

      // Collect invalid tokens from this batch
      response.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = r.error?.code;
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            allInvalidTokens.push(batch[idx]);
          }
        }
      });
    }

    // Bulk cleanup invalid tokens
    if (allInvalidTokens.length > 0) {
      await FCMToken.updateMany({ token: { $in: allInvalidTokens } }, { isActive: false });
      console.warn(`🗑️ Marked ${allInvalidTokens.length} invalid token(s) inactive`);
    }

    console.log(`📢 Bulk FCM: ${totalSuccess}/${tokens.length} delivered to ${userIds.length} users`);
    return { succeeded: totalSuccess, total: tokens.length };
  } catch (error) {
    console.error('❌ FCM sendToMultipleUsers error:', error.message);
    return { succeeded: 0, total: 0, error: error.message };
  }
};

// Send to a raw token (for testing)
const sendToToken = async (token, { title, body, data = {} } = {}) => {
  try {
    const messaging = getMsg();
    if (!messaging) return { success: false };

    const response = await messaging.send({
      token,
      notification: { title, body },
      data,
      android: { priority: 'high' },
      webpush: {
        notification: { title, body, icon: '/icon.svg' },
        fcm_options: { link: '/' }
      }
    });
    return { success: true, messageId: response };
  } catch (error) {
    console.error('FCM sendToToken error:', error.message);
    return { success: false, error: error.message };
  }
};

// Broadcast to ALL active users (topic-based for scale)
const broadcastToAll = async ({ title, body, data = {} } = {}) => {
  try {
    const messaging = getMsg();
    if (!messaging) return { success: false };

    // Subscribe all active tokens to 'all-users' topic (done once)
    // Then send via topic — no token limit
    const response = await messaging.send({
      topic: 'all-users',
      notification: { title, body },
      data,
      android: { priority: 'high' },
      webpush: { notification: { icon: '/logo192.png' } }
    });

    console.log(`📡 Broadcast sent: ${response}`);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('❌ FCM broadcast error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendToUser, sendToMultipleUsers, sendToToken, broadcastToAll };
