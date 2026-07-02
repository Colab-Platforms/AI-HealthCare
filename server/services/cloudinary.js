const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('☁️ Cloudinary Config:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '❌ MISSING',
    api_key: process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ MISSING',
    api_secret: process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ MISSING',
});

/* ─────────────────────────────────────────────────────────────
   Signed URL Cache
   Key: publicId  Value: { url, expiresAt }
   Avoids re-signing the same file on every request.
   TTL: 55 min (URLs expire at 60 min → 5 min safety buffer)
───────────────────────────────────────────────────────────── */
const SIGNED_URL_TTL_SEC = 60 * 60;        // 1 hour URL lifetime
const CACHE_TTL_MS       = 55 * 60 * 1000; // 55 min cache lifetime

const _signedUrlCache = new Map();

function _getCached(publicId) {
    const entry = _signedUrlCache.get(publicId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { _signedUrlCache.delete(publicId); return null; }
    return entry.url;
}

function _setCache(publicId, url) {
    // Prune cache if it grows too large (>500 entries)
    if (_signedUrlCache.size > 500) {
        const now = Date.now();
        for (const [k, v] of _signedUrlCache) {
            if (now > v.expiresAt) _signedUrlCache.delete(k);
        }
    }
    _signedUrlCache.set(publicId, { url, expiresAt: Date.now() + CACHE_TTL_MS });
}

/* ─────────────────────────────────────────────────────────────
   Upload — authenticated type so files are NOT publicly
   accessible without a signed URL.
───────────────────────────────────────────────────────────── */
const uploadImage = async (imageData, folder = 'food_scans') => {
    try {
        if (!imageData) { console.warn('☁️ uploadImage called with no data'); return null; }
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            console.error('☁️ Cloudinary not configured!'); return null;
        }

        const options = {
            folder: `fitcure/${folder}`,
            use_filename: true,
            unique_filename: true,
            resource_type: 'auto',
            type: 'authenticated',   // ← private; requires signed URL to access
        };

        if (Buffer.isBuffer(imageData)) {
            console.log('☁️ Uploading buffer...', (imageData.length / 1024).toFixed(2), 'KB');
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
                    if (error) { console.error('☁️ upload_stream error:', error.message); reject(error); }
                    else { console.log('☁️ upload_stream success:', result.public_id); resolve(result.secure_url); }
                });
                stream.end(imageData);
            });
        }

        const result = await cloudinary.uploader.upload(imageData, options);
        console.log('☁️ upload success:', result.public_id);
        return result.secure_url;
    } catch (error) {
        console.error('☁️ Upload Error:', error.message);
        return null;
    }
};

const uploadRaw = async (buffer, folder = 'medical_documents') => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: `fitcure/${folder}`,
                unique_filename: true,
                resource_type: 'raw',
                type: 'authenticated',   // ← private
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
            }
        );
        stream.end(buffer);
    });
};

/* ─────────────────────────────────────────────────────────────
   generateSignedUrl
   Returns a time-limited signed URL for any Cloudinary resource.
   - For internal server-to-Cloudinary fetches: use the raw
     cloudinaryUrl directly (server uses API key, no restriction).
   - For client-facing URLs: always use this function.

   Performance: result cached 55 min — zero extra API calls.
───────────────────────────────────────────────────────────── */
const generateSignedUrl = (cloudinaryUrlOrPublicId, resourceType = 'auto') => {
    try {
        if (!cloudinaryUrlOrPublicId) return null;

        // Accept either a full URL or a publicId
        const publicId = cloudinaryUrlOrPublicId.startsWith('http')
            ? extractPublicId(cloudinaryUrlOrPublicId)
            : cloudinaryUrlOrPublicId;

        if (!publicId) return null;

        // Return cached if still fresh
        const cached = _getCached(publicId);
        if (cached) return cached;

        const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SEC;

        const url = cloudinary.url(publicId, {
            sign_url: true,
            type: 'authenticated',
            resource_type: resourceType,
            secure: true,
            expires_at: expiresAt,
        });

        _setCache(publicId, url);
        return url;
    } catch (error) {
        console.error('☁️ generateSignedUrl error:', error.message);
        return null;
    }
};

/* ─────────────────────────────────────────────────────────────
   generateSignedDownloadUrl
   Same as above but forces browser download (attachment flag).
───────────────────────────────────────────────────────────── */
const generateSignedDownloadUrl = (cloudinaryUrlOrPublicId, resourceType = 'auto') => {
    try {
        if (!cloudinaryUrlOrPublicId) return null;

        const publicId = cloudinaryUrlOrPublicId.startsWith('http')
            ? extractPublicId(cloudinaryUrlOrPublicId)
            : cloudinaryUrlOrPublicId;

        if (!publicId) return null;

        const cacheKey = `dl:${publicId}`;
        const cached = _getCached(cacheKey);
        if (cached) return cached;

        const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SEC;

        const url = cloudinary.url(publicId, {
            sign_url: true,
            type: 'authenticated',
            resource_type: resourceType,
            secure: true,
            expires_at: expiresAt,
            flags: 'attachment',
        });

        _setCache(cacheKey, url);
        return url;
    } catch (error) {
        console.error('☁️ generateSignedDownloadUrl error:', error.message);
        return null;
    }
};

/* ─────────────────────────────────────────────────────────────
   extractPublicId
   Handles both 'upload' and 'authenticated' type URLs.
   Example: https://res.cloudinary.com/cloud/image/authenticated/v123/fitcure/reports/abc.pdf
         → fitcure/reports/abc
───────────────────────────────────────────────────────────── */
const extractPublicId = (cloudinaryUrl) => {
    try {
        if (!cloudinaryUrl) return null;
        const baseUrl = cloudinaryUrl.split('?')[0];
        // Cloudinary URL structure: /{resource_type}/{delivery_type}/v{ver}/{public_id}.{ext}
        // e.g. /raw/authenticated/v123/fitcure/medical_documents/abc
        // e.g. /image/authenticated/v123/fitcure/health_reports/xyz.jpg
        // e.g. /image/upload/v123/fitcure/food_scans/abc.jpg
        const match = baseUrl.match(/\/(?:raw|image|video|auto)\/(?:upload|authenticated)\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
        return match ? match[1] : null;
    } catch (error) {
        console.error('☁️ extractPublicId error:', error.message);
        return null;
    }
};

// Legacy alias — kept for backward compat
const generatePrivateDownloadUrl = generateSignedDownloadUrl;

module.exports = {
    uploadImage,
    uploadRaw,
    cloudinary,
    generateSignedUrl,
    generateSignedDownloadUrl,
    generatePrivateDownloadUrl,
    extractPublicId,
};
