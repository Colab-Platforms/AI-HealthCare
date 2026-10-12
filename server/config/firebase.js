const admin = require('firebase-admin');

let initialized = false;

// Dashboard env-var UIs mangle a pasted PEM key in a few predictable ways:
// wrapping quotes carried over from a JSON service-account file (the field's
// own quotes get copy-pasted too), escaped `\n`/`\r\n` that need converting
// to real line breaks, real Windows `\r\n` line endings, and stray leading/
// trailing whitespace. Normalizing all of these here means a bad paste into
// Render (or anywhere else) doesn't need a round of manual re-pasting to fix —
// this already covers the formats that failed twice before this existed.
function normalizePrivateKey(raw) {
  if (!raw) return raw;
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  key = key
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n');
  // PEM convention is a trailing newline after the END line; `.trim()` above
  // strips it along with any stray outer whitespace, so restore it.
  return key.endsWith('\n') ? key : `${key}\n`;
}

const getFirebaseApp = () => {
  if (initialized) return admin.getApp();

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

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

module.exports = { getFirebaseApp, admin, normalizePrivateKey };
