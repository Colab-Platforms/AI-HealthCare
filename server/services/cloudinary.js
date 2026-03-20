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

module.exports = {
    uploadImage,
    cloudinary
};
