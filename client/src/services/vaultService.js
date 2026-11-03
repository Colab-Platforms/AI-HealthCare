import api from './api';

const BASE = 'v1/vault';
const unwrap = (promise) => promise.then((r) => r.data);

export const errorMessage = (err, fallback = 'Something went wrong') =>
  err?.response?.data?.message || err?.message || fallback;

const MIME_BY_EXT = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  txt: 'text/plain',
};
export const ALLOWED_MIMES = Object.values(MIME_BY_EXT);

/** Browsers sometimes report an empty type; fall back to the extension. */
export const resolveMime = (file) => {
  if (ALLOWED_MIMES.includes(file.type)) return file.type;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return MIME_BY_EXT[ext] || file.type || '';
};

const stripExt = (name) => name.replace(/\.[^.]+$/, '');

/**
 * Direct browser -> Cloudinary upload with the params signed by our API.
 * Every signed field must be sent unchanged, with the file last.
 */
const uploadToCloudinary = (upload, file, onProgress) =>
  new Promise((resolve, reject) => {
    const form = new FormData();
    Object.entries(upload.fields).forEach(([k, v]) => form.append(k, String(v)));
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', upload.uploadUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = 'Upload to storage failed';
      try { msg = JSON.parse(xhr.responseText)?.error?.message || msg; } catch { /* keep default */ }
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading'));
    xhr.send(form);
  });

export const vaultService = {
  home: (params) => unwrap(api.get(`${BASE}/home`, { params })),
  usage: () => unwrap(api.get(`${BASE}/usage`)),
  timeline: (params) => unwrap(api.get(`${BASE}/timeline`, { params })),

  createFolder: (body) => unwrap(api.post(`${BASE}/folders`, body)),
  getFolder: (id) => unwrap(api.get(`${BASE}/folders/${id}`)),
  updateFolder: (id, body) => unwrap(api.patch(`${BASE}/folders/${id}`, body)),
  deleteFolder: (id, mode) => unwrap(api.delete(`${BASE}/folders/${id}`, { params: mode ? { mode } : undefined })),
  folderReports: (id, params) => unwrap(api.get(`${BASE}/folders/${id}/reports`, { params })),

  listReports: (params) => unwrap(api.get(`${BASE}/reports`, { params })),
  getReport: (id) => unwrap(api.get(`${BASE}/reports/${id}`)),
  updateReport: (id, body) => unwrap(api.patch(`${BASE}/reports/${id}`, body)),
  deleteReport: (id) => unwrap(api.delete(`${BASE}/reports/${id}`)),
  reportBlob: (id, download = false) =>
    api.get(`${BASE}/reports/${id}/file`, { params: download ? { download: 1 } : undefined, responseType: 'blob' }),
  reportDownload: (id) => unwrap(api.get(`${BASE}/reports/${id}/download`)),

  createShare: (reportId, body) => unwrap(api.post(`${BASE}/reports/${reportId}/shares`, body)),
  listShares: (reportId) => unwrap(api.get(`${BASE}/reports/${reportId}/shares`)),
  revokeShare: (shareId) => unwrap(api.delete(`${BASE}/shares/${shareId}`)),

  /**
   * sign -> direct upload -> finalize. `onProgress(index, percent)` fires per file.
   * Resolves with the finalize response ({ reports, failed, usage }).
   */
  async uploadReports({ files, folderId, reportDate, note, source = 'upload', onProgress }) {
    const sign = await unwrap(
      api.post(`${BASE}/uploads/sign`, {
        files: files.map((f) => ({ name: f.name, mime: resolveMime(f), size: f.size })),
      })
    );

    await Promise.all(
      sign.uploads.map((u) => uploadToCloudinary(u, files[u.index], (p) => onProgress?.(u.index, p)))
    );

    return unwrap(
      api.post(`${BASE}/reports`, {
        sessionId: sign.sessionId,
        folderId: folderId || undefined,
        source,
        reports: sign.uploads.map((u) => ({
          publicId: u.publicId,
          originalName: files[u.index].name,
          title: stripExt(files[u.index].name),
          reportDate: reportDate || undefined,
          note: note || undefined,
        })),
      })
    );
  },
};
