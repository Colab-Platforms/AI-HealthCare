const admin = require('firebase-admin');

let initialized = false;

const getFirebaseApp = () => {
  if (initialized) return admin.getApp();

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('Firebase credentials missing — push notifications disabled');
    return null;
  }

  try {
    admin.initializeApp({
      credential: admin.cert({ projectId, clientEmail, privateKey }),
    });
    initialized = true;
    console.log('Firebase Admin initialized');
    return admin.getApp();
  } catch (e) {
    console.error('Firebase init failed:', e.message);
    return null;
  }
};

module.exports = { getFirebaseApp, admin };
