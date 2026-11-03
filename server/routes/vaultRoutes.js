const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { vaultWriteLimiter, apiLimiter } = require('../middleware/rateLimit');
const vault = require('../controllers/vaultController');
const shares = require('../controllers/vaultShareController');

// Medical Vault v1 (mobile). Replaces /api/documents, which stays until the app migrates.
router.use(protect);
router.use(apiLimiter);

router.get('/home', vault.getHome);
router.get('/usage', vault.getUsage);
router.get('/timeline', vault.getTimeline);

// Folders
router.post('/folders', vault.createFolder);
router.get('/folders/:id', vault.getFolder);
router.patch('/folders/:id', vault.updateFolder);
router.delete('/folders/:id', vault.deleteFolder); // ?mode=move|delete when the folder has reports
router.get('/folders/:id/reports', vault.listFolderReports);

// Upload: sign -> app uploads straight to Cloudinary -> finalize
router.post('/uploads/sign', vaultWriteLimiter, vault.signUploads);
router.post('/reports', vaultWriteLimiter, vault.createReports);

// Reports
router.get('/reports', vault.listReports);
router.get('/reports/:id', vault.getReport);
router.patch('/reports/:id', vault.updateReport);
router.delete('/reports/:id', vault.deleteReport);
router.get('/reports/:id/file', vault.getReportFile);
router.get('/reports/:id/download', vault.getReportDownload);

// Share links
router.post('/reports/:id/shares', vaultWriteLimiter, shares.createShare);
router.get('/reports/:id/shares', shares.listShares);
router.delete('/shares/:shareId', shares.revokeShare);

module.exports = router;
