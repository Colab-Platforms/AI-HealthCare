const express = require('express');
const router = express.Router();
const { uploadDocument, getDocuments, deleteDocument, updateDocument, getDocumentFile } = require('../controllers/documentController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Use multer 'document' field to parse the file
router.post('/', protect, upload.single('document'), uploadDocument);
router.get('/', protect, getDocuments);
router.get('/:id/file', protect, getDocumentFile); // Proxy endpoint for file streaming
router.put('/:id', protect, updateDocument);
router.delete('/:id', protect, deleteDocument);

module.exports = router;

