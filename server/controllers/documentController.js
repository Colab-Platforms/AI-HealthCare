const MedicalDocument = require('../models/MedicalDocument');
const HealthReport = require('../models/HealthReport');
const cloudinary = require('../services/cloudinary');
const fs = require('fs');

exports.uploadDocument = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const { title, category, documentDate, notes } = req.body;
        
        if (!title) return res.status(400).json({ message: 'Title is required' });

        const dataBuffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
        
        let cloudinaryUrl = null;
        try {
            cloudinaryUrl = await cloudinary.uploadImage(dataBuffer, 'medical_documents');
        } catch (e) {
            console.error('Cloudinary fail:', e.message);
            return res.status(500).json({ message: 'Failed to upload document to cloud storage' });
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
            size: req.file.size || (dataBuffer ? dataBuffer.length : 0)
        });

        res.status(201).json({ message: 'Document stored securely', document: doc });
    } catch (error) {
        console.error('Document upload error:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.getDocuments = async (req, res) => {
    try {
        const { category, search } = req.query;
        let query = { userId: req.user._id };

        if (category && category !== 'all') {
            query.category = category;
        }
        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }

        // 1. Fetch from MedicalDocument
        const documents = await MedicalDocument.find(query).sort({ documentDate: -1, createdAt: -1 });
        
        // 2. Fetch from HealthReport if category is 'all' or 'lab_report'
        let reports = [];
        if (!category || category === 'all' || category === 'lab_report') {
            const reportQuery = { user: req.user._id };
            if (search) {
                reportQuery['originalFile.filename'] = { $regex: search, $options: 'i' };
            }
            const foundReports = await HealthReport.find(reportQuery).sort({ createdAt: -1 });
            
            reports = foundReports.map(r => ({
                _id: r._id,
                userId: r.user,
                title: r.originalFile?.filename || 'Lab Report',
                category: 'lab_report',
                documentDate: r.reportDate || r.createdAt,
                notes: r.aiAnalysis?.summary || 'AI Analyzed Report',
                fileUrl: r.originalFile?.cloudinaryUrl || r.originalFile?.path,
                originalName: r.originalFile?.filename,
                mimetype: r.originalFile?.mimetype,
                size: 0, 
                isAnalyzedReport: true, // Special flag for frontend behavior
                status: r.status
            }));
        }

        // Merge and sort
        const combined = [...documents, ...reports].sort((a, b) => 
            new Date(b.documentDate) - new Date(a.documentDate)
        );

        res.json({ documents: combined });
    } catch (error) {
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
