export const PRESET_CATEGORIES = [
  { key: 'illness', label: 'Illness' },
  { key: 'routine_checkup', label: 'Routine checkup' },
  { key: 'injury', label: 'Injury' },
  { key: 'scans_xrays', label: 'Scans & X-rays' },
  { key: 'prescriptions', label: 'Prescriptions' },
];

export const NAVY = '#2B3F86';

export const formatBytes = (bytes) => {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
};

// Dates are stored at UTC midnight, so always format in UTC to avoid off-by-one days.
const utc = (d) => new Date(d);

export const formatDate = (d) => {
  if (!d) return '';
  const x = utc(d);
  const day = x.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'UTC' });
  const mon = x.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  const yr = x.toLocaleDateString('en-GB', { year: '2-digit', timeZone: 'UTC' });
  return `${day} ${mon} '${yr}`;
};

export const formatDateLong = (d) =>
  d ? utc(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';

export const dayParts = (d) => ({
  day: utc(d).toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'UTC' }),
  mon: utc(d).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase(),
});

export const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1))
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .toUpperCase();
};

export const folderRange = (f) => {
  const { firstReportDate: a, latestReportDate: b } = f.stats || {};
  if (!a) return 'No reports yet';
  return a === b ? formatDate(a) : `${formatDate(a)} → ${formatDate(b)}`;
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const tint = (hex, alpha = '1A') => `${hex}${alpha}`;

export const fileKind = (report) => {
  const f = (report?.file?.format || '').toUpperCase();
  return f === 'JPEG' ? 'JPG' : f || 'FILE';
};
