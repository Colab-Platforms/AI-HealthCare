/**
 * Medical Vault configuration.
 *
 * Everything that is a product/plan decision lives here so it can change
 * without touching controllers. Limits that depend on the Cloudinary plan are
 * env-driven: the free plan caps files at ~10MB, so VAULT_MAX_FILE_BYTES
 * defaults to 10MB. After upgrading the plan, set it to 20971520 (20MB).
 */

const MB = 1024 * 1024;

const intFromEnv = (name, fallback) => {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const MAX_FILE_BYTES = intFromEnv('VAULT_MAX_FILE_BYTES', 10 * MB);
const MAX_FILES_PER_UPLOAD = intFromEnv('VAULT_MAX_FILES_PER_UPLOAD', 10);

/* ───────────────────────── Storage limit (EDIT HERE) ─────────────────────────
 * A user's vault limit is:
 *
 *     FREE_BASE_BYTES  +  (sum of every storage grant they have earned)
 *
 * Every successful paid subscription payment earns GRANT_BYTES_PER_PAYMENT, and
 * grants are permanent: if the user later drops to the free plan the limit just
 * stops growing, nothing is taken away. Both numbers can be changed here or via
 * env without touching any other code.
 *
 *   month 1 free            -> 10 MB
 *   month 2 paid  (+50 MB)  -> 60 MB
 *   month 3 paid  (+50 MB)  -> 110 MB
 *   month 4 free            -> 110 MB   (no growth until they pay again)
 *   month 5 paid  (+50 MB)  -> 160 MB
 *
 * Changing FREE_BASE_BYTES applies to everyone immediately (the limit is
 * recomputed on each request). Changing GRANT_BYTES_PER_PAYMENT only affects
 * grants created from now on; existing grants keep the size they were given.
 */
const FREE_BASE_BYTES = intFromEnv('VAULT_FREE_BYTES', 50 * MB);
const GRANT_BYTES_PER_PAYMENT = intFromEnv('VAULT_GRANT_BYTES', 100 * MB);

// Subscription plans that earn a grant when a payment succeeds. `free` and the
// 14-day `free_trial` are deliberately absent. basic/premium are retired plans
// kept so existing subscribers still earn storage.
const GRANTING_PLAN_KEYS = ['take_plus', 'basic', 'premium'];

// mime -> how it is stored on Cloudinary. PDFs go in as `image` so Cloudinary
// can report the page count; text goes in as `raw`.
const ALLOWED_FILE_TYPES = {
  'application/pdf': { resourceType: 'image', formats: ['pdf'], ext: 'pdf' },
  'image/jpeg': { resourceType: 'image', formats: ['jpg', 'jpeg'], ext: 'jpg' },
  'image/jpg': { resourceType: 'image', formats: ['jpg', 'jpeg'], ext: 'jpg' },
  'image/png': { resourceType: 'image', formats: ['png'], ext: 'png' },
  'text/plain': { resourceType: 'raw', formats: ['txt'], ext: 'txt' },
};

const PRESET_CATEGORIES = {
  illness: 'Illness',
  routine_checkup: 'Routine checkup',
  injury: 'Injury',
  scans_xrays: 'Scans & X-rays',
  prescriptions: 'Prescriptions',
};

const FOLDER_COLORS = {
  illness: '#D9534F',
  routine_checkup: '#3B82C4',
  injury: '#C79A1E',
  scans_xrays: '#7A5BB5',
  prescriptions: '#2E9E7B',
  custom: '#64748B',
};

const SHARE_EXPIRY_DAYS = { min: 1, max: 30, default: 3 };

// Signed direct-upload parameters are valid for a short window only.
const UPLOAD_SESSION_TTL_SEC = 30 * 60;
// Soft-deleted reports are purged from Cloudinary after this grace period.
const PURGE_GRACE_HOURS = 24;

const CLOUDINARY_ROOT = 'takehealth/vault';

module.exports = {
  MB,
  MAX_FILE_BYTES,
  FREE_BASE_BYTES,
  GRANT_BYTES_PER_PAYMENT,
  GRANTING_PLAN_KEYS,
  MAX_FILES_PER_UPLOAD,
  ALLOWED_FILE_TYPES,
  PRESET_CATEGORIES,
  FOLDER_COLORS,
  SHARE_EXPIRY_DAYS,
  UPLOAD_SESSION_TTL_SEC,
  PURGE_GRACE_HOURS,
  CLOUDINARY_ROOT,
};
