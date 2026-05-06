const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.resolve(__dirname, '..', 'uploads');

// Ensure a stable absolute upload path exists when using disk storage
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (error) {
  console.error('Failed to initialize uploads directory:', error.message);
}

// Use memory storage on serverless/cloud; disk storage locally
const isCloudRuntime = Boolean(
  process.env.VERCEL ||
  process.env.VERCEL_ID ||
  process.env.RAILWAY_ENVIRONMENT_ID
);

const storage = isCloudRuntime
  ? multer.memoryStorage() // Store in memory for Cloud
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadsDir),
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
      }
    });

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/heic', 'image/heif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF and images are allowed.'), false);
  }
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 } // Set to 4MB as requested
});
