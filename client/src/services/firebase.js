import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const initFirebase = () => {
  if (!firebaseConfig.projectId) {
    console.error('❌ Firebase: VITE_FIREBASE_PROJECT_ID is missing from .env');
    return null;
  }
  // Prevent duplicate app initialization on hot reload
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
};

// Register service worker manually so Vite dev server can intercept it
const registerSW = async () => {
  if (!('serviceWorker' in navigator)) {
    console.warn('⚠️ Service workers not supported in this browser');
    return null;
  }
  try {
    // Use the existing sw.js which has Firebase messaging merged in
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('✅ Firebase SW registered');
    return reg;
  } catch (e) {
    console.error('❌ Firebase SW registration failed:', e.message);
    return null;
  }
};

export const requestNotificationPermission = async () => {
  try {
    if (!('Notification' in window)) {
      console.warn('⚠️ This browser does not support notifications');
      return null;
    }

    const fbApp = initFirebase();
    if (!fbApp) return null;

    // Check existing permission state before prompting
    if (Notification.permission === 'denied') {
      console.warn('🔔 Notifications blocked — user must enable from browser site settings');
      return null;
    }

    // Only prompt if not yet decided
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

    if (permission !== 'granted') {
      console.warn('🔔 Notification permission denied by user');
      return null;
    }

    // Register SW explicitly — required for getToken in Vite dev
    const swReg = await registerSW();
    if (!swReg) return null;

    const messaging = getMessaging(fbApp);
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

    if (!vapidKey) {
      console.error('❌ Firebase: VITE_FIREBASE_VAPID_KEY is missing from .env');
      return null;
    }

    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
    if (token) {
      console.log('✅ FCM token obtained:', token.slice(0, 20) + '...');
    } else {
      console.warn('⚠️ FCM: No token returned — check VAPID key and Firebase project settings');
    }
    return token || null;
  } catch (error) {
    console.error('❌ FCM setup error:', error.message);
    return null;
  }
};

export const onForegroundMessage = (callback) => {
  try {
    const fbApp = initFirebase();
    if (!fbApp) return () => {};
    const messaging = getMessaging(fbApp);
    return onMessage(messaging, callback);
  } catch (e) {
    console.error('❌ onForegroundMessage error:', e.message);
    return () => {};
  }
};
