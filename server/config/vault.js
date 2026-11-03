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
const DEFAULT_QUOTA_BYTES = intFromEnv('VAULT_DEFAULT_QUOTA_BYTES', 1024 * MB); // 1 GB
const MAX_FILES_PER_UPLOAD = intFromEnv('VAULT_MAX_FILES_PER_UPLOAD', 10);

// Optional per-plan quota overrides (bytes). Unlisted plans get the default.
const QUOTA_BY_PLAN = {
  free: DEFAULT_QUOTA_BYTES,
  free_trial: DEFAULT_QUOTA_BYTES,
};

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

const quotaForPlan = (plan) => QUOTA_BY_PLAN[plan] || DEFAULT_QUOTA_BYTES;

module.exports = {
  MB,
  MAX_FILE_BYTES,
  DEFAULT_QUOTA_BYTES,
  MAX_FILES_PER_UPLOAD,
  ALLOWED_FILE_TYPES,
  PRESET_CATEGORIES,
  FOLDER_COLORS,
  SHARE_EXPIRY_DAYS,
  UPLOAD_SESSION_TTL_SEC,
  PURGE_GRACE_HOURS,
  CLOUDINARY_ROOT,
  quotaForPlan,
};
