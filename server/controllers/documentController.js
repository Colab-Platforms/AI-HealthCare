const MedicalDocument = require('../models/MedicalDocument');
const HealthReport = require('../models/HealthReport');
const cloudinaryService = require('../services/cloudinary');
const fs = require('fs');
const { logActivity } = require('../utils/activityLogger');
const { encrypt, decrypt } = require('../utils/encryption');

exports.uploadDocument = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const { title, category, documentDate, notes, hospital, doctorName, tags, isFavorite } = req.body;
        
        if (!title) return res.status(400).json({ message: 'Title is required' });

        const dataBuffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);

        const encryptedBuffer = encrypt(dataBuffer);
        // Wrap as base64 data URI so Cloudinary stores it as a raw file without type detection
        let cloudinaryUrl = null;
        try {
            cloudinaryUrl = await cloudinaryService.uploadRaw(encryptedBuffer, 'medical_documents');
        } catch (e) {
            console.error('Cloudinary fail:', e.message);
            return res.status(500).json({ message: 'Failed to upload document to cloud storage' });
        }

        let parsedTags = [];
        if (tags) {
            try {
                parsedTags = Array.isArray(tags) ? tags : JSON.parse(tags);
            } catch (e) {
                if (typeof tags === 'string') {
                    parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
                }
            }
        }

        const doc = await MedicalDocument.create({
            userId: req.user._id,
            title,
            category: category || 'other',
            documentDate: documentDate || new Date(),
            notes: notes || '',
            fileUrl: cloudinaryUrl,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size || (dataBuffer ? dataBuffer.length : 0),
            hospital: hospital || '',
            doctorName: doctorName || '',
            isFavorite: isFavorite === 'true' || isFavorite === true,
            tags: parsedTags,
            isEncrypted: true
        });

        // Log medical activity
        await logActivity(req.user._id, 'UPLOAD_MEDICAL_DOCUMENT', 'medical', {
            title,
            category: category || 'other',
            fileName: req.file.originalname,
            fileSize: req.file.size
        });

        res.status(201).json({ message: 'Document stored securely', document: doc });
    } catch (error) {
        console.error('Document upload error:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.getDocuments = async (req, res) => {
    try {
        const { category, search, hospital, doctor, tags, dateFrom, dateTo } = req.query;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

        // --- MedicalDocument query ---
        let mdQuery = { userId: req.user._id };
        if (category && category !== 'all' && category !== 'lab_report' && category !== 'prescription') {
            mdQuery.category = category;
        }
        if (search) mdQuery.title = { $regex: search, $options: 'i' };
        if (hospital) mdQuery.hospital = { $regex: hospital, $options: 'i' };
        if (doctor) mdQuery.doctorName = { $regex: doctor, $options: 'i' };
        if (tags) {
            const tagArr = tags.split(',').map(t => t.trim()).filter(Boolean);
            if (tagArr.length) mdQuery.tags = { $all: tagArr };
        }
        if (dateFrom || dateTo) {
            mdQuery.documentDate = {};
            if (dateFrom) mdQuery.documentDate.$gte = new Date(dateFrom);
            if (dateTo) { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); mdQuery.documentDate.$lte = d; }
        }

        const mdDocs = await MedicalDocument.find(mdQuery).sort({ documentDate: -1, createdAt: -1 });
        const vaultDocs = mdDocs.map(doc => ({ ...doc.toObject(), isAnalyzedReport: false }));

        // --- HealthReport query ---
        let reports = [];
        if (!category || category === 'all' || category === 'lab_report' || category === 'prescription') {
            const reportQuery = { user: req.user._id };
            if (search) reportQuery['originalFile.filename'] = { $regex: search, $options: 'i' };
            if (category === 'prescription') reportQuery.isPrescription = true;
            else if (category === 'lab_report') reportQuery.isPrescription = { $ne: true };

            const foundReports = await HealthReport.find(reportQuery).sort({ createdAt: -1 });
            reports = foundReports.map(r => ({
                _id: r._id,
                userId: r.user,
                title: r.originalFile?.filename || (r.isPrescription ? 'Prescription' : 'Lab Report'),
                category: r.isPrescription ? 'prescription' : 'lab_report',
                documentDate: r.reportDate || r.createdAt,
                notes: r.aiAnalysis?.summary || 'AI Analyzed Report',
                fileUrl: r.originalFile?.cloudinaryUrl || r.originalFile?.path,
                originalName: r.originalFile?.filename,
                mimetype: r.originalFile?.mimetype,
                size: 0,
                isAnalyzedReport: true,
                status: r.status,
                hospital: r.prescriptionDetails?.clinicName || r.pastLabDetails?.labName || 'AI Health Lab',
                doctorName: r.prescriptionDetails?.doctorName || 'AI Consultant',
                isFavorite: false,
                tags: ['AI Analyzed', r.reportType || (r.isPrescription ? 'Prescription' : 'Lab Report')]
            }));
        }

        // Merge + sort latest first
        const combined = [...vaultDocs, ...reports].sort((a, b) =>
            new Date(b.documentDate) - new Date(a.documentDate)
        );

        // Global stats (always across all unfiltered docs for accurate sidebar counts)
        const [totalMd, totalHr, recentMd, recentHr] = await Promise.all([
            MedicalDocument.countDocuments({ userId: req.user._id }),
            HealthReport.countDocuments({ user: req.user._id }),
            MedicalDocument.countDocuments({ userId: req.user._id, createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
            HealthReport.countDocuments({ user: req.user._id, createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
        ]);

        const total = combined.length;
        const pages = Math.ceil(total / limit) || 1;
        const paginated = combined.slice((page - 1) * limit, page * limit);

        res.json({
            documents: paginated,
            total,
            page,
            pages,
            stats: {
                total: totalMd + totalHr,
                aiCount: totalHr,
                vaultCount: totalMd,
                recent: recentMd + recentHr,
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateDocument = async (req, res) => {
    try {
        const document = await MedicalDocument.findOne({ _id: req.params.id, userId: req.user._id });
        if (!document) return res.status(404).json({ message: 'Document not found' });

        const { title, category, documentDate, notes, hospital, doctorName, isFavorite, tags } = req.body;

        if (title !== undefined) document.title = title;
        if (category !== undefined) document.category = category;
        if (documentDate !== undefined) document.documentDate = documentDate;
        if (notes !== undefined) document.notes = notes;
        if (hospital !== undefined) document.hospital = hospital;
        if (doctorName !== undefined) document.doctorName = doctorName;
        if (isFavorite !== undefined) document.isFavorite = isFavorite;
        
        if (tags !== undefined) {
            try {
                document.tags = Array.isArray(tags) ? tags : JSON.parse(tags);
            } catch (e) {
                if (typeof tags === 'string') {
                    document.tags = tags.split(',').map(t => t.trim()).filter(Boolean);
                }
            }
        }

        await document.save();

        res.json({ message: 'Document updated successfully', document });
    } catch (error) {
        console.error('Update document error:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.deleteDocument = async (req, res) => {
    try {
        const document = await MedicalDocument.findOne({ _id: req.params.id, userId: req.user._id });
        if (!document) return res.status(404).json({ message: 'Document not found' });
        
        // At this point, we just delete the db record. In a real physical scenario, we'd delete from Cloudinary too.
        await MedicalDocument.deleteOne({ _id: document._id });
        
        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Generate a private download URL for a document
 * Instead of proxying the file through the server, this generates a signed URL
 * that the client can use to download directly from Cloudinary.
 * This removes the server as a bottleneck and scales much better.
 */
exports.getDocumentDownloadUrl = async (req, res) => {
    try {
        const docId = req.params.id;
        const isReport = req.query.type === 'report';
        let fileUrl = null;
        let filename = 'document';

        if (isReport) {
            const report = await HealthReport.findOne({ _id: docId, user: req.user._id });
            if (!report) return res.status(404).json({ message: 'Report not found' });
            fileUrl = report.originalFile?.cloudinaryUrl || report.originalFile?.path;
            filename = report.originalFile?.filename || 'report';
        } else {
            const document = await MedicalDocument.findOne({ _id: docId, userId: req.user._id });
            if (!document) return res.status(404).json({ message: 'Document not found' });
            // Encrypted vault docs must go through server proxy for decryption
            if (document.isEncrypted) {
                return res.json({
                    downloadUrl: `/api/documents/${docId}/file`,
                    filename: document.originalName || document.title || 'document',
                    expiresIn: 'session'
                });
            }
            fileUrl = document.fileUrl;
            filename = document.originalName || document.title || 'document';
        }

        if (!fileUrl) {
            return res.status(404).json({ message: 'No file URL found for this document' });
        }

        // Extract public ID and extension from Cloudinary URL
        const regex = /res\.cloudinary\.com\/[^\/]+\/([^\/]+)\/([^\/]+)\/(?:v\d+\/)?(.+?)(?:\.([^.]+))?$/;
        const match = fileUrl.match(regex);

        if (!match) {
            console.error('❌ Could not parse Cloudinary URL:', fileUrl);
            return res.status(400).json({ message: 'Invalid file URL format' });
        }

        const resourceType = match[1]; // e.g. 'image'
        const publicId = match[3];      // e.g. 'fitcure/medical_documents/file_d4gl9f'
        const ext = match[4] || 'pdf';  // e.g. 'pdf'

        try {
            const { cloudinary } = cloudinaryService;
            
            // Generate a private download URL (valid for 24 hours)
            const downloadUrl = cloudinary.utils.private_download_url(publicId, ext, {
                resource_type: resourceType,
                type: 'upload',
                expires_at: Math.round(Date.now() / 1000) + (24 * 3600) // 24 hours
            });

            console.log('✅ Generated private download URL for:', filename);
            res.json({ 
                downloadUrl,
                filename,
                expiresIn: '24 hours'
            });
        } catch (err) {
            console.error('❌ Error generating private URL:', err.message);
            return res.status(500).json({ message: 'Failed to generate download URL' });
        }
    } catch (error) {
        console.error('❌ Error in getDocumentDownloadUrl:', error.message);
        res.status(500).json({ message: 'Failed to generate download URL: ' + error.message });
    }
};

/**
 * Proxy endpoint to fetch a document file from Cloudinary and stream it to the client.
 * This bypasses 401 Unauthorized errors that occur when the browser tries to directly 
 * access Cloudinary URLs with restricted access modes (e.g., authenticated delivery).
 * 
 * Supports both MedicalDocument (custom uploads) and HealthReport (AI-analyzed reports).
 */
exports.getDocumentFile = async (req, res) => {
    try {
        const docId = req.params.id;
        const isReport = req.query.type === 'report';
        let fileUrl = null;
        let mimetype = 'application/octet-stream';
        let filename = 'document';

        if (isReport) {
            const report = await HealthReport.findOne({ _id: docId, user: req.user._id });
            if (!report) return res.status(404).json({ message: 'Report not found' });
            fileUrl = report.originalFile?.cloudinaryUrl || report.originalFile?.path;
            mimetype = report.originalFile?.mimetype || 'application/pdf';
            filename = report.originalFile?.filename || 'report';
        } else {
            const document = await MedicalDocument.findOne({ _id: docId, userId: req.user._id });
            if (!document) return res.status(404).json({ message: 'Document not found' });
            fileUrl = document.fileUrl;
            mimetype = document.mimetype || 'application/pdf';
            filename = document.originalName || document.title || 'document';
        }

        if (!fileUrl) {
            return res.status(404).json({ message: 'No file URL found for this document' });
        }

        const axios = require('axios');
        let fetchUrl = fileUrl;
        let fetchOptions = { responseType: 'stream', timeout: 30000 };

        // For Cloudinary URLs, use private_download_url to download through the API endpoint
        // This bypasses ALL CDN delivery restrictions because it goes through api.cloudinary.com
        if (fileUrl.includes('res.cloudinary.com')) {
            try {
                const { cloudinary } = cloudinaryService;
                // Extract: resource_type, public_id, extension from the Cloudinary URL
                const regex = /res\.cloudinary\.com\/[^\/]+\/([^\/]+)\/([^\/]+)\/(?:v\d+\/)?(.+?)(?:\.([^.]+))?$/;
                const match = fileUrl.match(regex);

                if (match) {
                    const resourceType = match[1]; // e.g. 'image'
                    const publicId = match[3];      // e.g. 'fitcure/medical_documents/file_d4gl9f'
                    const ext = match[4] || 'pdf';  // e.g. 'pdf'

                    // private_download_url generates a URL like:
                    // https://api.cloudinary.com/v1_1/{cloud}/image/download?api_key=...&public_id=...&signature=...&timestamp=...
                    // This goes through the API, NOT the CDN, so delivery restrictions don't apply
                    fetchUrl = cloudinary.utils.private_download_url(publicId, ext, {
                        resource_type: resourceType,
                        type: 'upload',
                        expires_at: Math.round(Date.now() / 1000) + 300 // 5 min expiry
                    });

                    console.log('🔐 Generated Cloudinary private download URL (via api.cloudinary.com)');
                }
            } catch (err) {
                console.error('private_download_url generation failed, falling back to direct URL:', err.message);
                // fetchUrl stays as original fileUrl
            }
        }

        console.log('📥 Fetching file via proxy...');

        const response = await axios.get(fetchUrl, fetchOptions);

        console.log('✅ File fetched successfully, streaming to client');

        // Collect stream into buffer to decrypt if needed
        const needsDecrypt = !isReport && (await MedicalDocument.findOne({ _id: req.params.id, userId: req.user._id }))?.isEncrypted;
        if (needsDecrypt) {
            const chunks = [];
            response.data.on('data', chunk => chunks.push(chunk));
            response.data.on('end', () => {
                try {
                    const decrypted = decrypt(Buffer.concat(chunks));
                    res.setHeader('Content-Type', mimetype);
                    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
                    res.setHeader('Content-Length', decrypted.length);
                    res.end(decrypted);
                } catch (e) {
                    console.error('❌ Decryption failed:', e.message);
                    res.status(500).json({ message: 'Failed to decrypt document' });
                }
            });
            return;
        }

        res.setHeader('Content-Type', mimetype);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }

        response.data.pipe(res);
    } catch (error) {
        console.error('❌ Document file proxy error:', error.message);
        console.error('Error details:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            url: error.config?.url
        });
        
        if (error.response?.status === 401 || error.response?.status === 403) {
            return res.status(403).json({ message: 'File access denied. The file storage may have restricted access.' });
        }
        if (error.response?.status === 404) {
            return res.status(404).json({ message: 'File not found on storage server' });
        }
        res.status(500).json({ message: 'Failed to retrieve document file: ' + error.message });
    }
};
