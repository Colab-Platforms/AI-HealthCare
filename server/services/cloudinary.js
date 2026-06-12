const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Log Cloudinary config status on startup
console.log('☁️ Cloudinary Config:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '❌ MISSING',
    api_key: process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ MISSING',
    api_secret: process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ MISSING',
});

/**
 * Upload an image to Cloudinary
 * @param {string|Buffer} imageData - Base64 data URI string, file path, or buffer
 * @param {string} folder - Destination folder in Cloudinary
 * @returns {Promise<string>} - The remote URL of the uploaded image
 */
const uploadImage = async (imageData, folder = 'food_scans') => {
    try {
        if (!imageData) {
            console.warn('☁️ uploadImage called with no data');
            return null;
        }

        // Validate Cloudinary config
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            console.error('☁️ Cloudinary not configured! Missing env variables.');
            return null;
        }

        const options = {
            folder: `fitcure/${folder}`,
            use_filename: true,
            unique_filename: true,
            resource_type: 'auto',
            type: 'upload',
            access_mode: 'public',  // Explicitly set to public
        };

        // If imageData is a buffer, we need to use upload_stream
        if (Buffer.isBuffer(imageData)) {
            console.log('☁️ Uploading buffer to Cloudinary..., size:', (imageData.length / 1024).toFixed(2), 'KB');
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
                    if (error) {
                        console.error('☁️ Cloudinary upload_stream error:', error.message);
                        reject(error);
                    }
                    else {
                        console.log('☁️ Cloudinary upload_stream success:', result.secure_url);
                        resolve(result.secure_url);
                    }
                });
                stream.end(imageData);
            });
        }

        // Otherwise use standard upload (handles base64 data URIs, file paths, and URLs)
        const isDataUri = typeof imageData === 'string' && imageData.startsWith('data:');
        const isUrl = typeof imageData === 'string' && imageData.startsWith('http');
        console.log('☁️ Uploading to Cloudinary...', {
            type: isDataUri ? 'data-uri' : (isUrl ? 'url' : 'file-path'),
            size: typeof imageData === 'string' ? `${(imageData.length / 1024).toFixed(2)} KB string` : 'unknown'
        });

        const result = await cloudinary.uploader.upload(imageData, options);
        console.log('☁️ Cloudinary upload success:', result.secure_url);
        return result.secure_url;
    } catch (error) {
        console.error('☁️ Cloudinary Upload Error:', error.message || error);
        if (error.http_code) {
            console.error('☁️ HTTP Code:', error.http_code);
        }
        return null;
    }
};

/**
 * Generate a private download URL for a Cloudinary file
 * This URL can be used by the client to download directly from Cloudinary
 * without going through the server (removes server as bottleneck)
 * 
 * @param {string} publicId - The Cloudinary public ID of the file
 * @param {number} expirationHours - How long the URL is valid (default: 24 hours)
 * @returns {string} - A signed URL that can be used for direct download
 */
const generatePrivateDownloadUrl = (publicId, expirationHours = 24) => {
    try {
        if (!publicId) {
            console.warn('☁️ generatePrivateDownloadUrl called with no publicId');
            return null;
        }

        // Calculate expiration timestamp (in seconds, as Cloudinary expects)
        const expirationTime = Math.floor(Date.now() / 1000) + (expirationHours * 3600);

        // Generate signed URL using Cloudinary's URL builder
        const url = cloudinary.url(publicId, {
            sign_url: true,
            type: 'private',
            resource_type: 'auto',
            secure: true,
            expires_at: expirationTime,
            flags: 'attachment'  // Force download instead of preview
        });

        console.log('☁️ Generated private download URL for:', publicId);
        return url;
    } catch (error) {
        console.error('☁️ Error generating private URL:', error.message);
        return null;
    }
};

/**
 * Extract public ID from a Cloudinary URL
 * @param {string} cloudinaryUrl - Full Cloudinary URL
 * @returns {string} - Public ID (path without extension)
 */
const extractPublicId = (cloudinaryUrl) => {
    try {
        // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{public_id}.{ext}
        const match = cloudinaryUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
        return match ? match[1] : null;
    } catch (error) {
        console.error('☁️ Error extracting public ID:', error.message);
        return null;
    }
};

const uploadRaw = async (buffer, folder = 'medical_documents') => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: `fitcure/${folder}`,
                unique_filename: true,
                resource_type: 'raw', // skip type detection, store as-is
                type: 'upload',
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
            }
        );
        stream.end(buffer);
    });
};

module.exports = {
    uploadImage,
    uploadRaw,
    cloudinary,
    generatePrivateDownloadUrl,
    extractPublicId
};
